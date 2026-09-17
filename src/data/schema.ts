/**
 * Dreadnought tank data schema.
 *
 * All geometry is expressed in "diep units" where a level-1 circular tank body
 * has radius 50 and one background grid square is 50 units wide. A barrel's
 * `size` is its length measured outward from the tank centre, `width` is its
 * full thickness, and `offset` shifts it sideways perpendicular to its angle.
 */

export type StatKey =
  | 'regen'
  | 'maxHealth'
  | 'bodyDamage'
  | 'bulletSpeed'
  | 'bulletPen'
  | 'bulletDamage'
  | 'reload'
  | 'moveSpeed';

/** The eight stats in the order diep.io lists them in its sidebar. */
export const STAT_ORDER: readonly StatKey[] = [
  'regen',
  'maxHealth',
  'bodyDamage',
  'bulletSpeed',
  'bulletPen',
  'bulletDamage',
  'reload',
  'moveSpeed',
] as const;

export const STAT_LABELS: Readonly<Record<StatKey, string>> = {
  regen: 'Health Regen',
  maxHealth: 'Max Health',
  bodyDamage: 'Body Damage',
  bulletSpeed: 'Bullet Speed',
  bulletPen: 'Bullet Penetration',
  bulletDamage: 'Bullet Damage',
  reload: 'Reload',
  moveSpeed: 'Movement Speed',
};

/** The same names with the qualifier dropped, for the corner column on a phone. */
export const SHORT_STAT_LABELS: Readonly<Record<StatKey, string>> = {
  regen: 'Regen',
  maxHealth: 'Health',
  bodyDamage: 'Body',
  bulletSpeed: 'Speed',
  bulletPen: 'Pen',
  bulletDamage: 'Damage',
  reload: 'Reload',
  moveSpeed: 'Move',
};

/** What a barrel emits. Each kind has its own entity behaviour in sim/projectiles.ts. */
export type ProjectileKind =
  | 'bullet'
  | 'drone'
  | 'necroDrone'
  | 'trap'
  | 'swarm'
  | 'minion'
  | 'skimmer'
  | 'rocket'
  | 'glider';

/** How a barrel rectangle is drawn. */
export type BarrelShape =
  /** Plain rectangle. */
  | 'rect'
  /** Trapezoid flaring wider toward the muzzle (Machine Gun, drone spawners). */
  | 'trapezoidMuzzle'
  /** Trapezoid tapering narrower toward the muzzle (Stalker, Battleship). */
  | 'trapezoidBase';

export interface ProjectileDefinition {
  kind: ProjectileKind;
  /** Projectile radius = barrelWidth / 2 * sizeRatio. */
  sizeRatio: number;
  /** Multiplier on (2 + 1.5 * penetrationPoints). */
  health: number;
  /** Multiplier on (7 + 3 * damagePoints). */
  damage: number;
  /** Multiplier on (20 + 3 * bulletSpeedPoints), the terminal speed. */
  speed: number;
  /** Multiplier on the +-5 degree base spread. */
  scatterRate: number;
  /** Lifetime in units of 75 ticks (3 s). -1 means it never expires. */
  lifeLength: number;
  /** Knockback resistance: lower absorbs less of an impact. */
  absorbtionFactor: number;
  /** Max simultaneous live projectiles from this barrel (drones, minions). */
  maxCount?: number;
  /** Whether the player's cursor steers these drones. */
  controllable?: boolean;
  /** Barrels carried by the projectile itself (Skimmer, Rocketeer, Glider, Factory minions). */
  barrels?: BarrelDefinition[];
  /** Constant self-rotation in radians per tick (Skimmer spins at 0.1). */
  spinRate?: number;
  /** Ticks before the projectile's own barrels start firing (Rocketeer thruster). */
  startupDelay?: number;
}

export interface BarrelDefinition {
  /** Radians relative to the tank's facing. */
  angle: number;
  /** Perpendicular offset in diep units. */
  offset: number;
  /** Length from the tank centre to the muzzle, in diep units. */
  size: number;
  /** Full thickness in diep units. */
  width: number;
  /** Phase offset within this barrel's own reload period, 0 to 1. */
  delay: number;
  /** Reload multiplier: period = 15 * 0.914^reloadPoints * reload ticks. */
  reload: number;
  /** Recoil impulse applied to the owner, in units of 2 velocity. */
  recoil: number;
  shape: BarrelShape;
  /** Decorative trapezoid cap on the muzzle of trap launchers. */
  cap?: 'trapLauncher';
  /** Which input fires this barrel. Defaults to 'primary'. */
  trigger?: 'primary' | 'secondary';
  projectile: ProjectileDefinition;
}

export interface AutoTurretDefinition {
  /** Mount angle around the body, radians. Ignored when mountDistance is 0. */
  mountAngle: number;
  /** Distance from the body centre as a fraction of body radius. 0 is centred. */
  mountDistance: number;
  /** Turret base circle radius in diep units at base scale. */
  baseRadius: number;
  barrel: BarrelDefinition;
  /** Max deviation from the mount angle, radians. Undefined means full rotation. */
  arcLimit?: number;
}

export type Addon =
  /** A single independently aiming turret. */
  | { kind: 'autoTurret'; turret: AutoTurretDefinition }
  /** A ring of N turrets that slowly rotates (Auto 3, Auto 5). */
  | { kind: 'autoRing'; count: number; ringSpin: number; turret: AutoTurretDefinition }
  /** Spinning dark polygons behind the body (Smasher line). */
  | { kind: 'guard'; guards: GuardDefinition[] }
  /** The long trapezoid under Skimmer / Rocketeer / Glider barrels. */
  | { kind: 'launcher'; angle: number; length: number; width: number }
  /** Ranger's trapezoid over the barrel base. */
  | { kind: 'pronounced'; length: number; width: number; centerX: number };

export interface GuardDefinition {
  sides: number;
  /** Guard radius = bodyRadius * sizeRatio / sqrt(2). */
  sizeRatio: number;
  /** Static rotation offset in radians. */
  offsetAngle: number;
  /** Rotation in radians per tick. */
  spin: number;
}

export interface TankFlags {
  /** Fades out when idle (Stalker, Manager, Landmine). */
  invisible?: boolean;
  /** Right click pushes the camera forward (Predator). */
  zoom?: boolean;
  /** Body rotates constantly regardless of aim (Defender boss). */
  autoSpin?: boolean;
  /** Killing a square turns it into a drone (Necromancer). */
  necroCapture?: boolean;
}

export interface InvisibilityProfile {
  /** Opacity removed per tick while idle. */
  fadeRate: number;
  /** Opacity added per tick while moving. */
  moveRate: number;
  /** Opacity added per tick while firing. */
  shootRate: number;
  /** Opacity added when damaged. */
  damageAmount: number;
}

export interface TankDefinition {
  /** Stable kebab-case identifier, e.g. "penta-shot". */
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  /** Level at which this tank can first be chosen. */
  unlockLevel: 0 | 15 | 30 | 45;
  upgradesTo: string[];
  upgradesFrom: string[];
  barrels: BarrelDefinition[];
  /** Addons drawn beneath the body. */
  preAddons: Addon[];
  /** Addons drawn above the body. */
  postAddons: Addon[];
  /** Camera zoom multiplier; lower sees more. */
  fieldFactor: number;
  flags: TankFlags;
  invisibility?: InvisibilityProfile;
  /** Per-tank stat renames, e.g. Bullet Damage becomes Drone Damage. */
  statNames?: Partial<Record<StatKey, string>>;
  /** Per-tank caps overriding the default of 7. */
  statCaps?: Partial<Record<StatKey, number>>;
  /** Stats this tank does not have at all (Smasher line drops the bullet stats). */
  hiddenStats?: StatKey[];
  /** Body polygon: 1 is a circle, 4 a square. */
  sides: number;
  /** Multiplier on the level-derived body radius. Bosses are much larger. */
  sizeMultiplier?: number;
  /** Fixed body colour, used by bosses. Player and AI tanks use their team colour. */
  baseColor?: string;
  /** Knockback resistance of the body itself. */
  absorbtionFactor: number;
  /** Multiplier on movement acceleration. */
  speedMultiplier: number;
}

export type TankId = string;
