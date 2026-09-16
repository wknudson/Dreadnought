import type { Rng } from '../core/rng.ts';
import type { ShapeKind } from './shapes.ts';
import type { DifficultyId } from '../core/storage.ts';
import type { BossId } from './bosses.ts';
import { BOSS_ORDER } from './bosses.ts';
import { DEFAULT_ARENA_HALF_SIZE } from '../sim/world.ts';

/** How hard the run pushes back. */
export interface Difficulty {
  id: DifficultyId;
  name: string;
  /** Multiplier on enemy health. */
  health: number;
  /** Multiplier on enemy damage. */
  damage: number;
  /** Multiplier on how much a wave is allowed to spend. */
  budget: number;
  /** Seconds of quiet between waves. */
  breather: number;
  /** Chance a card slot offers a perk rather than a stat. */
  perkChance: number;
  /**
   * Multiplier on experience earned.
   *
   * Needed because a lower budget means fewer enemies, and fewer enemies means
   * less experience. Without this, the easy setting arrives at the first boss
   * several levels weaker than the hard one and is genuinely harder.
   */
  xpBonus: number;
}

export const DIFFICULTIES: Readonly<Record<DifficultyId, Difficulty>> = {
  easy: {
    id: 'easy', name: 'Easy',
    health: 0.8, damage: 0.65, budget: 0.8, breather: 8, perkChance: 0.28, xpBonus: 1.45,
  },
  normal: {
    id: 'normal', name: 'Normal',
    health: 1, damage: 1, budget: 1, breather: 6, perkChance: 0.25, xpBonus: 1.15,
  },
  hard: {
    id: 'hard', name: 'Hard',
    health: 1.3, damage: 1.35, budget: 1.3, breather: 4, perkChance: 0.35, xpBonus: 1,
  },
};

/** One kind of thing a wave can spend its budget on. */
export interface EnemyOption {
  /** A polygon, or an AI tank of the given tier. */
  kind: { type: 'shape'; shape: ShapeKind } | { type: 'tank'; tier: 2 | 3 | 4 };
  /** What one costs against the wave budget. */
  cost: number;
  /** The first wave this may appear on. */
  unlockWave: number;
  /** Relative likelihood of being picked when affordable. */
  weight: number;
}

/**
 * What a wave may be built from.
 *
 * Costs are relative to a square, and roughly track how much trouble each one
 * is. The unlock waves are what shape the opening: the first few are squares
 * and triangles, crashers arrive to break up camping, and enemy tanks only turn
 * up once the player has had a chance to pick a class.
 */
export const ENEMY_OPTIONS: readonly EnemyOption[] = [
  { kind: { type: 'shape', shape: 'square' }, cost: 1, unlockWave: 1, weight: 10 },
  { kind: { type: 'shape', shape: 'triangle' }, cost: 2, unlockWave: 2, weight: 8 },
  { kind: { type: 'shape', shape: 'smallCrasher' }, cost: 2, unlockWave: 3, weight: 6 },
  { kind: { type: 'shape', shape: 'largeCrasher' }, cost: 3, unlockWave: 4, weight: 5 },
  { kind: { type: 'shape', shape: 'pentagon' }, cost: 5, unlockWave: 4, weight: 4 },
  { kind: { type: 'tank', tier: 2 }, cost: 12, unlockWave: 6, weight: 5 },
  { kind: { type: 'tank', tier: 3 }, cost: 22, unlockWave: 10, weight: 4 },
  { kind: { type: 'shape', shape: 'alphaPentagon' }, cost: 25, unlockWave: 12, weight: 2 },
  { kind: { type: 'tank', tier: 4 }, cost: 40, unlockWave: 16, weight: 3 },
];

/** A boss arrives every this many waves. */
export const BOSS_INTERVAL = 5;
/**
 * Clearing this wave wins the run.
 *
 * Twenty-five gives all five bosses and lands a full run at roughly twenty
 * minutes, which is the length this was aimed at.
 */
export const FINAL_WAVE = 25;

export const isBossWave = (wave: number): boolean => wave > 0 && wave % BOSS_INTERVAL === 0;

/** Which boss stands at the end of a given boss wave. */
export function bossFor(wave: number): BossId | null {
  if (!isBossWave(wave)) return null;
  const index = Math.floor(wave / BOSS_INTERVAL) - 1;
  return BOSS_ORDER[index % BOSS_ORDER.length] ?? null;
}

/** One group of enemies arriving together. */
export interface SpawnGroup {
  entry: EnemyOption;
  count: number;
  /** Ticks after the wave starts before this group appears. */
  delayTicks: number;
}

export interface WaveDef {
  index: number;
  groups: SpawnGroup[];
  boss: BossId | null;
  /** Half-width the arena should be at, in diep units. */
  arenaHalfSize: number;
}

/**
 * How much wider the arena is than at the start, by wave.
 *
 * Clearing a boss earns room, which is both a reward and a necessity: later
 * waves field far more at once.
 */
export const arenaStageMultiplier = (wave: number): number =>
  1 + 0.32 * Math.floor(Math.max(0, wave - 1) / BOSS_INTERVAL);

/**
 * Half-width of the arena for a wave, in diep units.
 *
 * Measured against what the camera can actually show rather than fixed, because
 * a phone in portrait sees a quarter of the world width a desktop does. A fixed
 * arena is either most of the screen on one and a rumour on the other, with the
 * waves spawning somewhere out of sight.
 */
export const arenaSizeForWave = (wave: number, viewReference = DEFAULT_ARENA_HALF_SIZE): number =>
  Math.max(700, viewReference) * arenaStageMultiplier(wave);

/** What a wave is allowed to spend. Grows steadily rather than in jumps. */
export const budgetForWave = (wave: number, difficulty: Difficulty): number =>
  Math.round((8 + 3.2 * wave) * difficulty.budget);

/**
 * How much health a boss has on a given wave.
 *
 * diep.io gives every boss a flat three thousand, but there a boss is worn down
 * by a whole server. Solo, that is a four-minute grind against a health bar. It
 * scales with the wave instead, which keeps each boss a fight of roughly the
 * same length as the player's own firepower grows.
 */
export const bossHealthForWave = (wave: number, playerLevel: number): number =>
  400 + 70 * wave + 18 * playerLevel;

/** Experience for killing the boss of a given wave. */
export const bossXpForWave = (wave: number): number => 1200 + 240 * wave;

/**
 * How dangerous a boss is on a given wave, as a multiplier on its own numbers.
 *
 * The first boss arrives at wave five, when the player has only just picked a
 * class and has a couple of hundred health. Unscaled, it simply deletes them.
 */
export const bossThreatForWave = (wave: number, playerLevel: number): number =>
  Math.min(1.3, 0.3 + 0.02 * wave + playerLevel / 70);

/** The level an AI tank of this tier spawns at on this wave. */
export function enemyLevel(wave: number, tier: number): number {
  const base = Math.min(45, 4 + 2 * wave);
  // A higher-tier tank has to be at least high enough level to exist.
  return Math.max(base, (tier - 1) * 15);
}

/**
 * Builds a wave by spending a budget on whatever is unlocked.
 *
 * Generated rather than hand-authored, so the whole difficulty curve lives in
 * the costs and the budget formula above. That keeps tuning to a few numbers
 * instead of thirty hand-written tables.
 */
export function generateWave(index: number, difficulty: Difficulty, rng: Rng): WaveDef {
  const boss = bossFor(index);
  // A boss wave brings a smaller escort, since the boss is the fight.
  let budget = budgetForWave(index, difficulty) * (boss ? 0.45 : 1);

  const available = ENEMY_OPTIONS.filter((o) => index >= o.unlockWave && o.cost <= budget);
  const groups: SpawnGroup[] = [];
  const counts = new Map<EnemyOption, number>();

  let guard = 0;
  while (budget >= 1 && available.length && guard++ < 200) {
    const affordable = available.filter((o) => o.cost <= budget);
    if (!affordable.length) break;
    const pick = rng.weighted(affordable, (o) => o.weight);
    budget -= pick.cost;
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
  }

  // Everything of one kind arrives together, in a trickle rather than at once.
  let delay = 0;
  for (const [entry, count] of counts) {
    groups.push({ entry, count, delayTicks: delay });
    delay += rng.int(10, 40);
  }

  return {
    index,
    groups,
    boss,
    arenaHalfSize: arenaSizeForWave(index),
  };
}
