import { Rng } from '../core/rng.ts';
import type { Intent } from '../core/input.ts';
import { World, DEFAULT_ARENA_HALF_SIZE } from './world.ts';
import { resolveContacts } from './physics.ts';
import { Tank, type Controller, type TankIntent } from './tank.ts';
import { Shape } from './shape.ts';
import { Projectile } from './projectiles.ts';
import { getTank, ROOT_TANK_ID } from '../data/tanks.ts';
import { CARD_LEVELS, CLASS_LEVELS, levelForXp, MAX_LEVEL } from '../data/leveling.ts';
import type { ShapeKind } from '../data/shapes.ts';
import { SHINY_CHANCE } from '../data/shapes.ts';
import type { DifficultyId } from '../core/storage.ts';
import { lerp, vec, type Vec2 } from '../core/math.ts';

/** A decision waiting on the player, which holds the simulation while it stands. */
export type PendingChoice = 'class' | 'card';

/** Drives the player's tank from the sampled input. */
class PlayerController implements Controller {
  intent: TankIntent = {
    moveX: 0,
    moveY: 0,
    aimAngle: 0,
    fire: false,
    secondary: false,
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
}

/**
 * One attempt: a world, a player, and the progression wrapped around them.
 *
 * The run owns experience and levelling, queues the choices a level-up earns,
 * and keeps the arena stocked. It knows nothing about rendering or input
 * devices, which is what lets the same run be driven by a keyboard or a thumb.
 */
export class Run {
  readonly world: World;
  readonly player: Tank;
  readonly rng: Rng;
  readonly seed: number;
  readonly difficulty: DifficultyId;

  xp = 0;
  score = 0;
  level = 1;

  /** Decisions earned but not yet made, in the order they should be offered. */
  readonly pendingChoices: PendingChoice[] = [];

  /** Levels whose class upgrade has already been offered, so it is offered once. */
  private readonly classLevelsSeen = new Set<number>();

  over = false;
  /** Ticks since the player died, so the explosion can finish before the screen changes. */
  ticksSinceDeath = 0;

  private readonly control = new PlayerController();
  private readonly shapeRng: Rng;

  /** How many shapes to keep in the arena. Waves will take this over in Phase 3. */
  targetShapeCount = 28;

  constructor(options: RunOptions) {
    this.seed = options.seed;
    this.difficulty = options.difficulty;
    this.rng = new Rng(options.seed);
    this.shapeRng = this.rng.fork('shapes');

    this.world = new World(this.rng.fork('sim'));
    this.world.arena = { halfSize: DEFAULT_ARENA_HALF_SIZE, targetHalfSize: DEFAULT_ARENA_HALF_SIZE };

    this.player = new Tank(getTank(ROOT_TANK_ID), 1, this.control, options.color);
    this.player.team = 'player';
    this.player.name = options.playerName ?? '';
    this.world.spawn(this.player);
    Shape.target = this.player;

    this.world.events.on('entityKilled', ({ victim, killer }) => this.onKill(victim, killer));

    this.fillShapes(true);
  }

  /** True while a decision is outstanding, which is when the app holds the sim. */
  get waitingOnChoice(): boolean {
    return this.pendingChoices.length > 0;
  }

  /** Feeds this frame's input to the player's tank. */
  applyIntent(intent: Intent, aimAngle: number): void {
    const c = this.control.intent;
    c.moveX = intent.move.x;
    c.moveY = intent.move.y;
    c.aimAngle = aimAngle;
    c.fire = intent.fire;
    c.secondary = intent.secondary;
  }

  /** Advances the simulation one tick. */
  tick(): void {
    if (this.over) return;

    this.world.step(resolveContacts, () => this.tweenArena());

    if (!this.player.alive) {
      this.ticksSinceDeath++;
      // Let the explosion play out before the run reports itself finished.
      if (this.ticksSinceDeath > 38) this.over = true;
      return;
    }

    this.fillShapes(false);
  }

  /** Eases the arena toward its target size after a boss widens it. */
  private tweenArena(): void {
    const arena = this.world.arena;
    if (Math.abs(arena.halfSize - arena.targetHalfSize) < 0.5) {
      arena.halfSize = arena.targetHalfSize;
      return;
    }
    arena.halfSize = lerp(arena.halfSize, arena.targetHalfSize, 0.02);
  }

  /** Awards experience and processes any levels it buys. */
  addXp(amount: number): void {
    if (amount <= 0 || this.level >= MAX_LEVEL) return;
    this.xp += amount;
    const newLevel = levelForXp(this.xp);
    while (this.level < newLevel) {
      this.level++;
      this.player.setLevel(this.level);
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
    return this.player.def.upgradesTo.filter((id) => this.level >= getTank(id).unlockLevel);
  }

  private onKill(victim: unknown, killer: unknown): void {
    if (victim instanceof Shape) {
      victim.explode(this.world);
      if (killer === this.player) {
        this.addXp(victim.xp);
        this.score += victim.xp;
      }
      return;
    }
    if (victim instanceof Tank) {
      victim.explode(this.world);
      if (victim === this.player) {
        this.world.events.emit('playerDied', {});
      } else if (killer === this.player) {
        const reward = Math.round(victim.maxHealth * 2);
        this.addXp(reward);
        this.score += reward;
      }
      return;
    }
    if (victim instanceof Projectile) {
      // Projectiles clean up after themselves; nothing further to do here.
    }
  }

  /** Keeps the arena stocked with something to shoot. */
  private fillShapes(initial: boolean): void {
    let count = 0;
    for (const e of this.world.entities) if (e instanceof Shape) count++;
    if (count >= this.targetShapeCount) return;
    // Trickle them in so a cleared arena refills gradually rather than all at once.
    const toSpawn = initial ? this.targetShapeCount - count : this.world.tick % 25 === 0 ? 1 : 0;
    for (let i = 0; i < toSpawn; i++) this.spawnShape(initial);
  }

  private spawnShape(anywhere: boolean): void {
    const kind = this.pickShapeKind();
    const pos = anywhere ? this.randomInteriorPoint() : this.world.randomEdgePoint();
    const shiny = this.shapeRng.bool(SHINY_CHANCE);
    this.world.spawn(new Shape(kind, pos, this.shapeRng, shiny));
  }

  private pickShapeKind(): ShapeKind {
    const roll = this.shapeRng.next();
    if (roll < 0.58) return 'square';
    if (roll < 0.85) return 'triangle';
    if (roll < 0.95) return 'pentagon';
    return this.shapeRng.bool(0.6) ? 'smallCrasher' : 'largeCrasher';
  }

  /** A point inside the arena, kept clear of the player so nothing lands on them. */
  private randomInteriorPoint(): Vec2 {
    const h = this.world.arena.halfSize - 120;
    for (let attempt = 0; attempt < 12; attempt++) {
      const p = vec(this.shapeRng.range(-h, h), this.shapeRng.range(-h, h));
      const dx = p.x - this.player.pos.x;
      const dy = p.y - this.player.pos.y;
      if (dx * dx + dy * dy > 420 * 420) return p;
    }
    return this.world.randomEdgePoint();
  }
}
