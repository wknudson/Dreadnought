import type { StatKey, TankDefinition } from './schema.ts';
import { STAT_ORDER } from './schema.ts';
import { statCap } from './tanks.ts';
import { STAT_COLORS } from './colors.ts';
import { PERKS, type PerkDefinition, type PerkHost } from '../sim/perkImpl.ts';
import type { StatBlock } from '../sim/stats.ts';
import type { PerkSet } from '../sim/perks.ts';
import type { Rng } from '../core/rng.ts';
import type { Difficulty } from './waves.ts';

/** One offer on a card. */
export type Card =
  | { kind: 'stat'; stat: StatKey; label: string; description: string; color: string }
  | { kind: 'perk'; perk: PerkDefinition }
  | { kind: 'heal'; amount: number };

/** How many cards a level-up offers. */
export const HAND_SIZE = 3;

/** What each stat does, said plainly for someone who has not played diep.io. */
const STAT_DESCRIPTIONS: Readonly<Record<StatKey, string>> = {
  regen: 'Heal faster when nothing has hit you for a moment.',
  maxHealth: 'Twenty more health.',
  bodyDamage: 'Hurt whatever you drive into.',
  bulletSpeed: 'Shots fly faster and therefore further.',
  bulletPen: 'Shots survive longer before breaking up.',
  bulletDamage: 'Shots hit harder.',
  reload: 'Fire noticeably more often.',
  moveSpeed: 'Drive faster.',
};

function statCard(def: TankDefinition, stat: StatKey): Card {
  return {
    kind: 'stat',
    stat,
    label: def.statNames?.[stat] ?? defaultLabel(stat),
    description: STAT_DESCRIPTIONS[stat],
    color: STAT_COLORS[stat],
  };
}

const defaultLabel = (stat: StatKey): string =>
  ({
    regen: 'Health Regen',
    maxHealth: 'Max Health',
    bodyDamage: 'Body Damage',
    bulletSpeed: 'Bullet Speed',
    bulletPen: 'Bullet Penetration',
    bulletDamage: 'Bullet Damage',
    reload: 'Reload',
    moveSpeed: 'Movement Speed',
  })[stat];

export interface DealContext {
  def: TankDefinition;
  points: StatBlock;
  perks: PerkSet;
  host: PerkHost;
  difficulty: Difficulty;
  rng: Rng;
}

/** Stats this tank can still raise. */
function availableStats(def: TankDefinition, points: StatBlock): StatKey[] {
  return STAT_ORDER.filter((key) => points[key] < statCap(def, key));
}

/** Perks not yet maxed out, and that would do something for this build. */
function availablePerks(ctx: DealContext): PerkDefinition[] {
  return PERKS.filter((perk) => {
    if (ctx.perks.stacksOf(perk.id) >= perk.maxStacks) return false;
    return perk.available ? perk.available(ctx.host) : true;
  });
}

/**
 * Deals a hand of cards.
 *
 * Each slot independently rolls for a perk or a stat, which keeps the common
 * case, a straightforward stat bump, common, while leaving room for a hand of
 * three perks to turn up occasionally and feel like a moment.
 */
export function dealCards(ctx: DealContext): Card[] {
  const stats = availableStats(ctx.def, ctx.points);
  const perks = availablePerks(ctx);

  const hand: Card[] = [];
  const usedStats = new Set<StatKey>();
  const usedPerks = new Set<string>();

  for (let slot = 0; slot < HAND_SIZE; slot++) {
    const wantPerk = ctx.rng.next() < ctx.difficulty.perkChance;
    const perkPool = perks.filter((p) => !usedPerks.has(p.id));
    const statPool = stats.filter((s) => !usedStats.has(s));

    // Fall back to whichever pool still has something in it.
    const takePerk = (wantPerk && perkPool.length > 0) || statPool.length === 0;

    if (takePerk && perkPool.length) {
      const perk = ctx.rng.weighted(perkPool, (p) => p.weight);
      usedPerks.add(perk.id);
      hand.push({ kind: 'perk', perk });
    } else if (statPool.length) {
      const stat = ctx.rng.pick(statPool);
      usedStats.add(stat);
      hand.push(statCard(ctx.def, stat));
    } else {
      // Everything is capped: offer something rather than an empty slot.
      hand.push({ kind: 'heal', amount: 0.3 });
    }
  }

  return hand;
}

/** A short label for a card, used on the button and in the run summary. */
export function cardTitle(card: Card): string {
  switch (card.kind) {
    case 'stat':
      return `+1 ${card.label}`;
    case 'perk':
      return card.perk.name;
    case 'heal':
      return 'Field Dressing';
  }
}

export function cardDescription(card: Card): string {
  switch (card.kind) {
    case 'stat':
      return card.description;
    case 'perk':
      return card.perk.description;
    case 'heal':
      return 'Restores a third of your health.';
  }
}

export function cardRarity(card: Card): 'common' | 'uncommon' | 'rare' {
  if (card.kind === 'perk') return card.perk.rarity;
  return 'common';
}
