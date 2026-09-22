/**
 * The run, and the controller that carries the player's input into it.
 *
 * Below this is a world and what lives in it. This is where experience, class
 * choices, cards and perks are attached to that world, and where the decisions
 * that hold play are queued. The app, the tests and the balance tools all build
 * a `Run`, which is why its options carry overrides the game itself never uses.
 */

import { Rng } from '../core/rng.ts';
import type { Intent } from '../core/input.ts';
import { World, DEFAULT_ARENA_HALF_SIZE, squareArena } from './world.ts';
import { resolveContacts } from './physics.ts';
import { Tank, type Controller, type TankIntent } from './tank.ts';
import { Shape } from './shape.ts';
import { Projectile, raiseNecroDrone } from './projectiles.ts';
import { getTank, ROOT_TANK_ID, upgradeChoices } from '../data/tanks.ts';
import { CARD_LEVELS, CLASS_LEVELS, levelForXp, MAX_LEVEL, xpForLevel } from '../data/leveling.ts';
import type { DifficultyId } from '../core/storage.ts';
import { DIFFICULTIES, arenaSizeForWave, type Difficulty } from '../data/waves.ts';
import { WaveDirector, type WarningRing } from './waves.ts';
import { PerkSet } from './perks.ts';
import { xpMultiplierFor, type PerkDefinition, type PerkHost } from './perkImpl.ts';
import { dealCards, type Card } from '../data/cards.ts';
import { aiContext } from './ai.ts';
import { lerp, vec, type Vec2 } from '../core/math.ts';

/** A decision waiting on the player, which holds the simulation while it stands. */
export type PendingChoice = 'class' | 'card';

/**
 * Eases one arena axis toward its target, snapping once the gap stops showing.
 *
 * The snap matters more than it looks: without it the border creeps by
 * fractions of a unit forever, and anything that asks whether the arena has
 * finished moving never gets a yes.
 */
const easeArenaAxis = (current: number, target: number, rate: number): number =>
  Math.abs(current - target) < 0.5 ? target : lerp(current, target, rate);

/** Drives the player's tank from the sampled input. */
class PlayerController implements Controller {
  intent: TankIntent = {
    moveX: 0,
    moveY: 0,
    aimAngle: 0,
    fire: false,
    secondary: false,
    aimAt: vec(),
  };

  tick(): TankIntent {
    return this.intent;
  }
}

export interface RunOptions {
  seed: number;
  difficulty: DifficultyId;
  color: string;
  playerName?: string;
  /**
   * Fields of the chosen difficulty to replace, for the harnesses.
   *
   * A difficulty is a table of constants the game never varies at runtime, which
   * is right for the game and useless for measuring one of them: asking what a
   * card rate does means running the same seed at several, and the alternative
   * is mutating the shared table underneath every run in the process.
   */
  difficultyOverrides?: Partial<Difficulty>;
}

/** How a run ended. */
export type RunOutcome = 'alive' | 'died' | 'won';

/**
 * One attempt: a world, a player, and the progression wrapped around them.
 *
 * The run owns experience, levelling, the waves and the perks. It knows nothing
 * about rendering or input devices, which is what lets the same run be driven by
 * a keyboard, a thumb, or a test.
 */
export class Run implements PerkHost {
  readonly world: World;
  readonly player: Tank;
  readonly rng: Rng;
  readonly seed: number;
  readonly difficultyId: DifficultyId;
  readonly difficulty: Difficulty;
  readonly waves: WaveDirector;
  readonly perks = new PerkSet();

  xp = 0;
  score = 0;
  level = 1;

  /** Rerolls the player may spend on a hand of cards. */
  rerolls = 0;

  /** Decisions earned but not yet made, in the order they should be offered. */
  readonly pendingChoices: PendingChoice[] = [];
  /** The hand currently on offer, while a card choice is open. */
  hand: Card[] = [];

  outcome: RunOutcome = 'alive';
  /** Ticks since the player died, so the explosion can finish. */
  ticksSinceDeath = 0;

  /** Levels whose class upgrade has already been offered. */
  private readonly classLevelsSeen = new Set<number>();
  private readonly control = new PlayerController();
  private readonly cardRng: Rng;
  /** Tracks the secondary button so a dash fires once per press, not per tick. */
  private secondaryWasDown = false;

  constructor(options: RunOptions) {
    this.seed = options.seed;
    this.difficultyId = options.difficulty;
    this.difficulty = { ...DIFFICULTIES[options.difficulty], ...options.difficultyOverrides };
    this.rng = new Rng(options.seed);
    this.cardRng = this.rng.fork('cards');

    this.world = new World(this.rng.fork('sim'));
    this.world.arena = squareArena(DEFAULT_ARENA_HALF_SIZE);

    this.player = new Tank(getTank(ROOT_TANK_ID), 1, this.control, options.color);
    this.player.team = 'player';
    // The two perk hooks that fire inside the simulation rather than from an
    // event: one on every shot built, one on every stat refresh.
    this.player.shotModifier = (stats, mods) => this.perks.modifyProjectile(stats, mods);
    this.player.statModifier = (stats) => this.perks.modifyStats(stats);
    this.player.name = options.playerName ?? '';
    this.world.spawn(this.player);

    Shape.target = this.player;
    aiContext.target = this.player;

    this.world.events.on('entityKilled', ({ victim, killer }) => this.onKill(victim, killer));
    this.world.events.on('damageTaken', ({ victim, amount, source }) => {
      if (victim === this.player) this.onPlayerHit(amount, source);
      // A shot of the player's landing on something. Both directions of a
      // collision are reported, so the owner is what tells them apart: the
      // return damage has the victim as its source, not a projectile.
      if (source instanceof Projectile && source.rootOwner() === this.player) {
        this.perks.projectileHit(source, victim, this.world);
      }
    });

    this.waves = new WaveDirector(
      this.world,
      this.player,
      this.rng.fork('waves'),
      this.difficulty,
      {
        onWaveStart: () => {},
        onWaveClear: () => this.perks.waveClear(this.world),
        onRunWon: () => {
          this.outcome = 'won';
        },
      },
    );
    this.waves.start();
  }

  // --- What the interface reads ---------------------------------------------

  /** The arena modifier on the current wave, for the heads-up display. */
  get modifierName(): string | null {
    return this.waves.modifierName;
  }

  /** Where the authored last fight has got to, or null when it is not running. */
  get finale(): { phase: string; culled: number } | null {
    return this.waves.finaleReport;
  }

  /** A one-off announcement from the wave layer, with a counter to spot repeats. */
  get banner(): { text: string; id: number } {
    return this.waves.banner;
  }

  get wave(): number {
    return this.waves.wave;
  }

  get countdown(): number {
    return this.waves.countdownSeconds;
  }

  get bossName(): string | null {
    return this.waves.bossName;
  }

  get warnings(): WarningRing[] {
    return this.waves.warnings();
  }

  get enemiesLeft(): number {
    return this.waves.remaining;
  }

  get over(): boolean {
    return this.outcome !== 'alive';
  }

  /** True while a decision is outstanding, which is when the app holds the sim. */
  get waitingOnChoice(): boolean {
    return this.pendingChoices.length > 0;
  }

  // --- Input ----------------------------------------------------------------

  /** Feeds this frame's input to the player's tank. */
  applyIntent(intent: Intent, aimAngle: number): void {
    const c = this.control.intent;
    c.moveX = intent.move.x;
    c.moveY = intent.move.y;
    c.aimAngle = aimAngle;
    c.fire = intent.fire;
    // Drones fly to the cursor itself, not to the direction the hull faces.
    c.aimAt = intent.aimWorld;

    // A perk may claim the secondary button, and only on the press itself.
    const pressed = intent.secondary && !this.secondaryWasDown;
    this.secondaryWasDown = intent.secondary;
    c.secondary = intent.secondary;
    if (pressed && this.perks.secondary(this.world)) c.secondary = false;
  }

  // --- Simulation -----------------------------------------------------------

  tick(): void {
    if (this.over) return;

    this.world.step(resolveContacts, () => this.tweenArena());
    this.perks.tick(this.world);

    if (!this.player.alive) {
      this.ticksSinceDeath++;
      // Let the explosion play out before the run reports itself finished.
      if (this.ticksSinceDeath > 38) this.outcome = 'died';
      return;
    }

    this.waves.tick();
  }

  /**
   * Eases the arena toward its target shape after a boss widens it.
   *
   * Per axis, so a border that moves on one axis and holds on the other arrives
   * as one motion rather than as a square that briefly bulges on the way.
   */
  private tweenArena(): void {
    const arena = this.world.arena;
    arena.half.x = easeArenaAxis(arena.half.x, arena.targetHalf.x, arena.ease);
    arena.half.y = easeArenaAxis(arena.half.y, arena.targetHalf.y, arena.ease);
  }

  // --- Progression ----------------------------------------------------------

  /** Awards experience and processes any levels it buys. */
  addXp(amount: number): void {
    if (amount <= 0 || this.level >= MAX_LEVEL) return;
    this.xp += amount * xpMultiplierFor(this.perks.stacksOf('scholar')) * this.difficulty.xpBonus;

    const newLevel = levelForXp(this.xp);
    while (this.level < newLevel) {
      this.level++;
      this.player.setLevel(this.level);
      // Boss scaling reads the player's level, so keep the director current.
      this.waves.playerLevel = this.level;
      this.world.events.emit('levelUp', { level: this.level });
      // A class upgrade is offered before the card earned at the same level, so
      // the card can be spent knowing what the tank has become.
      if (CLASS_LEVELS.includes(this.level) && !this.classLevelsSeen.has(this.level)) {
        this.classLevelsSeen.add(this.level);
        if (this.player.def.upgradesTo.length > 0) this.pendingChoices.push('class');
      }
      if (CARD_LEVELS.has(this.level)) this.pendingChoices.push('card');
    }
  }

  addScore(amount: number): void {
    this.score += amount;
  }

  grantReroll(): void {
    this.rerolls++;
  }

  /** Takes the class upgrade the player chose. */
  upgradeTo(tankId: string): void {
    const def = getTank(tankId);
    const refunded = this.player.upgradeTo(def);
    // Points stranded on stats the new class does not have come back as cards.
    for (let i = 0; i < refunded; i++) this.pendingChoices.push('card');
    this.consumeChoice('class');
  }

  /** Removes the front choice of the given kind once it has been resolved. */
  consumeChoice(kind: PendingChoice): void {
    const index = this.pendingChoices.indexOf(kind);
    if (index >= 0) this.pendingChoices.splice(index, 1);
  }

  /** The class options available right now, empty when there is no choice to make. */
  classOptions(): string[] {
    return upgradeChoices(this.player.def.id, this.level).map((def) => def.id);
  }

  /**
   * The next level at which a class choice comes round, or null if none remain.
   *
   * Turning an upgrade down is a legitimate play: staying Basic through level 15
   * is the only way to reach Smasher, so the panel needs to say when the next
   * chance arrives rather than implying the offer is final.
   */
  nextClassLevel(): number | null {
    for (const level of CLASS_LEVELS) {
      if (level > this.level && !this.classLevelsSeen.has(level)) return level;
    }
    return null;
  }

  // --- Cards ----------------------------------------------------------------

  /** Deals a fresh hand for the pending card choice. */
  dealHand(): Card[] {
    this.hand = dealCards({
      def: this.player.def,
      points: this.player.points,
      perks: this.perks,
      host: this,
      difficulty: this.difficulty,
      rng: this.cardRng,
    });
    return this.hand;
  }

  /** Spends a reroll on a new hand. Returns false when none are left. */
  reroll(): boolean {
    if (this.rerolls <= 0) return false;
    this.rerolls--;
    this.dealHand();
    return true;
  }

  /** Applies the card the player picked and clears the choice. */
  takeCard(card: Card): void {
    switch (card.kind) {
      case 'stat':
        this.player.points[card.stat]++;
        this.player.refresh();
        break;
      case 'perk':
        this.addPerk(card.perk);
        break;
      case 'heal':
        this.player.health = Math.min(
          this.player.maxHealth,
          this.player.health + this.player.maxHealth * card.amount,
        );
        break;
    }
    this.hand = [];
    this.consumeChoice('card');
  }

  private addPerk(def: PerkDefinition): void {
    // Taking a perk again stacks the one already held rather than adding a second.
    if (this.perks.has(def.id)) this.perks.add({ id: def.id, stacks: 1 });
    else this.perks.add(def.create(this));
    this.player.refresh();
  }

  /** Perks taken so far, for the run summary. */
  perkSummary(): { id: string; stacks: number }[] {
    return this.perks.all.map((p) => ({ id: p.id, stacks: p.stacks }));
  }

  // --- Events ---------------------------------------------------------------

  /**
   * Lets defensive perks take back some of a hit the player just received.
   *
   * Damage is applied first and refunded here rather than being intercepted,
   * which keeps every source of damage going through one path.
   */
  private onPlayerHit(amount: number, source: unknown): void {
    const reduced = this.perks.damageTaken(amount, (source as never) ?? null, this.world);
    const refund = amount - reduced;
    if (refund > 0) {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + refund);
      if (this.player.health > 0) this.player.alive = true;
    }
  }

  private onKill(victim: unknown, killer: unknown): void {
    const byPlayer = killer === this.player;

    if (victim instanceof Shape) {
      victim.explode(this.world);
      this.waves.forget(victim);
      if (byPlayer) {
        this.addXp(victim.xp);
        this.score += victim.xp;
        this.tryRaise(victim);
        this.perks.enemyKilled(victim, this.world);
      }
      return;
    }

    if (victim instanceof Tank) {
      victim.explode(this.world);
      this.waves.forget(victim);
      if (victim === this.player) {
        this.world.events.emit('playerDied', {});
        return;
      }
      if (byPlayer) {
        const reward = victim.bossXp || Math.round(victim.maxHealth * 1.5);
        this.addXp(reward);
        this.score += reward;
        this.perks.enemyKilled(victim, this.world);
      }
      return;
    }

    if (victim instanceof Projectile) {
      this.waves.forget(victim);
    }
  }

  /**
   * Raises a killed square as a drone, for a tank that claims them.
   *
   * This is the Necromancer's whole weapon: its spawners never fire, so without
   * this it would have no fleet at all.
   */
  private tryRaise(victim: Shape): void {
    if (!this.player.def.flags.necroCapture) return;
    if (victim.def.kind !== 'square') return;
    const barrels = this.player.necroBarrels();
    if (!barrels.length) return;
    // Spread the fleet across the spawners so one does not fill up alone.
    const barrel = barrels.reduce((a, b) => (b.liveCount < a.liveCount ? b : a));
    raiseNecroDrone(
      this.world,
      this.player,
      this.player,
      barrel,
      this.player.points,
      this.player.scale(),
      victim.pos,
      this.player.color,
    );
  }

  /**
   * Grants a level outright. Used by the Shift+L debug key,
   * which is not gated to dev builds and works on the live site too.
   */
  debugGrantLevel(): void {
    if (this.level >= MAX_LEVEL) return;
    this.addXp(Math.max(1, xpForLevel(this.level + 1) - this.xp));
  }

  /** Where the player is, for anything that needs to follow them. */
  get focus(): Vec2 {
    return this.player.pos;
  }

  /**
   * Tells the run how much world the camera can show.
   *
   * The arena is sized against this so the playfield is comparable on a phone
   * and a monitor, rather than fixed in units and therefore invisible on one.
   */
  setViewReference(halfWidthInUnits: number): void {
    this.waves.viewReference = halfWidthInUnits;
    // Through the director, not around it: a window resized in the middle of the
    // last fight must not hand the arena back its square.
    const target = this.waves.arenaTarget(arenaSizeForWave(this.wave || 1, halfWidthInUnits));
    this.world.arena.targetHalf = target;
    // The opening frame should not start mid-tween.
    if (this.world.tick < 2) this.world.arena.half = vec(target.x, target.y);
  }
}
