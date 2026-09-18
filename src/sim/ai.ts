import type { TankDefinition } from '../data/schema.ts';
import type { World } from './world.ts';
import type { Controller, Tank, TankIntent } from './tank.ts';
import { idleIntent } from './tank.ts';
import type { Entity } from './entity.ts';
import { predictIntercept, vec, wrapAngle, type Vec2 } from '../core/math.ts';
import { emptyStats, type StatBlock } from './stats.ts';
import { projectileAcceleration, projectileLifeTicks } from '../data/leveling.ts';
import type { Rng } from '../core/rng.ts';

/**
 * How an enemy tank fights.
 *
 * Chosen from the tank's own weapons rather than named per class, so a tank
 * added to the roster behaves sensibly without anyone listing it here.
 */
export type Archetype = 'grunt' | 'marksman' | 'rammer' | 'commander';

/** Who the AI is trying to kill. Set by the run each tick. */
export interface AiContext {
  target: Entity | null;
}

export const aiContext: AiContext = { target: null };

/** Picks a fighting style from what the tank is armed with. */
export function archetypeFor(def: TankDefinition): Archetype {
  if (!def.barrels.length) return 'rammer';

  const kinds = new Set(def.barrels.map((b) => b.projectile.kind));
  if (kinds.has('drone') || kinds.has('necroDrone') || kinds.has('swarm') || kinds.has('minion')) {
    return 'commander';
  }

  // A tank whose rear guns are thrusters is built to ram, not to trade shots.
  const thrusters = def.barrels.filter(
    (b) =>
      Math.abs(wrapAngle(b.angle)) > 2.2 &&
      b.projectile.kind === 'bullet' &&
      b.projectile.damage <= 0.25,
  );
  if (thrusters.length >= 2) return 'rammer';

  if (def.fieldFactor <= 0.85) return 'marksman';
  return 'grunt';
}

/**
 * How far this tank's shots reach, in diep units.
 *
 * A bullet settles to a cruise speed and dies on a timer, so range is simply one
 * times the other. Knowing it is what lets an AI hold at the edge of its own
 * effectiveness instead of charging a Sniper into knife range.
 */
export function effectiveRange(def: TankDefinition, stats: StatBlock): number {
  let best = 400;
  for (const barrel of def.barrels) {
    const p = barrel.projectile;
    if (p.kind === 'trap') continue;
    const speed = projectileAcceleration(stats.bulletSpeed, p.speed);
    const life = projectileLifeTicks(p.lifeLength);
    // Drones never expire, so cap them at the distance they will actually chase.
    const ticks = Number.isFinite(life) ? life : 90;
    best = Math.max(best, speed * ticks * 0.85);
  }
  return Math.min(best, 2200);
}

/** Stat builds per archetype, so an enemy is not a bag of zeroes. */
const BUILDS: Record<Archetype, Partial<StatBlock>> = {
  grunt: { maxHealth: 3, bodyDamage: 2, bulletSpeed: 3, bulletPen: 3, bulletDamage: 4, reload: 3, moveSpeed: 3 },
  marksman: { maxHealth: 2, bulletSpeed: 5, bulletPen: 4, bulletDamage: 5, reload: 3, moveSpeed: 3 },
  rammer: { maxHealth: 6, bodyDamage: 6, regen: 3, moveSpeed: 6 },
  commander: { maxHealth: 3, bulletSpeed: 4, bulletPen: 5, bulletDamage: 4, reload: 4, moveSpeed: 2 },
};

/** Fills in a stat block for an enemy of the given style and level. */
export function buildStatsFor(archetype: Archetype, level: number): StatBlock {
  const stats = emptyStats();
  const build = BUILDS[archetype];
  // Scale the build in as the enemy levels, so early waves stay soft.
  const share = Math.min(1, level / 45);
  for (const [key, value] of Object.entries(build)) {
    stats[key as keyof StatBlock] = Math.round((value ?? 0) * share);
  }
  return stats;
}

/** Ticks between a strafing enemy reversing direction. */
const STRAFE_PERIOD = 50;

/**
 * Drives an enemy tank.
 *
 * All four styles share one idea: pick a distance worth holding, move to keep
 * it, and shoot whenever the target is roughly in front. What changes between
 * them is the distance and how hard they try to keep it.
 */
export class AiTankController implements Controller {
  readonly archetype: Archetype;
  private range = 600;
  /** +1 or -1: which way this tank is currently circling. */
  private strafe: 1 | -1;
  private strafeTimer: number;
  private readonly rng: Rng;
  /** Set for a tick after dodging, so it commits rather than dithering. */
  private dodgeTicks = 0;
  private dodgeAngle = 0;
  /** Set once the wave director loses patience: close in and stop kiting. */
  private hunting = false;

  constructor(archetype: Archetype, rng: Rng) {
    this.archetype = archetype;
    this.rng = rng;
    this.strafe = rng.bool() ? 1 : -1;
    this.strafeTimer = rng.int(0, STRAFE_PERIOD);
  }

  /** Recomputed when the tank is built, since it depends on stats. */
  setRange(range: number): void {
    this.range = range;
  }

  tick(tank: Tank, world: World): TankIntent {
    const target = aiContext.target;
    const intent = idleIntent();
    if (!target || !target.alive) {
      // Nothing to fight: drift toward the middle rather than sit in a corner.
      const home = Math.atan2(-tank.pos.y, -tank.pos.x);
      intent.moveX = Math.cos(home) * 0.3;
      intent.moveY = Math.sin(home) * 0.3;
      intent.aimAngle = tank.angle;
      return intent;
    }

    const dx = target.pos.x - tank.pos.x;
    const dy = target.pos.y - tank.pos.y;
    const distance = Math.hypot(dx, dy) || 1;
    const bearing = Math.atan2(dy, dx);

    // Aim where the target is going, not where it has been.
    const shotSpeed = projectileAcceleration(tank.points.bulletSpeed, 1);
    const lead = predictIntercept(tank.pos, target.pos, target.vel, shotSpeed);
    intent.aimAngle = Math.atan2(lead.y - tank.pos.y, lead.x - tank.pos.x);
    intent.aimAt = vec(lead.x, lead.y);

    const hold = this.holdDistance();
    const heading = this.headingFor(tank, world, bearing, distance, hold);
    intent.moveX = Math.cos(heading);
    intent.moveY = Math.sin(heading);

    // Fire when roughly lined up and within reach, so shots are not simply thrown away.
    const offAxis = Math.abs(wrapAngle(intent.aimAngle - tank.angle));
    intent.fire = distance < this.range * 1.1 && (offAxis < 0.5 || this.archetype === 'commander');
    // A commander points its drones at the player rather than firing a gun.
    intent.secondary = false;

    this.strafeTimer++;
    if (this.strafeTimer > STRAFE_PERIOD) {
      this.strafeTimer = 0;
      if (this.rng.bool(0.6)) this.strafe = this.strafe === 1 ? -1 : 1;
    }

    return intent;
  }

  /**
   * The distance this style wants to fight at.
   *
   * Capped, because a Ranger's shots reach most of the arena and an enemy that
   * holds at its own maximum range simply retreats forever: two tanks with the
   * same top speed never resolve that chase.
   */
  private holdDistance(): number {
    if (this.hunting) return 0;
    switch (this.archetype) {
      case 'rammer':
        return 0;
      case 'marksman':
        return Math.min(this.range * 0.8, 1000);
      case 'commander':
        return Math.min(Math.max(700, this.range * 0.6), 900);
      default:
        return Math.min(this.range * 0.55, 700);
    }
  }

  /** Sends this tank straight at the player, for a wave that has dragged on. */
  hunt(): void {
    this.hunting = true;
  }

  /**
   * Where to move this tick.
   *
   * Closing, backing off and circling are all the same decision seen from
   * different distances, so they are one calculation rather than three states.
   */
  private headingFor(
    tank: Tank,
    world: World,
    bearing: number,
    distance: number,
    hold: number,
  ): number {
    if (this.dodgeTicks > 0) {
      this.dodgeTicks--;
      return this.dodgeAngle;
    }

    // Step out of the way of anything about to hit us.
    const incoming = this.incomingThreat(tank, world);
    if (incoming !== null) {
      this.dodgeAngle = incoming;
      this.dodgeTicks = 8;
      return incoming;
    }

    if (this.archetype === 'rammer') return bearing;

    const slack = hold * 0.2;
    if (distance > hold + slack) return bearing;
    if (distance < hold - slack) return bearing + Math.PI;
    // At the distance it wants: circle, which keeps it a moving target.
    return bearing + (Math.PI / 2) * this.strafe;
  }

  /**
   * A direction to step if a projectile is about to arrive, else null.
   *
   * Extrapolates each nearby shot a few ticks forward and checks whether it
   * passes close. Sidestepping perpendicular to it is the cheapest escape.
   */
  private incomingThreat(tank: Tank, world: World): number | null {
    if (this.archetype === 'rammer') return null;
    for (const e of world.near(tank.pos, 320)) {
      if (e.kind !== 'projectile' || !e.alive || e.team === tank.team) continue;
      const speed = Math.hypot(e.vel.x, e.vel.y);
      if (speed < 1) continue;
      const aheadX = e.pos.x + e.vel.x * 8;
      const aheadY = e.pos.y + e.vel.y * 8;
      const missBy = Math.hypot(aheadX - tank.pos.x, aheadY - tank.pos.y);
      if (missBy < tank.radius + e.radius + 20) {
        return Math.atan2(e.vel.y, e.vel.x) + Math.PI / 2;
      }
    }
    return null;
  }
}

/** Where to place a spawning enemy so it does not land on top of the player. */
export function safeSpawnPoint(world: World, away: Vec2, minDistance: number): Vec2 {
  for (let attempt = 0; attempt < 16; attempt++) {
    const point = world.randomEdgePoint(80);
    const d = Math.hypot(point.x - away.x, point.y - away.y);
    if (d >= minDistance) return point;
  }
  // Fall back to the far corner from the player.
  const h = world.inset(80);
  return vec(away.x > 0 ? -h.x : h.x, away.y > 0 ? -h.y : h.y);
}
