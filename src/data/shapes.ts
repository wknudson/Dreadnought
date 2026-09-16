import { COLORS } from './colors.ts';

export type ShapeKind =
  | 'square'
  | 'triangle'
  | 'pentagon'
  | 'alphaPentagon'
  | 'smallCrasher'
  | 'largeCrasher';

export interface ShapeDefinition {
  kind: ShapeKind;
  name: string;
  color: string;
  sides: number;
  /** Radius the shape is drawn at, in diep units. */
  drawRadius: number;
  health: number;
  /** Contact damage per tick. */
  bodyDamage: number;
  /** Experience awarded to whoever lands the killing blow. */
  xp: number;
  /** How hard it shoves what it touches. */
  pushFactor: number;
  /** How much of an impact it absorbs. Lower means harder to move. */
  absorbtionFactor: number;
  /** Drift speed in units per tick when wandering. */
  driftSpeed: number;
  /**
   * How strongly its wander is biased toward the player, 0 to 1.
   *
   * In diep.io the polygons drift aimlessly. Here they lean toward the player so
   * a wave arrives rather than waiting to be hunted down.
   */
  playerBias: number;
  /** Set on the crashers, which actively give chase. */
  chase?: { detectRadius: number; acceleration: number };
}

/** Collision radius is the drawn radius over root two, as the game stores it. */
export const collisionRadius = (drawRadius: number): number => drawRadius / Math.SQRT2;

export const SHAPES: Readonly<Record<ShapeKind, ShapeDefinition>> = {
  square: {
    kind: 'square',
    name: 'Square',
    color: COLORS.square,
    sides: 4,
    drawRadius: 55,
    health: 10,
    bodyDamage: 2,
    xp: 10,
    pushFactor: 8,
    absorbtionFactor: 1,
    driftSpeed: 0.6,
    playerBias: 0.12,
  },
  triangle: {
    kind: 'triangle',
    name: 'Triangle',
    color: COLORS.triangle,
    sides: 3,
    drawRadius: 55,
    health: 30,
    bodyDamage: 2,
    xp: 25,
    pushFactor: 8,
    absorbtionFactor: 1,
    driftSpeed: 0.5,
    playerBias: 0.2,
  },
  pentagon: {
    kind: 'pentagon',
    name: 'Pentagon',
    color: COLORS.pentagon,
    sides: 5,
    drawRadius: 75,
    health: 100,
    bodyDamage: 3,
    xp: 130,
    pushFactor: 11,
    absorbtionFactor: 0.5,
    driftSpeed: 0.35,
    playerBias: 0.08,
  },
  alphaPentagon: {
    kind: 'alphaPentagon',
    name: 'Alpha Pentagon',
    color: COLORS.pentagon,
    sides: 5,
    drawRadius: 200,
    health: 3000,
    bodyDamage: 5,
    xp: 3000,
    pushFactor: 11,
    absorbtionFactor: 0.05,
    driftSpeed: 0.2,
    playerBias: 0.06,
  },
  smallCrasher: {
    kind: 'smallCrasher',
    name: 'Crasher',
    color: COLORS.crasher,
    sides: 3,
    drawRadius: 35,
    health: 10,
    bodyDamage: 2,
    xp: 15,
    pushFactor: 12,
    absorbtionFactor: 2,
    driftSpeed: 0.8,
    playerBias: 0.3,
    chase: { detectRadius: 900, acceleration: 3.2 },
  },
  largeCrasher: {
    kind: 'largeCrasher',
    name: 'Crasher',
    color: COLORS.crasher,
    sides: 3,
    drawRadius: 55,
    health: 30,
    bodyDamage: 2,
    xp: 25,
    pushFactor: 12,
    absorbtionFactor: 0.1,
    driftSpeed: 0.6,
    playerBias: 0.3,
    chase: { detectRadius: 700, acceleration: 2.4 },
  },
};

/** Shiny variants: ten times the health for a hundred times the experience. */
export const SHINY_HEALTH_MULTIPLIER = 10;
export const SHINY_XP_MULTIPLIER = 100;
/** How often a spawned shape turns out to be shiny. Far kinder than the real game. */
export const SHINY_CHANCE = 0.002;
