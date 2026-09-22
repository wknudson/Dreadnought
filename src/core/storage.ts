/**
 * Persistence. Everything here is a convenience, never a requirement: a browser
 * with storage blocked plays exactly the same game, it just forgets.
 */

import { markWin, sanitizeCodex, type Codex } from './codex.ts';

const KEY = 'dreadnought.v1';

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface BestRun {
  wave: number;
  score: number;
  level: number;
  tank: string;
}

export interface Settings {
  colorId: string;
  difficulty: DifficultyId;
  autoFire: boolean;
  autoSpin: boolean;
}

interface Saved {
  settings: Settings;
  best: Partial<Record<DifficultyId, BestRun>>;
  codex: Codex;
}

const defaults = (): Saved => ({
  settings: { colorId: 'blue', difficulty: 'normal', autoFire: false, autoSpin: false },
  best: {},
  codex: {},
});

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const base = defaults();
    return {
      settings: { ...base.settings, ...parsed.settings },
      best: { ...parsed.best },
      codex: sanitizeCodex(parsed.codex),
    };
  } catch {
    // Private windows and blocked storage both land here.
    return defaults();
  }
}

function write(data: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Nothing to do: the run continues, it just will not be remembered.
  }
}

export function loadSettings(): Settings {
  return read().settings;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const data = read();
  data.settings = { ...data.settings, ...patch };
  write(data);
  return data.settings;
}

export function allBests(): Partial<Record<DifficultyId, BestRun>> {
  return read().best;
}

/** Records a finished run if it beat the stored one. Returns true when it did. */
export function recordRun(difficulty: DifficultyId, run: BestRun): boolean {
  const data = read();
  const previous = data.best[difficulty];
  // Waves survived is the headline; score settles ties.
  const better =
    !previous || run.wave > previous.wave || (run.wave === previous.wave && run.score > previous.score);
  if (better) {
    data.best[difficulty] = run;
    write(data);
  }
  return better;
}

export function loadCodex(): Codex {
  return read().codex;
}

/**
 * Marks a won run's tanks in the codex. Returns the ids whose mark was added
 * or raised, which is empty when the win only repeated what was already there.
 */
export function recordWin(path: readonly string[], difficulty: DifficultyId): string[] {
  const data = read();
  const { codex, changed } = markWin(data.codex, path, difficulty);
  if (changed.length) {
    data.codex = codex;
    write(data);
  }
  return changed;
}
