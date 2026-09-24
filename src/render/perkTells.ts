/**
 * Perks drawn on the player's tank, so what you are carrying can be seen in the
 * fight rather than only read off the list in the corner.
 *
 * Only the perks whose effect lives on the body are here: Static Field, Thorns,
 * Shield, Killing Spree, Last Stand, Bulwark, Glass Cannon, Afterburner and
 * Magnet. The shot perks mark the bullets instead (bulletLooks.ts), and the two
 * with nothing physical to show live on the HUD. Each one grows with its stacks,
 * so the tank shows how much of a perk it has as well as which. Everything is flat
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
  magnetRadius,
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
const BULWARK_COLOR = '#6B6F76';
const FLAME_COLOR = '#FF9A3C';
const MAGNET_COLOR = '#7C8DA0';

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
    else if (tell.id === 'magnet') drawMagnet(ctx, tank, tell.stacks, time);
    else if (tell.id === 'dash') drawFlame(ctx, tank, tell.gauge[0] ?? 1, time);
    else if (tell.id === 'thorns') drawThorns(ctx, tank, tell.stacks, time);
    else if (tell.id === 'bulwark') drawBulwark(ctx, tank, tell.stacks);
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
    if (tell.id === 'glass-cannon') drawGlass(ctx, tank, tell.stacks, time);
    else if (tell.id === 'shield') drawShield(ctx, tank, tell.gauge[0] ?? 0, time);
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

/**
 * Armour plates hugging the hull: a ring of dark segments with gaps between,
 * more of them and thicker with each stack, so the tank looks bolted up.
 */
function drawBulwark(ctx: CanvasRenderingContext2D, tank: Tank, stacks: number): void {
  const r = tank.radius * hullExtent(tank.def);
  const plates = 6 + 2 * stacks;
  const width = tank.radius * (0.14 + 0.06 * stacks);
  const ring = r + width * 0.35;
  const gap = 0.16;
  const turn = tank.angle;
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let i = 0; i < plates; i++) {
    const a = turn + (Math.PI * 2 * i) / plates;
    const span = (Math.PI * 2) / plates;
    ctx.moveTo(Math.cos(a + gap) * ring, Math.sin(a + gap) * ring);
    ctx.arc(0, 0, ring, a + gap, a + span - gap);
  }
  ctx.strokeStyle = outline(BULWARK_COLOR);
  ctx.lineWidth = width + Math.max(2, tank.radius * 0.06);
  ctx.stroke();
  ctx.strokeStyle = BULWARK_COLOR;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/**
 * A pale crescent of light across the body, sweeping slowly round, the way light
 * sits on glass. Clipped to the body, so it never spills past the outline.
 */
function drawGlass(ctx: CanvasRenderingContext2D, tank: Tank, stacks: number, time: number): void {
  const r = tank.radius;
  const a = time * 0.03;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha *= 0.3 + 0.15 * stacks;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  // Two offset circles make the crescent: the lit one minus a shadow one.
  ctx.arc(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, r * 0.7, 0, Math.PI * 2);
  ctx.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.72, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.restore();
}

/**
 * A small flame behind the tank while the dash is ready, shrinking away as it
 * recharges, so you can tell at a glance whether you have one to spend.
 */
function drawFlame(ctx: CanvasRenderingContext2D, tank: Tank, ready: number, time: number): void {
  if (ready <= 0.05) return;
  const r = tank.radius * hullExtent(tank.def);
  const back = tank.angle + Math.PI;
  const flicker = 0.85 + 0.15 * Math.sin(time * 1.7) + 0.08 * Math.sin(time * 4.1);
  const length = tank.radius * 0.75 * ready * flicker;
  const half = tank.radius * 0.28 * ready;
  ctx.save();
  ctx.rotate(back);
  ctx.beginPath();
  ctx.moveTo(r * 0.85, -half);
  ctx.lineTo(r + length, 0);
  ctx.lineTo(r * 0.85, half);
  ctx.closePath();
  ctx.fillStyle = FLAME_COLOR;
  ctx.strokeStyle = outline(FLAME_COLOR);
  ctx.lineWidth = Math.max(1.5, tank.radius * 0.06);
  ctx.lineJoin = 'round';
  ctx.globalAlpha *= 0.85;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Faint specks drifting in from the pull radius, fading as they near the tank.
 * Placed by the tick alone, so they need no state.
 */
function drawMagnet(ctx: CanvasRenderingContext2D, tank: Tank, stacks: number, time: number): void {
  const reach = magnetRadius(stacks);
  const inner = tank.radius * hullExtent(tank.def) * 1.4;
  const specks = 8;
  const period = 60;
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.fillStyle = MAGNET_COLOR;
  ctx.strokeStyle = outline(MAGNET_COLOR);
  ctx.lineWidth = Math.max(1.5, tank.radius * 0.04);
  for (let i = 0; i < specks; i++) {
    // Each speck is a quarter of the way further through its fall than the last.
    const t = ((time + (period * i) / specks) % period) / period;
    const d = reach + (inner - reach) * t * t;
    const a = (Math.PI * 2 * i) / specks + i * 0.7;
    ctx.globalAlpha = base * 0.85 * Math.sin(Math.PI * t);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(5, tank.radius * 0.15), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
