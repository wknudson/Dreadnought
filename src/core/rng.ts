/**
 * Seeded random numbers.
 *
 * Every random decision in the simulation goes through one of these so a run is
 * reproducible from its seed. Independent concerns take their own stream via
 * `fork`, which keeps visual randomness from perturbing gameplay.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Avoid the degenerate all-zero state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** mulberry32: small, fast, and good enough for a game. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** Uniform integer in [lo, hi]. */
  int(lo: number, hi: number): number {
    return Math.floor(this.range(lo, hi + 1));
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  angle(): number {
    return this.next() * Math.PI * 2;
  }

  pick<T>(items: readonly T[]): T {
    if (!items.length) throw new Error('pick from an empty list');
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Picks by relative weight. Items with a non-positive weight are never chosen. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    let total = 0;
    for (const item of items) total += Math.max(0, weightOf(item));
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, weightOf(item));
      if (roll <= 0) return item;
    }
    return items[items.length - 1]!;
  }

  /** Fisher-Yates, in place. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }

  /**
   * A new stream derived from this one and a name. Forking twice with the same
   * name yields the same stream, so streams stay stable as code is reordered.
   */
  fork(name: string): Rng {
    let h = this.state ^ 0x85ebca6b;
    for (let i = 0; i < name.length; i++) {
      h = Math.imul(h ^ name.charCodeAt(i), 0xc2b2ae35);
      h = (h << 13) | (h >>> 19);
    }
    return new Rng(h >>> 0);
  }
}

/** Reads a seed from the URL when present, otherwise invents one. */
export function seedFromLocation(): number {
  const param = new URLSearchParams(globalThis.location?.search ?? '').get('seed');
  if (param) {
    const parsed = Number.parseInt(param, 10);
    if (Number.isFinite(parsed)) return parsed >>> 0;
    // Allow word seeds by hashing them.
    let h = 0x811c9dc5;
    for (let i = 0; i < param.length; i++) h = Math.imul(h ^ param.charCodeAt(i), 0x01000193);
    return h >>> 0;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
