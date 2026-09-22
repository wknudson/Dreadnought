/**
 * Auto turrets, the self-aiming guns some tanks carry.
 *
 * Holds the turret and `Tankish`, the slice of a tank it depends on, declared
 * here rather than imported so that tank.ts can build turrets without a cycle.
 * Firing goes through the same barrel host as any other gun; what this file adds
 * is choosing a target and swinging round to meet it.
 */

import type { AutoTurretDefinition } from '../data/schema.ts';
import type { Entity } from './entity.ts';
import type { World } from './world.ts';
import { BarrelHost, type BarrelOwner } from './weapon.ts';
import type { StatBlock } from './stats.ts';
import { predictIntercept, turnToward, vec, wrapAngle, type Vec2 } from '../core/math.ts';

/** How far a turret looks for something to shoot, in diep units. */
const SIGHT_RANGE = 1200;
/** Radians per tick a turret may swing. Fast, but not instant. */
const TRAVERSE = 0.12;
/** Radians per tick an idle turret drifts, so it never looks frozen. */
const IDLE_DRIFT = 0.01;

/**
 * A turret bolted to a tank, aiming and firing on its own.
 *
 * Not a world entity: it lives on its host, is ticked by it, and is drawn as
 * part of it. What makes it a turret rather than another barrel is that its
 * angle is absolute, so it tracks a target while the hull faces elsewhere.
 */
export class AutoTurret implements BarrelOwner {
  readonly def: AutoTurretDefinition;
  readonly host: BarrelHost;

  /** Absolute aim, in radians. */
  angle = 0;
  prevAngle = 0;

  /** The tank this turret is mounted on. */
  private readonly owner: Tankish;
  /** Index within a ring, which sets the mount bearing as the ring rotates. */
  private readonly ringIndex: number;
  private readonly ringCount: number;
  /** Shared rotation of the ring this turret belongs to, in radians. */
  private ringAngle = 0;

  constructor(def: AutoTurretDefinition, owner: Tankish, ringIndex = 0, ringCount = 1) {
    this.def = def;
    this.owner = owner;
    this.ringIndex = ringIndex;
    this.ringCount = ringCount;
    this.host = new BarrelHost([def.barrel]);
  }

  get entity(): Entity {
    return this.owner;
  }

  stats(): StatBlock {
    // A turret inherits its host's upgrades, so investing in reload speeds it up.
    return this.owner.points;
  }

  scale(): number {
    return this.owner.scale();
  }

  reloadScale(): number {
    return this.owner.reloadScale();
  }

  aimAngle(): number {
    return this.angle;
  }

  /** Where this turret sits, in world space. */
  private mountOffset(): { x: number; y: number; bearing: number } {
    if (this.def.mountDistance <= 0) return { x: 0, y: 0, bearing: this.owner.angle };
    const bearing =
      this.owner.angle + this.ringAngle + (Math.PI * 2 * this.ringIndex) / this.ringCount;
    const distance = this.def.mountDistance * this.owner.radius;
    return { x: Math.cos(bearing) * distance, y: Math.sin(bearing) * distance, bearing };
  }

  /** Mount position in world coordinates, used as the barrel origin. */
  worldPosition(): Vec2 {
    const offset = this.mountOffset();
    return vec(this.owner.pos.x + offset.x, this.owner.pos.y + offset.y);
  }

  /**
   * Picks a target, swings toward it, and fires when it is roughly lined up.
   *
   * Firing only once the turret is on target is what stops a ring of turrets
   * spraying in every direction as they swing round.
   */
  tick(world: World, ringAngle: number): void {
    this.prevAngle = this.angle;
    this.ringAngle = ringAngle;

    const mount = this.mountOffset();
    const origin = this.worldPosition();
    const target = this.findTarget(world, origin);

    let onTarget = false;
    if (target) {
      // Lead the target, since a turret that aims where something was will miss.
      const speed = 20 + 3 * this.stats().bulletSpeed;
      const lead = predictIntercept(origin, target.pos, target.vel, speed);
      let want = Math.atan2(lead.y - origin.y, lead.x - origin.x);

      // A ring turret can only cover its own arc, so it cannot poach a target
      // on the far side of the hull from a turret that should be taking it.
      if (this.def.arcLimit !== undefined) {
        const offAxis = wrapAngle(want - mount.bearing);
        if (Math.abs(offAxis) > this.def.arcLimit) {
          want = mount.bearing + Math.sign(offAxis) * this.def.arcLimit;
        }
      }
      this.angle = turnToward(this.angle, want, TRAVERSE);
      onTarget = Math.abs(wrapAngle(this.angle - want)) < 0.15;
    } else {
      // Nothing in sight: drift back to the mount bearing and wait.
      this.angle = turnToward(this.angle, mount.bearing, IDLE_DRIFT * 4) + IDLE_DRIFT;
    }

    this.host.tick(this, this.angle, {
      world,
      fire: onTarget,
      secondary: false,
      alwaysFire: onTarget,
      originOverride: origin,
    });
  }

  private findTarget(world: World, origin: Vec2): Entity | null {
    let best: Entity | null = null;
    let bestDist = SIGHT_RANGE * SIGHT_RANGE;
    for (const e of world.near(origin, SIGHT_RANGE)) {
      if (!e.alive || e.kind === 'projectile' || e.kind === 'pickup') continue;
      if (e.team === this.owner.team || e.team === 'neutral') continue;
      const d = (e.pos.x - origin.x) ** 2 + (e.pos.y - origin.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }
}

/** The part of a Tank an AutoTurret needs, kept narrow to avoid a cycle. */
export interface Tankish extends Entity {
  points: StatBlock;
  scale(): number;
  reloadScale(): number;
}
