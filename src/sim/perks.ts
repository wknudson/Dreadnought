import type { World } from './world.ts';
import type { Entity } from './entity.ts';
import type { DerivedTankStats } from './stats.ts';
import type { ProjectileMods } from './projectiles.ts';
import type { ProjectileStats } from './stats.ts';

/**
 * A run modifier picked from a card.
 *
 * Every hook is optional, so a perk implements only the moment it cares about.
 * The two that run in the hot loop, `modifyStats` and `modifyProjectile`, are
 * applied once when something is created rather than being consulted per tick.
 */
export interface Perk {
  readonly id: string;
  /** How many copies of this perk have been taken. */
  stacks: number;

  /** Adjusts the owner's derived stats. Called whenever the tank is refreshed. */
  modifyStats?(stats: DerivedTankStats): void;
  /** Adjusts a projectile as it is created. */
  modifyProjectile?(stats: ProjectileStats, mods: ProjectileMods): void;
  /** A projectile of the owner's struck something. */
  onProjectileHit?(projectile: Entity, victim: Entity, world: World): void;
  /** Something the owner is credited for died. */
  onEnemyKilled?(victim: Entity, world: World): void;
  /** Called before damage lands. Returns the amount that should actually apply. */
  onDamageTaken?(amount: number, source: Entity | null, world: World): number;
  /** A wave finished. */
  onWaveClear?(world: World): void;
  /** Every tick, for anything that has to keep time. */
  onTick?(world: World): void;
  /** The secondary button was pressed. Return true to consume it. */
  onSecondary?(world: World): boolean;
}

/**
 * The perks a run has collected.
 *
 * Dispatch is a loop over a short list, which is cheap enough that the hooks can
 * be called from anywhere without thinking about it.
 */
export class PerkSet {
  private readonly perks: Perk[] = [];
  private readonly byId = new Map<string, Perk>();

  /** Adds a perk, or stacks it onto the one already held. */
  add(perk: Perk): Perk {
    const existing = this.byId.get(perk.id);
    if (existing) {
      existing.stacks++;
      return existing;
    }
    this.perks.push(perk);
    this.byId.set(perk.id, perk);
    return perk;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  stacksOf(id: string): number {
    return this.byId.get(id)?.stacks ?? 0;
  }

  get all(): readonly Perk[] {
    return this.perks;
  }

  modifyStats(stats: DerivedTankStats): void {
    for (const p of this.perks) p.modifyStats?.(stats);
  }

  modifyProjectile(stats: ProjectileStats, mods: ProjectileMods): void {
    for (const p of this.perks) p.modifyProjectile?.(stats, mods);
  }

  projectileHit(projectile: Entity, victim: Entity, world: World): void {
    for (const p of this.perks) p.onProjectileHit?.(projectile, victim, world);
  }

  enemyKilled(victim: Entity, world: World): void {
    for (const p of this.perks) p.onEnemyKilled?.(victim, world);
  }

  /** Runs every perk's damage hook, each seeing what the last left. */
  damageTaken(amount: number, source: Entity | null, world: World): number {
    let remaining = amount;
    for (const p of this.perks) {
      if (!p.onDamageTaken) continue;
      remaining = p.onDamageTaken(remaining, source, world);
      if (remaining <= 0) return 0;
    }
    return remaining;
  }

  waveClear(world: World): void {
    for (const p of this.perks) p.onWaveClear?.(world);
  }

  tick(world: World): void {
    for (const p of this.perks) p.onTick?.(world);
  }

  /** True if some perk claimed the secondary button this press. */
  secondary(world: World): boolean {
    let used = false;
    for (const p of this.perks) if (p.onSecondary?.(world)) used = true;
    return used;
  }
}
