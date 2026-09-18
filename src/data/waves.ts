import type { Rng } from '../core/rng.ts';
import type { ShapeKind } from './shapes.ts';
import type { DifficultyId } from '../core/storage.ts';
import type { BossId } from './bosses.ts';
import { BOSS_ORDER } from './bosses.ts';
import { MAX_LEVEL } from './leveling.ts';
import { DEFAULT_ARENA_HALF_SIZE } from '../sim/world.ts';
import { TICKS_PER_SECOND } from '../core/loop.ts';

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
  /**
   * Chance a card slot offers a perk rather than a stat.
   *
   * The lever that pays for the perk pool existing, and the one that quietly
   * sets how much damage a player brings to a boss. A run deals 33 cards and
   * each slot rolls this independently, so a player ends with about 33 * (1 -
   * this) stat points: 24.8 at a quarter, 15.8 at a half. Raising it is what
   * recovers the runs a bigger pool costs, and the recovery flattens.
   *
   * It is not tied to how many perks there are, which is the trap. Going from
   * fifteen perks to twenty-one costs the same as going to twenty-seven, and
   * twelve perks that do nothing cost as much as twelve real ones: a run is won
   * by assembling the survival stack, and anything new in the pool displaces it.
   *
   * Push it too far and the win rate will thank you while the game gets worse.
   * Measured before `statShareOf` existed, hard at 0.52 won one more run in
   * thirty than at 0.44 and took 106 seconds to kill a boss instead of 68: the
   * win rate called that an improvement while the fight it was measuring grew
   * by three quarters. `bossHealthForWave` now corrects its level term for this
   * number, so that particular drift is answered and a rate moved today will
   * not repeat it. What the correction cannot answer is how the game plays with
   * a third of a run's cards spent on perks, so read fight length, not wins.
   */
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
    health: 0.8, damage: 0.65, budget: 0.8, breather: 8, perkChance: 0.35, xpBonus: 1.45,
  },
  normal: {
    id: 'normal', name: 'Normal',
    health: 1, damage: 1, budget: 1, breather: 6, perkChance: 0.35, xpBonus: 1.15,
  },
  hard: {
    id: 'hard', name: 'Hard',
    health: 1.3, damage: 1.35, budget: 1.3, breather: 4, perkChance: 0.44, xpBonus: 1,
  },
};

/** One kind of thing a wave can spend its budget on. */
export interface EnemyOption {
  /** A polygon, or an AI tank of the given tier. */
  kind: { type: 'shape'; shape: ShapeKind } | { type: 'tank'; tier: 1 | 2 | 3 | 4 };
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
 * and triangles, crashers arrive to break up camping, and the first enemy tank
 * arrives at wave four.
 *
 * That first one is deliberately a Basic Tank, the same thing the player is
 * still driving. A classed tank cannot exist below level fifteen, so fielding
 * one at wave four means fielding something the player is not yet allowed to
 * be, and the harness loses a quarter of its runs on that wave alone. A mirror
 * match is a fair introduction; the classes follow once the player has one.
 *
 * Tanks are weighted heavily against the polygons, because an enemy tank is the
 * only opponent that shoots back and a wave without one is a farming trip. The
 * polygons still outnumber them several to one: they cost a fraction as much,
 * and they are what the experience economy is built on.
 */
export const ENEMY_OPTIONS: readonly EnemyOption[] = [
  { kind: { type: 'shape', shape: 'square' }, cost: 1, unlockWave: 1, weight: 10 },
  { kind: { type: 'shape', shape: 'triangle' }, cost: 2, unlockWave: 2, weight: 8 },
  { kind: { type: 'shape', shape: 'smallCrasher' }, cost: 2, unlockWave: 3, weight: 6 },
  { kind: { type: 'shape', shape: 'largeCrasher' }, cost: 3, unlockWave: 4, weight: 5 },
  { kind: { type: 'shape', shape: 'pentagon' }, cost: 5, unlockWave: 4, weight: 4 },
  { kind: { type: 'tank', tier: 1 }, cost: 4, unlockWave: 4, weight: 8 },
  { kind: { type: 'tank', tier: 2 }, cost: 7, unlockWave: 7, weight: 16 },
  { kind: { type: 'tank', tier: 3 }, cost: 12, unlockWave: 9, weight: 12 },
  { kind: { type: 'shape', shape: 'alphaPentagon' }, cost: 25, unlockWave: 12, weight: 2 },
  { kind: { type: 'tank', tier: 4 }, cost: 20, unlockWave: 14, weight: 8 },
];

/** Whether an option fields an AI tank rather than a polygon. */
const isTankOption = (o: EnemyOption): boolean => o.kind.type === 'tank';

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
 * The share of a run's cards a difficulty leaves as stat points, against the
 * share the boss health curve was drawn for.
 *
 * A card slot offers a perk with probability `perkChance` and a stat otherwise,
 * so a difficulty's card rate decides how much of a level is damage. It moved,
 * and it moved by different amounts per difficulty: a player on hard now reaches
 * a boss with about a quarter fewer stat points than the curve assumed, while
 * the boss still collects its full share per level and hard's health multiplier
 * on top. Nobody chose that product. It is two numbers in two files, one of
 * which belongs to the cards rather than to the bosses.
 *
 * Scaling the level term by this puts it back: how hard a boss is stays a thing
 * the difficulty multipliers say, and a change to the card rate stops silently
 * retuning every boss fight in the game.
 *
 * It corrects for damage, which is what fight length is made of, and not for
 * survival. Perks are mostly what keeps a player alive, so a difficulty dealing
 * more of them has a player who lives longer and hits softer; only the second
 * half is the curve's business.
 */
export const statShareOf = (difficulty: Difficulty): number =>
  (1 - difficulty.perkChance) / REFERENCE_STAT_SHARE;

/**
 * The stat share the curve below was measured against: a card rate of 0.35.
 *
 * A record of the conditions of a measurement, not a preference. The fight
 * lengths that set the curve were timed on normal while it dealt perks at that
 * rate, so that is the point at which the correction has to be one.
 */
const REFERENCE_STAT_SHARE = 1 - 0.35;

/**
 * How much health a boss has on a given wave.
 *
 * diep.io gives every boss a flat three thousand, but there a boss is worn down
 * by a whole server. Solo, that is a four-minute grind against a health bar. It
 * scales with the wave instead, which keeps each boss a fight of roughly the
 * same length as the player's own firepower grows.
 *
 * What caps it is termination, not the win rate. A curve half again as steep
 * was measured at 10 wins in 54 against this one's 11, which is no difference
 * at all, so anyone reaching for the win rate to justify a number here will
 * find it cannot resolve one. The finale is what decides: on the steeper curve
 * one trial in 48 failed to finish inside six minutes, the boss grinding from
 * 6126 down to 1811 and still going, and on this one all 48 resolved. A boss
 * the player cannot finish is a worse failure than one they finish early, and
 * it is the only part of this that a measurement can actually see.
 */
export const bossHealthForWave = (
  wave: number,
  playerLevel: number,
  difficulty: Difficulty,
): number => 800 + 95 * wave + 24 * playerLevel * statShareOf(difficulty);

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

/**
 * How many AI tanks one wave may field.
 *
 * Without a cap the budget alone decides it, and the wave the first tank unlocks
 * on can already afford three of them against a player who has not picked a
 * class yet. That wave is not difficult, it is a wall. The cap opens at one and
 * widens at the pace the player's own firepower does.
 */
export const tankLimitForWave = (wave: number): number =>
  Math.min(6, 1 + Math.floor(Math.max(0, wave - 4) / 3));

/** How far above or below the player an AI tank may spawn. */
export const ENEMY_LEVEL_SPREAD = 2;

/**
 * The level an AI tank of this tier spawns at.
 *
 * Measured against the player rather than the wave number, because the two come
 * apart badly: a player who farms well is ten levels ahead of the wave by the
 * midgame, and an enemy tank that far behind is a moving polygon. Matching the
 * player keeps every tank fight a fair one however the run has gone, and the
 * jitter is there so a wave of three is not three identical tanks.
 */
export function enemyLevel(playerLevel: number, tier: number, jitter = 0): number {
  const level = playerLevel + jitter;
  // A higher-tier tank has to be at least high enough level to exist.
  return Math.max(Math.min(MAX_LEVEL, level), (tier - 1) * 15);
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

  // Buy one tank up front, so no wave past the unlock is polygons only. Weights
  // alone leave the occasional wave with nothing that shoots back, and that wave
  // reads as the game having forgotten about you.
  //
  // A boss wave is the exception and its allowance is one short: the boss is
  // already the thing that shoots back, and a level-matched escort on top of the
  // first one is what turns wave five from a fight into a funeral.
  const tankLimit = tankLimitForWave(index) - (boss ? 1 : 0);
  let tanksBought = 0;
  const tanks = tankLimit > 0 ? available.filter(isTankOption) : [];
  if (tanks.length) {
    const opener = rng.weighted(tanks, (o) => o.weight);
    budget -= opener.cost;
    counts.set(opener, 1);
    tanksBought = 1;
  }

  let guard = 0;
  while (budget >= 1 && available.length && guard++ < 200) {
    const affordable = available.filter(
      (o) => o.cost <= budget && (!isTankOption(o) || tanksBought < tankLimit),
    );
    if (!affordable.length) break;
    const pick = rng.weighted(affordable, (o) => o.weight);
    budget -= pick.cost;
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
    if (isTankOption(pick)) tanksBought++;
  }

  // Everything of one kind arrives together, in a trickle rather than at once.
  // Polygons lead and the tanks follow a beat behind, so a wave opens with
  // something to farm rather than with the hardest thing in it on the doorstep.
  const ordered = [...counts].sort(
    ([a], [b]) => Number(isTankOption(a)) - Number(isTankOption(b)),
  );
  let delay = 0;
  let announced = false;
  for (const [entry, count] of ordered) {
    if (isTankOption(entry) && !announced) {
      announced = true;
      if (delay > 0) delay += rng.int(TICKS_PER_SECOND * 2, TICKS_PER_SECOND * 5);
    }
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
