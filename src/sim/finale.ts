import { lerp, vec, type Vec2 } from '../core/math.ts';
import { TICKS_PER_SECOND } from '../core/loop.ts';
import { ARENA_EASE, type World } from './world.ts';
import type { Tank } from './tank.ts';
import { Drone } from './projectiles.ts';

/**
 * The last fight.
 *
 * Every other boss is a tank in a square. The Fallen Overlord is a tank in an
 * arena that keeps changing its mind, and the changes are the fight: the player
 * spends the first four bosses learning to circle, and this one takes circling
 * away twice before taking everything away.
 *
 * Authored rather than rolled. A run that reaches wave twenty-five has an hour
 * in it, and losing that to a shape the run happened to draw is a worse story
 * than losing it to a shape you were supposed to have learned.
 */

/** The three shapes the fight moves through. */
export type FinalePhaseId = 'hall' | 'well' | 'vise';

interface FinalePhase {
  id: FinalePhaseId;
  /** Announced as the walls land. */
  name: string;
  /** Announced as they start to move, over the telegraph. */
  warning: string;
  /**
   * Half-extents as multiples of the wave's nominal half-size.
   *
   * Nominal is measured against what the camera can show, so these are really
   * statements about the screen: a little under half on the short axis means
   * both walls stay in view, and the long axis running past what can be seen is
   * what makes a corridor feel like one.
   */
  extent: Vec2;
  /** Boss health fraction at which this phase gives way to the next. */
  until: number;
}

/**
 * Thresholds deliberately avoid a half.
 *
 * A boss enrages below half health: faster reload, and it closes to just over
 * half its hold distance. Two thirds and one third put that squarely inside the
 * Well, between reshapes, so the player reads one change at a time. A threshold
 * moved to 0.5 would fire an arena reshape and a behaviour change on the same
 * tick, which is more than the fight can say at once.
 */
const PHASES: readonly FinalePhase[] = [
  {
    id: 'hall',
    name: 'THE HALL',
    warning: 'The arena narrows',
    extent: vec(1.75, 0.42),
    until: 2 / 3,
  },
  {
    id: 'well',
    name: 'THE WELL',
    warning: 'The walls turn',
    extent: vec(0.42, 1.75),
    until: 1 / 3,
  },
  {
    // The Vise contracts on its own clock, so its extent is only where it opens.
    id: 'vise',
    name: 'THE VISE',
    warning: 'Nowhere left',
    extent: vec(1, 1),
    until: 0,
  },
];

/** How long the incoming bounds are shown before they are imposed. */
const TELEGRAPH_TICKS = Math.round(TICKS_PER_SECOND * 2.6);
/** How fast the border travels while a reshape lands, as a fraction of the gap. */
const SNAP_EASE = 0.14;
/** How long the Vise takes to close from its opening size to its floor. */
const VISE_TICKS = TICKS_PER_SECOND * 50;
/** The Vise never closes past this multiple of the boss's own radius. */
const VISE_FLOOR_RADII = 8;

/**
 * Drives the arena through the last fight and culls what the walls sweep over.
 *
 * Only drones are culled. They are the Overlord's whole threat and the only
 * thing on the field the player can deliberately put somewhere, which is what
 * makes the cull a decision rather than a coin toss: bait the swarm wide before
 * the walls turn and it dies with the ground it was standing on.
 */
export class FinaleDirector {
  private readonly world: World;
  private readonly boss: Tank;

  private index = 0;
  /** Ticks since the current phase's walls finished landing. */
  private phaseTicks = 0;
  /** Counts down while the next shape is shown before it arrives. */
  private telegraphTicks = 0;

  /** Set when there is a line for the banner; cleared once the director reads it. */
  announcement: string | null = null;

  /**
   * How many drones the walls have swept away so far.
   *
   * Read by the harness rather than by the game. The win rate currently puts
   * wave twenty-five out of reach of a full playthrough, so the only way to know
   * the culls are firing at all is to ask them.
   */
  culled = 0;

  constructor(world: World, boss: Tank) {
    this.world = world;
    this.boss = boss;
    this.world.arena.ease = SNAP_EASE;
    this.announcement = PHASES[0]!.name;
  }

  private get phase(): FinalePhase {
    return PHASES[this.index]!;
  }

  /** Which shape the fight is in, for the debug readout and the harness. */
  get phaseId(): FinalePhaseId {
    return this.phase.id;
  }

  /** True once the Vise is the only thing left to reach. */
  get finished(): boolean {
    return !this.boss.alive;
  }

  /**
   * The bounds this fight wants, in units.
   *
   * Everything that sets the arena goes through here, including a window resize
   * partway through the fight, so there is exactly one answer at any moment.
   */
  arenaTarget(nominal: number): Vec2 {
    const phase = this.phase;
    if (phase.id !== 'vise') return vec(nominal * phase.extent.x, nominal * phase.extent.y);

    // The Vise closes on its own clock rather than on the boss's health, so a
    // player who stops shooting does not stop the walls.
    const floor = Math.max(this.boss.radius * VISE_FLOOR_RADII, nominal * 0.26);
    const open = nominal * phase.extent.x;
    const t = Math.min(1, this.phaseTicks / VISE_TICKS);
    const h = lerp(open, Math.min(floor, open), t);
    return vec(h, h);
  }

  tick(nominal: number): void {
    const arena = this.world.arena;

    if (this.telegraphTicks > 0) {
      // Hold the current shape and keep showing the next one.
      if (--this.telegraphTicks === 0) this.land(nominal);
      else arena.ghost = this.nextBounds(nominal);
      return;
    }

    this.phaseTicks++;
    arena.targetHalf = this.arenaTarget(nominal);

    const next = PHASES[this.index + 1];
    if (next && this.healthFraction() <= this.phase.until) {
      this.telegraphTicks = TELEGRAPH_TICKS;
      arena.ghost = this.nextBounds(nominal);
      this.announcement = next.warning;
    }
  }

  /** Puts the arena back the way the rest of the game expects to find it. */
  release(): void {
    this.world.arena.ghost = null;
    this.world.arena.ease = ARENA_EASE;
  }

  private healthFraction(): number {
    if (!this.boss.alive || this.boss.maxHealth <= 0) return 0;
    return this.boss.health / this.boss.maxHealth;
  }

  private nextBounds(nominal: number): Vec2 {
    const next = PHASES[this.index + 1] ?? this.phase;
    return vec(nominal * next.extent.x, nominal * next.extent.y);
  }

  /** The moment the walls arrive: the shape changes, and the swarm pays for it. */
  private land(nominal: number): void {
    this.index = Math.min(this.index + 1, PHASES.length - 1);
    this.phaseTicks = 0;

    const bounds = this.arenaTarget(nominal);
    const arena = this.world.arena;
    arena.targetHalf = bounds;
    arena.ghost = null;

    this.cullDrones(bounds);
    this.shoveBoss(bounds);
    this.announcement = this.phase.name;
  }

  /**
   * Kills every drone of the Overlord's that the new bounds do not contain.
   *
   * The player's own drones are spared. The rule for this fight is that the
   * walls never take anything from the player, and a cull that swept the field
   * would quietly break it for exactly four classes: an Overlord loses its whole
   * swarm at each transition while a Sniper loses nothing, which reads as the
   * fight punishing a build rather than rewarding a position.
   *
   * Set `alive` rather than dealing damage: a drone swept away by a wall is not
   * a kill anyone made, and running it through the damage path would credit it,
   * feed the perks that watch for kills, and pay experience for standing still.
   */
  private cullDrones(bounds: Vec2): void {
    for (const e of this.world.entities) {
      if (!e.alive || e.team !== 'enemy' || !(e instanceof Drone)) continue;
      if (Math.abs(e.pos.x) <= bounds.x && Math.abs(e.pos.y) <= bounds.y) continue;
      e.alive = false;
      this.culled++;
    }
  }

  /**
   * Moves the Overlord inside the new bounds rather than letting them cull it.
   *
   * Pushed past the wall rather than pinned to it, because a boss held against
   * a border is a boss that spends the phase grinding along it instead of
   * fighting, and the last thing this fight needs is the final boss in a corner.
   */
  private shoveBoss(bounds: Vec2): void {
    if (!this.boss.alive) return;
    const margin = this.boss.radius * 2.5;
    const limitX = Math.max(0, bounds.x - margin);
    const limitY = Math.max(0, bounds.y - margin);
    this.boss.pos.x = Math.max(-limitX, Math.min(limitX, this.boss.pos.x));
    this.boss.pos.y = Math.max(-limitY, Math.min(limitY, this.boss.pos.y));
    this.boss.prevPos.x = this.boss.pos.x;
    this.boss.prevPos.y = this.boss.pos.y;
  }
}
