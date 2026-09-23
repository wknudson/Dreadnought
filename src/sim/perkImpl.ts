/**
 * The perks themselves, and what they need from the run.
 *
 * `PERKS` is the pool the cards deal from, each entry a definition that builds
 * its perk when taken. The `Pickup` healing orb lives here because a perk is the
 * only thing that drops one, and `PerkHost` is the narrow view of the run a perk
 * is handed. The hooks they implement are declared in perks.ts.
 */

import type { Perk } from './perks.ts';
import type { World } from './world.ts';
import { Entity, type EntityKind } from './entity.ts';
import { Tank } from './tank.ts';
import { Shape } from './shape.ts';
import { Projectile } from './projectiles.ts';
import { applyDamage, integrate, maintainVelocity } from './physics.ts';
import { COLORS } from '../data/colors.ts';
import { hullExtent } from '../data/tanks.ts';
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
  /** What the renderer fills it with. */
  color: string = COLORS.healthFill;
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

/** Colours shared with the tells in render/perkTells.ts, so an effect and its tell match. */
export const SHIELD_COLOR = '#6FC3FF';
export const STATIC_FIELD_COLOR = '#7FD1F5';
export const EXPLOSION_COLOR = '#FFB86B';

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
          color: EXPLOSION_COLOR,
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
      modifyProjectile(stats, mods) {
        stats.damage *= 1 + 0.25 * this.stacks;
        mods.heavy = this.stacks;
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
    create: (host) => {
      let charges = 1;
      return {
        id: 'shield',
        stacks: 1,
        gauge: () => [charges],
        onDamageTaken(amount, _source, world) {
          if (charges <= 0) return amount;
          charges--;
          // The shell that took the hit breaks, so a spent charge is seen.
          const tank = host.player;
          world.addDeath({
            pos: vec(tank.pos.x, tank.pos.y),
            angle: tank.angle,
            radius: tank.radius * hullExtent(tank.def) * shieldShellRadius(charges),
            color: SHIELD_COLOR,
            sides: 6,
            def: null,
            ring: true,
          });
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

  // --- Momentum: what builds up, and what you stand to lose ----------------
  {
    id: 'spree',
    name: 'Killing Spree',
    description: 'Every kill makes you fire faster. It fades if you stop killing.',
    rarity: 'uncommon',
    weight: 8,
    maxStacks: 3,
    available: (host) => host.player.def.barrels.length > 0,
    create: (host) => {
      // One countdown per kill rather than a single timer, so a spree tails off
      // as the kills that built it age out instead of falling off a cliff.
      const charges: number[] = [];
      const WINDOW = 100;
      const CAP = 10;
      return {
        id: 'spree',
        stacks: 1,
        gauge: () => charges.map((c) => c / WINDOW),
        modifyStats(stats) {
          stats.reloadScale *= 1 - Math.min(0.55, 0.045 * this.stacks * charges.length);
        },
        onEnemyKilled() {
          if (charges.length >= CAP) charges.shift();
          charges.push(WINDOW);
          host.player.refresh();
        },
        onTick() {
          if (!charges.length) return;
          let lost = false;
          for (let i = charges.length - 1; i >= 0; i--) {
            if (--charges[i]! <= 0) {
              charges.splice(i, 1);
              lost = true;
            }
          }
          if (lost) host.player.refresh();
        },
      };
    },
  },
  {
    id: 'chain',
    name: 'Chain Reaction',
    description: 'Whatever you kill goes off, and whatever that kills goes off too.',
    rarity: 'rare',
    weight: 4,
    maxStacks: 3,
    create: (host) => ({
      id: 'chain',
      stacks: 1,
      onEnemyKilled(victim, world) {
        // The blast is credited to the player, so a chained kill scores and
        // detonates in its own right. That is the whole appeal, and also the
        // reason for a depth limit: a dense wave would otherwise recurse until
        // the stack gave out.
        if (chainDepth >= 3) return;
        const blast = 90 + 30 * this.stacks;
        const damage = victim.maxHealth * (0.3 + 0.1 * this.stacks);
        chainDepth++;
        try {
          for (const e of world.near(victim.pos, blast)) {
            if (!e.alive || e.kind === 'projectile') continue;
            if (e.team === 'player' || e.team === 'neutral') continue;
            applyDamage(world, e, damage, host.player);
          }
          world.addDeath({
            pos: vec(victim.pos.x, victim.pos.y),
            angle: 0,
            radius: blast * 0.45,
            color: '#FFB86B',
            sides: 1,
            def: null,
          });
        } finally {
          chainDepth--;
        }
      },
    }),
  },

  // --- Bargains: everything here costs something ---------------------------
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    description: 'Half again as much damage from every shot. A quarter less health.',
    rarity: 'rare',
    weight: 5,
    maxStacks: 2,
    available: (host) => host.player.def.barrels.length > 0,
    create: () => ({
      id: 'glass-cannon',
      stacks: 1,
      modifyStats(stats) {
        stats.maxHealth *= Math.pow(0.75, this.stacks);
      },
      modifyProjectile(stats) {
        stats.damage *= 1 + 0.5 * this.stacks;
      },
    }),
  },
  {
    id: 'last-stand',
    name: 'Last Stand',
    description: 'The closer you are to dying, the faster you fire.',
    rarity: 'rare',
    weight: 5,
    maxStacks: 3,
    available: (host) => host.player.def.barrels.length > 0,
    create: (host) => {
      // Quantised, because the derived stats are rebuilt on a change and a
      // continuous reading of health would rebuild them every single tick.
      let step = 0;
      const stepOf = (): number => {
        const tank = host.player;
        const fraction = tank.maxHealth > 0 ? tank.health / tank.maxHealth : 1;
        return Math.max(0, Math.min(8, Math.round((0.5 - fraction) * 16)));
      };
      return {
        id: 'last-stand',
        stacks: 1,
        gauge: () => [step / 8],
        modifyStats(stats) {
          stats.reloadScale *= 1 - (step / 8) * 0.15 * this.stacks;
        },
        onTick() {
          const next = stepOf();
          if (next === step) return;
          step = next;
          host.player.refresh();
        },
      };
    },
  },

  // --- The field: shots that keep going, and what is left behind -----------
  {
    id: 'split-shot',
    name: 'Split Shot',
    description: 'Your shots shatter on impact into smaller ones that carry on.',
    rarity: 'rare',
    weight: 5,
    maxStacks: 2,
    available: (host) => host.player.def.barrels.length > 0,
    create: (host) => ({
      id: 'split-shot',
      stacks: 1,
      modifyProjectile(_stats, mods) {
        mods.split = Math.max(mods.split, 1 + this.stacks);
      },
      onProjectileHit(projectile) {
        // Ending the shot here is what makes the perk visible. Left to its own
        // devices a bullet outlives most of what it hits and dies against the
        // far wall, where its children would be born outside the arena.
        // Despawning scatters them, so the impact is all this has to arrange.
        if (!isOwnedBy(projectile, host.player)) return;
        const p = projectile as Projectile;
        if (p.mods.split > 0) p.alive = false;
      },
    }),
  },
  {
    id: 'static-field',
    name: 'Static Field',
    description: 'Everything near you is slowly cooked.',
    rarity: 'uncommon',
    weight: 7,
    maxStacks: 3,
    create: (host) => {
      let tick = 0;
      return {
        id: 'static-field',
        stacks: 1,
        onTick(world) {
          tick++;
          if (tick % 5) return;
          const radius = staticFieldRadius(this.stacks);
          for (const e of world.near(host.player.pos, radius)) {
            if (!e.alive || e.kind === 'projectile') continue;
            if (e.team === 'player' || e.team === 'neutral') continue;
            applyDamage(world, e, 1.2 * this.stacks, host.player);
          }
          // A ripple once a second, on top of the steady ring the renderer
          // draws, so the field reads as live rather than painted on.
          if (tick % 25 === 0) {
            world.addDeath({
              pos: vec(host.player.pos.x, host.player.pos.y),
              angle: 0,
              radius,
              color: STATIC_FIELD_COLOR,
              sides: 1,
              def: null,
              ring: true,
            });
          }
        },
      };
    },
  },
];

/** A shield shell's size, as a multiple of the hull, for the i-th charge out. */
export const shieldShellRadius = (i: number): number => 1.35 + 0.38 * i;

/** How far Static Field reaches. The renderer draws its ring from this too. */
export const staticFieldRadius = (stacks: number): number => 110 + 45 * stacks;

/** Depth of the running Chain Reaction, so a chain cannot recurse without end. */
let chainDepth = 0;

const PERKS_BY_ID = new Map(PERKS.map((perk) => [perk.id, perk]));

/** The card a taken perk came from, for anything that wants to name or explain it. */
export const perkDefinition = (id: string): PerkDefinition | null => PERKS_BY_ID.get(id) ?? null;

/** Multiplier on experience from the Fast Learner perk. */
export const xpMultiplierFor = (stacks: number): number => 1 + stacks / 3;

export { Shape };
