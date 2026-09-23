/**
 * Access to the tank roster. The definitions themselves are generated; this
 * module indexes them and answers the questions the rest of the game asks.
 */
import { GENERATED_TANKS } from './tanks.generated.ts';
import type { StatKey, TankDefinition, TankId } from './schema.ts';
import { STAT_LABELS, STAT_ORDER } from './schema.ts';

export const TANKS: readonly TankDefinition[] = GENERATED_TANKS;

const BY_ID = new Map<TankId, TankDefinition>(TANKS.map((t) => [t.id, t]));

/** The tank every run starts as. */
export const ROOT_TANK_ID: TankId = 'tank';

export function getTank(id: TankId): TankDefinition {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown tank "${id}"`);
  return def;
}

/**
 * The upgrade choices available to a tank at a given level.
 *
 * A branch only opens once the player reaches its unlock level, which is what
 * lets the tier-skipping tanks (Smasher at 30, Sprayer and Auto Tank at 45)
 * appear alongside the ordinary choices rather than instead of them.
 */
export function upgradeChoices(id: TankId, level: number): TankDefinition[] {
  return getTank(id)
    .upgradesTo.map(getTank)
    .filter((child) => level >= child.unlockLevel)
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}

/** The stats this tank actually uses, in sidebar order, with its own labels applied. */
export function visibleStats(def: TankDefinition): { key: StatKey; label: string; cap: number }[] {
  const hidden = new Set(def.hiddenStats ?? []);
  return STAT_ORDER.filter((key) => !hidden.has(key)).map((key) => ({
    key,
    label: def.statNames?.[key] ?? STAT_LABELS[key],
    cap: def.statCaps?.[key] ?? DEFAULT_STAT_CAP,
  }));
}

/** The cap on a single stat for tanks that do not override it. */
export const DEFAULT_STAT_CAP = 7;

export function statCap(def: TankDefinition, key: StatKey): number {
  if (def.hiddenStats?.includes(key)) return 0;
  return def.statCaps?.[key] ?? DEFAULT_STAT_CAP;
}

/**
 * How far a tank's body reaches, guards included but barrels not, as a multiple
 * of body radius. Anything drawn around the hull starts from here, so a Smasher's
 * spinning guard does not hide it.
 */
export function hullExtent(def: TankDefinition): number {
  let extent = 1;
  for (const addon of [...def.preAddons, ...def.postAddons]) {
    if (addon.kind === 'guard') for (const g of addon.guards) extent = Math.max(extent, g.sizeRatio);
  }
  return extent;
}
