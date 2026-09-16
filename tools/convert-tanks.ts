/**
 * Generates src/data/tanks.generated.ts from the vendor tank table plus local overrides.
 *
 * The vendor file (tools/vendor/TankDefinitions.json, from the ABCxFF/diepcustom
 * project) supplies exact barrel geometry. Only numeric facts are read from it;
 * no vendor code is copied. Corrections, and the two tanks it omits, live in
 * tools/overrides/ so every deviation from the source is reviewable in one place.
 *
 * Run with: npm run data
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ADDONS, UNDER_BODY } from './addons.ts';
import type {
  Addon,
  BarrelDefinition,
  BarrelShape,
  ProjectileKind,
  StatKey,
  TankDefinition,
} from '../src/data/schema.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

interface VendorBullet {
  type: string;
  sizeRatio: number;
  health: number;
  damage: number;
  speed: number;
  scatterRate: number;
  lifeLength: number;
  absorbtionFactor: number;
}

interface VendorBarrel {
  angle: number;
  offset: number;
  size: number;
  width: number;
  delay: number;
  reload: number;
  recoil: number;
  isTrapezoid: boolean;
  trapezoidDirection: number;
  addon: string | null;
  droneCount?: number;
  canControlDrones?: boolean;
  bullet: VendorBullet;
}

interface VendorTank {
  id: number;
  name: string;
  levelRequirement: number;
  upgrades: number[];
  flags: { invisibility: boolean; zoomAbility: boolean; canClaimSquares: boolean; devOnly: boolean };
  visibilityRateShooting: number;
  visibilityRateMoving: number;
  invisibilityRate: number;
  fieldFactor: number;
  absorbtionFactor: number;
  speed: number;
  preAddon: string | null;
  postAddon: string | null;
  sides: number;
  barrels: VendorBarrel[];
  stats: { name: string; max: number }[];
}

/** Vendor ids to exclude: game-mode specials and internal placeholders, not tree tanks. */
const EXCLUDED_IDS = new Set([
  16, // Arena Closer
  27, // Mothership
  45, 46, 47, // Dominator variants
  53, // unnamed internal default
]);

/** Vendor bullet type strings mapped onto our projectile kinds. */
const KIND_BY_TYPE: Record<string, ProjectileKind> = {
  bullet: 'bullet',
  drone: 'drone',
  necrodrone: 'necroDrone',
  trap: 'trap',
  swarm: 'swarm',
  minion: 'minion',
  skimmer: 'skimmer',
  rocket: 'rocket',
};

const STAT_BY_LABEL: Record<string, StatKey> = {
  'Health Regen': 'regen',
  'Max Health': 'maxHealth',
  'Body Damage': 'bodyDamage',
  'Bullet Speed': 'bulletSpeed',
  'Bullet Penetration': 'bulletPen',
  'Bullet Damage': 'bulletDamage',
  Reload: 'reload',
  'Movement Speed': 'moveSpeed',
  // The Overseer branch renames the four projectile stats.
  'Drone Speed': 'bulletSpeed',
  'Drone Health': 'bulletPen',
  'Drone Damage': 'bulletDamage',
  'Drone Count': 'reload',
};

export const toId = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

function barrelShape(b: VendorBarrel): BarrelShape {
  if (!b.isTrapezoid) return 'rect';
  // trapezoidDirection 0 flares toward the muzzle; PI tapers toward it.
  return Math.abs(b.trapezoidDirection) < 1e-6 ? 'trapezoidMuzzle' : 'trapezoidBase';
}

function convertBarrel(b: VendorBarrel): BarrelDefinition {
  const kind = KIND_BY_TYPE[b.bullet.type];
  if (!kind) throw new Error(`unknown bullet type "${b.bullet.type}"`);
  const out: BarrelDefinition = {
    angle: round(b.angle),
    offset: round(b.offset),
    size: round(b.size),
    width: round(b.width),
    delay: round(b.delay),
    reload: round(b.reload),
    recoil: round(b.recoil),
    shape: barrelShape(b),
    projectile: {
      kind,
      sizeRatio: round(b.bullet.sizeRatio),
      health: round(b.bullet.health),
      damage: round(b.bullet.damage),
      speed: round(b.bullet.speed),
      scatterRate: round(b.bullet.scatterRate),
      lifeLength: round(b.bullet.lifeLength),
      absorbtionFactor: round(b.bullet.absorbtionFactor),
    },
  };
  if (b.addon === 'trapLauncher') out.cap = 'trapLauncher';
  // An unsigned-max drone count means no cap, which we model as an absent field.
  if (b.droneCount !== undefined && b.droneCount > 0 && b.droneCount < 1000) {
    out.projectile.maxCount = b.droneCount;
  }
  if (b.canControlDrones !== undefined) out.projectile.controllable = b.canControlDrones;
  return out;
}

function addonsFor(name: string | null): Addon[] {
  if (!name) return [];
  const found = ADDONS[name];
  if (!found) throw new Error(`no geometry defined for addon "${name}"`);
  return found;
}

function convertTank(v: VendorTank): TankDefinition {
  const statNames: Partial<Record<StatKey, string>> = {};
  const statCaps: Partial<Record<StatKey, number>> = {};
  const hiddenStats: StatKey[] = [];
  for (const s of v.stats) {
    const key = STAT_BY_LABEL[s.name];
    if (!key) throw new Error(`unknown stat label "${s.name}" on ${v.name}`);
    if (s.max === 0) hiddenStats.push(key);
    else if (s.max !== 7) statCaps[key] = s.max;
    // Record a rename only where the label differs from our default.
    if (s.name.startsWith('Drone')) statNames[key] = s.name;
  }

  const def: TankDefinition = {
    id: toId(v.name),
    name: v.name,
    tier: 1,
    unlockLevel: 0,
    upgradesTo: [],
    upgradesFrom: [],
    barrels: v.barrels.map(convertBarrel),
    preAddons: [],
    postAddons: [],
    fieldFactor: round(v.fieldFactor),
    flags: {},
    sides: v.sides,
    absorbtionFactor: round(v.absorbtionFactor),
    speedMultiplier: round(v.speed),
  };

  // An addon is drawn under the body or over it depending on which one it is.
  // Auto Smasher is the only tank carrying one of each.
  const under: Addon[] = [...addonsFor(v.preAddon)];
  const over: Addon[] = [];
  if (v.postAddon === 'autosmasher') {
    const [guard, turret] = addonsFor('autosmasher');
    if (guard) under.push(guard);
    if (turret) over.push(turret);
  } else if (v.postAddon) {
    (UNDER_BODY.has(v.postAddon) ? under : over).push(...addonsFor(v.postAddon));
  }
  def.preAddons = under;
  def.postAddons = over;

  if (v.flags.invisibility) {
    def.flags.invisible = true;
    def.invisibility = {
      fadeRate: round(v.invisibilityRate),
      moveRate: round(v.visibilityRateMoving),
      shootRate: round(v.visibilityRateShooting),
      damageAmount: 0.2,
    };
  }
  if (v.flags.zoomAbility) def.flags.zoom = true;
  if (v.flags.canClaimSquares) def.flags.necroCapture = true;
  if (Object.keys(statNames).length) def.statNames = statNames;
  if (Object.keys(statCaps).length) def.statCaps = statCaps;
  if (hiddenStats.length) def.hiddenStats = hiddenStats;
  return def;
}

type Json = Record<string, unknown>;

/** Deep merge where arrays merge element-wise by index, so a patch can touch one barrel. */
function merge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(base) && Array.isArray(patch)) {
    const out = [...(base as unknown[])];
    patch.forEach((p, i) => {
      out[i] = i < out.length ? merge(out[i], p) : p;
    });
    return out as T;
  }
  if (
    typeof base === 'object' &&
    base !== null &&
    !Array.isArray(base) &&
    typeof patch === 'object' &&
    !Array.isArray(patch)
  ) {
    const out: Json = { ...(base as Json) };
    for (const [k, val] of Object.entries(patch as Json)) out[k] = merge(out[k], val);
    return out as T;
  }
  return patch as T;
}

function main(): void {
  const raw = JSON.parse(
    readFileSync(join(root, 'tools/vendor/TankDefinitions.json'), 'utf8'),
  ) as (VendorTank | null)[];
  const vendor = raw.filter(
    (t): t is VendorTank => Boolean(t) && Boolean(t!.name) && !EXCLUDED_IDS.has(t!.id),
  );

  const byVendorId = new Map(vendor.map((v) => [v.id, v]));
  const tanks = new Map<string, TankDefinition>();
  const levelByTank = new Map<string, number>();

  for (const v of vendor) {
    const def = convertTank(v);
    if (tanks.has(def.id)) throw new Error(`duplicate tank id "${def.id}"`);
    def.upgradesTo = v.upgrades
      .filter((u) => byVendorId.has(u))
      .map((u) => toId(byVendorId.get(u)!.name));
    tanks.set(def.id, def);
    levelByTank.set(def.id, v.levelRequirement);
  }

  // Tanks the vendor table omits, supplied in full by overrides.
  for (const file of ['auto-tank', 'glider']) {
    const extra = JSON.parse(
      readFileSync(join(root, `tools/overrides/${file}.json`), 'utf8'),
    ) as TankDefinition;
    if (tanks.has(extra.id)) throw new Error(`override ${file} duplicates an existing tank`);
    tanks.set(extra.id, extra);
    levelByTank.set(extra.id, extra.unlockLevel);
    // Wire it into its parents so the graph stays connected.
    for (const parentId of extra.upgradesFrom) {
      const parent = tanks.get(parentId);
      if (!parent) throw new Error(`override ${file} names unknown parent "${parentId}"`);
      if (!parent.upgradesTo.includes(extra.id)) parent.upgradesTo.push(extra.id);
    }
  }

  // Patch corrections onto the converted tanks.
  const patches = JSON.parse(
    readFileSync(join(root, 'tools/overrides/tanks.json'), 'utf8'),
  ) as Record<string, unknown>;
  for (const [id, patch] of Object.entries(patches)) {
    if (id.startsWith('$')) continue; // comment keys
    const base = tanks.get(id);
    if (!base) throw new Error(`override targets unknown tank "${id}"`);
    tanks.set(id, merge(base, patch));
  }

  // Derive upgradesFrom from every upgradesTo edge.
  for (const def of tanks.values()) def.upgradesFrom = [];
  for (const def of tanks.values()) {
    for (const childId of def.upgradesTo) {
      const child = tanks.get(childId);
      if (!child) throw new Error(`${def.id} upgrades to unknown tank "${childId}"`);
      if (!child.upgradesFrom.includes(def.id)) child.upgradesFrom.push(def.id);
    }
  }

  // Tier comes from the unlock level, which is what the game actually gates on.
  // Graph depth alone would misplace the tier-skipping tanks (Smasher, Sprayer,
  // Auto Tank), each of which hangs off a much shallower parent.
  const errors: string[] = [];
  const reachable = new Set<string>(['tank']);
  const queue = ['tank'];
  while (queue.length) {
    const id = queue.shift()!;
    for (const childId of tanks.get(id)!.upgradesTo) {
      if (!reachable.has(childId)) {
        reachable.add(childId);
        queue.push(childId);
      }
    }
  }

  for (const def of tanks.values()) {
    const level = levelByTank.get(def.id) ?? 0;
    if (![0, 15, 30, 45].includes(level)) {
      errors.push(`${def.id} has an unexpected unlock level ${level}`);
      continue;
    }
    def.unlockLevel = level as 0 | 15 | 30 | 45;
    def.tier = (level / 15 + 1) as 1 | 2 | 3 | 4;
    if (!reachable.has(def.id)) errors.push(`${def.id} is unreachable from the root tank`);
    if (def.id !== 'tank' && def.upgradesFrom.length === 0) errors.push(`${def.id} has no parent`);
    for (const b of def.barrels) {
      if (b.size <= 0 || b.width <= 0) errors.push(`${def.id} has a degenerate barrel`);
      if (b.reload <= 0) errors.push(`${def.id} has a barrel with a non-positive reload`);
    }
  }

  const sorted = [...tanks.values()].sort(
    (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
  );
  const counts = [1, 2, 3, 4].map((t) => sorted.filter((d) => d.tier === t).length);

  if (errors.length) {
    for (const e of errors) console.error(`  error: ${e}`);
    console.error(`\n${errors.length} validation error(s)`);
    process.exit(1);
  }

  const banner = [
    '// GENERATED FILE - do not edit.',
    '// Produced by tools/convert-tanks.ts from tools/vendor/TankDefinitions.json',
    '// plus the corrections in tools/overrides/. Run "npm run data" to regenerate.',
    '',
    "import type { TankDefinition } from './schema.ts';",
    '',
  ].join('\n');

  // Unquote plain identifier keys so the generated file reads like hand-written source.
  const json = JSON.stringify(sorted, null, 2).replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, '$1$2:');
  writeFileSync(
    join(root, 'src/data/tanks.generated.ts'),
    `${banner}export const GENERATED_TANKS: readonly TankDefinition[] = ${json};\n`,
  );

  console.log(`${sorted.length} tanks, 0 validation errors`);
  console.log(
    `  tier 1: ${counts[0]}   tier 2: ${counts[1]}   tier 3: ${counts[2]}   tier 4: ${counts[3]}`,
  );
}

main();
