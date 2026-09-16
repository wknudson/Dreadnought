import type { Entity } from './entity.ts';
import type { World } from './world.ts';

/** Fraction of velocity lost every tick. diep.io applies a flat 10%. */
export const FRICTION = 0.1;
/** Below this speed an entity simply stops, which keeps slow drift from lingering. */
const REST_SPEED = 0.01;

/**
 * Integrates one entity: stop if crawling, move, then bleed off speed.
 *
 * Friction being a flat proportion each tick is what gives diep.io its feel. A
 * tank reaches most of its top speed in under half a second and coasts to a halt
 * over about the same time.
 */
export function integrate(e: Entity): void {
  if (Math.hypot(e.vel.x, e.vel.y) < REST_SPEED) {
    e.vel.x = 0;
    e.vel.y = 0;
  }
  e.pos.x += e.vel.x;
  e.pos.y += e.vel.y;
  e.vel.x -= e.vel.x * FRICTION;
  e.vel.y -= e.vel.y * FRICTION;
}

/**
 * Pushes toward a terminal speed rather than setting velocity outright.
 *
 * Adding a tenth of the target speed each tick balances against the tenth lost
 * to friction, so velocity converges on `speed` instead of overshooting it.
 */
export function maintainVelocity(e: Entity, angle: number, speed: number): void {
  e.vel.x += Math.cos(angle) * speed * FRICTION;
  e.vel.y += Math.sin(angle) * speed * FRICTION;
}

export function addImpulse(e: Entity, angle: number, magnitude: number): void {
  e.vel.x += Math.cos(angle) * magnitude;
  e.vel.y += Math.sin(angle) * magnitude;
}

/** Whether two entities are on opposing sides. Neutral entities fight nobody. */
export function hostile(a: Entity, b: Entity): boolean {
  if (a.team === 'neutral' || b.team === 'neutral') return false;
  return a.team !== b.team;
}

/** Tanks hurt each other half again as hard as they hurt anything else. */
const TANK_VS_TANK_SCALE = 1.5;

function contactDamage(attacker: Entity, victim: Entity): number {
  const base = damageOf(attacker);
  if (base <= 0) return 0;
  let scale = victim.incomingDamageScale;
  if (attacker.kind === 'tank' && victim.kind === 'tank') scale *= TANK_VS_TANK_SCALE;
  return base * scale;
}

/** Contact damage per tick, filled in by the entity subclasses. */
export interface Damaging {
  contactDamage: number;
}

function damageOf(e: Entity): number {
  return (e as Entity & Partial<Damaging>).contactDamage ?? 0;
}

/**
 * Resolves every overlapping hostile pair: knockback first, then mutual damage.
 *
 * Both sides are hurt in the same pass because diep.io settles a collision within
 * one tick; a bullet striking a shape damages the shape and is worn down by it
 * simultaneously, which is why penetration works the way it does.
 */
export function resolveContacts(world: World): void {
  const seen = new Set<number>();

  for (const a of world.entities) {
    if (!a.alive) continue;
    const nearby = world.near(a.pos, a.radius);
    for (const b of nearby) {
      if (b === a || !b.alive) continue;
      // Each unordered pair is handled once.
      const pairKey = a.id < b.id ? a.id * 1e7 + b.id : b.id * 1e7 + a.id;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      if (!hostile(a, b)) continue;
      // A projectile never collides with the tank that fired it, nor with its siblings.
      if (a.rootOwner() === b.rootOwner()) continue;

      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const reach = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach * reach) continue;

      const d = Math.sqrt(d2) || 0.0001;
      const angle = Math.atan2(dy, dx);

      // Knockback: each side is shoved by how hard the other pushes, scaled by
      // its own resistance.
      addImpulse(b, angle, a.pushFactor * b.absorbtionFactor);
      addImpulse(a, angle + Math.PI, b.pushFactor * a.absorbtionFactor);

      // Separate overlapping bodies so they do not sink into each other.
      const overlap = (reach - d) * 0.5;
      if (overlap > 0 && a.kind !== 'projectile' && b.kind !== 'projectile') {
        const nx = dx / d;
        const ny = dy / d;
        a.pos.x -= nx * overlap;
        a.pos.y -= ny * overlap;
        b.pos.x += nx * overlap;
        b.pos.y += ny * overlap;
      }

      const toB = contactDamage(a, b);
      const toA = contactDamage(b, a);
      applyDamage(world, b, toB, a);
      applyDamage(world, a, toA, b);
    }
  }
}

/** Damages an entity, announcing both the hit and any resulting death. */
export function applyDamage(
  world: World,
  victim: Entity,
  amount: number,
  source: Entity | null,
): void {
  if (amount <= 0 || !victim.alive) return;
  const died = victim.damage(amount);
  world.events.emit('damageTaken', { victim, amount, source });
  if (died) {
    world.events.emit('entityKilled', { victim, killer: source ? source.rootOwner() : null });
  }
}
