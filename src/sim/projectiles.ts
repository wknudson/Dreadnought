import { Entity, type EntityKind } from './entity.ts';
import type { World } from './world.ts';
import { integrate, maintainVelocity } from './physics.ts';
import type { ProjectileStats } from './stats.ts';
import { deriveProjectileStats, projectilePush } from './stats.ts';
import { BarrelHost, type BarrelOwner, type BarrelState } from './weapon.ts';
import { setProjectileFactory } from './weapon.ts';
import type { ProjectileKind } from '../data/schema.ts';
import { vec, type Vec2 } from '../core/math.ts';

/** Perk-driven behaviour attached to a projectile when it spawns. */
export interface ProjectileMods {
  /** Extra enemies a projectile survives passing through. */
  pierce: number;
  /** Times it may bounce off the arena wall. */
  bounces: number;
  /** Radians per tick it may steer toward a target. Zero disables homing. */
  homing: number;
  /** Children spawned when it expires or lands. */
  split: number;
  /** Radius of an explosion on impact. */
  explodeRadius: number;
}

export const noMods = (): ProjectileMods => ({
  pierce: 0,
  bounces: 0,
  homing: 0,
  split: 0,
  explodeRadius: 0,
});

/**
 * Anything a barrel emits.
 *
 * All projectile kinds share a lifetime, a health pool that erodes as they punch
 * through things, and the contact damage the physics pass reads.
 */
export abstract class Projectile extends Entity {
  override readonly kind: EntityKind = 'projectile';

  contactDamage: number;
  lifeTicks: number;
  age = 0;
  mods: ProjectileMods = noMods();

  /** The barrel that fired this, so its slot can be freed on death. */
  readonly spawner: BarrelState | null;
  /** The projectile kind, used for rendering. */
  readonly projectileKind: ProjectileKind;

  constructor(
    pos: Vec2,
    angle: number,
    stats: ProjectileStats,
    kind: ProjectileKind,
    spawner: BarrelState | null,
  ) {
    super();
    this.pos = vec(pos.x, pos.y);
    this.prevPos = vec(pos.x, pos.y);
    this.angle = angle;
    this.prevAngle = angle;
    this.radius = stats.radius;
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.contactDamage = stats.damage;
    this.lifeTicks = stats.lifeTicks;
    this.absorbtionFactor = stats.absorbtionFactor;
    this.projectileKind = kind;
    this.spawner = spawner;
    this.hideHealthBar = true;
  }

  /** Frees the spawner slot. Called once, when the projectile leaves the world. */
  protected release(): void {
    if (this.spawner) BarrelHost.release(this.spawner);
  }

  protected expire(world: World, showEffect = true): void {
    if (!this.alive) return;
    this.alive = false;
    this.release();
    if (showEffect) {
      world.addDeath({
        pos: vec(this.pos.x, this.pos.y),
        angle: this.angle,
        radius: this.radius,
        color: this.deathColor,
        sides: this.deathSides,
        def: null,
      });
    }
  }

  /** Colour of the fade-out puff. Set by whoever spawns the projectile. */
  deathColor = '#00B2E1';
  /** Polygon sides for the fade-out puff. */
  deathSides = 1;

  abstract override update(world: World): void;
}

/** A plain bullet: launched fast, settles to a cruise speed, expires on a timer. */
export class Bullet extends Projectile {
  /** Terminal speed this bullet converges on. */
  private readonly cruise: number;

  constructor(
    pos: Vec2,
    angle: number,
    stats: ProjectileStats,
    kind: ProjectileKind,
    spawner: BarrelState | null,
  ) {
    super(pos, angle, stats, kind, spawner);
    this.cruise = stats.acceleration;
    // A shot leaves the barrel faster than it can sustain and is dragged back to
    // its cruise speed, which is why a quick tank can outrun its own bullets.
    this.vel = vec(Math.cos(angle) * stats.initialSpeed, Math.sin(angle) * stats.initialSpeed);
  }

  override update(world: World): void {
    this.age++;
    if (this.age >= this.lifeTicks) {
      this.expire(world);
      return;
    }

    if (this.mods.homing > 0) this.steerTowardTarget(world);

    maintainVelocity(this, this.angle, this.cruise);
    integrate(this);

    if (this.mods.bounces > 0) this.bounceOffWalls(world);
    else if (world.outsideArena(this.pos, this.radius)) this.expire(world);
  }

  private steerTowardTarget(world: World): void {
    let best: Entity | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const e of world.near(this.pos, 600)) {
      if (!e.alive || e.kind === 'projectile') continue;
      if (e.team === this.team || e.team === 'neutral') continue;
      const d = (e.pos.x - this.pos.x) ** 2 + (e.pos.y - this.pos.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    if (!best) return;
    const want = Math.atan2(best.pos.y - this.pos.y, best.pos.x - this.pos.x);
    let delta = want - this.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.angle += Math.max(-this.mods.homing, Math.min(this.mods.homing, delta));
  }

  private bounceOffWalls(world: World): void {
    const limit = world.arena.halfSize - this.radius;
    let bounced = false;
    if (this.pos.x < -limit || this.pos.x > limit) {
      this.pos.x = Math.max(-limit, Math.min(limit, this.pos.x));
      this.vel.x *= -1;
      this.angle = Math.atan2(this.vel.y, this.vel.x);
      bounced = true;
    }
    if (this.pos.y < -limit || this.pos.y > limit) {
      this.pos.y = Math.max(-limit, Math.min(limit, this.pos.y));
      this.vel.y *= -1;
      this.angle = Math.atan2(this.vel.y, this.vel.x);
      bounced = true;
    }
    if (bounced) this.mods.bounces--;
  }
}

/**
 * Builds the projectile a barrel just fired.
 *
 * Registered with the weapon module so barrels can create projectiles without
 * importing this file directly.
 */
setProjectileFactory((world, owner: BarrelOwner, barrel, spawn, angle) => {
  const stats = deriveProjectileStats(owner.stats(), barrel.def, owner.scale());
  const kind = barrel.def.projectile.kind;

  // Only plain bullets exist so far. The other kinds arrive with their tanks in
  // the next phase; until then their barrels fire nothing rather than crashing.
  if (kind !== 'bullet') return null;

  const bullet = new Bullet(spawn, angle, stats, kind, barrel);
  const source = owner.entity;
  bullet.team = source.team;
  bullet.owner = source;
  bullet.pushFactor = projectilePush(owner.stats(), barrel.def);
  bullet.deathColor = (source as Entity & { color?: string }).color ?? '#00B2E1';
  world.spawn(bullet);
  return bullet;
});
