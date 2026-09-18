import { lerp, vec, type Vec2 } from '../core/math.ts';
import { TICKS_PER_SECOND } from '../core/loop.ts';
import type { Rng } from '../core/rng.ts';
import type { World } from './world.ts';
import type { Entity } from './entity.ts';
import type { WarningRing } from './waves.ts';

/**
 * Things the arena does to a boss wave.
 *
 * The map is a square that grows, and a square that grows is the same square
 * every run. These are the answer: on three of the five boss waves the arena
 * takes a hand, drawn from a pool so a run sees three of them and no two runs
 * see the same three.
 *
 * They are deliberately not extra difficulty. A wave that fights you with its
 * walls as well as its enemies is simply a harder wave, and the run does not
 * need one of those on the waves it is already dying to; each modifier states
 * what fraction of the wave's enemy budget it is worth and the wave buys that
 * much less. The arena is spending the wave's money, not adding to it.
 */
export interface ArenaModifier {
  id: ModifierId;
  /** Announced on the banner as the wave opens. */
  name: string;
  /**
   * Whether a run may draw this.
   *
   * A modifier that is built, tested and reachable by the harness but not yet
   * trusted in front of a player stays here with this false, rather than being
   * deleted and rewritten later.
   */
  live: boolean;
  /**
   * Share of the wave's enemy budget this is worth.
   *
   * Set by what the modifier does to the player rather than by how it looks: the
   * Tide moves the walls constantly and asks very little, the Crush takes the
   * room away for good and asks a great deal.
   */
  budgetShare: number;
  /**
   * Half-extents this wants the arena at, or null to leave the size alone.
   *
   * Given the wave's nominal half-size and how long the wave has been running,
   * so a modifier can be a shape, a journey, or a rhythm.
   */
  shape?: (nominal: number, ticks: number) => Vec2;
  /** Anything that is not a shape. Meteors are the only one so far. */
  tick?: (ctx: ModifierContext) => void;
}

export type ModifierId = 'crush' | 'tide' | 'meteors';

export interface ModifierContext {
  world: World;
  player: Entity;
  rng: Rng;
  /** Ticks since the wave began. */
  ticks: number;
  /** The wave this is running on, which the damage scales against. */
  wave: number;
  /** Multiplier on damage dealt to the player, from the difficulty. */
  damageScale: number;
  /** Rings the renderer should draw, which the modifier appends to. */
  warnings: WarningRing[];
  /**
   * Meteors in the air.
   *
   * The one modifier that carries state between ticks, so the one piece of the
   * context that is not general. It lives on the director rather than in this
   * module: state held here would outlive the wave that made it, and a wave
   * inheriting the previous wave's meteors is a bug nobody would think to look
   * for. Owned where it is cleared.
   */
  meteors: PendingMeteor[];
}

/**
 * A meteor waiting to land.
 *
 * Not an entity: nothing collides with it, and between the warning and the blast
 * it is a promise rather than a thing.
 */
export interface PendingMeteor {
  at: Vec2;
  ticksLeft: number;
  /** Blast radius, carried so the renderer need not know a meteor's constants. */
  radius: number;
  /** What ticksLeft started at, which is what turns it into a progress bar. */
  totalTicks: number;
}

/** How far the Crush closes, as a fraction of the arena it started from. */
const CRUSH_FLOOR = 0.42;
/** How long the Crush takes to close, in ticks. */
const CRUSH_TICKS = TICKS_PER_SECOND * 45;

/** How far the Tide swings either side of the nominal size. */
const TIDE_AMPLITUDE = 0.24;
/** One full breath, in ticks. */
const TIDE_PERIOD = TICKS_PER_SECOND * 22;
/**
 * When the Tide stops breathing and holds at its narrowest.
 *
 * Matched to the wave director's own patience, which is when it gives up on a
 * wave arriving politely and sends the stragglers after the player. Past that
 * point the arena stops handing room back for the same reason.
 */
const TIDE_SETTLE_TICKS = TICKS_PER_SECOND * 40;

/** Ticks between meteors. */
const METEOR_INTERVAL = TICKS_PER_SECOND * 4;
/** How long a meteor is drawn before it lands. */
const METEOR_WARNING = Math.round(TICKS_PER_SECOND * 1.6);
/** Blast radius in diep units. */
const METEOR_RADIUS = 260;
/** How far from the player a meteor may be aimed. */
const METEOR_SPREAD = 700;

/** Damage a meteor deals on the wave it lands on. */
const meteorDamage = (wave: number): number => 14 + 1.6 * wave;

function tickMeteors(ctx: ModifierContext): void {
  const pending = ctx.meteors;

  if (ctx.ticks > 0 && ctx.ticks % METEOR_INTERVAL === 0) {
    // Aimed near the player rather than at them: a meteor that lands where you
    // stand is a tax, and one that lands beside you is a reason to move.
    const limit = ctx.world.inset(METEOR_RADIUS);
    const x = ctx.player.pos.x + ctx.rng.range(-METEOR_SPREAD, METEOR_SPREAD);
    const y = ctx.player.pos.y + ctx.rng.range(-METEOR_SPREAD, METEOR_SPREAD);
    pending.push({
      at: vec(
        Math.max(-limit.x, Math.min(limit.x, x)),
        Math.max(-limit.y, Math.min(limit.y, y)),
      ),
      ticksLeft: METEOR_WARNING,
      radius: METEOR_RADIUS,
      totalTicks: METEOR_WARNING,
    });
  }

  for (let i = pending.length - 1; i >= 0; i--) {
    const meteor = pending[i]!;
    if (--meteor.ticksLeft > 0) continue;

    pending.splice(i, 1);
    // Everything in the blast, both sides. A hazard that only hurts the player
    // is a difficulty setting; one that hurts the wave as well is a weapon the
    // player can use, and that is the difference between dread and tedium.
    const damage = meteorDamage(ctx.wave);
    for (const e of ctx.world.near(meteor.at, METEOR_RADIUS)) {
      if (!e.alive || e.kind === 'projectile') continue;
      const d = Math.hypot(e.pos.x - meteor.at.x, e.pos.y - meteor.at.y);
      if (d > METEOR_RADIUS + e.radius) continue;
      e.damage(e === ctx.player ? damage * ctx.damageScale : damage);
    }
    ctx.world.addDeath({
      pos: vec(meteor.at.x, meteor.at.y),
      angle: 0,
      radius: METEOR_RADIUS,
      color: '#F14E54',
      sides: 1,
      def: null,
    });
  }
}

export const MODIFIERS: readonly ArenaModifier[] = [
  {
    // The room closes and does not open again. Kiting has an expiry.
    id: 'crush',
    live: true,
    name: 'THE CRUSH',
    budgetShare: 0.3,
    shape: (nominal, ticks) => {
      const t = Math.min(1, ticks / CRUSH_TICKS);
      const h = lerp(nominal, nominal * CRUSH_FLOOR, t);
      return vec(h, h);
    },
  },
  {
    /*
     * The arena leans between wide and tall, and is never larger than the square
     * it would have been.
     *
     * That cap is not decoration. The first version swung either side of the
     * nominal size, and it could not clear a boss against a build that kites:
     * with a still arena the player runs out of room and the fight resolves in
     * the corner it backed into, and a wall that moves outward hands that corner
     * back every few seconds. One seed went from the boss at 3% after eighty
     * seconds to the boss at 74% after three hundred, on the same build, purely
     * because it never ran out of somewhere to retreat to.
     *
     * Capping it was not enough on its own, because a wall that grows at all
     * hands the corner back whether or not it passes the baseline doing it. So
     * the breathing stops: past the wave director's own patience the Tide holds
     * at its narrowest and the arena is still again. The player gets forty
     * seconds of a moving room and then a small one, which is the same bargain
     * the director makes when it stops waiting and sends the stragglers in.
     */
    id: 'tide',
    live: true,
    name: 'THE TIDE',
    budgetShare: 0.12,
    shape: (nominal, ticks) => {
      const narrow = nominal * (1 - TIDE_AMPLITUDE * 2);
      if (ticks > TIDE_SETTLE_TICKS) return vec(narrow, narrow);
      const swing = Math.sin((ticks / TIDE_PERIOD) * Math.PI * 2) * TIDE_AMPLITUDE;
      return vec(
        nominal * (1 - TIDE_AMPLITUDE + swing),
        nominal * (1 - TIDE_AMPLITUDE - swing),
      );
    },
  },
  {
    /*
     * Built, tested, and held out of the pool until a person has played it.
     *
     * Over 64 seeds at wave twenty the Crush and the Tide clear 29 against 32
     * for a clean wave, which is the neutrality they were built for. Meteors
     * clears 7. Nothing about its own numbers moves that: halving the damage
     * gives 9, lengthening the interval and widening the spread gives 9, and
     * raising its share of the budget from 0.22 to 0.38 gives 1, because the
     * escort was never what was killing anyone.
     *
     * Setting the damage to zero gives 29. That is the whole problem in one
     * number. The bot never dodges, so it takes every blast, and any sustained
     * damage it cannot avoid kills it over a sixty-second fight; the only
     * setting this harness will endorse is none at all. It cannot tell a fair
     * meteor from a lethal one, so its verdict here is not evidence and must
     * not be treated as any.
     *
     * A human dodges most of these, and at a fifth of the blasts taken the
     * arithmetic lands somewhere reasonable — which is a guess, and guessing is
     * the reason this is not in the pool. Turning `live` on is the whole of
     * shipping it, once someone has played a wave of it and said.
     */
    id: 'meteors',
    live: false,
    name: 'METEORS',
    budgetShare: 0.22,
    tick: tickMeteors,
  },
];

export const getModifier = (id: ModifierId): ArenaModifier =>
  MODIFIERS.find((m) => m.id === id)!;

/**
 * The boss waves that roll a modifier.
 *
 * Not wave five. A player meets their first boss having just picked a class,
 * with a few hundred health and no idea what the boss does, and the run's own
 * history says that anything new arriving on a wave the player is not equipped
 * for ends a quarter of runs on that wave alone. The Guardian is a fair fight.
 *
 * Not wave twenty-five either: the Fallen Overlord has an authored arena of its
 * own, and rolling a second one on top would be two fights arguing.
 */
export const MODIFIED_WAVES: readonly number[] = [10, 15];
// Two waves because two modifiers are live. It grows with the pool: a run draws
// without replacement, so more waves than modifiers would leave the last of them
// reliably plain, which is a worse pattern than one fewer modified wave.

/**
 * Picks the modifiers a run will use, in the order it will meet them.
 *
 * Drawn without replacement, so a run gets three different ones rather than the
 * same one twice, and drawn once at the start from the run's own seed, so a seed
 * reproduces its whole arc rather than just its waves.
 */
export function rollModifiers(rng: Rng): Map<number, ModifierId> {
  const pool = MODIFIERS.filter((m) => m.live).map((m) => m.id);
  const rolled = new Map<number, ModifierId>();
  for (const wave of MODIFIED_WAVES) {
    if (!pool.length) break;
    const index = rng.int(0, pool.length - 1);
    rolled.set(wave, pool.splice(index, 1)[0]!);
  }
  return rolled;
}
