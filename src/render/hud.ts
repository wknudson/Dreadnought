import type { Run } from '../sim/run.ts';
import { Tank } from '../sim/tank.ts';
import { COLORS } from '../data/colors.ts';
import { levelProgress, MAX_LEVEL } from '../data/leveling.ts';
import type { TouchSticks } from '../core/input.ts';
import { STICK_RADIUS } from '../core/input.ts';
import { perkDefinition, type PerkDefinition } from '../sim/perkImpl.ts';
import type { Vec2 } from '../core/math.ts';

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
  /** The mouse, in CSS pixels, for the perk list to test against. */
  pointer: Vec2 | null = null,
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
  drawPerks(ctx, run, width, height, scale, pointer);
  drawMinimap(ctx, run, width, height, scale);
  drawBanner(ctx, state, width, height, scale);
}

/**
 * The arena in miniature, bottom right.
 *
 * Worth the corner it takes up because the camera shows only part of the arena,
 * and a wave arriving behind you is otherwise a surprise rather than a decision.
 * Enemies are dots, the boss is a larger one, and the box is what you can see.
 */
function drawMinimap(
  ctx: CanvasRenderingContext2D,
  run: Run,
  width: number,
  height: number,
  scale: number,
): void {
  const size = Math.round(Math.min(140, Math.max(84, width * 0.13)));
  const pad = Math.round(14 * scale);
  const x = width - size - pad;
  // On a phone the bottom right corner belongs to the thumb buttons and the
  // level bars, so the map moves up out of their way.
  const narrow = width < 640;
  const y = narrow ? Math.round(74 * scale) : height - size - pad;

  const half = run.world.arena.halfSize;
  const toMap = (wx: number, wy: number): [number, number] => [
    x + ((wx + half) / (half * 2)) * size,
    y + ((wy + half) / (half * 2)) * size,
  ];

  ctx.save();
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = COLORS.background;
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.fill();
  ctx.stroke();

  // Clip so nothing outside the arena bleeds past the frame.
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.globalAlpha = 1;

  for (const e of run.world.entities) {
    if (!e.alive || e.kind === 'projectile' || e.kind === 'pickup') continue;
    if (e === run.player) continue;
    const [mx, my] = toMap(e.pos.x, e.pos.y);
    const boss = e instanceof Tank && e.isBoss;
    ctx.fillStyle = boss ? COLORS.enemyRed : e.team === 'enemy' ? COLORS.enemyRed : COLORS.border;
    ctx.globalAlpha = boss ? 1 : 0.65;
    ctx.beginPath();
    ctx.arc(mx, my, boss ? 5 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player last, as a triangle pointing the way they face.
  const [px, py] = toMap(run.player.pos.x, run.player.pos.y);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(run.player.angle);
  ctx.fillStyle = run.player.color;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, 4);
  ctx.lineTo(-4, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
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

/** Where the perk list starts, from the left edge. */
const PERK_X = 14;

/** The card colours, so a perk reads the same in the list as it did in the hand. */
const rarityColor = (rarity: PerkDefinition['rarity']): string =>
  rarity === 'rare' ? '#F9C846' : '#7FD1F5';

/**
 * The perks collected so far, stacked up the left edge.
 *
 * Hovering one explains it. The list is the only place a perk you took twenty
 * waves ago is still named, and the name alone does not say what it does.
 */
function drawPerks(
  ctx: CanvasRenderingContext2D,
  run: Run,
  width: number,
  height: number,
  scale: number,
  pointer: Vec2 | null,
): void {
  const perks = run.perkSummary();
  if (!perks.length) return;
  const size = 13 * scale;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';

  const rows = perks.map((perk, i) => {
    const def = perkDefinition(perk.id);
    const name = def?.name ?? perkName(perk.id);
    const label = perk.stacks > 1 ? `${name} x${perk.stacks}` : name;
    return {
      def,
      stacks: perk.stacks,
      label,
      bottom: height - 90 * scale - i * (size + 5),
      textWidth: ctx.measureText(label).width,
    };
  });

  // The hit box is the label itself with a little slack. Kept tight on purpose:
  // the pointer is also the crosshair, and aiming past the corner should not
  // keep throwing a panel onto the screen.
  const hovered =
    pointer &&
    rows.find(
      (row) =>
        pointer.x >= PERK_X - 4 &&
        pointer.x <= PERK_X + row.textWidth + 6 &&
        pointer.y >= row.bottom - size - 2 &&
        pointer.y <= row.bottom + 3,
    );

  for (const row of rows) {
    ctx.lineWidth = size * 0.3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.strokeText(row.label, PERK_X, row.bottom);
    ctx.fillStyle = row === hovered && row.def ? rarityColor(row.def.rarity) : '#FFFFFF';
    ctx.fillText(row.label, PERK_X, row.bottom);
  }

  if (hovered?.def) {
    // Beside the list rather than over it, so the other perks stay readable.
    const listWidth = Math.max(...rows.map((row) => row.textWidth));
    drawPerkTooltip(
      ctx,
      hovered.def,
      hovered.stacks,
      PERK_X + listWidth + 14,
      hovered.bottom - size / 2,
      width,
      height,
      scale,
    );
  }
  ctx.restore();
}

/** Breaks a description into lines that fit the given width. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The panel explaining the perk under the pointer. */
function drawPerkTooltip(
  ctx: CanvasRenderingContext2D,
  def: PerkDefinition,
  stacks: number,
  preferredX: number,
  rowMiddle: number,
  width: number,
  height: number,
  scale: number,
): void {
  const pad = 10 * scale;
  const titleSize = 14 * scale;
  const bodySize = 12.5 * scale;
  const lineHeight = bodySize * 1.35;
  // A window too narrow to fit the panel beside the list gets it over the list
  // instead, which is worse than the tooltip being readable.
  const panelWidth = Math.min(300 * scale, Math.max(150, width - PERK_X * 2));
  const x = Math.max(PERK_X, Math.min(preferredX, width - panelWidth - PERK_X));

  ctx.font = `400 ${bodySize}px ${FONT}`;
  const lines = wrapText(ctx, def.description, panelWidth - pad * 2);
  const footer = def.maxStacks > 1 ? `${stacks} of ${def.maxStacks} taken` : null;

  const panelHeight =
    pad * 2 + titleSize + lineHeight * lines.length + (footer ? lineHeight : 0) + 4 * scale;
  // Centred on the row it belongs to, nudged back on screen at either end.
  const y = Math.max(12, Math.min(rowMiddle - panelHeight / 2, height - panelHeight - 12));

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#1B1B1B';
  ctx.strokeStyle = rarityColor(def.rarity);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, panelWidth, panelHeight, 6 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let cursor = y + pad;

  ctx.font = `700 ${titleSize}px ${FONT}`;
  ctx.fillStyle = rarityColor(def.rarity);
  ctx.fillText(stacks > 1 ? `${def.name} x${stacks}` : def.name, x + pad, cursor);
  cursor += titleSize + 4 * scale;

  ctx.font = `400 ${bodySize}px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  for (const line of lines) {
    ctx.fillText(line, x + pad, cursor);
    cursor += lineHeight;
  }

  if (footer) {
    ctx.fillStyle = '#9A9A9A';
    ctx.fillText(footer, x + pad, cursor);
  }
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
