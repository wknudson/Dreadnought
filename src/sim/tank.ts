import { Entity, type EntityKind } from './entity.ts';
import type { World } from './world.ts';
import { integrate } from './physics.ts';
import { BarrelHost, type BarrelOwner } from './weapon.ts';
import {
  deriveTankStats,
  emptyStats,
  reconcileStats,
  type DerivedTankStats,
  type StatBlock,
} from './stats.ts';
import { SQUARE_BODY_RADIUS, BASE_BODY_RADIUS } from '../data/leveling.ts';
import type { TankDefinition } from '../data/schema.ts';
import { COLORS } from '../data/colors.ts';
import { vec } from '../core/math.ts';

/** What a controller asks its tank to do this tick. */
export interface TankIntent {
  /** Desired movement direction. Length above 1 is clamped. */
  moveX: number;
  moveY: number;
  /** Where the tank should point, in radians. */
  aimAngle: number;
  fire: boolean;
  secondary: boolean;
}

export const idleIntent = (): TankIntent => ({
  moveX: 0,
  moveY: 0,
  aimAngle: 0,
  fire: false,
  secondary: false,
});

export interface Controller {
  tick(tank: Tank, world: World): TankIntent;
}

/**
 * A tank: the player, an enemy, or a boss.
 *
 * All three differ only in their controller and their definition, so upgrading
 * the player's class and spawning an elite enemy run through the same code.
 */
export class Tank extends Entity implements BarrelOwner {
  override readonly kind: EntityKind = 'tank';

  def: TankDefinition;
  level: number;
  points: StatBlock = emptyStats();
  derived: DerivedTankStats;
  host: BarrelHost;
  controller: Controller;

  color: string;
  name = '';
  score = 0;

  /** The intent this tank acted on last tick, kept for rendering and AI. */
  lastIntent: TankIntent = idleIntent();

  /** Rotation of the spinning guards on the Smasher line. */
  guardSpin = 0;
  prevGuardSpin = 0;

  contactDamage = 0;

  constructor(def: TankDefinition, level: number, controller: Controller, color: string) {
    super();
    this.def = def;
    this.level = level;
    this.controller = controller;
    this.color = color;
    this.host = new BarrelHost(def.barrels);
    this.absorbtionFactor = def.absorbtionFactor;
    this.derived = deriveTankStats(def, level, this.points, this.isSpike);
    this.maxHealth = this.derived.maxHealth;
    this.health = this.maxHealth;
    this.radius = this.computeRadius();
    this.contactDamage = this.derived.bodyDamage;
  }

  private get isSpike(): boolean {
    return this.def.id === 'spike';
  }

  private computeRadius(): number {
    const base = this.def.sides === 4 ? SQUARE_BODY_RADIUS : BASE_BODY_RADIUS;
    const grown = base * Math.pow(1.01, this.level - 1);
    return grown * (this.def.sizeMultiplier ?? 1);
  }

  /** Size relative to a level-1 circular tank, scaling barrels and projectiles. */
  scale(): number {
    return this.radius / BASE_BODY_RADIUS;
  }

  stats(): StatBlock {
    return this.points;
  }

  aimAngle(): number {
    return this.angle;
  }

  get entity(): Entity {
    return this;
  }

  /** Recomputes everything that depends on level, points or definition. */
  refresh(): void {
    this.derived = deriveTankStats(this.def, this.level, this.points, this.isSpike);
    const healthFraction = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
    this.maxHealth = this.derived.maxHealth;
    this.health = Math.min(this.maxHealth, this.maxHealth * healthFraction);
    this.radius = this.computeRadius();
    this.contactDamage = this.derived.bodyDamage;
  }

  setLevel(level: number): void {
    this.level = level;
    this.refresh();
  }

  /**
   * Switches class. Returns how many stat points were refunded, which happens
   * when the new tank has fewer stats than the old one, as the Smasher line does.
   */
  upgradeTo(def: TankDefinition): number {
    this.def = def;
    this.host.replace(def.barrels);
    this.absorbtionFactor = def.absorbtionFactor;
    const refunded = reconcileStats(def, this.points);
    this.refresh();
    // Refill to the new maximum so an upgrade always feels like a reward.
    this.health = this.maxHealth;
    return refunded;
  }

  /** The zoom this tank's class and level imply. Lower sees more of the arena. */
  fieldOfView(): number {
    return (0.55 * this.def.fieldFactor) / Math.pow(1.01, (this.level - 1) / 2);
  }

  override update(world: World): void {
    const intent = this.controller.tick(this, world);
    this.lastIntent = intent;

    // Move.
    const mag = Math.hypot(intent.moveX, intent.moveY);
    if (mag > 0.001) {
      const nx = intent.moveX / Math.max(1, mag);
      const ny = intent.moveY / Math.max(1, mag);
      this.vel.x += nx * this.derived.acceleration;
      this.vel.y += ny * this.derived.acceleration;
    }

    this.angle = intent.aimAngle;

    integrate(this);
    world.clampToArena(this);

    // Fire.
    this.host.tick(this, this.angle, {
      world,
      fire: intent.fire,
      secondary: intent.secondary,
    });

    // Spinning guards on the Smasher line.
    this.prevGuardSpin = this.guardSpin;
    this.guardSpin += 0.1;

    // Regeneration, once the tank has been left alone for a moment.
    if (this.health < this.maxHealth && this.ticksSinceDamage > 25) {
      const boosted = this.ticksSinceDamage > 750 ? 6 : 1;
      this.health = Math.min(this.maxHealth, this.health + this.derived.regenPerTick * boosted);
    }

    this.updateOpacity(intent);
  }

  /** Drives the fade of the invisibility tanks. */
  private updateOpacity(intent: TankIntent): void {
    const profile = this.def.invisibility;
    if (!profile) {
      this.opacity = 1;
      return;
    }
    const moving = Math.hypot(this.vel.x, this.vel.y) > 0.5;
    let delta = -profile.fadeRate;
    if (moving) delta += profile.moveRate;
    if (intent.fire) delta += profile.shootRate;
    if (this.flashTicks > 0) delta += profile.damageAmount;
    this.opacity = Math.max(0, Math.min(1, this.opacity + delta));
  }

  /** Leaves a death effect shaped like this tank. */
  explode(world: World): void {
    world.addDeath({
      pos: vec(this.pos.x, this.pos.y),
      angle: this.angle,
      radius: this.radius,
      color: this.color,
      sides: this.def.sides,
      def: this.def,
    });
  }
}

/** A controller that does nothing, for tanks parked in a menu preview. */
export class NullController implements Controller {
  tick(): TankIntent {
    return idleIntent();
  }
}

export const DEFAULT_PLAYER_COLOR = COLORS.playerBlue;
