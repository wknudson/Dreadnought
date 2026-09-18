import { Entity, type EntityKind } from './entity.ts';
import type { World } from './world.ts';
import { integrate, maintainVelocity } from './physics.ts';
import type { ProjectileStats } from './stats.ts';
import { deriveProjectileStats, projectilePush, type StatBlock } from './stats.ts';
import { BarrelHost, type BarrelOwner, type BarrelState } from './weapon.ts';
import { setProjectileFactory } from './weapon.ts';
import type { BarrelDefinition, ProjectileKind, TankDefinition } from '../data/schema.ts';
import { vec, wrapAngle, type Vec2 } from '../core/math.ts';

/** Perk-driven behaviour attached to a projectile when it spawns. */
export interface ProjectileMods {
  /** Extra enemies a projectile survives passing through. */
  pierce: number;
  /** Times it may bounce off the arena wall. */
  bounces: number;
  /** Radians per tick it may steer toward a target. Zero disables homing. */
  homing: number;
  /** Children spawned when it expires or lands. */
  split: number;
  /** Radius of an explosion on impact. */
  explodeRadius: number;
}

export const noMods = (): ProjectileMods => ({
  pierce: 0,
  bounces: 0,
  homing: 0,
  split: 0,
  explodeRadius: 0,
});

/** What a drone is being told to do this tick. */
export interface DroneOrders {
  /** Where the owner's cursor is, in world space. */
  target: Vec2;
  /** True while the owner is actively steering them. */
  steering: boolean;
  /** True while the owner is pushing them away instead. */
  repelling: boolean;
}

/**
 * Anything a barrel emits.
 *
 * All projectile kinds share a lifetime, a health pool that erodes as they punch
 * through things, and the contact damage the physics pass reads.
 */
export abstract class Projectile extends Entity {
  override readonly kind: EntityKind = 'projectile';

  contactDamage: number;
  lifeTicks: number;
  age = 0;
  mods: ProjectileMods = noMods();

  /** The barrel that fired this, so its slot can be freed on death. */
  readonly spawner: BarrelState | null;
  /** The projectile kind, which decides how it is drawn. */
  readonly projectileKind: ProjectileKind;

  /** Colour of the fade-out puff. Set by whoever spawns the projectile. */
  deathColor = '#00B2E1';
  /** Polygon sides for the fade-out puff. */
  deathSides = 1;

  /**
   * Set on projectiles that carry barrels of their own.
   *
   * Missiles and minions are drawn through the same renderer as tanks, so they
   * need something shaped like a tank definition to hand it.
   */
  carriedDef: TankDefinition | null = null;

  constructor(
    pos: Vec2,
    angle: number,
    stats: ProjectileStats,
    kind: ProjectileKind,
    spawner: BarrelState | null,
  ) {
    super();
    this.pos = vec(pos.x, pos.y);
    this.prevPos = vec(pos.x, pos.y);
    this.angle = angle;
    this.prevAngle = angle;
    this.radius = stats.radius;
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.contactDamage = stats.damage;
    this.lifeTicks = stats.lifeTicks;
    this.absorbtionFactor = stats.absorbtionFactor;
    this.projectileKind = kind;
    this.spawner = spawner;
    this.hideHealthBar = true;
    // A quarter damage taken is what gives penetration its meaning: a bullet
    // survives several shapes rather than trading one for one.
    this.incomingDamageScale = 0.25;
  }

  /**
   * Spends a piercing charge rather than breaking up.
   *
   * Penetration is otherwise a health pool, and a health pool cannot express
   * "carries through one more enemy": a shape deals its body damage on every
   * tick the two overlap, so the shot that survives a big hit is the one that
   * happened to be moving fast enough. A charge makes the promise literal.
   */
  override damage(amount: number): boolean {
    const died = super.damage(amount);
    if (!died || this.mods.pierce <= 0) return died;
    this.mods.pierce--;
    this.alive = true;
    this.health = this.maxHealth;
    return false;
  }

  /**
   * Cleans up however the projectile died.
   *
   * A drone shot down by an enemy and one that simply timed out both land here,
   * which matters: if only the timeout freed the spawner slot, a fleet that lost
   * a fight could never be rebuilt.
   */
  override onDespawn(world: World): void {
    if (this.spawner) BarrelHost.release(this.spawner);
    world.addDeath({
      pos: vec(this.pos.x, this.pos.y),
      angle: this.angle,
      radius: this.radius,
      color: this.deathColor,
      sides: this.deathSides,
      def: null,
    });
  }

  /** Ends this projectile. Cleanup happens in onDespawn. */
  protected expire(_world: World): void {
    this.alive = false;
  }

  abstract override update(world: World): void;
}

/** A plain bullet: launched fast, settles to a cruise speed, expires on a timer. */
export class Bullet extends Projectile {
  /** Terminal speed this bullet converges on. */
  protected readonly cruise: number;

  constructor(
    pos: Vec2,
    angle: number,
    stats: ProjectileStats,
    kind: ProjectileKind,
    spawner: BarrelState | null,
  ) {
    super(pos, angle, stats, kind, spawner);
    this.cruise = stats.acceleration;
    // A shot leaves the barrel faster than it can sustain and is dragged back to
    // its cruise speed, which is why a quick tank can outrun its own bullets.
    this.vel = vec(Math.cos(angle) * stats.initialSpeed, Math.sin(angle) * stats.initialSpeed);
  }

  override update(world: World): void {
    this.age++;
    if (this.age >= this.lifeTicks) {
      this.expire(world);
      return;
    }

    if (this.mods.homing > 0) this.steerTowardTarget(world);

    maintainVelocity(this, this.angle, this.cruise);
    integrate(this);

    if (this.mods.bounces > 0) this.bounceOffWalls(world);
    else if (world.outsideArena(this.pos, this.radius)) this.expire(world);
  }

  private steerTowardTarget(world: World): void {
    const best = nearestHostile(world, this, 600);
    if (!best) return;
    const want = Math.atan2(best.pos.y - this.pos.y, best.pos.x - this.pos.x);
    const delta = wrapAngle(want - this.angle);
    this.angle += Math.max(-this.mods.homing, Math.min(this.mods.homing, delta));
  }

  /**
   * Breaks up into smaller shots rather than simply going out.
   *
   * Hung on the despawn rather than on the timer because a shot almost never
   * reaches its timer: it crosses the arena in less time than it has, so the
   * deaths that matter are the ones against something. A shot that left the
   * arena is excluded, since its children would be born outside it and die on
   * their first tick.
   *
   * The children carry none of the parent's splitting, so no chain of them is
   * possible however far the perk is stacked; stacking widens the fan instead.
   */
  override onDespawn(world: World): void {
    const count = this.mods.split;
    if (count > 0 && !world.outsideArena(this.pos, this.radius)) {
      const spread = Math.PI / 5;
      for (let i = 0; i < count; i++) {
        const offset = count === 1 ? 0 : spread * (i / (count - 1) - 0.5) * 2;
        const child = new Bullet(
          this.pos,
          this.angle + offset,
          {
            damage: this.contactDamage * 0.5,
            health: this.maxHealth * 0.5,
            acceleration: this.cruise,
            initialSpeed: this.cruise,
            radius: this.radius * 0.6,
            lifeTicks: Math.max(6, this.lifeTicks * 0.4),
            absorbtionFactor: this.absorbtionFactor,
            scatter: 0,
          },
          'bullet',
          null,
        );
        child.team = this.team;
        child.owner = this.owner;
        child.deathColor = this.deathColor;
        child.pushFactor = this.pushFactor * 0.5;
        world.spawn(child);
      }
    }
    super.onDespawn(world);
  }

  private bounceOffWalls(world: World): void {
    const limit = world.inset(this.radius);
    let bounced = false;
    if (this.pos.x < -limit.x || this.pos.x > limit.x) {
      this.pos.x = Math.max(-limit.x, Math.min(limit.x, this.pos.x));
      this.vel.x *= -1;
      bounced = true;
    }
    if (this.pos.y < -limit.y || this.pos.y > limit.y) {
      this.pos.y = Math.max(-limit.y, Math.min(limit.y, this.pos.y));
      this.vel.y *= -1;
      bounced = true;
    }
    if (bounced) {
      this.angle = Math.atan2(this.vel.y, this.vel.x);
      this.mods.bounces--;
    }
  }
}

/** Anything that can give drones orders. Implemented by Tank. */
export interface DroneCommander {
  droneOrders(): DroneOrders;
}

/** How far from its owner a drone will chase something. */
const DRONE_VIEW_RANGE = 900;
/** The radius of the ring idle drones settle into. */
const DRONE_REST_RADIUS = 400;

/**
 * A drone: a triangle that flies itself, and that you can point at things.
 *
 * Left click sends them at the cursor, right click pushes them away. With
 * neither held they hunt anything near their owner, and failing that they circle
 * the owner in a loose halo. That idle orbit is most of what an Overseer looks
 * like from the outside.
 */
export class Drone extends Projectile {
  private readonly cruise: number;
  private readonly commander: DroneCommander | null;
  /** Set while the drone is loitering, which slows it to a drift. */
  private resting = false;

  constructor(
    pos: Vec2,
    angle: number,
    stats: ProjectileStats,
    kind: ProjectileKind,
    spawner: BarrelState | null,
    commander: DroneCommander | null,
    controllable: boolean,
  ) {
    super(pos, angle, stats, kind, spawner);
    this.cruise = stats.acceleration;
    this.commander = controllable ? commander : null;
    this.pushFactor = 4;
    this.deathSides = 3;
    // Drones leave the spawner at a third of a bullet's pace.
    const launch = stats.initialSpeed / 3;
    this.vel = vec(Math.cos(angle) * launch, Math.sin(angle) * launch);
  }

  override update(world: World): void {
    this.age++;
    // A lifeLength of -1 gives an infinite life, which is what most drones have.
    if (this.age >= this.lifeTicks) {
      this.expire(world);
      return;
    }

    const owner = this.owner;
    if (!owner || !owner.alive) {
      // Drones die with the tank that made them.
      this.expire(world);
      return;
    }

    const orders = this.commander?.droneOrders();
    let heading: number;
    let throttle = 1;

    if (orders && (orders.steering || orders.repelling)) {
      heading = Math.atan2(orders.target.y - this.pos.y, orders.target.x - this.pos.x);
      if (orders.repelling) heading += Math.PI;
    } else {
      const prey = nearestHostileNear(world, this, owner.pos, DRONE_VIEW_RANGE);
      if (prey) {
        heading = Math.atan2(prey.pos.y - this.pos.y, prey.pos.x - this.pos.x);
      } else {
        const idle = this.idleHeading(owner.pos);
        heading = idle.heading;
        throttle = idle.throttle;
      }
    }

    this.angle = heading;
    maintainVelocity(this, heading, this.cruise * throttle);
    integrate(this);
    world.clampToArena(this);
  }

  /**
   * Circles the owner when there is nothing to do.
   *
   * Drones aim at a point tangent to their owner rather than at the owner, which
   * makes them orbit instead of piling into the hull. Close in they throttle
   * back and simply turn on the spot.
   */
  private idleHeading(ownerPos: Vec2): { heading: number; throttle: number } {
    const dx = this.pos.x - ownerPos.x;
    const dy = this.pos.y - ownerPos.y;
    const distance2 = dx * dx + dy * dy;
    const unit = distance2 / (DRONE_REST_RADIUS * DRONE_REST_RADIUS);

    if (unit <= 1 && this.resting) {
      return { heading: this.angle + 0.01 + 0.012 * unit, throttle: 1 / 6 };
    }

    const tangent = Math.atan2(dy, dx) + Math.PI / 2;
    const ownerRadius = this.owner?.radius ?? 50;
    const aimX = ownerPos.x + Math.cos(tangent) * ownerRadius * 1.2;
    const aimY = ownerPos.y + Math.sin(tangent) * ownerRadius * 1.2;
    const heading = Math.atan2(aimY - this.pos.y, aimX - this.pos.x);

    const toAim = (aimX - this.pos.x) ** 2 + (aimY - this.pos.y) ** 2;
    this.resting = toAim <= 4 * ownerRadius * ownerRadius;
    return { heading, throttle: unit < 0.5 ? 1 / 3 : 1 };
  }
}

/**
 * A square raised by a Necromancer from one it killed.
 *
 * Behaves like a drone but is treated as a shape for damage, so unlike every
 * other projectile it takes hits at full strength rather than a quarter.
 */
export class NecroDrone extends Drone {
  constructor(
    pos: Vec2,
    angle: number,
    stats: ProjectileStats,
    spawner: BarrelState | null,
    commander: DroneCommander | null,
  ) {
    super(pos, angle, stats, 'necroDrone', spawner, commander, true);
    this.deathSides = 4;
    // A raised square is still a square: it takes hits in full.
    this.incomingDamageScale = 1;
  }
}

/**
 * A trap: thrown a short way, then left sitting where it lands.
 *
 * Unlike a bullet it has no engine, so friction alone decides how far it goes.
 * It also long outlives the shot that placed it, which is the whole point.
 */
export class Trap extends Projectile {
  constructor(
    pos: Vec2,
    angle: number,
    stats: ProjectileStats,
    spawner: BarrelState | null,
    rng: { angle(): number },
  ) {
    super(pos, angle, stats, 'trap', spawner);
    // Traps tumble out at whatever angle they please.
    this.angle = rng.angle();
    this.prevAngle = this.angle;
    this.deathSides = 3;
    const launch = stats.acceleration / 2 + 30;
    this.vel = vec(Math.cos(angle) * launch, Math.sin(angle) * launch);
  }

  override update(world: World): void {
    this.age++;
    if (this.age >= this.lifeTicks) {
      this.expire(world);
      return;
    }
    // No thrust: it slides to a halt and stays put.
    integrate(this);
    world.clampToArena(this);
  }
}

/**
 * A missile that carries barrels of its own.
 *
 * Skimmer's spins while firing sideways; Rocketeer's is driven by the recoil of
 * a rear thruster rather than by any speed of its own, which is why it starts
 * slow and builds. Both inherit their launcher's upgrades through `owner`.
 */
export class Missile extends Projectile implements BarrelOwner {
  private readonly cruise: number;
  private readonly host: BarrelHost;
  private readonly spinRate: number;
  private readonly startupDelay: number;
  private readonly ownerStats: () => StatBlock;
  private readonly ownerReload: () => number;
  private readonly ownerScale: number;
  /** Reverses the spin, which is Skimmer's right-click. */
  private readonly commander: DroneCommander | null;

  constructor(
    pos: Vec2,
    angle: number,
    stats: ProjectileStats,
    kind: ProjectileKind,
    spawner: BarrelState | null,
    barrels: readonly BarrelDefinition[],
    options: {
      spinRate: number;
      startupDelay: number;
      stats: () => StatBlock;
      reloadScale: () => number;
      scale: number;
      commander: DroneCommander | null;
    },
  ) {
    super(pos, angle, stats, kind, spawner);
    this.cruise = stats.acceleration;
    this.host = new BarrelHost(barrels);
    this.spinRate = options.spinRate;
    this.startupDelay = options.startupDelay;
    this.ownerStats = options.stats;
    this.ownerReload = options.reloadScale;
    this.ownerScale = options.scale;
    this.commander = options.commander;
    this.vel = vec(Math.cos(angle) * stats.initialSpeed, Math.sin(angle) * stats.initialSpeed);
    this.carriedDef = carrierDefinition(kind, barrels, 1);
  }

  get entity(): Entity {
    return this;
  }

  stats(): StatBlock {
    return this.ownerStats();
  }

  reloadScale(): number {
    return this.ownerReload();
  }

  /** The missile's own size drives its barrels, so they shrink with it. */
  scale(): number {
    return (this.radius / 25) * 0.5 * this.ownerScale;
  }

  aimAngle(): number {
    return this.angle;
  }

  override update(world: World): void {
    this.age++;
    if (this.age >= this.lifeTicks) {
      this.expire(world);
      return;
    }

    if (this.spinRate) {
      const orders = this.commander?.droneOrders();
      this.angle += orders?.repelling ? -this.spinRate : this.spinRate;
    }

    // A missile with its own thrust coasts; one without is pushed by recoil alone.
    if (this.cruise > 0) maintainVelocity(this, this.angle, this.cruise);
    integrate(this);

    if (this.age >= this.startupDelay) {
      this.host.tick(this, this.angle, { world, fire: true, secondary: false, alwaysFire: true });
    }

    if (world.outsideArena(this.pos, this.radius)) this.expire(world);
  }
}

/**
 * A Factory minion: a small circular tank with a gun, flying loose.
 *
 * It orbits wherever its owner is pointing rather than chasing outright, which
 * is what makes a Factory feel like it is directing a squad.
 */
export class Minion extends Projectile implements BarrelOwner {
  private readonly cruise: number;
  private readonly host: BarrelHost;
  private readonly ownerStats: () => StatBlock;
  private readonly ownerReload: () => number;
  private readonly commander: DroneCommander | null;

  /** Squared distance the minions try to hold from the cursor. */
  private static readonly FOCUS_RADIUS = 800;

  constructor(
    pos: Vec2,
    angle: number,
    stats: ProjectileStats,
    spawner: BarrelState | null,
    barrels: readonly BarrelDefinition[],
    ownerStats: () => StatBlock,
    ownerReloadScale: () => number,
    commander: DroneCommander | null,
  ) {
    super(pos, angle, stats, 'minion', spawner);
    this.cruise = stats.acceleration;
    this.host = new BarrelHost(barrels);
    this.ownerStats = ownerStats;
    this.ownerReload = ownerReloadScale;
    this.commander = commander;
    this.pushFactor = 4;
    const launch = stats.initialSpeed / 3;
    this.vel = vec(Math.cos(angle) * launch, Math.sin(angle) * launch);
    this.carriedDef = carrierDefinition('minion', barrels, 1);
  }

  get entity(): Entity {
    return this;
  }

  stats(): StatBlock {
    return this.ownerStats();
  }

  reloadScale(): number {
    return this.ownerReload();
  }

  scale(): number {
    // A minion is roughly half a tank, and its gun is scaled to match.
    return this.radius / 50;
  }

  aimAngle(): number {
    return this.angle;
  }

  override update(world: World): void {
    this.age++;
    const owner = this.owner;
    if (this.age >= this.lifeTicks || !owner || !owner.alive) {
      this.expire(world);
      return;
    }

    const orders = this.commander?.droneOrders();
    const focus = orders?.target ?? owner.pos;

    // Face whatever is worth shooting, and move relative to the focus point.
    const prey = nearestHostileNear(world, this, owner.pos, DRONE_VIEW_RANGE);
    this.angle = prey
      ? Math.atan2(prey.pos.y - this.pos.y, prey.pos.x - this.pos.x)
      : Math.atan2(focus.y - this.pos.y, focus.x - this.pos.x);

    const toFocus = Math.hypot(focus.x - this.pos.x, focus.y - this.pos.y);
    const bearing = Math.atan2(focus.y - this.pos.y, focus.x - this.pos.x);
    let heading = bearing;
    if (orders?.repelling) heading = bearing + Math.PI;
    else if (toFocus < Minion.FOCUS_RADIUS / 3) heading = bearing + Math.PI;
    else if (toFocus < Minion.FOCUS_RADIUS) heading = bearing + Math.PI / 2;

    maintainVelocity(this, heading, this.cruise);
    integrate(this);
    world.clampToArena(this);

    this.host.tick(this, this.angle, {
      world,
      fire: true,
      secondary: false,
      alwaysFire: true,
    });
  }
}

/**
 * A throwaway definition so a barrel-carrying projectile can be drawn as a tank.
 *
 * Only the fields the renderer reads are filled in; nothing looks this up in the
 * roster, and it never takes part in the upgrade tree.
 */
function carrierDefinition(
  id: string,
  barrels: readonly BarrelDefinition[],
  sides: number,
): TankDefinition {
  return {
    id: `carried:${id}`,
    name: id,
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [],
    barrels: [...barrels],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides,
    absorbtionFactor: 1,
    speedMultiplier: 1,
  };
}

// --- Target finding --------------------------------------------------------

/** The nearest thing this projectile is willing to hit. */
function nearestHostile(world: World, from: Entity, range: number): Entity | null {
  let best: Entity | null = null;
  let bestDist = range * range;
  for (const e of world.near(from.pos, range)) {
    if (!e.alive || e.kind === 'projectile' || e.kind === 'pickup') continue;
    if (e.team === from.team || e.team === 'neutral') continue;
    const d = (e.pos.x - from.pos.x) ** 2 + (e.pos.y - from.pos.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

/**
 * The nearest hostile within range of a separate anchor point.
 *
 * Drones only engage what is near their owner, not what is near themselves, so
 * a drifting drone cannot drag the whole fleet across the arena.
 */
function nearestHostileNear(
  world: World,
  from: Entity,
  anchor: Vec2,
  range: number,
): Entity | null {
  let best: Entity | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const e of world.near(anchor, range)) {
    if (!e.alive || e.kind === 'projectile' || e.kind === 'pickup') continue;
    if (e.team === from.team || e.team === 'neutral') continue;
    const d = (e.pos.x - from.pos.x) ** 2 + (e.pos.y - from.pos.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

// --- Construction ----------------------------------------------------------

/** A BarrelOwner that can also command drones, which tanks and missiles can. */
type MaybeCommander = BarrelOwner & Partial<DroneCommander>;

const commanderOf = (owner: MaybeCommander): DroneCommander | null =>
  typeof owner.droneOrders === 'function' ? (owner as DroneCommander) : null;

/**
 * Builds the projectile a barrel just fired.
 *
 * Registered with the weapon module so barrels can create projectiles without
 * importing this file, which would be a cycle.
 */
setProjectileFactory((world, owner, barrel, spawn, angle) => {
  const def = barrel.def.projectile;
  const stats = deriveProjectileStats(owner.stats(), barrel.def, owner.scale());
  const source = owner.entity;
  // Perks get their say before anything is built, since a projectile reads its
  // stats once in the constructor and never again.
  const mods = noMods();
  source.rootOwner().shotModifier?.(stats, mods);
  const commander = commanderOf(owner as MaybeCommander);
  const color = (source as Entity & { color?: string }).color ?? '#00B2E1';

  let projectile: Projectile;
  switch (def.kind) {
    case 'drone':
    case 'swarm':
      projectile = new Drone(
        spawn,
        angle,
        stats,
        def.kind,
        barrel,
        commander,
        def.controllable ?? false,
      );
      break;

    case 'necroDrone':
      // Only raised from a killed square, never fired from the spawner itself.
      return null;

    case 'trap':
      projectile = new Trap(spawn, angle, stats, barrel, world.rng);
      break;

    case 'minion':
      projectile = new Minion(
        spawn,
        angle,
        stats,
        barrel,
        def.barrels ?? [],
        () => owner.stats(),
        () => owner.reloadScale(),
        commander,
      );
      break;

    case 'skimmer':
    case 'rocket':
    case 'glider':
      projectile = new Missile(spawn, angle, stats, def.kind, barrel, def.barrels ?? [], {
        spinRate: def.spinRate ?? 0,
        startupDelay: def.startupDelay ?? 0,
        stats: () => owner.stats(),
        reloadScale: () => owner.reloadScale(),
        scale: owner.scale(),
        commander,
      });
      break;

    default:
      projectile = new Bullet(spawn, angle, stats, 'bullet', barrel);
      break;
  }

  projectile.team = source.team;
  projectile.owner = source;
  projectile.mods = mods;
  projectile.pushFactor = projectilePush(owner.stats(), barrel.def);
  projectile.deathColor = color;
  world.spawn(projectile);
  return projectile;
});

/**
 * Raises a killed square as a Necromancer drone.
 *
 * Called from the run when a square dies to a tank that claims them, rather than
 * from a barrel: the spawner exists only to be drawn and to cap the fleet.
 */
export function raiseNecroDrone(
  world: World,
  owner: Entity,
  commander: DroneCommander | null,
  barrel: BarrelState,
  ownerStats: StatBlock,
  ownerScale: number,
  at: Vec2,
  color: string,
): NecroDrone | null {
  const cap = barrel.def.projectile.maxCount;
  if (cap !== undefined && barrel.liveCount >= cap) return null;

  const stats = deriveProjectileStats(ownerStats, barrel.def, ownerScale);
  const mods = noMods();
  owner.rootOwner().shotModifier?.(stats, mods);
  const drone = new NecroDrone(at, world.rng.angle(), stats, barrel, commander);
  drone.team = owner.team;
  drone.owner = owner;
  drone.mods = mods;
  drone.deathColor = color;
  barrel.liveCount++;
  world.spawn(drone);
  return drone;
}
