import type { BossDefinition } from '../data/bosses.ts';
import type { Controller, Tank, TankIntent } from './tank.ts';
import { idleIntent } from './tank.ts';
import type { World } from './world.ts';
import { aiContext } from './ai.ts';
import { vec, wrapAngle } from '../core/math.ts';
import { predictIntercept } from '../core/math.ts';

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

  constructor(boss: BossDefinition, clockwise: boolean) {
    this.boss = boss;
    this.orbit = clockwise ? 1 : -1;
  }

  /** Sends the boss in, abandoning whatever range it would rather hold. */
  hunt(): void {
    this.hunting = true;
  }

  tick(tank: Tank, world: World): TankIntent {
    this.phase++;
    const intent = idleIntent();
    const target = aiContext.target;

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
        // away buys time but not escape.
        const urgency = Math.min(1, distance / 1400);
        const heading = distance > 260 ? bearing : bearing + (Math.PI / 2) * this.orbit;
        intent.moveX = Math.cos(heading) * (0.5 + 0.5 * urgency);
        intent.moveY = Math.sin(heading) * (0.5 + 0.5 * urgency);
        break;
      }

      case 'summoner': {
        // Keeps its distance and lets the swarm do the work, but every few
        // seconds it throws the whole fleet forward at once.
        const diving = this.phase % 150 < 50;
        intent.fire = diving;
        const hold = this.hunting ? 0 : 900;
        const heading = distance < hold ? bearing + Math.PI : bearing;
        const urgency = Math.abs(distance - hold) > 200 ? 0.5 : 0.15;
        intent.moveX = Math.cos(heading) * urgency;
        intent.moveY = Math.sin(heading) * urgency;
        break;
      }

      case 'fortress': {
        // Crawls forward, spinning constantly so its launchers lay a moving
        // shell of traps rather than a line.
        intent.aimAngle = tank.angle + 0.035;
        const reach = this.hunting ? 0 : 400;
        const heading = distance > reach ? bearing : bearing + (Math.PI / 2) * this.orbit;
        intent.moveX = Math.cos(heading) * (this.hunting ? 0.75 : 0.35);
        intent.moveY = Math.sin(heading) * (this.hunting ? 0.75 : 0.35);
        break;
      }

      case 'charger': {
        // Runs you down, overshoots, turns around and does it again.
        const overshooting = this.phase % 120 > 85;
        const heading = overshooting ? bearing + Math.PI * 0.75 : bearing;
        intent.moveX = Math.cos(heading);
        intent.moveY = Math.sin(heading);
        intent.aimAngle = bearing;
        break;
      }

      case 'sieger': {
        // Holds well back and sends drones, backing off if you close.
        const hold = this.hunting ? 0 : 1100;
        const heading = distance < hold ? bearing + Math.PI : bearing;
        const urgency = distance < hold * 0.7 ? 0.8 : 0.3;
        intent.moveX = Math.cos(heading) * urgency;
        intent.moveY = Math.sin(heading) * urgency;
        break;
      }
    }

    // Keep a boss from grinding along the wall where it cannot be fought.
    const limit = world.arena.halfSize - tank.radius - 40;
    if (Math.abs(tank.pos.x) > limit || Math.abs(tank.pos.y) > limit) {
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

/** True when the given angle is roughly forward of a tank. */
export const roughlyFacing = (tank: Tank, angle: number): boolean =>
  Math.abs(wrapAngle(angle - tank.angle)) < 0.6;
