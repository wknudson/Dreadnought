/**
 * The bosses: who they are, the order they arrive in, and what they fight with.
 *
 * Only the data lives here. How each one moves is its `behaviour`, which
 * sim/bossAi.ts acts on, and the health one gets on a given wave comes from the
 * curve in data/waves.ts scaled by its `toughness`. The definitions are built
 * on the first call to `getBoss` and cached after that.
 */

import type { BarrelDefinition, TankDefinition } from './schema.ts';
import { COLORS } from './colors.ts';
import { getTank } from './tanks.ts';

export type BossId =
  | 'guardian'
  | 'summoner'
  | 'defender'
  | 'fallen-booster'
  | 'fallen-overlord';

/** The order bosses appear in, one every five waves. */
export const BOSS_ORDER: readonly BossId[] = [
  'guardian',
  'summoner',
  'defender',
  'fallen-booster',
  'fallen-overlord',
];

export interface BossDefinition {
  id: BossId;
  name: string;
  /** The tank definition the boss fights with. */
  def: TankDefinition;
  /**
   * How much of a wave's boss health this one gets.
   *
   * The five used to carry diep.io's flat three thousand, identical and unread,
   * with the wave formula deciding everything. They do not all die at the same
   * rate for it: the player picks the range, so a wide slow trap layer takes
   * punishment a charger crossing the arena never stands still for. These are
   * measured against how long each fight actually ran, not guessed.
   */
  toughness: number;
  /** Contact damage per tick. */
  bodyDamage: number;
  /** How it behaves, handled in sim/bossAi.ts. */
  behaviour: 'circler' | 'summoner' | 'fortress' | 'charger' | 'sieger';
  /** A line shown when it arrives. */
  taunt: string;
}

const spawner = (angle: number, count: number, reload: number): BarrelDefinition => ({
  angle,
  offset: 0,
  size: 70,
  width: 42,
  delay: 0,
  reload,
  recoil: 1,
  shape: 'trapezoidMuzzle',
  projectile: {
    kind: 'drone',
    sizeRatio: 1,
    health: 2,
    damage: 0.7,
    speed: 0.9,
    scatterRate: 1,
    lifeLength: -1,
    absorbtionFactor: 1,
    maxCount: count,
    controllable: false,
  },
});

const trapLauncher = (angle: number): BarrelDefinition => ({
  angle,
  offset: 0,
  size: 60,
  width: 50,
  delay: 0,
  // Slow enough that the traps form a hazard rather than a shield: a denser
  // wall simply absorbs everything fired at the boss behind it.
  reload: 3.5,
  recoil: 1,
  shape: 'rect',
  cap: 'trapLauncher',
  projectile: {
    kind: 'trap',
    sizeRatio: 0.9,
    health: 2.5,
    damage: 1.2,
    speed: 2,
    scatterRate: 1,
    lifeLength: 1.5,
    absorbtionFactor: 1,
  },
});

const autoTurret = (mountAngle: number, mountDistance: number) =>
  ({
    kind: 'autoTurret' as const,
    turret: {
      mountAngle,
      mountDistance,
      baseRadius: 22,
      arcLimit: Math.PI,
      barrel: {
        angle: 0,
        offset: 0,
        size: 55,
        width: 29.4,
        delay: 0.01,
        reload: 1.4,
        recoil: 0.3,
        shape: 'rect' as const,
        projectile: {
          kind: 'bullet' as const,
          sizeRatio: 1,
          health: 1.4,
          damage: 0.55,
          speed: 1.1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1,
        },
      },
    },
  });

/** Builds a boss's tank definition. Bosses are not part of the upgrade tree. */
function bossTank(
  id: string,
  sides: number,
  sizeMultiplier: number,
  color: string,
  barrels: BarrelDefinition[],
  postAddons: TankDefinition['postAddons'] = [],
): TankDefinition {
  return {
    id: `boss:${id}`,
    name: id,
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [],
    barrels,
    preAddons: [],
    postAddons,
    fieldFactor: 1,
    flags: {},
    sides,
    sizeMultiplier,
    baseColor: color,
    // A boss is not shoved about by what it is fighting.
    absorbtionFactor: 0.12,
    // Slower than the player, but not so much slower that running away wins.
    speedMultiplier: 0.8,
  };
}

const HALF = Math.PI / 2;

/**
 * The five bosses, one for each boss wave.
 *
 * Three are overgrown polygons and two are grey "fallen" tanks, which is how
 * diep.io splits them. The fallen pair reuse real tank definitions at a larger
 * size, so they fight with weapons the player recognises from the tree.
 */
function buildBosses(): Record<BossId, BossDefinition> {
  const fallenBooster: TankDefinition = {
    ...getTank('booster'),
    id: 'boss:fallen-booster',
    name: 'Fallen Booster',
    sizeMultiplier: 2.2,
    baseColor: COLORS.fallen,
    absorbtionFactor: 0.15,
    // The charger is the one boss you genuinely cannot outrun.
    speedMultiplier: 1.3,
  };

  const fallenOverlord: TankDefinition = {
    ...getTank('overlord'),
    id: 'boss:fallen-overlord',
    name: 'Fallen Overlord',
    sizeMultiplier: 2.4,
    baseColor: COLORS.fallen,
    absorbtionFactor: 0.1,
    speedMultiplier: 0.7,
    // Slower to replace its fleet than a player Overlord, but the drones bite harder.
    barrels: getTank('overlord').barrels.map((b) => ({
      ...b,
      reload: b.reload * 2,
      projectile: { ...b.projectile, damage: b.projectile.damage * 1.6, maxCount: 3 },
    })),
  };

  return {
    guardian: {
      id: 'guardian',
      name: 'Guardian of the Pentagons',
      def: bossTank('Guardian of the Pentagons', 3, 3.2, COLORS.crasher, [
        spawner(Math.PI, 8, 1.2),
      ]),
      toughness: 1.25,
      bodyDamage: 14,
      behaviour: 'circler',
      taunt: 'The Guardian wakes.',
    },

    summoner: {
      id: 'summoner',
      name: 'Summoner',
      def: bossTank('Summoner', 4, 3.4, COLORS.square, [
        spawner(0, 4, 2),
        spawner(HALF, 4, 2),
        spawner(Math.PI, 4, 2),
        spawner(-HALF, 4, 2),
      ]),
      toughness: 0.95,
      bodyDamage: 14,
      behaviour: 'summoner',
      taunt: 'The Summoner calls its swarm.',
    },

    defender: {
      id: 'defender',
      name: 'Defender',
      def: bossTank(
        'Defender',
        3,
        3.2,
        COLORS.triangle,
        [trapLauncher(0), trapLauncher((Math.PI * 2) / 3), trapLauncher((Math.PI * 4) / 3)],
        [autoTurret(0, 0.62), autoTurret((Math.PI * 2) / 3, 0.62), autoTurret((Math.PI * 4) / 3, 0.62)],
      ),
      toughness: 1.6,
      bodyDamage: 14,
      behaviour: 'fortress',
      taunt: 'The Defender rolls in.',
    },

    'fallen-booster': {
      id: 'fallen-booster',
      name: 'Fallen Booster',
      def: fallenBooster,
      toughness: 1.1,
      bodyDamage: 14,
      behaviour: 'charger',
      taunt: 'Something grey and fast is coming.',
    },

    'fallen-overlord': {
      id: 'fallen-overlord',
      name: 'Fallen Overlord',
      def: fallenOverlord,
      toughness: 0.8,
      bodyDamage: 14,
      behaviour: 'sieger',
      taunt: 'The Fallen Overlord takes the field.',
    },
  };
}

let cache: Record<BossId, BossDefinition> | null = null;

export function getBoss(id: BossId): BossDefinition {
  cache ??= buildBosses();
  return cache[id];
}
