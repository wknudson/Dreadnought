/**
 * The codex: which tanks the player has won a run with, kept across runs.
 *
 * A win marks every tank the run passed through, not only the one it ended as,
 * so Basic and the tier-two tanks fill in on the way to the tier-four ones and
 * all fifty can be finished. Each mark remembers the hardest difficulty it was
 * won on and only ever moves up. It unlocks colours and nothing else: the
 * codex is something to chase, never something that makes a run easier.
 *
 * Everything here is pure, so it can be tested without a browser; storage.ts
 * is what reads and writes it.
 */

import type { DifficultyId } from './storage.ts';
import { TANKS } from '../data/tanks.ts';
import { PLAYER_COLORS } from '../data/colors.ts';

/** Tank id to the hardest difficulty a run was won on with it. */
export type Codex = Record<string, DifficultyId>;

export const DIFFICULTY_RANK: Readonly<Record<DifficultyId, number>> = {
  easy: 0,
  normal: 1,
  hard: 2,
};

const KNOWN_TANKS = new Set(TANKS.map((t) => t.id));

/**
 * Marks every tank on a winning run's path.
 *
 * Returns a new codex rather than changing the one given, along with the ids
 * whose mark was added or raised.
 */
export function markWin(
  codex: Codex,
  path: readonly string[],
  difficulty: DifficultyId,
): { codex: Codex; changed: string[] } {
  const next: Codex = { ...codex };
  const changed: string[] = [];
  for (const id of new Set(path)) {
    const previous = next[id];
    if (previous !== undefined && DIFFICULTY_RANK[previous] >= DIFFICULTY_RANK[difficulty]) continue;
    next[id] = difficulty;
    changed.push(id);
  }
  return { codex: next, changed };
}

/**
 * Reads a codex out of whatever storage held.
 *
 * Storage is never type-checked on the way in, so anything that is not a known
 * tank with a real difficulty is dropped rather than trusted.
 */
export function sanitizeCodex(raw: unknown): Codex {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const codex: Codex = {};
  for (const [id, difficulty] of Object.entries(raw)) {
    if (!KNOWN_TANKS.has(id)) continue;
    if (typeof difficulty !== 'string' || !(difficulty in DIFFICULTY_RANK)) continue;
    codex[id] = difficulty as DifficultyId;
  }
  return codex;
}

export const markedCount = (codex: Codex): number => Object.keys(codex).length;

/** Whether a colour may be picked with this many tanks marked. */
export const isColorUnlocked = (color: { unlockAt?: number }, count: number): boolean =>
  count >= (color.unlockAt ?? 0);

/** The codex total that unlocks the next colour, or null once every one is open. */
export function nextColorUnlock(count: number): number | null {
  const ahead = PLAYER_COLORS.map((c) => c.unlockAt ?? 0).filter((at) => at > count);
  return ahead.length ? Math.min(...ahead) : null;
}
