import type { Run } from '../sim/run.ts';
import { COLORS } from '../data/colors.ts';
import { levelProgress, MAX_LEVEL } from '../data/leveling.ts';
import type { TouchSticks } from '../core/input.ts';
import { STICK_RADIUS } from '../core/input.ts';

const FONT = 'Ubuntu, system-ui, sans-serif';

/** White text with the heavy black outline the game uses everywhere. */
export function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = 'center',
): void {
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.22;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, x, y);
}

/** One of the rounded progress bars along the bottom of the screen. */
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fraction: number,
  color: string,
  label: string,
): void {
  const r = height / 2;
  ctx.save();
  ctx.lineCap = 'round';

  ctx.strokeStyle = COLORS.barBack;
  ctx.lineWidth = height;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.stroke();

  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped > 0.001) {
    ctx.strokeStyle = color;
    ctx.lineWidth = height * 0.62;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + r + (width - height) * clamped, y);
    ctx.stroke();
  }

  outlinedText(ctx, label, x + width / 2, y, height * 0.62);
  ctx.restore();
}

export interface HudState {
  /** Ticks since a new wave was announced, for the banner that fades in and out. */
  bannerTicks: number;
  /** What the banner says, if anything. */
  bannerText: string;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  run: Run,
  state: HudState,
  width: number,
  height: number,
): void {
  const barWidth = Math.min(460, width * 0.52);
  const x = (width - barWidth) / 2;
  const scale = Math.min(1, width / 700);
  const levelHeight = 26 * scale;
  const scoreHeight = 22 * scale;
  const bottom = height - 26 * scale;

  const progress = levelProgress(run.xp, run.level);
  const levelLabel =
    run.level >= MAX_LEVEL
      ? `Lvl ${run.level} ${run.player.def.name}`
      : `Lvl ${run.level} ${run.player.def.name}`;

  bar(ctx, x, bottom - scoreHeight - levelHeight * 0.9, barWidth, levelHeight, progress, COLORS.xpBar, levelLabel);
  bar(
    ctx,
    x + barWidth * 0.08,
    bottom,
    barWidth * 0.84,
    scoreHeight,
    1,
    COLORS.scoreBar,
    `Score: ${Math.floor(run.score).toLocaleString()}`,
  );

  drawWaveStatus(ctx, run, width, scale);
  drawPerks(ctx, run, height, scale);
  drawBanner(ctx, state, width, height, scale);
}

/** Wave number along the top, with either a countdown or what is left to kill. */
function drawWaveStatus(
  ctx: CanvasRenderingContext2D,
  run: Run,
  width: number,
  scale: number,
): void {
  if (run.wave <= 0) return;
  outlinedText(ctx, `Wave ${run.wave}`, width / 2, 30 * scale, 27 * scale);

  const countdown = run.countdown;
  if (countdown > 0) {
    outlinedText(ctx, `Next wave in ${Math.ceil(countdown)}`, width / 2, 60 * scale, 19 * scale);
    return;
  }

  if (run.bossName) {
    outlinedText(ctx, run.bossName, width / 2, 60 * scale, 20 * scale);
    return;
  }

  const left = run.enemiesLeft;
  if (left > 0) {
    outlinedText(ctx, `${left} left`, width / 2, 58 * scale, 17 * scale);
  }
}

/** The perks collected so far, stacked up the left edge. */
function drawPerks(
  ctx: CanvasRenderingContext2D,
  run: Run,
  height: number,
  scale: number,
): void {
  const perks = run.perkSummary();
  if (!perks.length) return;
  const size = 13 * scale;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  perks.forEach((perk, i) => {
    const label = perk.stacks > 1 ? `${perkName(perk.id)} x${perk.stacks}` : perkName(perk.id);
    const y = height - 90 * scale - i * (size + 5);
    ctx.lineWidth = size * 0.3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.strokeText(label, 14, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, 14, y);
  });
  ctx.restore();
}

/** Perk identifiers are kebab-case; this is enough to read them back. */
function perkName(id: string): string {
  return id
    .split('-')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}

/** A large announcement that fades in and out, for a new wave or a boss. */
function drawBanner(
  ctx: CanvasRenderingContext2D,
  state: HudState,
  width: number,
  height: number,
  scale: number,
): void {
  if (!state.bannerText || state.bannerTicks > BANNER_TICKS) return;
  const t = state.bannerTicks / BANNER_TICKS;
  // Hold at full opacity in the middle, fading at either end.
  const alpha = Math.min(1, Math.min(t * 6, (1 - t) * 4));
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  outlinedText(ctx, state.bannerText, width / 2, height * 0.32, 40 * scale);
  ctx.restore();
}

/** How long a wave announcement stays on screen, in ticks. */
export const BANNER_TICKS = 70;

/** Draws whichever touch joysticks are currently held. */
export function drawTouchSticks(ctx: CanvasRenderingContext2D, sticks: TouchSticks): void {
  const visuals = sticks.visuals();
  if (!visuals.length) return;
  ctx.save();
  for (const { origin, knob } of visuals) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, STICK_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(knob.x, knob.y, STICK_RADIUS * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A small readout in the corner while developing. */
export function drawDebug(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  width: number,
): void {
  ctx.save();
  ctx.font = `400 13px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  lines.forEach((line, i) => ctx.fillText(line, width - 12, 12 + i * 16));
  ctx.restore();
}
