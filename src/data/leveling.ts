/**
 * Levels, experience and the formulas that turn stat points into numbers.
 *
 * The XP table and every formula here are diep.io's own, so the feel of levelling
 * matches the game the arena is styled after.
 */

/** Cumulative XP required to reach each level. Index 0 is unused; index 1 is level 1. */
export const XP_TABLE: readonly number[] = [
  0, 0, 4, 13, 28, 50, 78, 113, 157, 211, 275, 350, 437, 538, 655, 787, 938, 1109, 1301, 1516,
  1757, 2026, 2325, 2658, 3026, 3433, 3883, 4379, 4925, 5525, 6184, 6907, 7698, 8537, 9426, 10368,
  11367, 12426, 13549, 14739, 16000, 17337, 18754, 20256, 21849, 23536,
];

export const MAX_LEVEL = 45;

/** Levels at which diep.io grants a stat point, and so at which Dreadnought deals cards. */
export const CARD_LEVELS: ReadonlySet<number> = new Set([
  ...Array.from({ length: 27 }, (_, i) => i + 2), // every level from 2 to 28
  30, 33, 36, 39, 42, 45,
]);

/** Levels at which a class upgrade becomes available. */
export const CLASS_LEVELS: readonly number[] = [15, 30, 45];

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return XP_TABLE[Math.min(level, MAX_LEVEL)] ?? XP_TABLE[MAX_LEVEL]!;
}

/** The level a given amount of experience buys. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= XP_TABLE[level + 1]!) level++;
  return level;
}

/** Progress through the current level, 0 to 1. Returns 1 at the cap. */
export function levelProgress(xp: number, level: number): number {
  if (level >= MAX_LEVEL) return 1;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  if (next <= base) return 1;
  return Math.min(1, Math.max(0, (xp - base) / (next - base)));
}

// --- Derived stat formulas -------------------------------------------------

/** Body radius in diep units. One background grid square is 50 units. */
export const BASE_BODY_RADIUS = 50;
export const bodyRadius = (level: number): number =>
  BASE_BODY_RADIUS * Math.pow(1.01, level - 1);

/** Square-bodied tanks (Necromancer, Factory) are built on a smaller base. */
export const SQUARE_BODY_RADIUS = 32.5 * Math.SQRT2;

export const maxHealth = (level: number, points: number): number =>
  50 + 2 * (level - 1) + 20 * points;

/** Health restored per tick once regeneration has kicked in. */
export function regenPerTick(max: number, points: number): number {
  const perSecond = (max * (0.03 + 0.12 * points)) / 30;
  return perSecond / 25;
}

/** Contact damage per tick. Spike adds half again on top. */
export const bodyDamagePerTick = (points: number, spike = false): number =>
  spike ? 9 * points + 30 : 6 * points + 20;

/** Movement acceleration per tick. Terminal speed is ten times this. */
export const moveAcceleration = (level: number, points: number): number =>
  (2.55 * Math.pow(1.07, points)) / Math.pow(1.015, level - 1);

/** A barrel's reload period in ticks. */
export const reloadTicks = (points: number, barrelReload: number): number =>
  15 * Math.pow(0.914, points) * barrelReload;

/** Projectile terminal speed in units per tick, before the launch impulse. */
export const projectileAcceleration = (points: number, speedMult: number): number =>
  (20 + 3 * points) * speedMult;

export const projectileDamage = (points: number, damageMult: number): number =>
  (7 + 3 * points) * damageMult;

export const projectileHealth = (points: number, healthMult: number): number =>
  (2 + 1.5 * points) * healthMult;

/** Lifetime in ticks. A lifeLength of -1 means the projectile never expires. */
export const projectileLifeTicks = (lifeLength: number): number =>
  lifeLength < 0 ? Number.POSITIVE_INFINITY : lifeLength * 75;
