import { Rng } from '../core/rng.ts';
import { type Vec2, vec } from '../core/math.ts';
import { DEATH_TICKS, type Entity } from './entity.ts';
import type { TankDefinition } from '../data/schema.ts';

/** A dying entity, kept only long enough to play its puff-and-fade animation. */
export interface DeathEffect {
  pos: Vec2;
  angle: number;
  radius: number;
  color: string;
  /** Polygon sides; 1 draws a circle. */
  sides: number;
  /** Set when a whole tank died, so the effect can draw its barrels too. */
  def: TankDefinition | null;
  /** Counts up to DEATH_TICKS. */
  age: number;
  prevAge: number;
}

export interface WorldEvents {
  entityKilled: { victim: Entity; killer: Entity | null };
  damageTaken: { victim: Entity; amount: number; source: Entity | null };
  waveClear: { wave: number };
  levelUp: { level: number };
  playerDied: Record<string, never>;
}

type Handler<K extends keyof WorldEvents> = (payload: WorldEvents[K]) => void;

/** A tiny typed pub/sub so systems can react without knowing about each other. */
export class EventBus {
  private handlers = new Map<keyof WorldEvents, Set<(payload: never) => void>>();

  on<K extends keyof WorldEvents>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (payload: never) => void);
    return () => set!.delete(handler as (payload: never) => void);
  }

  emit<K extends keyof WorldEvents>(event: K, payload: WorldEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) (handler as Handler<K>)(payload);
  }
}

/** Cell size for the broad phase, in diep units. Comfortably larger than most entities. */
const CELL_SIZE = 200;

/**
 * A uniform grid for finding nearby entities.
 *
 * Rebuilt from scratch every tick: with a few hundred entities that is cheaper
 * and far simpler than tracking incremental moves between cells.
 */
export class SpatialHash {
  private cells = new Map<number, Entity[]>();

  private key(cx: number, cy: number): number {
    // Pack two signed cell coordinates into one number.
    return (cx + 0x8000) * 0x10000 + (cy + 0x8000);
  }

  clear(): void {
    this.cells.clear();
  }

  insert(e: Entity): void {
    const minX = Math.floor((e.pos.x - e.radius) / CELL_SIZE);
    const maxX = Math.floor((e.pos.x + e.radius) / CELL_SIZE);
    const minY = Math.floor((e.pos.y - e.radius) / CELL_SIZE);
    const maxY = Math.floor((e.pos.y + e.radius) / CELL_SIZE);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const k = this.key(cx, cy);
        const bucket = this.cells.get(k);
        if (bucket) bucket.push(e);
        else this.cells.set(k, [e]);
      }
    }
  }

  /** Every entity whose cell overlaps the given circle. May include duplicates. */
  query(pos: Vec2, radius: number, out: Entity[]): Entity[] {
    out.length = 0;
    const minX = Math.floor((pos.x - radius) / CELL_SIZE);
    const maxX = Math.floor((pos.x + radius) / CELL_SIZE);
    const minY = Math.floor((pos.y - radius) / CELL_SIZE);
    const maxY = Math.floor((pos.y + radius) / CELL_SIZE);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const e of bucket) if (!out.includes(e)) out.push(e);
      }
    }
    return out;
  }
}

/**
 * Starting half-width of the playfield, in diep units.
 *
 * A level-1 tank sees roughly 3500 units across, so this shows most of the arena
 * at once without the walls crowding the view. It grows as bosses fall.
 */
export const DEFAULT_ARENA_HALF_SIZE = 2200;

/** Added to the arena half-width each time a boss wave is cleared. */
export const ARENA_GROWTH_PER_STAGE = 450;

export interface Arena {
  /** Half the arena's width. The playfield spans -halfSize to +halfSize on both axes. */
  halfSize: number;
  /** Target used while the border animates outward after a boss. */
  targetHalfSize: number;
}

/**
 * The simulation. Owns every entity, the arena bounds, and the tick order.
 */
export class World {
  readonly entities: Entity[] = [];
  readonly events = new EventBus();
  readonly hash = new SpatialHash();
  readonly deaths: DeathEffect[] = [];

  arena: Arena = { halfSize: DEFAULT_ARENA_HALF_SIZE, targetHalfSize: DEFAULT_ARENA_HALF_SIZE };

  /** Ticks elapsed since the world was created. */
  tick = 0;

  private readonly spawnQueue: Entity[] = [];
  private readonly scratch: Entity[] = [];

  readonly rng: Rng;

  constructor(rng: Rng) {
    this.rng = rng;
  }

  /** Queues an entity. It joins the world at the start of the next tick. */
  spawn<T extends Entity>(entity: T): T {
    entity.snapshot();
    this.spawnQueue.push(entity);
    return entity;
  }

  /** Entities near a point. The returned array is reused, so copy it if you keep it. */
  near(pos: Vec2, radius: number): Entity[] {
    return this.hash.query(pos, radius, this.scratch);
  }

  addDeath(effect: Omit<DeathEffect, 'age' | 'prevAge'>): void {
    this.deaths.push({ ...effect, age: 0, prevAge: 0 });
  }

  /** Keeps a circle inside the arena, zeroing the velocity component that would leave. */
  clampToArena(e: Entity): void {
    const limit = this.arena.halfSize - e.radius;
    if (e.pos.x < -limit) {
      e.pos.x = -limit;
      if (e.vel.x < 0) e.vel.x = 0;
    } else if (e.pos.x > limit) {
      e.pos.x = limit;
      if (e.vel.x > 0) e.vel.x = 0;
    }
    if (e.pos.y < -limit) {
      e.pos.y = -limit;
      if (e.vel.y < 0) e.vel.y = 0;
    } else if (e.pos.y > limit) {
      e.pos.y = limit;
      if (e.vel.y > 0) e.vel.y = 0;
    }
  }

  /** True when the point lies outside the playable square. */
  outsideArena(pos: Vec2, margin = 0): boolean {
    const limit = this.arena.halfSize + margin;
    return Math.abs(pos.x) > limit || Math.abs(pos.y) > limit;
  }

  /** A random point on the arena perimeter, inset slightly so nothing spawns in the wall. */
  randomEdgePoint(inset = 60): Vec2 {
    const h = this.arena.halfSize - inset;
    const t = this.rng.range(-h, h);
    switch (this.rng.int(0, 3)) {
      case 0:
        return vec(t, -h);
      case 1:
        return vec(t, h);
      case 2:
        return vec(-h, t);
      default:
        return vec(h, t);
    }
  }

  private admitSpawns(): void {
    if (!this.spawnQueue.length) return;
    for (const e of this.spawnQueue) this.entities.push(e);
    this.spawnQueue.length = 0;
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (const e of this.entities) if (e.alive) this.hash.insert(e);
  }

  private sweepDead(): void {
    let write = 0;
    for (let read = 0; read < this.entities.length; read++) {
      const e = this.entities[read]!;
      if (e.alive) {
        this.entities[write++] = e;
      } else {
        e.removed = true;
      }
    }
    this.entities.length = write;
  }

  private advanceDeaths(): void {
    let write = 0;
    for (let read = 0; read < this.deaths.length; read++) {
      const d = this.deaths[read]!;
      d.prevAge = d.age;
      d.age++;
      if (d.age <= DEATH_TICKS) this.deaths[write++] = d;
    }
    this.deaths.length = write;
  }

  /**
   * One simulation step.
   *
   * Order matters: new entities join first so they are visible to collision this
   * tick, the arena tween runs before movement so nothing ends up outside the new
   * bounds, then entities think and move, then contacts resolve, then the dead
   * are swept. `resolveContacts` is supplied by physics.ts to avoid a cycle.
   */
  step(resolveContacts: (world: World) => void, tweenArena: () => void): void {
    this.tick++;
    this.admitSpawns();
    tweenArena();

    for (const e of this.entities) e.snapshot();
    for (const e of this.entities) {
      if (e.flashTicks > 0) e.flashTicks--;
      if (e.ticksSinceDamage < Number.MAX_SAFE_INTEGER) e.ticksSinceDamage++;
    }

    this.rebuildHash();
    for (const e of this.entities) if (e.alive) e.update(this);

    this.rebuildHash();
    resolveContacts(this);

    this.advanceDeaths();
    this.sweepDead();
  }
}
