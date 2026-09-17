import type { BarrelDefinition, StatKey, TankDefinition } from '../data/schema.ts';
import { SHORT_STAT_LABELS } from '../data/schema.ts';
import { visibleStats } from '../data/tanks.ts';
import { STAT_COLORS } from '../data/colors.ts';
import { TICKS_PER_SECOND } from '../core/loop.ts';
import type { Tank } from '../sim/tank.ts';
import {
  barrelReloadTicks,
  deriveProjectileStats,
  deriveTankStats,
  emptyStats,
} from '../sim/stats.ts';
import { noMods } from '../sim/projectiles.ts';

/**
 * The eight stats as the corner column shows them.
 *
 * Kept apart from the drawing so the numbers can be checked without a canvas.
 * Every figure is the one the simulation is actually using, read back through
 * the same functions that produced it, which is the only way a readout like this
 * stays honest as the formulas change.
 */
export interface StatReadout {
  key: StatKey;
  /** The tank's own name for the stat, which a few classes override. */
  label: string;
  /** The same, shortened, for a screen too narrow for the full name. */
  shortLabel: string;
  points: number;
  cap: number;
  color: string;
  /** What the stat currently buys, formatted with its unit. */
  value: string;
  /** How much the run has added over a tank of this level with no points. */
  gainFraction: number;
}

/**
 * The barrel the bullet stats are quoted for.
 *
 * A tank with several barrels fires them all with the same stat points, so any
 * one of them tells the same story about how the points have grown. The first
 * real gun is the one a player thinks of as theirs; a thruster is not.
 */
function referenceBarrel(def: TankDefinition): BarrelDefinition | null {
  const real = def.barrels.filter(
    (b) => b.projectile.kind === 'bullet' && b.projectile.damage > 0.25,
  );
  return real[0] ?? def.barrels[0] ?? null;
}

const round = (n: number): string => (n >= 10 ? String(Math.round(n)) : n.toFixed(1));

/** The eight stats with their live numbers, ready to draw. */
export function statReadouts(player: Tank): StatReadout[] {
  const def = player.def;
  const barrel = referenceBarrel(def);
  const scale = player.scale();

  // The same tank with nothing spent and no perks, which is what the gain is
  // measured against. Level is held fixed so the column reports what the run
  // chose rather than what it simply survived to.
  const base = deriveTankStats(def, player.level, emptyStats(), player.isSpike);
  const live = player.derived;

  const baseShot = barrel ? deriveProjectileStats(emptyStats(), barrel, scale) : null;
  const liveShot = barrel ? deriveProjectileStats(player.points, barrel, scale) : null;
  // Perks change a shot as it is created, so the readout has to ask them too.
  if (liveShot) player.shotModifier?.(liveShot, noMods());

  // Through the weapon's own function, so the figure cannot drift from the
  // period the barrel is actually counting against.
  const shotsPerSecond = (points: typeof player.points): number =>
    barrel ? TICKS_PER_SECOND / barrelReloadTicks(points, barrel) : 0;

  const figures: Record<StatKey, { now: number; was: number; unit: string }> = {
    regen: {
      now: live.regenPerTick * TICKS_PER_SECOND,
      was: base.regenPerTick * TICKS_PER_SECOND,
      unit: '/s',
    },
    maxHealth: { now: live.maxHealth, was: base.maxHealth, unit: '' },
    bodyDamage: { now: live.bodyDamage, was: base.bodyDamage, unit: '' },
    bulletSpeed: { now: liveShot?.acceleration ?? 0, was: baseShot?.acceleration ?? 0, unit: '' },
    bulletPen: { now: liveShot?.health ?? 0, was: baseShot?.health ?? 0, unit: '' },
    bulletDamage: { now: liveShot?.damage ?? 0, was: baseShot?.damage ?? 0, unit: '' },
    reload: { now: shotsPerSecond(player.points), was: shotsPerSecond(emptyStats()), unit: '/s' },
    // Terminal speed is ten times the per-tick acceleration.
    moveSpeed: { now: live.acceleration * 10, was: base.acceleration * 10, unit: '' },
  };

  return visibleStats(def).map(({ key, label, cap }) => {
    const { now, was, unit } = figures[key];
    return {
      key,
      label,
      shortLabel: def.statNames?.[key] ?? SHORT_STAT_LABELS[key],
      points: player.points[key],
      cap,
      color: STAT_COLORS[key],
      value: `${round(now)}${unit}`,
      gainFraction: was > 0 ? now / was - 1 : 0,
    };
  });
}

const FONT = 'Ubuntu, system-ui, sans-serif';

/** Where the column sits, from the left edge and above the bottom bars. */
const COLUMN_X = 14;
/**
 * How far the lowest bar sits above the bottom edge.
 *
 * The level and score bars are centred, and on a narrow screen they reach far
 * enough left to meet this column, so it starts higher there.
 */
const columnBottom = (compact: boolean): number => (compact ? 106 : 96);

/**
 * The stat column, bottom left, always on.
 *
 * Each stat is the same rounded bar the level and score use, filled to the
 * points spent, with what those points actually bought beside it. Returns the y
 * of its top edge so whatever stacks above it knows where to start.
 */
export function drawStatColumn(
  ctx: CanvasRenderingContext2D,
  player: Tank,
  width: number,
  height: number,
  scale: number,
): number {
  // A narrow screen gets the bars alone: the numbers beside them would take a
  // third of the width and there is a game going on behind this.
  const compact = width < 640;
  const rows = statReadouts(player);
  const bottom = height - columnBottom(compact) * scale;
  if (!rows.length) return bottom;

  // Floors on a phone, where the shared scale would shrink this past reading.
  const barWidth = compact ? Math.max(104, 118 * scale) : 146 * scale;
  const barHeight = Math.max(11, 12 * scale);
  const step = barHeight + Math.max(4, 5 * scale);
  const fontSize = Math.max(8.5, 9.5 * scale);
  const top = bottom - (rows.length - 1) * step - barHeight;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.textBaseline = 'middle';

  rows.forEach((row, i) => {
    // Drawn bottom up, so the sidebar order reads top down as diep.io lists it.
    const y = bottom - (rows.length - 1 - i) * step;
    const r = barHeight / 2;

    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = barHeight;
    ctx.beginPath();
    ctx.moveTo(COLUMN_X + r, y);
    ctx.lineTo(COLUMN_X + barWidth - r, y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const filled = row.cap > 0 ? row.points / row.cap : 0;
    if (filled > 0.001) {
      ctx.strokeStyle = row.color;
      ctx.lineWidth = barHeight * 0.66;
      ctx.beginPath();
      ctx.moveTo(COLUMN_X + r, y);
      ctx.lineTo(COLUMN_X + r + (barWidth - barHeight) * filled, y);
      ctx.stroke();
    }

    ctx.font = `700 ${fontSize}px ${FONT}`;
    ctx.lineWidth = fontSize * 0.34;
    ctx.strokeStyle = '#000000';

    ctx.textAlign = 'left';
    const label = compact ? row.shortLabel : row.label;
    ctx.strokeText(label, COLUMN_X + r, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, COLUMN_X + r, y);

    ctx.textAlign = 'right';
    const pips = `${row.points}/${row.cap}`;
    ctx.strokeText(pips, COLUMN_X + barWidth - r, y);
    ctx.fillStyle = row.points >= row.cap ? '#FFFFFF' : '#D8D8D8';
    ctx.fillText(pips, COLUMN_X + barWidth - r, y);

    if (compact) return;

    // What the points bought, and how much of it they added.
    ctx.textAlign = 'left';
    const x = COLUMN_X + barWidth + 8 * scale;
    ctx.strokeText(row.value, x, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(row.value, x, y);

    if (row.gainFraction >= 0.005) {
      const gain = `+${Math.round(row.gainFraction * 100)}%`;
      const at = x + ctx.measureText(row.value).width + 6 * scale;
      ctx.strokeText(gain, at, y);
      ctx.fillStyle = row.color;
      ctx.fillText(gain, at, y);
    }
  });

  ctx.restore();
  return top;
}
