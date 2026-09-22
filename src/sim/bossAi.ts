/**
 * How the bosses move, and when they turn.
 *
 * Holds the boss controller and the enrage threshold it acts on. It steers, aims
 * and pulls the trigger, and nothing more: a boss's weapons, bulk and health are
 * set in data/bosses.ts and by the wave director that spawns it, so the enrage
 * reaches the barrels by asking the tank to refresh rather than by touching them.
 */

import type { BossDefinition } from '../data/bosses.ts';
import type { Controller, Tank, TankIntent } from './tank.ts';
import { idleIntent } from './tank.ts';
import type { World } from './world.ts';
import { aiContext } from './ai.ts';
import { vec } from '../core/math.ts';
import { predictIntercept } from '../core/math.ts';

/**
 * The health fraction at which a boss turns.
 *
 * Held deliberately clear of the finale's own thresholds, which reshape the
 * arena at two thirds and one third of the last boss's health. An arena change
 * and a behaviour change arriving on the same tick is two announcements at
 * once, and the fight stops being readable at the moment it most needs to be: a
 * half is the furthest point from both. The two are independent numbers rather
 * than one derived from the other, so a test in `tests/waves.test.ts` is what
 * holds them apart when either side moves.
 */
export const ENRAGE_AT = 0.5;

/**
 * Drives a boss.
 *
 * Each behaviour is a few lines rather than a state machine, because what makes
 * a boss fight is mostly its weapons and its bulk. What the movement has to do
 * is put those weapons where they are a problem, and stay legible while it does.
 */
export class BossController implements Controller {
  private readonly boss: BossDefinition;
  /** Counts up, driving the behaviours that pulse rather than run continuously. */
  private phase = 0;
  /** Which way a circling boss is going round. */
  private orbit: 1 | -1;
  /**
   * Set when the wave director runs out of patience.
   *
   * The ranged bosses screen themselves with drones and traps that soak
   * everything fired at them. Held at arm's length that is not a fight, it is a
   * siege with no clock, so eventually they have to come to you.
   */
  private hunting = false;
  /** True once the boss has dropped below half health. */
  private enraged = false;
  /** The heading a charger committed to, held for the length of one pass. */
  private dashAngle = 0;

  constructor(boss: BossDefinition, clockwise: boolean) {
    this.boss = boss;
    this.orbit = clockwise ? 1 : -1;
  }

  /** Sends the boss in, abandoning whatever range it would rather hold. */
  hunt(): void {
    this.hunting = true;
  }

  /**
   * Whether the boss is in its second half.
   *
   * Read by the run when it refreshes the boss, which is how the faster reload
   * reaches the barrels: the derived block owns the period, so the only honest
   * way to change it is to have it rebuilt.
   */
  get isEnraged(): boolean {
    return this.enraged;
  }

  /** How much of its wanted distance an enraged boss still keeps. */
  private closeIn(hold: number): number {
    if (this.hunting) return 0;
    return this.enraged ? hold * 0.55 : hold;
  }

  tick(tank: Tank, world: World): TankIntent {
    this.phase++;
    const intent = idleIntent();
    const target = aiContext.target;

    // Half health is the turn. Everything below reads it, and the refresh is
    // what carries the shorter reload through to the barrels.
    if (!this.enraged && tank.maxHealth > 0 && tank.health <= tank.maxHealth * ENRAGE_AT) {
      this.enraged = true;
      tank.refresh();
    }

    if (!target || !target.alive) {
      // Patrol the middle while there is nobody to fight.
      const home = Math.atan2(-tank.pos.y, -tank.pos.x);
      intent.moveX = Math.cos(home) * 0.4;
      intent.moveY = Math.sin(home) * 0.4;
      intent.aimAngle = tank.angle + 0.01;
      return intent;
    }

    const dx = target.pos.x - tank.pos.x;
    const dy = target.pos.y - tank.pos.y;
    const distance = Math.hypot(dx, dy) || 1;
    const bearing = Math.atan2(dy, dx);

    const lead = predictIntercept(tank.pos, target.pos, target.vel, 26);
    intent.aimAt = vec(lead.x, lead.y);
    intent.aimAngle = Math.atan2(lead.y - tank.pos.y, lead.x - tank.pos.x);
    intent.fire = true;

    switch (this.boss.behaviour) {
      case 'circler': {
        // Comes on steadily and speeds up the further away you get, so running
        // away buys time but not escape. Enraged it stops circling politely at
        // arm's length and keeps coming.
        const urgency = Math.min(1, distance / 1400);
        const heading = distance > this.closeIn(260) ? bearing : bearing + (Math.PI / 2) * this.orbit;
        const pace = (this.enraged ? 0.75 : 0.5) + 0.5 * urgency;
        intent.moveX = Math.cos(heading) * pace;
        intent.moveY = Math.sin(heading) * pace;
        break;
      }

      case 'summoner': {
        // Keeps its distance and lets the swarm do the work, but every few
        // seconds it throws the whole fleet forward at once.
        //
        // The pause between dives used to be two thirds of the fight, and a
        // swarm left to its own judgement is a swarm not attacking: most of the
        // fight was the player shooting an idle fleet. It dives for half the
        // cycle now, and once enraged it simply never calls them back.
        const diving = this.phase % 150 < 75;
        intent.fire = diving || this.enraged;
        const hold = this.closeIn(900);
        const heading = distance < hold ? bearing + Math.PI : bearing;
        const urgency = Math.abs(distance - hold) > 200 ? 0.5 : 0.15;
        intent.moveX = Math.cos(heading) * urgency;
        intent.moveY = Math.sin(heading) * urgency;
        break;
      }

      case 'fortress': {
        // Crawls forward, spinning constantly so its launchers lay a moving
        // shell of traps rather than a line.
        intent.aimAngle = tank.angle + (this.enraged ? 0.055 : 0.035);
        const reach = this.closeIn(400);
        const heading = distance > reach ? bearing : bearing + (Math.PI / 2) * this.orbit;
        const pace = this.hunting ? 0.75 : this.enraged ? 0.6 : 0.35;
        intent.moveX = Math.cos(heading) * pace;
        intent.moveY = Math.sin(heading) * pace;
        break;
      }

      case 'charger': {
        // A pass, not a walk: line up, commit to a heading and cross through,
        // then pull away and turn for another run.
        //
        // Driving straight at the player and staying there was the shortest
        // fight in the game by a distance. A boss parked inside their guns is
        // a stationary target that happens to be touching them, and they win
        // that trade every time. Committing to the heading is what makes it a
        // charge: it can be sidestepped, and it has to come round again.
        const period = this.enraged ? 80 : 120;
        const step = this.phase % period;
        const winding = step < period * 0.2;
        const dashing = step < period * 0.6;

        if (winding) {
          // Back off to give the run some road, and keep facing the player.
          this.dashAngle = bearing;
          intent.moveX = Math.cos(bearing + Math.PI) * 0.6;
          intent.moveY = Math.sin(bearing + Math.PI) * 0.6;
        } else if (dashing) {
          // Committed. It goes where it was pointing, through and past.
          intent.moveX = Math.cos(this.dashAngle);
          intent.moveY = Math.sin(this.dashAngle);
        } else {
          // Swing wide rather than reverse on the spot, so the next pass comes
          // in from somewhere new.
          const away = this.dashAngle + (Math.PI / 2) * this.orbit;
          intent.moveX = Math.cos(away) * 0.8;
          intent.moveY = Math.sin(away) * 0.8;
        }
        intent.aimAngle = bearing;
        break;
      }

      case 'sieger': {
        // Holds well back and sends drones, backing off if you close.
        const hold = this.closeIn(1100);
        const heading = distance < hold ? bearing + Math.PI : bearing;
        const urgency = distance < hold * 0.7 ? 0.8 : 0.3;
        intent.moveX = Math.cos(heading) * urgency;
        intent.moveY = Math.sin(heading) * urgency;
        break;
      }
    }

    // Keep a boss from grinding along the wall where it cannot be fought.
    const limit = world.inset(tank.radius + 40);
    if (Math.abs(tank.pos.x) > limit.x || Math.abs(tank.pos.y) > limit.y) {
      const inward = Math.atan2(-tank.pos.y, -tank.pos.x);
      intent.moveX = Math.cos(inward);
      intent.moveY = Math.sin(inward);
    }

    return intent;
  }

  /** Used by the fortress behaviour, which never faces where it is going. */
  static facingMatters(boss: BossDefinition): boolean {
    return boss.behaviour !== 'fortress';
  }
}
