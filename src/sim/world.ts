/**
 * The world, and the machinery it runs on.
 *
 * Besides `World`, which owns the entities and the tick order, this holds the
 * typed event bus systems talk through, the spatial hash for finding what is
 * nearby, the arena's bounds and how they move, and the death effects left
 * behind. It knows nothing of waves or perks; the run layers those on top.
 */

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
  /** Draw only a thin outline, for a ripple rather than a burst. */
  ring?: boolean;
  /** Fade in place without growing, for an afterimage rather than a death. */
  ghost?: boolean;
  /** Counts up to DEATH_TICKS. */
  age: number;
  prevAge: number;
}

/**
 * A spark that flies into something, such as health coming back to the player.
 *
 * Purely visual, and deliberately kept off the simulation's random stream: its
 * starting direction comes from a hash of the tick and an index, so adding one
 * never changes what a seed plays out.
 */
export interface Mote {
  pos: Vec2;
  prevPos: Vec2;
  vel: Vec2;
  target: Entity;
  color: string;
  age: number;
}

/** Most motes alive at once. Past this, new ones are simply not made. */
export const MAX_MOTES = 48;
/** How long a mote may fly before it is dropped, arrived or not. */
const MOTE_TICKS = 30;

/** A repeatable angle from two integers, for spreading effects without the RNG. */
const hashAngle = (a: number, b: number): number => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  return ((h >>> 0) / 0x100000000) * Math.PI * 2;
};

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
 * Matched to what a level-1 tank can see, so the first wave arrives in view
 * rather than out of it: enemies enter at the perimeter, and a perimeter beyond
 * the edge of the screen just means several seconds of staring at nothing.
 * The arena widens as bosses fall and the camera pulls back with level.
 */
export const DEFAULT_ARENA_HALF_SIZE = 1300;

export interface Arena {
  /**
   * Half the arena's extent on each axis. The playfield spans -half to +half.
   *
   * Two numbers rather than one, because the arena is not required to be square.
   * Everything the game ships today builds a square, but a wave that squeezes
   * one axis into a corridor while leaving the other alone needs somewhere to
   * say so, and retrofitting that into a scalar means finding every place the
   * squareness was assumed rather than stated.
   */
  half: Vec2;
  /** Target used while the border animates toward a new size or shape. */
  targetHalf: Vec2;
  /**
   * How much of the remaining gap the border closes each tick.
   *
   * A single constant served while the only thing that moved the border was a
   * boss falling, where a slow drift outward is exactly right. A wall that is
   * closing on you is a different event and has to be able to say so.
   */
  ease: number;
  /**
   * Bounds about to be imposed, drawn as a warning while they are still coming.
   *
   * Without this a reshape is a lottery. Showing where the walls will land is
   * what turns the moment into a decision: everything outside that rectangle is
   * about to be swept away, including things you put there on purpose.
   */
  ghost: Vec2 | null;
}

/** How much of the gap the border closes per tick when nothing says otherwise. */
export const ARENA_EASE = 0.02;

/** An arena that is square, which is what every wave currently asks for. */
export const squareArena = (half: number): Arena => ({
  half: vec(half, half),
  targetHalf: vec(half, half),
  ease: ARENA_EASE,
  ghost: null,
});

/**
 * The simulation. Owns every entity, the arena bounds, and the tick order.
 */
export class World {
  readonly entities: Entity[] = [];
  readonly events = new EventBus();
  readonly hash = new SpatialHash();
  readonly deaths: DeathEffect[] = [];
  readonly motes: Mote[] = [];

  arena: Arena = squareArena(DEFAULT_ARENA_HALF_SIZE);

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

  /**
   * The arena's bounds pulled in by the same amount on both axes.
   *
   * Several systems want "how far out may this go", and each one doing its own
   * subtraction is exactly where an assumption about squareness creeps back in.
   */
  inset(amount: number): Vec2 {
    return vec(Math.max(0, this.arena.half.x - amount), Math.max(0, this.arena.half.y - amount));
  }

  /** Keeps a circle inside the arena, zeroing the velocity component that would leave. */
  clampToArena(e: Entity): void {
    const limit = this.inset(e.radius);
    if (e.pos.x < -limit.x) {
      e.pos.x = -limit.x;
      if (e.vel.x < 0) e.vel.x = 0;
    } else if (e.pos.x > limit.x) {
      e.pos.x = limit.x;
      if (e.vel.x > 0) e.vel.x = 0;
    }
    if (e.pos.y < -limit.y) {
      e.pos.y = -limit.y;
      if (e.vel.y < 0) e.vel.y = 0;
    } else if (e.pos.y > limit.y) {
      e.pos.y = limit.y;
      if (e.vel.y > 0) e.vel.y = 0;
    }
  }

  /** True when the point lies outside the playfield. */
  outsideArena(pos: Vec2, margin = 0): boolean {
    return Math.abs(pos.x) > this.arena.half.x + margin || Math.abs(pos.y) > this.arena.half.y + margin;
  }

  /**
   * A random point on the arena perimeter, inset slightly so nothing spawns in the wall.
   *
   * The edge is chosen by length rather than by count: on a long thin arena the
   * two short ends would otherwise take half of everything that spawns, and a
   * wave would arrive down the corridor instead of around the player.
   */
  randomEdgePoint(inset = 60): Vec2 {
    const h = this.inset(inset);
    const span = h.x + h.y;
    if (this.rng.bool(span > 0 ? h.x / span : 0.5)) {
      // A top or bottom edge, which runs along x.
      return vec(this.rng.range(-h.x, h.x), this.rng.bool() ? -h.y : h.y);
    }
    return vec(this.rng.bool() ? -h.x : h.x, this.rng.range(-h.y, h.y));
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
      } else if (!e.removed) {
        e.removed = true;
        e.onDespawn(this);
      }
    }
    this.entities.length = write;
  }

  /**
   * Sends a mote from a point into a target. `index` spreads several made on
   * the same tick, so a burst fans out rather than stacking on one line.
   */
  addMote(from: Vec2, target: Entity, color: string, index = 0): void {
    if (this.motes.length >= MAX_MOTES) return;
    const a = hashAngle(this.tick, index);
    this.motes.push({
      pos: vec(from.x, from.y),
      prevPos: vec(from.x, from.y),
      vel: vec(Math.cos(a) * 9, Math.sin(a) * 9),
      target,
      color,
      age: 0,
    });
  }

  private advanceMotes(): void {
    let write = 0;
    for (let read = 0; read < this.motes.length; read++) {
      const m = this.motes[read]!;
      m.prevPos.x = m.pos.x;
      m.prevPos.y = m.pos.y;
      m.age++;
      const dx = m.target.pos.x - m.pos.x;
      const dy = m.target.pos.y - m.pos.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (!m.target.alive || m.age > MOTE_TICKS || distance < m.target.radius * 0.6) continue;
      // Steer ever harder toward the target, so it curls in rather than overshooting.
      const pull = 2.5 + m.age * 0.35;
      m.vel.x = m.vel.x * 0.82 + (dx / distance) * pull;
      m.vel.y = m.vel.y * 0.82 + (dy / distance) * pull;
      m.pos.x += m.vel.x;
      m.pos.y += m.vel.y;
      this.motes[write++] = m;
    }
    this.motes.length = write;
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
    this.advanceMotes();
    this.sweepDead();
  }
}
