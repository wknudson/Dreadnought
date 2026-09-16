import type { World } from './world.ts';
import type { Rng } from '../core/rng.ts';
import { Shape } from './shape.ts';
import { Tank } from './tank.ts';
import { AiTankController, archetypeFor, buildStatsFor, effectiveRange, safeSpawnPoint } from './ai.ts';
import { BossController } from './bossAi.ts';
import { getBoss, type BossId } from '../data/bosses.ts';
import {
  arenaSizeForWave,
  bossHealthForWave,
  bossThreatForWave,
  bossXpForWave,
  enemyLevel,
  generateWave,
  isBossWave,
  FINAL_WAVE,
  type Difficulty,
  type SpawnGroup,
  type WaveDef,
} from '../data/waves.ts';
import { TANKS, getTank } from '../data/tanks.ts';
import { COLORS } from '../data/colors.ts';
import { SHINY_CHANCE, type ShapeKind } from '../data/shapes.ts';
import type { Entity } from './entity.ts';
import { vec, type Vec2 } from '../core/math.ts';
import { TICKS_PER_SECOND } from '../core/loop.ts';

/** What the director is doing right now. */
export type WavePhase = 'idle' | 'incoming' | 'fighting' | 'breather' | 'won';

/** Ticks a warning ring shows before whatever it marks arrives. */
const WARNING_TICKS = 25;
/** How close to the player an enemy may spawn. */
const MIN_SPAWN_DISTANCE = 700;

/** A spawn that has been announced but has not happened yet. */
interface PendingSpawn {
  at: Vec2;
  ticksLeft: number;
  spawn: (at: Vec2) => void;
  /** Drawn at this radius, so a boss gets a bigger warning than a square. */
  radius: number;
}

/** A ring drawn where something is about to appear. */
export interface WarningRing {
  pos: Vec2;
  radius: number;
  /** 0 to 1, counting up as the spawn approaches. */
  progress: number;
}

export interface WaveEvents {
  onWaveStart(wave: number, bossName: string | null): void;
  onWaveClear(wave: number): void;
  onRunWon(): void;
}

/**
 * Runs the waves.
 *
 * Owns the whole rhythm of a run: announce, spawn at the edges, wait for the
 * arena to be cleared, breathe, repeat. It also decides when the arena grows,
 * which happens once a boss falls so the reward is visible.
 */
export class WaveDirector {
  wave = 0;
  phase: WavePhase = 'idle';
  /** Ticks left in the current breather. */
  breatherTicks = 0;
  /** The boss of the current wave, while it lives. */
  bossName: string | null = null;

  private readonly world: World;
  private readonly rng: Rng;
  private readonly difficulty: Difficulty;
  private readonly events: WaveEvents;
  private readonly player: Entity;

  /** Enemies belonging to the current wave, which must die for it to clear. */
  private readonly tracked = new Set<Entity>();
  /** Ticks a wave may run before the last enemies are told to come and find you. */
  private static readonly PATIENCE_TICKS = TICKS_PER_SECOND * 40;
  private readonly pending: PendingSpawn[] = [];
  private current: WaveDef | null = null;
  /** Groups of the current wave not yet released. */
  private queue: SpawnGroup[] = [];
  private waveTicks = 0;

  /** The player's level, which boss scaling reads. Kept current by the run. */
  playerLevel = 1;

  constructor(
    world: World,
    player: Entity,
    rng: Rng,
    difficulty: Difficulty,
    events: WaveEvents,
  ) {
    this.world = world;
    this.player = player;
    this.rng = rng;
    this.difficulty = difficulty;
    this.events = events;
  }

  /** Seconds left before the next wave, for the heads-up display. */
  get countdownSeconds(): number {
    return this.phase === 'breather' ? this.breatherTicks / TICKS_PER_SECOND : 0;
  }

  /** Rings to draw where something is about to appear. */
  warnings(): WarningRing[] {
    return this.pending.map((p) => ({
      pos: p.at,
      radius: p.radius,
      progress: 1 - p.ticksLeft / WARNING_TICKS,
    }));
  }

  /** Enemies still standing between the player and the next breather. */
  get remaining(): number {
    let alive = 0;
    for (const e of this.tracked) if (e.alive) alive++;
    return alive + this.pending.length + this.queue.reduce((n, g) => n + g.count, 0);
  }

  /** Begins the run at wave one. */
  start(): void {
    this.beginWave(1);
  }

  /**
   * Stops the waves where they are and clears the field.
   *
   * For tests and the practice sandbox, where the point is to study one tank
   * rather than to survive.
   */
  halt(): void {
    this.phase = 'idle';
    this.queue = [];
    this.pending.length = 0;
    for (const e of this.tracked) e.alive = false;
    this.tracked.clear();
  }

  /** Skips straight to a given wave. Used by the in-development wave key. */
  jumpTo(wave: number): void {
    this.halt();
    this.beginWave(Math.max(1, wave));
  }

  tick(): void {
    // Release anything whose warning has run out.
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!;
      if (--p.ticksLeft > 0) continue;
      this.pending.splice(i, 1);
      p.spawn(p.at);
    }

    switch (this.phase) {
      case 'incoming':
      case 'fighting':
        this.waveTicks++;
        this.releaseDueGroups();
        if (this.queue.length === 0 && this.pending.length === 0) this.phase = 'fighting';
        if (this.waveTicks > WaveDirector.PATIENCE_TICKS) this.huntStragglers();
        if (this.phase === 'fighting' && this.remaining === 0) this.clearWave();
        break;

      case 'breather':
        if (--this.breatherTicks <= 0) this.beginWave(this.wave + 1);
        break;

      default:
        break;
    }
  }

  /**
   * Sends the last enemies after the player.
   *
   * Without this a wave can end in a long walk across the arena after something
   * slow that wandered away, which is the least interesting way to spend a run.
   */
  private huntStragglers(): void {
    for (const e of this.tracked) {
      if (!e.alive) continue;
      if (e instanceof Shape) e.hunting = true;
      else if (e instanceof Tank) {
        const c = e.controller;
        if (c instanceof AiTankController || c instanceof BossController) c.hunt();
      }
    }
  }

  private beginWave(index: number): void {
    this.wave = index;
    this.waveTicks = 0;
    this.tracked.clear();
    this.current = generateWave(index, this.difficulty, this.rng);
    this.queue = [...this.current.groups];
    this.phase = 'incoming';

    // The arena widens as the run goes on, so late waves are not a scrum.
    this.world.arena.targetHalfSize = arenaSizeForWave(index);

    const boss = this.current.boss;
    this.bossName = boss ? getBoss(boss).name : null;
    if (boss) this.announceBoss(boss);

    this.events.onWaveStart(index, this.bossName);
  }

  private clearWave(): void {
    this.events.onWaveClear(this.wave);
    if (this.wave >= FINAL_WAVE) {
      this.phase = 'won';
      this.events.onRunWon();
      return;
    }
    this.phase = 'breather';
    this.breatherTicks = Math.round(this.difficulty.breather * TICKS_PER_SECOND);
  }

  /** Releases any group whose delay has elapsed. */
  private releaseDueGroups(): void {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const group = this.queue[i]!;
      if (this.waveTicks < group.delayTicks) continue;
      this.queue.splice(i, 1);
      for (let n = 0; n < group.count; n++) this.announceGroupMember(group);
    }
  }

  private announceGroupMember(group: SpawnGroup): void {
    const at = safeSpawnPoint(this.world, this.player.pos, MIN_SPAWN_DISTANCE);
    const kind = group.entry.kind;
    if (kind.type === 'shape') {
      this.pending.push({
        at,
        ticksLeft: WARNING_TICKS,
        radius: 60,
        spawn: (p) => this.spawnShape(kind.shape, p),
      });
    } else {
      this.pending.push({
        at,
        ticksLeft: WARNING_TICKS,
        radius: 90,
        spawn: (p) => this.spawnAiTank(kind.tier, p),
      });
    }
  }

  private announceBoss(id: BossId): void {
    const at = safeSpawnPoint(this.world, this.player.pos, MIN_SPAWN_DISTANCE + 300);
    this.pending.push({
      at,
      ticksLeft: WARNING_TICKS * 3,
      radius: 220,
      spawn: (p) => this.spawnBoss(id, p),
    });
  }

  private spawnShape(kind: ShapeKind, at: Vec2): void {
    const shiny = this.rng.bool(SHINY_CHANCE);
    const shape = new Shape(kind, at, this.rng, shiny);
    shape.maxHealth *= this.difficulty.health;
    shape.health = shape.maxHealth;
    shape.contactDamage *= this.difficulty.damage;
    this.world.spawn(shape);
    this.tracked.add(shape);
  }

  /** Picks a tank of the given tier and drops it in as an enemy. */
  private spawnAiTank(tier: 2 | 3 | 4, at: Vec2): void {
    const candidates = TANKS.filter((t) => t.tier === tier && t.barrels.length > 0);
    const def = this.rng.pick(candidates.length ? candidates : [getTank('twin')]);
    const level = enemyLevel(this.wave, tier);
    const archetype = archetypeFor(def);
    const controller = new AiTankController(archetype, this.rng.fork(`ai:${this.wave}:${def.id}`));

    const tank = new Tank(def, level, controller, COLORS.enemyRed);
    tank.team = 'enemy';
    tank.name = def.name;
    tank.points = buildStatsFor(archetype, level);
    tank.refresh();
    tank.maxHealth *= this.difficulty.health;
    tank.health = tank.maxHealth;
    tank.contactDamage *= this.difficulty.damage;
    controller.setRange(effectiveRange(def, tank.points));

    tank.pos = vec(at.x, at.y);
    tank.prevPos = vec(at.x, at.y);
    this.world.spawn(tank);
    this.tracked.add(tank);
  }

  private spawnBoss(id: BossId, at: Vec2): void {
    const boss = getBoss(id);
    const threat = bossThreatForWave(this.wave, this.playerLevel);
    const controller = new BossController(boss, this.rng.bool());

    // An early boss brings a smaller escort as well as hitting softer: its
    // drones and traps are what actually overwhelm a low-level player.
    const def = {
      ...boss.def,
      barrels: boss.def.barrels.map((b) =>
        b.projectile.maxCount === undefined
          ? b
          : {
              ...b,
              projectile: {
                ...b.projectile,
                maxCount: Math.max(1, Math.round(b.projectile.maxCount * threat)),
              },
            },
      ),
    };

    const tank = new Tank(def, 45, controller, boss.def.baseColor ?? COLORS.fallen);
    tank.team = 'enemy';
    tank.name = boss.name;

    // A boss's own stat points drive what its drones and shots hit for, so they
    // scale with the same threat factor as everything else about it. Left at
    // maximum, a wave-five boss's escort does more damage per tick than the
    // player has health.
    tank.points = buildStatsFor('commander', Math.round(45 * threat));
    tank.refresh();
    tank.maxHealth = bossHealthForWave(this.wave, this.playerLevel) * this.difficulty.health;
    tank.health = tank.maxHealth;
    tank.contactDamage = boss.bodyDamage * threat * this.difficulty.damage;
    tank.isBoss = true;
    tank.bossXp = bossXpForWave(this.wave);

    tank.pos = vec(at.x, at.y);
    tank.prevPos = vec(at.x, at.y);
    this.world.spawn(tank);
    this.tracked.add(tank);
  }

  /** Stops tracking something that died, so a cleared wave is noticed. */
  forget(entity: Entity): void {
    this.tracked.delete(entity);
  }

  /** True once the run has been beaten. */
  get won(): boolean {
    return this.phase === 'won';
  }

  /** Whether a boss is on the field this wave. */
  get isBossWave(): boolean {
    return isBossWave(this.wave);
  }
}
