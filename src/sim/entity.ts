import { type Vec2, vec } from '../core/math.ts';
import type { World } from './world.ts';

export type Team = 'player' | 'enemy' | 'neutral';

export type EntityKind = 'tank' | 'shape' | 'projectile' | 'pickup';

/** Ticks a hit tint lasts. */
export const FLASH_TICKS = 3;
/** Ticks the puff-and-fade death animation runs for. */
export const DEATH_TICKS = 6;

let nextId = 1;

/**
 * Anything that lives in the world and can be hit.
 *
 * Positions are recorded twice: `pos` is where the entity is as of the last
 * completed tick, and `prevPos` where it was the tick before. The renderer
 * interpolates between them, which is what keeps motion smooth when the display
 * refreshes faster than the 25 Hz simulation.
 */
export abstract class Entity {
  readonly id = nextId++;
  abstract readonly kind: EntityKind;

  pos: Vec2 = vec();
  prevPos: Vec2 = vec();
  vel: Vec2 = vec();
  angle = 0;
  prevAngle = 0;

  radius = 10;
  team: Team = 'neutral';

  health = 1;
  maxHealth = 1;

  /** Counts down after taking damage, driving the hit tint. */
  flashTicks = 0;
  /** Ticks since this entity last lost health, used for regeneration delays. */
  ticksSinceDamage = Number.MAX_SAFE_INTEGER;

  alive = true;
  /** Set once the entity has been removed from the world's list. */
  removed = false;

  /** How much of an impact this entity absorbs. Lower means harder to shove. */
  absorbtionFactor = 1;
  /** How hard this entity shoves others on contact. */
  pushFactor = 8;

  /**
   * Multiplier on damage this entity receives.
   *
   * Projectiles set it to a quarter, which is what lets a bullet punch through
   * several shapes. Necromancer squares set it back to one, because they count
   * as shapes and die as readily as the ones they were raised from.
   */
  incomingDamageScale = 1;

  /** Opacity, driven by the invisibility tanks. */
  opacity = 1;

  /** Who owns this entity for the purpose of crediting a kill. */
  owner: Entity | null = null;

  /** True when this entity should not be drawn with a health bar. */
  hideHealthBar = false;

  /** Advances this entity by one tick. */
  abstract update(world: World): void;

  /**
   * Called once, as the entity is removed from the world.
   *
   * Every death runs through here, whether the entity ran out of time or was
   * shot, so cleanup that must not be missed belongs in this hook rather than
   * wherever the death happened to be noticed.
   */
  onDespawn(_world: World): void {}

  /** Records the pre-tick transform so the renderer can interpolate. */
  snapshot(): void {
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
    this.prevAngle = this.angle;
  }

  /** Applies damage and reports whether this killed the entity. */
  damage(amount: number): boolean {
    if (!this.alive || amount <= 0) return false;
    this.health -= amount;
    this.flashTicks = FLASH_TICKS;
    this.ticksSinceDamage = 0;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  /** The entity ultimately responsible for this one, following the owner chain. */
  rootOwner(): Entity {
    let e: Entity = this;
    let hops = 0;
    while (e.owner && hops++ < 8) e = e.owner;
    return e;
  }
}

/** Resets the id counter. Only for tests. */
export function resetEntityIds(): void {
  nextId = 1;
}
