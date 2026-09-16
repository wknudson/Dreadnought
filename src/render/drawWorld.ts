import type { Camera } from './camera.ts';
import type { World, DeathEffect } from '../sim/world.ts';
import type { Entity } from '../sim/entity.ts';
import { DEATH_TICKS, FLASH_TICKS } from '../sim/entity.ts';
import { Tank } from '../sim/tank.ts';
import { Shape } from '../sim/shape.ts';
import { Projectile } from '../sim/projectiles.ts';
import { drawTank, polygonPath } from './drawTank.ts';
import { COLORS, outline } from '../data/colors.ts';
import { BarrelHost } from '../sim/weapon.ts';
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
): void {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  camera.applyTransform(ctx);

  drawGrid(ctx, camera);
  drawOutOfBounds(ctx, camera, world);

  // Ordered so the things you need to read sit on top of the things you do not.
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
    }
  }

  for (const e of traps) drawProjectile(ctx, e as Projectile, alpha);
  for (const e of shapes) drawShape(ctx, e as Shape, alpha);
  for (const e of projectiles) drawProjectile(ctx, e as Projectile, alpha);
  for (const t of enemies) drawTankEntity(ctx, t, alpha);
  for (const t of players) drawTankEntity(ctx, t, alpha);

  for (const d of world.deaths) drawDeath(ctx, d, alpha);

  // Health bars and names render in their own passes so nothing overlaps them.
  for (const e of [...shapes, ...enemies, ...players]) drawHealthBar(ctx, e, alpha);
  for (const t of [...enemies, ...players]) drawName(ctx, t, alpha);

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

/** Shades everything beyond the arena, the way diep.io marks its border. */
function drawOutOfBounds(ctx: CanvasRenderingContext2D, camera: Camera, world: World): void {
  const h = world.arena.halfSize;
  const b = camera.visibleBounds(GRID_SIZE * 2);
  ctx.save();
  ctx.globalAlpha = COLORS.outOfBoundsAlpha;
  ctx.fillStyle = COLORS.outOfBounds;
  // Four bands around the playfield, clipped to what the camera can see.
  if (b.minY < -h) ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, Math.min(-h, b.maxY) - b.minY);
  if (b.maxY > h) ctx.fillRect(b.minX, Math.max(h, b.minY), b.maxX - b.minX, b.maxY - Math.max(h, b.minY));
  const midTop = Math.max(-h, b.minY);
  const midBottom = Math.min(h, b.maxY);
  if (midBottom > midTop) {
    if (b.minX < -h) ctx.fillRect(b.minX, midTop, Math.min(-h, b.maxX) - b.minX, midBottom - midTop);
    if (b.maxX > h) ctx.fillRect(Math.max(h, b.minX), midTop, b.maxX - Math.max(h, b.minX), midBottom - midTop);
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

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, alpha: number): void {
  const pos = lerpPos(p, alpha);
  const fill = p.deathColor;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline(fill);
  ctx.lineWidth = Math.max(1, p.radius * 0.2);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (p.projectileKind === 'drone' || p.projectileKind === 'swarm') {
    ctx.rotate(lerpAngle(p.prevAngle, p.angle, alpha));
    polygonPath(ctx, 0, 0, p.radius * 1.4, 3);
  } else if (p.projectileKind === 'necroDrone') {
    ctx.rotate(lerpAngle(p.prevAngle, p.angle, alpha));
    polygonPath(ctx, 0, 0, p.radius * 1.3, 4);
  } else {
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
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
  if (e.hideHealthBar || e.health >= e.maxHealth || !e.alive) return;
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

export { BarrelHost };
