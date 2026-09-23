/**
 * Perks drawn on the player's tank, so what you are carrying can be seen in the
 * fight rather than only read off the list in the corner.
 *
 * Only the perks whose effect lives on the body are here: Static Field, Thorns,
 * Shield, Killing Spree and Last Stand. Each one grows with its stacks, so the
 * tank shows how much of a perk it has as well as which. Everything is flat
 * shapes with dark outlines, in diep.io's own vocabulary, and everything is
 * timed off the simulation's tick so it pauses when the game does.
 *
 * Reading state goes through `Run.perkTells`, which asks each perk's `gauge`;
 * nothing here can change a perk.
 */

import type { PerkTell } from '../sim/perks.ts';
import type { Tank } from '../sim/tank.ts';
import {
  SHIELD_COLOR,
  STATIC_FIELD_COLOR,
  shieldShellRadius,
  staticFieldRadius,
} from '../sim/perkImpl.ts';
import { outline } from '../data/colors.ts';
import { hullExtent } from '../data/tanks.ts';
import { polygonPath } from './drawTank.ts';
import type { Vec2 } from '../core/math.ts';

const THORN_COLOR = '#4F8A3C';
const SPREE_COLOR = '#FFB347';
const LAST_STAND_COLOR = '#FF4D5E';

/** Tells that sit behind the hull: the field on the ground, and the barbs. */
export function drawPerkTellsUnder(
  ctx: CanvasRenderingContext2D,
  tank: Tank,
  pos: Vec2,
  tells: readonly PerkTell[],
  /** Simulation ticks, fractional between them. */
  time: number,
): void {
  if (!tells.length || tank.opacity <= 0) return;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.globalAlpha = tank.opacity;
  for (const tell of tells) {
    if (tell.id === 'static-field') drawStaticField(ctx, tell.stacks, time);
    else if (tell.id === 'thorns') drawThorns(ctx, tank, tell.stacks, time);
  }
  ctx.restore();
}

/** Tells that sit over the hull: shield shells, the spree, and Last Stand's beat. */
export function drawPerkTellsOver(
  ctx: CanvasRenderingContext2D,
  tank: Tank,
  pos: Vec2,
  tells: readonly PerkTell[],
  time: number,
): void {
  if (!tells.length || tank.opacity <= 0) return;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.globalAlpha = tank.opacity;
  // The spree's pips sit outside any shield shells, so the two never overlap.
  const charges = tells.find((t) => t.id === 'shield')?.gauge[0] ?? 0;
  const clear = charges > 0 ? shieldShellRadius(charges - 1) + 0.3 : 1.6;
  for (const tell of tells) {
    if (tell.id === 'shield') drawShield(ctx, tank, tell.gauge[0] ?? 0, time);
    else if (tell.id === 'spree') drawSpree(ctx, tank, tell.stacks, tell.gauge, clear);
    else if (tell.id === 'last-stand') drawLastStand(ctx, tank, tell.stacks, tell.gauge[0] ?? 0, time);
  }
  ctx.restore();
}

/**
 * A dashed ring at exactly the damage reach, turning slowly, with a faint wash
 * inside it. The flicker is a sum of two slow waves rather than noise, so it
 * shimmers without ever strobing.
 */
function drawStaticField(ctx: CanvasRenderingContext2D, stacks: number, time: number): void {
  const radius = staticFieldRadius(stacks);
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = base * 0.06;
  ctx.fillStyle = STATIC_FIELD_COLOR;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  const flicker = 0.7 + 0.1 * Math.sin(time * 0.9) + 0.08 * Math.sin(time * 2.3);
  ctx.globalAlpha = base * flicker;
  ctx.strokeStyle = STATIC_FIELD_COLOR;
  ctx.lineWidth = 5;
  ctx.setLineDash([26, 16]);
  ctx.lineDashOffset = -time * 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * A ring of small barbs per stack, rooted under the hull so they grow out of it.
 * The longest ring is drawn first so the shorter ones sit in front of it, and
 * alternate rings are offset half a barb so each stack reads as its own row.
 */
function drawThorns(ctx: CanvasRenderingContext2D, tank: Tank, stacks: number, time: number): void {
  const r = tank.radius;
  const hull = r * hullExtent(tank.def);
  ctx.save();
  ctx.fillStyle = THORN_COLOR;
  ctx.strokeStyle = outline(THORN_COLOR);
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.lineJoin = 'round';
  for (let ring = stacks - 1; ring >= 0; ring--) {
    const count = 12 + ring * 2;
    const length = r * (0.3 + 0.14 * ring);
    const halfWidth = (Math.PI / count) * 0.5;
    const spin = time * 0.004 * (ring % 2 ? -1 : 1) + (ring % 2 ? Math.PI / count : 0);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const a = spin + (Math.PI * 2 * i) / count;
      const root = hull * 0.92;
      ctx.moveTo(Math.cos(a - halfWidth) * root, Math.sin(a - halfWidth) * root);
      ctx.lineTo(Math.cos(a) * (hull + length), Math.sin(a) * (hull + length));
      ctx.lineTo(Math.cos(a + halfWidth) * root, Math.sin(a + halfWidth) * root);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * One hexagon shell per charge left, nested and turning together, with enough
 * space between them that three still count as three at a glance. A spent
 * charge's shell breaks as a ripple from the simulation at the same size, so the
 * outermost shell is the one that visibly goes.
 */
function drawShield(ctx: CanvasRenderingContext2D, tank: Tank, charges: number, time: number): void {
  if (charges <= 0) return;
  const r = tank.radius * hullExtent(tank.def);
  const base = ctx.globalAlpha;
  const width = Math.max(1.5, tank.radius * 0.07);
  ctx.save();
  ctx.lineJoin = 'round';
  for (let i = 0; i < charges; i++) {
    const radius = r * shieldShellRadius(i);
    const turn = time * 0.015;
    ctx.globalAlpha = base * (0.85 - 0.12 * i);
    ctx.beginPath();
    polygonPath(ctx, 0, 0, radius, 6, turn);
    // A dark edge under the colour, the way diep outlines everything, so a pale
    // line still reads against the pale floor.
    ctx.strokeStyle = outline(SHIELD_COLOR);
    ctx.lineWidth = width * 1.6;
    ctx.stroke();
    ctx.strokeStyle = SHIELD_COLOR;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A pip per kill still counting, in an arc over the tank. Each one shrinks and
 * fades as its kill ages out, so the spree visibly drains when you stop.
 */
function drawSpree(
  ctx: CanvasRenderingContext2D,
  tank: Tank,
  stacks: number,
  left: readonly number[],
  /** How far out the arc sits, as a multiple of the hull. */
  clear: number,
): void {
  if (!left.length) return;
  const r = tank.radius;
  const arc = r * hullExtent(tank.def) * clear;
  const step = 0.3;
  const start = -Math.PI / 2 - (step * (left.length - 1)) / 2;
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.fillStyle = SPREE_COLOR;
  ctx.strokeStyle = outline(SPREE_COLOR);
  ctx.lineWidth = Math.max(1, r * 0.035);
  for (let i = 0; i < left.length; i++) {
    const t = Math.max(0, Math.min(1, left[i]!));
    const a = start + step * i;
    const size = r * (0.13 + 0.025 * stacks) * (0.55 + 0.45 * t);
    ctx.globalAlpha = base * (0.35 + 0.65 * t);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * arc, Math.sin(a) * arc, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A red glow on the rim with a beat leaving it, faster and brighter the nearer
 * death is. It only appears once the perk is actually doing something, which is
 * below half health.
 */
function drawLastStand(
  ctx: CanvasRenderingContext2D,
  tank: Tank,
  stacks: number,
  urgency: number,
  time: number,
): void {
  if (urgency <= 0) return;
  const r = tank.radius * hullExtent(tank.def);
  // Beats per second climb from about one and a half to three.
  const period = 17 - 9 * urgency;
  const phase = (time % period) / period;
  const fade = (1 - phase) * (1 - phase);
  const strength = Math.min(1, (0.5 + 0.5 * urgency) * (0.85 + 0.1 * stacks));
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.strokeStyle = LAST_STAND_COLOR;
  // A steady glow at the rim, so it is never caught invisible between beats.
  ctx.globalAlpha = base * strength * 0.7;
  ctx.lineWidth = Math.max(2, tank.radius * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = base * strength * fade;
  ctx.lineWidth = Math.max(2, tank.radius * 0.16 * (1 - phase * 0.6));
  ctx.beginPath();
  ctx.arc(0, 0, r * (1.05 + 0.35 * phase), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
