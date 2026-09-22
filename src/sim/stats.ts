/**
 * Turns stat points into the numbers the simulation reads.
 *
 * A tank's points are a `StatBlock`. From them this derives its health, regen,
 * body damage and acceleration, and from them and the barrel that fires it a
 * projectile's damage, health, speed, size and lifetime. The curves themselves
 * are in data/leveling.ts. It also works out the refund when a new class drops
 * stats the old one had.
 */

import type { BarrelDefinition, StatKey, TankDefinition } from '../data/schema.ts';
import { STAT_ORDER } from '../data/schema.ts';
import { statCap } from '../data/tanks.ts';
import {
  bodyDamagePerTick,
  maxHealth,
  moveAcceleration,
  projectileAcceleration,
  projectileDamage,
  projectileHealth,
  projectileLifeTicks,
  regenPerTick,
  reloadTicks,
} from '../data/leveling.ts';

/** Points spent in each of the eight stats. */
export type StatBlock = Record<StatKey, number>;

export const emptyStats = (): StatBlock => ({
  regen: 0,
  maxHealth: 0,
  bodyDamage: 0,
  bulletSpeed: 0,
  bulletPen: 0,
  bulletDamage: 0,
  reload: 0,
  moveSpeed: 0,
});

/** Whether this tank can take another point in the stat. */
export function canRaise(def: TankDefinition, stats: StatBlock, key: StatKey): boolean {
  return stats[key] < statCap(def, key);
}

/**
 * Drops points from stats a tank does not have.
 *
 * Upgrading into the Smasher line removes the four projectile stats, and diep.io
 * refunds those points rather than stranding them. We do the same, returning how
 * many were freed so the run can hand back that many cards.
 */
export function reconcileStats(def: TankDefinition, stats: StatBlock): number {
  let refunded = 0;
  for (const key of STAT_ORDER) {
    const cap = statCap(def, key);
    if (stats[key] > cap) {
      refunded += stats[key] - cap;
      stats[key] = cap;
    }
  }
  return refunded;
}

/** Everything about a tank that the simulation reads each tick. */
export interface DerivedTankStats {
  maxHealth: number;
  regenPerTick: number;
  bodyDamage: number;
  /** Acceleration per tick; terminal speed is ten times this. */
  acceleration: number;
  /**
   * What perks multiply every barrel's reload period by.
   *
   * The stat points are deliberately not in here. They scale a barrel's own
   * period, which `barrelReloadTicks` owns, and having the curve in two places
   * is what left this field unread for as long as it was.
   */
  reloadScale: number;
}

export function deriveTankStats(
  def: TankDefinition,
  level: number,
  stats: StatBlock,
  isSpike: boolean,
): DerivedTankStats {
  const hp = maxHealth(level, stats.maxHealth);
  return {
    maxHealth: hp,
    regenPerTick: regenPerTick(hp, stats.regen),
    bodyDamage: bodyDamagePerTick(stats.bodyDamage, isSpike),
    acceleration: moveAcceleration(level, stats.moveSpeed) * def.speedMultiplier,
    reloadScale: 1,
  };
}

/** Everything a projectile needs at the moment it is created. */
export interface ProjectileStats {
  damage: number;
  health: number;
  /** Terminal speed in units per tick. */
  acceleration: number;
  /** Speed on the tick it spawns, before friction pulls it back to terminal. */
  initialSpeed: number;
  radius: number;
  lifeTicks: number;
  absorbtionFactor: number;
  /** Half-width of the random spread cone, in radians. */
  scatter: number;
}

/**
 * Turns an owner's stat points and a barrel's multipliers into concrete numbers.
 *
 * `scale` is the owner's size relative to a level-1 tank, so a bigger tank fires
 * proportionally bigger projectiles.
 */
export function deriveProjectileStats(
  stats: StatBlock,
  barrel: BarrelDefinition,
  scale: number,
): ProjectileStats {
  const p = barrel.projectile;
  const acceleration = projectileAcceleration(stats.bulletSpeed, p.speed);
  return {
    damage: projectileDamage(stats.bulletDamage, p.damage),
    health: projectileHealth(stats.bulletPen, p.health),
    acceleration,
    // The launch impulse overshoots terminal speed; friction settles it back.
    initialSpeed: acceleration + 30,
    radius: ((barrel.width * scale) / 2) * p.sizeRatio,
    lifeTicks: projectileLifeTicks(p.lifeLength),
    absorbtionFactor: p.absorbtionFactor,
    scatter: (Math.PI / 180) * 5 * p.scatterRate,
  };
}

/** How hard a projectile shoves what it hits. */
export const projectilePush = (
  stats: StatBlock,
  barrel: BarrelDefinition,
): number =>
  (7 / 3 + stats.bulletDamage) * barrel.projectile.damage * barrel.projectile.absorbtionFactor;

/**
 * A barrel's reload period in ticks for an owner with these stats.
 *
 * `scale` is whatever the owner's perks do to it, which is one for everything
 * that has no perks.
 */
export const barrelReloadTicks = (
  stats: StatBlock,
  barrel: BarrelDefinition,
  scale = 1,
): number => Math.max(1, reloadTicks(stats.reload, barrel.reload) * scale);
