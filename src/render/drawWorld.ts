/**
 * Draws the arena and everything in it, in world space, for one frame.
 *
 * Positions and angles are interpolated between the last two ticks by `alpha`,
 * so motion stays smooth whatever the display rate. Entities are sorted into
 * layers first, so tanks sit above shapes and shots, and health bars and names go
 * on top in passes of their own. Screen-space furniture such as the score and the
 * minimap belongs to hud.ts instead.
 */

import type { Camera } from './camera.ts';
import type { World, DeathEffect } from '../sim/world.ts';
import type { WarningRing } from '../sim/waves.ts';
import type { PerkTell } from '../sim/perks.ts';
import { drawPerkTellsOver, drawPerkTellsUnder } from './perkTells.ts';
import type { Entity } from '../sim/entity.ts';
import { DEATH_TICKS, FLASH_TICKS } from '../sim/entity.ts';
import { Tank } from '../sim/tank.ts';
import { Shape } from '../sim/shape.ts';
import { Projectile } from '../sim/projectiles.ts';
import { drawTank, polygonPath } from './drawTank.ts';
import { COLORS, mix, outline } from '../data/colors.ts';
import { lerp, vec, type Vec2 } from '../core/math.ts';

/** Grid spacing in diep units: one square is one body radius at level 1. */
const GRID_SIZE = 50;

/** Interpolated position for smooth motion between simulation ticks. */
function lerpPos(e: { pos: Vec2; prevPos: Vec2 }, alpha: number): Vec2 {
  return vec(lerp(e.prevPos.x, e.pos.x, alpha), lerp(e.prevPos.y, e.pos.y, alpha));
}

function lerpAngle(prev: number, next: number, alpha: number): number {
  let delta = next - prev;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return prev + delta * alpha;
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  alpha: number,
  width: number,
  height: number,
  warnings: readonly WarningRing[] = [],
  /** The player's perks, drawn on its tank. */
  tells: readonly PerkTell[] = [],
): void {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  camera.applyTransform(ctx);

  drawGrid(ctx, camera);
  drawOutOfBounds(ctx, camera, world);
  drawGhostBounds(ctx, world);
  for (const warning of warnings) drawWarning(ctx, warning);

  // Ordered so the things you need to read sit on top of the things you do not.
  const orbs: Entity[] = [];
  const traps: Entity[] = [];
  const shapes: Entity[] = [];
  const projectiles: Entity[] = [];
  const enemies: Tank[] = [];
  const players: Tank[] = [];

  const bounds = camera.visibleBounds();
  for (const e of world.entities) {
    if (!e.alive) continue;
    if (
      e.pos.x + e.radius < bounds.minX ||
      e.pos.x - e.radius > bounds.maxX ||
      e.pos.y + e.radius < bounds.minY ||
      e.pos.y - e.radius > bounds.maxY
    ) {
      continue;
    }
    if (e instanceof Tank) (e.team === 'player' ? players : enemies).push(e);
    else if (e instanceof Shape) shapes.push(e);
    else if (e instanceof Projectile) {
      (e.projectileKind === 'trap' ? traps : projectiles).push(e);
    } else if (e.kind === 'pickup') orbs.push(e);
  }

  for (const e of orbs) drawOrb(ctx, e, alpha);
  for (const e of traps) drawProjectile(ctx, e as Projectile, alpha);
  for (const e of shapes) drawShape(ctx, e as Shape, alpha);
  for (const e of projectiles) drawProjectile(ctx, e as Projectile, alpha);
  for (const t of enemies) drawTankEntity(ctx, t, alpha);
  const time = world.tick - 1 + alpha;
  for (const t of players) {
    const pos = lerpPos(t, alpha);
    drawPerkTellsUnder(ctx, t, pos, tells, time);
    drawTankEntity(ctx, t, alpha);
    drawPerkTellsOver(ctx, t, pos, tells, time);
  }

  for (const d of world.deaths) drawDeath(ctx, d, alpha);

  // Health bars and names render in their own passes so nothing overlaps them.
  for (const e of [...shapes, ...enemies, ...players]) drawHealthBar(ctx, e, alpha);
  for (const t of [...enemies, ...players]) drawName(ctx, t, alpha);

  ctx.restore();
}

/**
 * The small round things that are neither a tank, a shape nor a shot: health
 * orbs and mines.
 *
 * They were drawn by nothing at all until this existed, which made a perk that
 * drops healing on the field rather hard to play around.
 */
function drawOrb(ctx: CanvasRenderingContext2D, e: Entity, alpha: number): void {
  const pos = lerpPos(e, alpha);
  const color = (e as Entity & { color?: string }).color ?? COLORS.healthFill;
  ctx.save();
  ctx.globalAlpha = e.opacity;
  ctx.fillStyle = color;
  ctx.strokeStyle = outline(color);
  ctx.lineWidth = Math.max(2, e.radius * 0.28);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, e.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Marks where something is about to arrive.
 *
 * A closing ring rather than a static marker, so the moment it will land is
 * readable at a glance and a wave never appears out of nowhere behind you.
 */
function drawWarning(ctx: CanvasRenderingContext2D, warning: WarningRing): void {
  const { pos, radius, progress } = warning;
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.globalAlpha = 0.25 + 0.35 * progress;
  ctx.strokeStyle = COLORS.enemyRed;
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.setLineDash([radius * 0.35, radius * 0.25]);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // A second ring closes on the first, counting the spawn down.
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.5 * progress;
  ctx.beginPath();
  ctx.arc(0, 0, radius * (1.9 - progress * 0.9), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera): void {
  const b = camera.visibleBounds(GRID_SIZE);
  ctx.save();
  ctx.globalAlpha = COLORS.gridAlpha;
  ctx.strokeStyle = COLORS.grid;
  // A hairline at any zoom: the grid should never dominate the background.
  ctx.lineWidth = 1 / camera.zoom;
  ctx.beginPath();
  const startX = Math.floor(b.minX / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(b.minY / GRID_SIZE) * GRID_SIZE;
  for (let x = startX; x <= b.maxX; x += GRID_SIZE) {
    ctx.moveTo(x, b.minY);
    ctx.lineTo(x, b.maxY);
  }
  for (let y = startY; y <= b.maxY; y += GRID_SIZE) {
    ctx.moveTo(b.minX, y);
    ctx.lineTo(b.maxX, y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Outlines bounds that are coming but have not arrived.
 *
 * Drawn on the world rather than announced in words, because the decision it
 * asks for is spatial: everything outside this rectangle is about to be swept
 * away, and the player needs to know where to leave the swarm standing.
 */
function drawGhostBounds(ctx: CanvasRenderingContext2D, world: World): void {
  const ghost = world.arena.ghost;
  if (!ghost) return;
  // A slow pulse, so it reads as pending rather than as scenery.
  const pulse = 0.45 + 0.3 * Math.sin(world.tick * 0.22);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = COLORS.enemyRed;
  ctx.lineWidth = 8;
  ctx.setLineDash([90, 60]);
  ctx.strokeRect(-ghost.x, -ghost.y, ghost.x * 2, ghost.y * 2);
  ctx.restore();
}

/** Shades everything beyond the arena, the way diep.io marks its border. */
function drawOutOfBounds(ctx: CanvasRenderingContext2D, camera: Camera, world: World): void {
  const hx = world.arena.half.x;
  const hy = world.arena.half.y;
  const b = camera.visibleBounds(GRID_SIZE * 2);
  ctx.save();
  ctx.globalAlpha = COLORS.outOfBoundsAlpha;
  ctx.fillStyle = COLORS.outOfBounds;
  // Four bands around the playfield, clipped to what the camera can see.
  if (b.minY < -hy) ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, Math.min(-hy, b.maxY) - b.minY);
  if (b.maxY > hy) {
    ctx.fillRect(b.minX, Math.max(hy, b.minY), b.maxX - b.minX, b.maxY - Math.max(hy, b.minY));
  }
  const midTop = Math.max(-hy, b.minY);
  const midBottom = Math.min(hy, b.maxY);
  if (midBottom > midTop) {
    if (b.minX < -hx) ctx.fillRect(b.minX, midTop, Math.min(-hx, b.maxX) - b.minX, midBottom - midTop);
    if (b.maxX > hx) {
      ctx.fillRect(Math.max(hx, b.minX), midTop, b.maxX - Math.max(hx, b.minX), midBottom - midTop);
    }
  }
  ctx.restore();
}

function drawTankEntity(ctx: CanvasRenderingContext2D, tank: Tank, alpha: number): void {
  const pos = lerpPos(tank, alpha);
  const angle = lerpAngle(tank.prevAngle, tank.angle, alpha);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  drawTank(ctx, tank.def, {
    color: tank.color,
    angle,
    radius: tank.radius,
    opacity: tank.opacity,
    flash: tank.flashTicks / FLASH_TICKS,
    barrelRecoil: tank.host.barrels.map((b) => b.recoilAnim),
    guardSpin: lerp(tank.prevGuardSpin, tank.guardSpin, alpha),
    // Turrets aim independently of the hull, so their angles are absolute and
    // have to be interpolated separately from it.
    turretAngles: tank.turrets.map((t) => lerpAngle(t.prevAngle, t.angle, alpha) - angle),
    ringSpin: lerp(tank.prevRingAngle, tank.ringAngle, alpha),
  });
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, alpha: number): void {
  const pos = lerpPos(shape, alpha);
  const angle = lerpAngle(shape.prevAngle, shape.angle, alpha);
  const fill = shape.color;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);
  ctx.fillStyle = shape.flashTicks > 0 ? COLORS.shiny : fill;
  ctx.strokeStyle = outline(fill);
  ctx.lineWidth = Math.max(1, shape.radius * 0.15);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  polygonPath(ctx, 0, 0, shape.drawRadius, shape.sides);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Traps are drawn as the three-pointed star the game uses. */
function starPath(ctx: CanvasRenderingContext2D, radius: number, points: number): void {
  const inner = radius * 0.5;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, alpha: number): void {
  const pos = lerpPos(p, alpha);
  const angle = lerpAngle(p.prevAngle, p.angle, alpha);
  const fill = p.deathColor;

  // A missile or minion carries its own barrels, so it is drawn as a small tank.
  const carrier = p.carriedDef;
  if (carrier) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    drawTank(ctx, carrier, {
      color: fill,
      angle,
      radius: p.radius,
      flash: p.flashTicks / FLASH_TICKS,
    });
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.fillStyle = p.flashTicks > 0 ? mix(fill, '#FFFFFF', 0.45) : fill;
  ctx.strokeStyle = outline(fill);
  ctx.lineWidth = Math.max(1, p.radius * 0.2);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (p.projectileKind) {
    case 'drone':
    case 'swarm':
      ctx.rotate(angle);
      polygonPath(ctx, 0, 0, p.radius * 1.5, 3);
      break;
    case 'necroDrone':
      ctx.rotate(angle);
      polygonPath(ctx, 0, 0, p.radius * 1.35, 4, Math.PI / 4);
      break;
    case 'trap':
      ctx.rotate(angle);
      starPath(ctx, p.radius * 1.5, 3);
      break;
    default:
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      break;
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The puff-and-fade a dying entity leaves behind. */
function drawDeath(ctx: CanvasRenderingContext2D, d: DeathEffect, alpha: number): void {
  const age = lerp(d.prevAge, d.age, alpha);
  const t = Math.min(1, age / DEATH_TICKS);
  const scale = Math.pow(1.1, age);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t);
  ctx.translate(d.pos.x, d.pos.y);
  if (d.def) {
    drawTank(ctx, d.def, { color: d.color, angle: d.angle, radius: d.radius * scale });
  } else if (d.ring) {
    // A ripple: the outline alone, thin, so it marks a reach without covering it.
    ctx.rotate(d.angle);
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (d.sides <= 1) ctx.arc(0, 0, d.radius * scale, 0, Math.PI * 2);
    else polygonPath(ctx, 0, 0, d.radius * scale, d.sides);
    ctx.stroke();
  } else {
    ctx.rotate(d.angle);
    ctx.fillStyle = d.color;
    ctx.strokeStyle = outline(d.color);
    ctx.lineWidth = Math.max(1, d.radius * 0.2);
    ctx.beginPath();
    if (d.sides <= 1) ctx.arc(0, 0, d.radius * scale, 0, Math.PI * 2);
    else polygonPath(ctx, 0, 0, d.radius * scale, d.sides);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawHealthBar(ctx: CanvasRenderingContext2D, e: Entity, alpha: number): void {
  const isBoss = e instanceof Tank && e.isBoss;
  if (e.hideHealthBar || !e.alive) return;
  // A boss shows its bar from the first moment, so you can see what you are in for.
  if (!isBoss && e.health >= e.maxHealth) return;
  const pos = lerpPos(e, alpha);
  const width = e.radius * 2;
  const height = Math.max(4, e.radius * 0.22);
  const y = pos.y + e.radius + height * 1.6;
  const x = pos.x - width / 2;
  const fraction = Math.max(0, Math.min(1, e.health / e.maxHealth));

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = height;
  ctx.strokeStyle = COLORS.healthBack;
  ctx.beginPath();
  ctx.moveTo(x + height / 2, y);
  ctx.lineTo(x + width - height / 2, y);
  ctx.stroke();

  if (fraction > 0) {
    ctx.strokeStyle = COLORS.healthFill;
    ctx.lineWidth = height * 0.66;
    ctx.beginPath();
    ctx.moveTo(x + height / 2, y);
    ctx.lineTo(x + height / 2 + (width - height) * fraction, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawName(ctx: CanvasRenderingContext2D, tank: Tank, alpha: number): void {
  if (!tank.name) return;
  const pos = lerpPos(tank, alpha);
  const size = Math.max(12, tank.radius * 0.5);
  ctx.save();
  ctx.font = `700 ${size}px Ubuntu, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = size * 0.22;
  ctx.strokeStyle = '#000000';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = tank.opacity;
  ctx.strokeText(tank.name, pos.x, pos.y - tank.radius - size * 0.5);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(tank.name, pos.x, pos.y - tank.radius - size * 0.5);
  ctx.restore();
}

