import type { BarrelDefinition } from '../data/schema.ts';
import type { Entity } from './entity.ts';
import type { World } from './world.ts';
import { barrelReloadTicks, deriveProjectileStats, type StatBlock } from './stats.ts';
import { addImpulse } from './physics.ts';
import { vec, type Vec2 } from '../core/math.ts';

/**
 * Anything with barrels: player tanks, AI tanks, bosses, auto turrets, and the
 * missiles that Skimmer and Rocketeer launch.
 *
 * Implementers supply their own stat points and scale, which is how a missile
 * inherits its launcher's upgrades and a turret inherits its host's.
 */
export interface BarrelOwner {
  readonly entity: Entity;
  /** Stat points driving reload, damage, penetration and speed. */
  stats(): StatBlock;
  /** Body size relative to a level-1 tank, scaling barrels and projectiles alike. */
  scale(): number;
  /** Where a spawned projectile should point when it is not simply the barrel angle. */
  aimAngle(): number;
}

/** Per-barrel firing state. One of these exists for each barrel on a host. */
export interface BarrelState {
  readonly def: BarrelDefinition;
  /**
   * Counts up in ticks; a shot leaves once it passes the barrel's period.
   *
   * A barrel begins loaded rather than empty, so the first click fires at once.
   * Combined with `delay` that also staggers a multi-barrel tank from its very
   * first volley: Twin's second barrel starts half a period short of ready.
   */
  cycle: number;
  /** False until the first tick has seeded `cycle` from the live reload period. */
  primed: boolean;
  /** Eases from 1 to 0 after firing, pulling the barrel back visually. */
  recoilAnim: number;
  /** Live projectiles this barrel is responsible for, for the drone caps. */
  liveCount: number;
}

export interface FireContext {
  world: World;
  /** Whether the primary trigger is held. */
  fire: boolean;
  /** Whether the secondary trigger is held. */
  secondary: boolean;
  /** Barrels that ignore the trigger entirely, as drone spawners do. */
  alwaysFire?: boolean;
}

/** Called to build the projectile a barrel emits. Set by projectiles.ts. */
export type ProjectileFactory = (
  world: World,
  owner: BarrelOwner,
  barrel: BarrelState,
  spawn: Vec2,
  angle: number,
) => Entity | null;

let factory: ProjectileFactory | null = null;

/**
 * Registers the projectile constructor.
 *
 * Barrels need to create projectiles and projectiles need barrels, so the
 * dependency is broken here rather than with a circular import.
 */
export function setProjectileFactory(f: ProjectileFactory): void {
  factory = f;
}

export class BarrelHost {
  readonly barrels: BarrelState[];

  constructor(defs: readonly BarrelDefinition[]) {
    this.barrels = defs.map((def) => ({ def, cycle: 0, recoilAnim: 0, liveCount: 0, primed: false }));
  }

  /** Rebuilds for a new tank definition, as when a class upgrade is taken. */
  replace(defs: readonly BarrelDefinition[]): void {
    this.barrels.length = 0;
    for (const def of defs) this.barrels.push({ def, cycle: 0, recoilAnim: 0, liveCount: 0, primed: false });
  }

  /** Where a barrel's muzzle sits in world space. */
  muzzle(owner: BarrelOwner, barrel: BarrelState, facing: number): Vec2 {
    const scale = owner.scale();
    const { pos } = owner.entity;
    const a = facing + barrel.def.angle;
    const length = barrel.def.size * scale;
    const offset = barrel.def.offset * scale;
    return vec(
      pos.x + Math.cos(a) * length - Math.sin(a) * offset,
      pos.y + Math.sin(a) * length + Math.cos(a) * offset,
    );
  }

  /**
   * Advances every barrel by one tick, firing those whose cycle has come round.
   *
   * A barrel's `delay` is a phase offset within its own reload period. That single
   * number produces all of diep.io's firing patterns: Twin's two barrels at 0 and
   * 0.5 alternate, while Penta Shot's 0, 0.33 and 0.66 ripple outward.
   */
  tick(owner: BarrelOwner, facing: number, ctx: FireContext): void {
    const stats = owner.stats();

    for (const barrel of this.barrels) {
      if (barrel.recoilAnim > 0) barrel.recoilAnim = Math.max(0, barrel.recoilAnim - 0.15);

      const period = barrelReloadTicks(stats, barrel.def);
      if (!barrel.primed) {
        // Start one full period in, which is what makes the first shot instant.
        barrel.cycle = period;
        barrel.primed = true;
      }
      const cap = barrel.def.projectile.maxCount;
      const spawner = cap !== undefined;

      // Drone spawners run continuously and are gated by their count instead.
      const wantsToFire = spawner || ctx.alwaysFire
        ? true
        : barrel.def.trigger === 'secondary'
          ? ctx.secondary
          : ctx.fire;

      const blockedByCap = cap !== undefined && barrel.liveCount >= cap;

      if (!wantsToFire || blockedByCap) {
        // Hold at the ready so the next shot leaves immediately.
        barrel.cycle = Math.min(barrel.cycle + 1, period * (1 + barrel.def.delay));
        continue;
      }

      barrel.cycle++;
      const threshold = period * (1 + barrel.def.delay);
      if (barrel.cycle < threshold) continue;
      barrel.cycle = period * barrel.def.delay;

      this.fireOne(ctx.world, owner, barrel, facing);
    }
  }

  private fireOne(world: World, owner: BarrelOwner, barrel: BarrelState, facing: number): void {
    if (!factory) throw new Error('projectile factory not registered');

    const stats = owner.stats();
    const scale = owner.scale();
    const shotStats = deriveProjectileStats(stats, barrel.def, scale);
    const scatter = shotStats.scatter * (world.rng.next() - 0.5) * 2;
    const angle = facing + barrel.def.angle + scatter;

    const spawn = this.muzzle(owner, barrel, facing);
    const projectile = factory(world, owner, barrel, spawn, angle);
    if (!projectile) return;

    barrel.recoilAnim = 1;
    barrel.liveCount++;
    // Recoil shoves the tank backwards along the shot line.
    addImpulse(owner.entity, angle + Math.PI, barrel.def.recoil * 2);
  }

  /** Called by a projectile when it dies, freeing a slot on its spawner. */
  static release(barrel: BarrelState): void {
    if (barrel.liveCount > 0) barrel.liveCount--;
  }

  /** The visual pull-back of a barrel, in diep units. */
  static recoilOffset(barrel: BarrelState): number {
    return barrel.recoilAnim * 6;
  }
}
