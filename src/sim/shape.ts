import { Entity, type EntityKind } from './entity.ts';
import type { World } from './world.ts';
import { integrate, maintainVelocity } from './physics.ts';
import {
  collisionRadius,
  SHAPES,
  SHINY_HEALTH_MULTIPLIER,
  SHINY_XP_MULTIPLIER,
  type ShapeDefinition,
  type ShapeKind,
} from '../data/shapes.ts';
import { COLORS, mix } from '../data/colors.ts';
import { vec, type Vec2 } from '../core/math.ts';

/** Ticks a shape must go unharmed before it starts healing. */
const REGEN_DELAY_TICKS = 750;

/**
 * A polygon: the squares, triangles and pentagons that fill the arena, plus the
 * crashers that hunt you.
 *
 * In diep.io these drift on fixed circular paths and are entirely passive. Here
 * they wander with a lean toward the player, so a wave closes in on you over time
 * instead of sitting in a corner waiting to be farmed.
 */
export class Shape extends Entity {
  override readonly kind: EntityKind = 'shape';

  readonly def: ShapeDefinition;
  readonly shiny: boolean;
  readonly sides: number;
  readonly drawRadius: number;
  readonly color: string;
  readonly xp: number;

  contactDamage: number;

  /** The direction this shape is currently wandering in. */
  private heading: number;
  /** Slow constant tumble, so shapes are never perfectly still. */
  private readonly spin: number;
  /** Set once a crasher has noticed the player; it will not lose interest. */
  private provoked = false;

  constructor(kind: ShapeKind, pos: Vec2, rng: { next(): number; angle(): number }, shiny = false) {
    super();
    const def = SHAPES[kind];
    this.def = def;
    this.shiny = shiny;
    this.sides = def.sides;
    this.drawRadius = def.drawRadius;
    this.radius = collisionRadius(def.drawRadius);
    this.color = shiny ? mix(def.color, COLORS.shiny, 0.75) : def.color;
    this.maxHealth = def.health * (shiny ? SHINY_HEALTH_MULTIPLIER : 1);
    this.health = this.maxHealth;
    this.xp = def.xp * (shiny ? SHINY_XP_MULTIPLIER : 1);
    this.contactDamage = def.bodyDamage;
    this.pushFactor = def.pushFactor;
    this.absorbtionFactor = def.absorbtionFactor;
    this.team = 'enemy';

    this.pos = vec(pos.x, pos.y);
    this.prevPos = vec(pos.x, pos.y);
    this.heading = rng.angle();
    this.angle = rng.angle();
    this.prevAngle = this.angle;
    this.spin = (rng.next() - 0.5) * 0.02;
  }

  /** The player this shape steers toward. Set by the run each tick. */
  static target: Entity | null = null;

  override update(world: World): void {
    this.angle += this.spin;

    const target = Shape.target;
    const chase = this.def.chase;

    if (chase && target?.alive) {
      const dx = target.pos.x - this.pos.x;
      const dy = target.pos.y - this.pos.y;
      const d2 = dx * dx + dy * dy;
      if (this.provoked || d2 < chase.detectRadius * chase.detectRadius) {
        // A crasher that has seen you keeps coming, whatever you do next.
        this.provoked = true;
        const toTarget = Math.atan2(dy, dx);
        this.angle = toTarget;
        maintainVelocity(this, toTarget, chase.acceleration);
        integrate(this);
        world.clampToArena(this);
        this.regenerate();
        return;
      }
    }

    // Wander: nudge the heading at random, then lean it toward the player.
    this.heading += (world.rng.next() - 0.5) * 0.25;
    if (target?.alive && this.def.playerBias > 0) {
      const toTarget = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
      let delta = toTarget - this.heading;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.heading += delta * this.def.playerBias * 0.08;
    }

    maintainVelocity(this, this.heading, this.def.driftSpeed);
    integrate(this);

    // Bounce off the arena wall rather than sliding along it.
    const limit = world.arena.halfSize - this.radius;
    if (this.pos.x < -limit || this.pos.x > limit) this.heading = Math.PI - this.heading;
    if (this.pos.y < -limit || this.pos.y > limit) this.heading = -this.heading;
    world.clampToArena(this);

    this.regenerate();
  }

  /** Shapes heal back to full if left alone, as they do in diep.io. */
  private regenerate(): void {
    if (this.health >= this.maxHealth || this.ticksSinceDamage < REGEN_DELAY_TICKS) return;
    this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.002);
  }

  /** Leaves the fade-out puff for this shape. */
  explode(world: World): void {
    world.addDeath({
      pos: vec(this.pos.x, this.pos.y),
      angle: this.angle,
      radius: this.drawRadius,
      color: this.color,
      sides: this.sides,
      def: null,
    });
  }
}
