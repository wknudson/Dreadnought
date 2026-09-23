/**
 * Marks on the player's bullets for the six shot perks, so a shot shows what it
 * will do before it does it.
 *
 * A bullet is a few pixels across, so each perk gets one small mark and they are
 * placed to stack without fighting: the tail behind, the nose as part of the
 * body's own outline, the cracks and the core on it, the rings around it.
 * Piercing and Ricochet read the shot's live charges, so their marks count down
 * as they are spent. Only round bullets are marked; drones and traps keep their
 * own shapes.
 *
 * Drawing is what a marked bullet costs, so every mark is one path and one fill
 * or stroke, and the nose shares the body's rather than adding its own. Every
 * mark reads `ProjectileMods`, which only the player's shots ever have, so enemy
 * fire and plain shots never reach anything in here.
 */

import type { Projectile, Bullet } from '../sim/projectiles.ts';
import { EXPLOSION_COLOR } from '../sim/perkImpl.ts';
import { mix, outline } from '../data/colors.ts';
import type { Vec2 } from '../core/math.ts';

/** Whether a bullet has anything worth marking, so a plain shot skips all of it. */
export const hasMarks = (p: Projectile): boolean => {
  const m = p.mods;
  return m.pierce > 0 || m.bounces > 0 || m.homing > 0 || m.split > 0 || m.explodeRadius > 0 || m.heavy > 0;
};

/** How much a Heavy Rounds stack thickens the outline, as a fraction of radius. */
export const heavyOutline = (radius: number, heavy: number): number => radius * (0.2 + 0.065 * heavy);

/** How far Piercing's nose reaches past the body, longest with every charge left. */
export const noseLength = (radius: number, pierce: number): number =>
  pierce > 0 ? radius * (0.75 + 0.3 * (pierce - 1)) : 0;

/**
 * Draws a perked bullet whole: tail, body with its nose and heavy outline, then
 * the marks that sit on and around it.
 */
export function drawMarkedBullet(
  ctx: CanvasRenderingContext2D,
  p: Bullet,
  /** The bullet's interpolated position and heading. */
  pos: Vec2,
  angle: number,
  /** The body colour this frame, already tinted if the shot is flashing. */
  body: string,
  /** World units per screen pixel, the floor for any line. */
  px: number,
): void {
  const r = p.radius;
  const fill = p.deathColor;
  const edge = outline(fill);
  const m = p.mods;

  if (m.homing > 0 && p.trail.length) drawTail(ctx, p, pos, fill, px);

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);

  // The body, drawn as a teardrop when it has a nose, so Piercing costs no more
  // than the circle it replaces.
  ctx.beginPath();
  const nose = noseLength(r, m.pierce);
  if (nose > 0) {
    const tip = r + nose;
    const t = Math.acos(r / tip);
    ctx.moveTo(tip, 0);
    ctx.arc(0, 0, r, t, Math.PI * 2 - t);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = body;
  ctx.strokeStyle = m.heavy > 0 ? mix(edge, '#000000', 0.25) : edge;
  ctx.lineWidth = Math.max(px, heavyOutline(r, m.heavy));
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();

  if (m.split > 0) {
    // One crack per piece it will break into: a line across for two, a Y for three.
    ctx.beginPath();
    for (let i = 0; i < m.split; i++) {
      const a = (Math.PI * 2 * i) / m.split + Math.PI / 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
    }
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(px, r * 0.12);
    ctx.stroke();
  }

  if (m.explodeRadius > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = EXPLOSION_COLOR;
    ctx.fill();
  }

  if (m.bounces > 0) {
    // A ring per bounce left, all in one stroke, the outer one next to go.
    const start = r + heavyOutline(r, m.heavy) / 2;
    const gap = Math.max(px * 2.5, r * 0.3);
    ctx.beginPath();
    for (let i = 1; i <= m.bounces; i++) {
      const ring = start + gap * i;
      ctx.moveTo(ring, 0);
      ctx.arc(0, 0, ring, 0, Math.PI * 2);
    }
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(px, r * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A tail through where a seeking shot has just been: a wide, brighter half
 * nearest the shot and a thin, fainter half behind it, two strokes in all.
 */
function drawTail(ctx: CanvasRenderingContext2D, p: Bullet, pos: Vec2, fill: string, px: number): void {
  const points = p.trail;
  const mid = Math.ceil(points.length / 2);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = mix(fill, '#FFFFFF', 0.25);

  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(px, p.radius * 1.1);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  for (let i = 0; i < mid; i++) ctx.lineTo(points[i]!.x, points[i]!.y);
  ctx.stroke();

  if (points.length > mid) {
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = Math.max(px, p.radius * 0.55);
    ctx.beginPath();
    ctx.moveTo(points[mid - 1]!.x, points[mid - 1]!.y);
    for (let i = mid; i < points.length; i++) ctx.lineTo(points[i]!.x, points[i]!.y);
    ctx.stroke();
  }
  ctx.restore();
}
