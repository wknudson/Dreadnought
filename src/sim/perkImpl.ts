import type { Perk } from './perks.ts';
import type { World } from './world.ts';
import { Entity, type EntityKind } from './entity.ts';
import { Tank } from './tank.ts';
import { Shape } from './shape.ts';
import { Projectile } from './projectiles.ts';
import { applyDamage, integrate, maintainVelocity } from './physics.ts';
import { COLORS } from '../data/colors.ts';
import { vec, type Vec2 } from '../core/math.ts';

/** Everything a perk needs from the run that owns it. */
export interface PerkHost {
  readonly player: Tank;
  addXp(amount: number): void;
  addScore(amount: number): void;
  /** Grants another card choice. */
  grantReroll(): void;
}

/** A healing orb dropped by a dying enemy, drawn toward the player. */
export class Pickup extends Entity {
  override readonly kind: EntityKind = 'pickup';

  /** How much health it restores. */
  readonly heal: number;
  /** How far it will be pulled from, which the magnet perk widens. */
  attractRadius = 220;

  private readonly target: Entity;

  constructor(at: Vec2, heal: number, target: Entity) {
    super();
    this.pos = vec(at.x, at.y);
    this.prevPos = vec(at.x, at.y);
    this.radius = 14;
    this.heal = heal;
    this.target = target;
    this.team = 'neutral';
    this.hideHealthBar = true;
    this.health = 1;
    this.maxHealth = 1;
  }

  override update(world: World): void {
    if (!this.target.alive) {
      this.alive = false;
      return;
    }
    const dx = this.target.pos.x - this.pos.x;
    const dy = this.target.pos.y - this.pos.y;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance < this.target.radius + this.radius) {
      // Collected.
      const tank = this.target as Tank;
      tank.health = Math.min(tank.maxHealth, tank.health + this.heal);
      this.alive = false;
      world.addDeath({
        pos: vec(this.pos.x, this.pos.y),
        angle: 0,
        radius: this.radius,
        color: COLORS.healthFill,
        sides: 1,
        def: null,
      });
      return;
    }

    // Inside the magnet radius it accelerates in; outside it simply drifts.
    if (distance < this.attractRadius) {
      const pull = 1 - distance / this.attractRadius;
      maintainVelocity(this, Math.atan2(dy, dx), 6 + 22 * pull);
    }
    integrate(this);
  }
}

/** Definition of a card's perk, before it is taken. */
export interface PerkDefinition {
  id: string;
  name: string;
  description: string;
  rarity: 'uncommon' | 'rare';
  /** Relative likelihood of being offered. */
  weight: number;
  /** How many copies may be taken. */
  maxStacks: number;
  /** False when this perk would do nothing for the current build. */
  available?(host: PerkHost): boolean;
  create(host: PerkHost): Perk;
}

const isOwnedBy = (projectile: Entity, owner: Entity): boolean =>
  projectile.rootOwner() === owner;

/**
 * The perk pool.
 *
 * Three families, matching what the run is meant to offer: things that change
 * what your shots do, things that change the pace you gain power at, and things
 * that keep you alive. Each is a small object rather than a branch in the
 * simulation, so adding one never means touching the hot loop.
 */
export const PERKS: readonly PerkDefinition[] = [
  // --- Bullet modifiers ----------------------------------------------------
  {
    id: 'pierce',
    name: 'Piercing Rounds',
    description: 'Your shots carry through one more enemy before they break up.',
    rarity: 'uncommon',
    weight: 10,
    maxStacks: 3,
    available: (host) => host.player.def.barrels.length > 0,
    create: () => ({
      id: 'pierce',
      stacks: 1,
      modifyProjectile(stats, mods) {
        mods.pierce += this.stacks;
        // Surviving a hit means having the health left to do it.
        stats.health *= 1 + 0.5 * this.stacks;
      },
    }),
  },
  {
    id: 'ricochet',
    name: 'Ricochet',
    description: 'Shots bounce off the arena wall instead of dying against it.',
    rarity: 'uncommon',
    weight: 8,
    maxStacks: 2,
    available: (host) => host.player.def.barrels.length > 0,
    create: () => ({
      id: 'ricochet',
      stacks: 1,
      modifyProjectile(_stats, mods) {
        mods.bounces += this.stacks;
      },
    }),
  },
  {
    id: 'homing',
    name: 'Seeking Rounds',
    description: 'Your shots steer gently toward whatever is nearest.',
    rarity: 'rare',
    weight: 5,
    maxStacks: 3,
    available: (host) => host.player.def.barrels.length > 0,
    create: () => ({
      id: 'homing',
      stacks: 1,
      modifyProjectile(_stats, mods) {
        mods.homing = Math.max(mods.homing, 0.03 * this.stacks);
      },
    }),
  },
  {
    id: 'explosive',
    name: 'Explosive Rounds',
    description: 'Shots burst on impact, damaging everything close by.',
    rarity: 'rare',
    weight: 5,
    maxStacks: 3,
    available: (host) => host.player.def.barrels.length > 0,
    create: (host) => ({
      id: 'explosive',
      stacks: 1,
      modifyProjectile(_stats, mods) {
        mods.explodeRadius = Math.max(mods.explodeRadius, 70 + 30 * this.stacks);
      },
      onProjectileHit(projectile, _victim, world) {
        if (!isOwnedBy(projectile, host.player)) return;
        const p = projectile as Projectile;
        if (p.mods.explodeRadius <= 0) return;
        const blast = p.mods.explodeRadius;
        const damage = p.contactDamage * 0.6;
        for (const e of world.near(p.pos, blast)) {
          if (!e.alive || e.team === p.team || e.team === 'neutral') continue;
          if (e.kind === 'projectile') continue;
          applyDamage(world, e, damage, host.player);
        }
        world.addDeath({
          pos: vec(p.pos.x, p.pos.y),
          angle: 0,
          radius: blast * 0.5,
          color: '#FFB86B',
          sides: 1,
          def: null,
        });
      },
    }),
  },
  {
    id: 'heavy-rounds',
    name: 'Heavy Rounds',
    description: 'Every shot hits a quarter harder.',
    rarity: 'uncommon',
    weight: 9,
    maxStacks: 4,
    available: (host) => host.player.def.barrels.length > 0,
    create: () => ({
      id: 'heavy-rounds',
      stacks: 1,
      modifyProjectile(stats) {
        stats.damage *= 1 + 0.25 * this.stacks;
      },
    }),
  },

  // --- Economy and tempo ---------------------------------------------------
  {
    id: 'scholar',
    name: 'Fast Learner',
    description: 'Everything you destroy is worth a third more experience.',
    rarity: 'uncommon',
    weight: 9,
    maxStacks: 3,
    create: () => ({ id: 'scholar', stacks: 1 }),
  },
  {
    id: 'magnet',
    name: 'Magnet',
    description: 'Health orbs are drawn to you from much further away.',
    rarity: 'uncommon',
    weight: 7,
    maxStacks: 3,
    create: (host) => ({
      id: 'magnet',
      stacks: 1,
      onTick: (world) => {
        for (const e of world.near(host.player.pos, 1400)) {
          if (e instanceof Pickup) e.attractRadius = Math.max(e.attractRadius, 480);
        }
      },
    }),
  },
  {
    id: 'harvest',
    name: 'Harvest',
    description: 'Enemies sometimes leave behind an orb that heals you.',
    rarity: 'uncommon',
    weight: 8,
    maxStacks: 3,
    create: (host) => ({
      id: 'harvest',
      stacks: 1,
      onEnemyKilled(victim, world) {
        const chance = 0.12 + 0.1 * this.stacks;
        if (world.rng.next() > chance) return;
        const heal = victim instanceof Tank ? 30 : 12;
        world.spawn(new Pickup(victim.pos, heal, host.player));
      },
    }),
  },
  {
    id: 'reroll',
    name: 'Second Thoughts',
    description: 'Gives you a reroll, and one more after every wave.',
    rarity: 'rare',
    weight: 4,
    maxStacks: 2,
    create: (host) => ({
      id: 'reroll',
      stacks: 1,
      onWaveClear: () => host.grantReroll(),
    }),
  },

  // --- Defence and body ----------------------------------------------------
  {
    id: 'thorns',
    name: 'Thorns',
    description: 'Anything that rams you takes some of it back.',
    rarity: 'uncommon',
    weight: 8,
    maxStacks: 3,
    create: (host) => ({
      id: 'thorns',
      stacks: 1,
      onDamageTaken(amount, source, world) {
        if (source && source.alive && source.kind !== 'projectile') {
          applyDamage(world, source, amount * 0.5 * this.stacks, host.player);
        }
        return amount;
      },
    }),
  },
  {
    id: 'shield',
    name: 'Shield',
    description: 'Absorbs a hit, and comes back when the wave is over.',
    rarity: 'rare',
    weight: 5,
    maxStacks: 3,
    create: () => {
      let charges = 1;
      return {
        id: 'shield',
        stacks: 1,
        onDamageTaken(amount) {
          if (charges <= 0) return amount;
          charges--;
          return 0;
        },
        onWaveClear() {
          charges = this.stacks;
        },
      };
    },
  },
  {
    id: 'lifesteal',
    name: 'Lifesteal',
    description: 'Damage you deal returns a little of your own health.',
    rarity: 'rare',
    weight: 5,
    maxStacks: 3,
    create: (host) => ({
      id: 'lifesteal',
      stacks: 1,
      onProjectileHit(projectile, _victim, _world) {
        if (!isOwnedBy(projectile, host.player)) return;
        const p = projectile as Projectile;
        const heal = p.contactDamage * 0.08 * this.stacks;
        host.player.health = Math.min(host.player.maxHealth, host.player.health + heal);
      },
    }),
  },
  {
    id: 'field-repair',
    name: 'Field Repair',
    description: 'Clearing a wave patches you back up by a third.',
    rarity: 'uncommon',
    weight: 8,
    maxStacks: 3,
    create: (host) => ({
      id: 'field-repair',
      stacks: 1,
      onWaveClear() {
        const heal = host.player.maxHealth * (0.2 + 0.15 * this.stacks);
        host.player.health = Math.min(host.player.maxHealth, host.player.health + heal);
      },
    }),
  },
  {
    id: 'dash',
    name: 'Afterburner',
    description: 'Press the secondary button to dash. It recharges quickly.',
    rarity: 'rare',
    weight: 5,
    maxStacks: 2,
    create: (host) => {
      let cooldown = 0;
      return {
        id: 'dash',
        stacks: 1,
        onTick() {
          if (cooldown > 0) cooldown--;
        },
        onSecondary() {
          if (cooldown > 0) return false;
          cooldown = Math.max(20, 60 - 15 * this.stacks);
          const tank = host.player;
          const heading = Math.atan2(tank.lastIntent.moveY, tank.lastIntent.moveX);
          const moving = Math.hypot(tank.lastIntent.moveX, tank.lastIntent.moveY) > 0.01;
          const angle = moving ? heading : tank.angle;
          tank.vel.x += Math.cos(angle) * 45;
          tank.vel.y += Math.sin(angle) * 45;
          return true;
        },
      };
    },
  },
  {
    id: 'bulwark',
    name: 'Bulwark',
    description: 'Shrugs off a fifth of all damage.',
    rarity: 'uncommon',
    weight: 7,
    maxStacks: 3,
    create: () => ({
      id: 'bulwark',
      stacks: 1,
      onDamageTaken(amount) {
        return amount * Math.pow(0.8, this.stacks);
      },
    }),
  },
];

/** Multiplier on experience from the Fast Learner perk. */
export const xpMultiplierFor = (stacks: number): number => 1 + stacks / 3;

export { Shape };
