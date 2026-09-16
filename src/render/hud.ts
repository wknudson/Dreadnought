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
  /** Wave number, or 0 before waves begin. */
  wave: number;
  /** Seconds left in the break between waves, or 0 during a wave. */
  countdown: number;
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

  if (state.wave > 0) {
    outlinedText(ctx, `Wave ${state.wave}`, width / 2, 34 * scale, 28 * scale);
    if (state.countdown > 0) {
      outlinedText(
        ctx,
        `Next wave in ${Math.ceil(state.countdown)}`,
        width / 2,
        66 * scale,
        20 * scale,
      );
    }
  }
}

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
