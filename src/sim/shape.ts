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
 * Beyond this distance a shape stops ambling and starts closing.
 *
 * diep.io's polygons drift aimlessly, which is fine when they are scenery. Here
 * they are a wave, and a wave that never arrives is a wave that never ends: a
 * single pentagon wandering off can otherwise hold a run up indefinitely.
 */
const CLOSING_DISTANCE = 650;
/** How much faster a shape travels while closing the gap. */
const CLOSING_SPEED_MULTIPLIER = 4;
/**
 * Speed of a straggler sent after the player, in units per tick.
 *
 * Deliberately faster than a tank can drive. Kiting is a legitimate answer to a
 * wave, but it cannot be an answer to the last enemy in one, or a run stalls on
 * a lap of the arena that nobody enjoys.
 */
const HUNTING_SPEED = 14;

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
  /**
   * Set by the wave director on stragglers.
   *
   * A wave that is nearly cleared should not become a chase across the arena,
   * so the last few are told to come and find the player.
   */
  hunting = false;

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
        // Chasers take this path instead of the drift below, so the straggler
        // speed has to be honoured here too or a hunting crasher stays slow.
        maintainVelocity(this, toTarget, this.pursuitSpeed(target, chase.acceleration));
        integrate(this);
        world.clampToArena(this);
        this.regenerate();
        return;
      }
    }

    // How far off the player is decides whether this is a drift or an approach.
    let distance = Number.POSITIVE_INFINITY;
    let toTarget = this.heading;
    if (target?.alive) {
      const dx = target.pos.x - this.pos.x;
      const dy = target.pos.y - this.pos.y;
      distance = Math.hypot(dx, dy);
      toTarget = Math.atan2(dy, dx);
    }

    const closing = target?.alive && (this.hunting || distance > CLOSING_DISTANCE);
    let speed = this.def.driftSpeed;

    if (this.hunting && target) {
      // Out of patience: run the player down.
      this.heading = toTarget;
      speed = this.pursuitSpeed(target, speed);
    } else if (closing) {
      // Head in directly, quickly enough that the wave actually arrives.
      this.heading = toTarget;
      const urgency = Math.min(1, distance / (CLOSING_DISTANCE * 3));
      speed *= 1 + (CLOSING_SPEED_MULTIPLIER - 1) * urgency;
    } else {
      // Close by, amble the way the polygons do in the game this borrows from.
      this.heading += (world.rng.next() - 0.5) * 0.25;
      if (target?.alive && this.def.playerBias > 0) {
        let delta = toTarget - this.heading;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        this.heading += delta * this.def.playerBias;
      }
    }

    maintainVelocity(this, this.heading, speed);
    integrate(this);

    // Bounce off the arena wall rather than sliding along it.
    const limit = world.inset(this.radius);
    if (this.pos.x < -limit.x || this.pos.x > limit.x) this.heading = Math.PI - this.heading;
    if (this.pos.y < -limit.y || this.pos.y > limit.y) this.heading = -this.heading;
    world.clampToArena(this);

    this.regenerate();
  }

  /**
   * How fast this shape moves while chasing.
   *
   * A straggler is matched to whatever speed the player is actually making,
   * because something that can be outrun forever is a wave that never ends.
   */
  private pursuitSpeed(target: Entity, base: number): number {
    if (!this.hunting) return base;
    const fleeing = Math.hypot(target.vel.x, target.vel.y);
    return Math.max(HUNTING_SPEED, fleeing * 1.25);
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
