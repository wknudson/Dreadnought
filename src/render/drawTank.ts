import type { Addon, BarrelDefinition, TankDefinition } from '../data/schema.ts';
import { COLORS, mix, outline } from '../data/colors.ts';
import { BASE_BODY_RADIUS } from '../data/leveling.ts';

/**
 * How much narrower the small end of a trapezoidal barrel is.
 *
 * The game marks a barrel as trapezoidal and says which way it points, but never
 * publishes the ratio, so this is matched by eye against the real thing.
 */
const TRAPEZOID_TAPER = 0.65;

/** Outline thickness as a fraction of the body radius. */
const OUTLINE_RATIO = 0.075;

export interface DrawTankOptions {
  /** Body colour. Barrels are always grey. */
  color: string;
  /** Facing, in radians. */
  angle: number;
  /** Body radius in pixels. Everything else is derived from it. */
  radius: number;
  /** 0 to 1. Used by the invisibility tanks and the death fade. */
  opacity?: number;
  /** 0 to 1 tint toward the hit colour. */
  flash?: number;
  /** Per-barrel pull-back, 0 to 1, parallel to the barrel. */
  barrelRecoil?: readonly number[];
  /** Absolute angles for each auto turret, in the order the addons declare them. */
  turretAngles?: readonly number[];
  /** Rotation of the spinning guards on the Smasher line. */
  guardSpin?: number;
  /** Rotation of an Auto 3 / Auto 5 mounting ring. */
  ringSpin?: number;
}

const HIT_COLOR = '#FF6B6B';

/**
 * Draws a tank centred on the current transform origin.
 *
 * This is the single renderer for every tank in the game: the one you drive, the
 * ones shooting at you, the icons in the upgrade panel, the nodes of the tech
 * tree and the swatches in the colour picker. They all look identical because
 * they are all this function.
 */
export function drawTank(
  ctx: CanvasRenderingContext2D,
  def: TankDefinition,
  opts: DrawTankOptions,
): void {
  const { radius } = opts;
  // Definitions are authored against a level-1 body radius of 50 units.
  const scale = radius / BASE_BODY_RADIUS;
  const fill = opts.flash ? mix(opts.color, HIT_COLOR, opts.flash) : opts.color;
  const lineWidth = Math.max(1, radius * OUTLINE_RATIO * 2);

  ctx.save();
  if (opts.opacity !== undefined && opts.opacity < 1) ctx.globalAlpha *= Math.max(0, opts.opacity);
  ctx.rotate(opts.angle);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';

  for (const addon of def.preAddons) {
    drawAddon(ctx, addon, scale, radius, lineWidth, opts);
  }

  def.barrels.forEach((barrel, i) => {
    drawBarrel(ctx, barrel, scale, lineWidth, opts.barrelRecoil?.[i] ?? 0);
  });

  drawBody(ctx, def, radius, fill, lineWidth);

  let turretIndex = 0;
  for (const addon of def.postAddons) {
    turretIndex = drawAddon(ctx, addon, scale, radius, lineWidth, opts, turretIndex);
  }

  ctx.restore();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  def: TankDefinition,
  radius: number,
  fill: string,
  lineWidth: number,
): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline(fill);
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  if (def.sides <= 1) {
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  } else {
    // A square body is drawn corner-up, matching how the game orients it.
    polygonPath(ctx, 0, 0, radius, def.sides, def.sides === 4 ? Math.PI / 4 : 0);
  }
  ctx.fill();
  ctx.stroke();
}

/**
 * Draws one barrel.
 *
 * A barrel runs from the tank centre out to `size`, so its inner end is always
 * hidden under the body. `offset` slides it sideways, which is what separates
 * Twin's two barrels and stacks Gunner's four.
 */
function drawBarrel(
  ctx: CanvasRenderingContext2D,
  barrel: BarrelDefinition,
  scale: number,
  lineWidth: number,
  recoil: number,
): void {
  const length = barrel.size * scale;
  const halfWidth = (barrel.width * scale) / 2;
  const offset = barrel.offset * scale;
  // Recoil slides the barrel back into the body rather than shortening it.
  const pullback = recoil * Math.min(8 * scale, length * 0.12);

  ctx.save();
  ctx.rotate(barrel.angle);
  ctx.translate(-pullback, offset);

  ctx.fillStyle = COLORS.barrel;
  ctx.strokeStyle = outline(COLORS.barrel);
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  if (barrel.shape === 'rect') {
    ctx.rect(0, -halfWidth, length, halfWidth * 2);
  } else {
    const narrow = halfWidth * TRAPEZOID_TAPER;
    // trapezoidMuzzle flares out toward the tip; trapezoidBase tapers to it.
    const baseHalf = barrel.shape === 'trapezoidMuzzle' ? narrow : halfWidth;
    const tipHalf = barrel.shape === 'trapezoidMuzzle' ? halfWidth : narrow;
    ctx.moveTo(0, -baseHalf);
    ctx.lineTo(length, -tipHalf);
    ctx.lineTo(length, tipHalf);
    ctx.lineTo(0, baseHalf);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  if (barrel.cap === 'trapLauncher') {
    // The wedge that caps a trap launcher's muzzle.
    const capLength = barrel.width * scale * (20 / 42);
    const capHalf = halfWidth * 1.05;
    ctx.beginPath();
    ctx.moveTo(length, -capHalf);
    ctx.lineTo(length + capLength, -capHalf * TRAPEZOID_TAPER);
    ctx.lineTo(length + capLength, capHalf * TRAPEZOID_TAPER);
    ctx.lineTo(length, capHalf);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/** Returns the next turret index so callers can hand each turret its own angle. */
function drawAddon(
  ctx: CanvasRenderingContext2D,
  addon: Addon,
  scale: number,
  radius: number,
  lineWidth: number,
  opts: DrawTankOptions,
  turretIndex = 0,
): number {
  switch (addon.kind) {
    case 'guard': {
      const spin = opts.guardSpin ?? 0;
      ctx.save();
      ctx.fillStyle = COLORS.border;
      ctx.strokeStyle = outline(COLORS.border);
      ctx.lineWidth = lineWidth;
      for (const guard of addon.guards) {
        // The guard is measured across its flats, hence the diagonal correction.
        const r = (radius * guard.sizeRatio) / Math.SQRT2;
        ctx.beginPath();
        polygonPath(ctx, 0, 0, r * Math.SQRT2, guard.sides, guard.offsetAngle + spin * guard.spin * 10);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      return turretIndex;
    }

    case 'launcher': {
      const length = addon.length * scale;
      const halfWidth = (addon.width * scale) / 2;
      ctx.save();
      ctx.rotate(addon.angle);
      ctx.fillStyle = COLORS.barrel;
      ctx.strokeStyle = outline(COLORS.barrel);
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(0, -halfWidth * TRAPEZOID_TAPER);
      ctx.lineTo(length, -halfWidth);
      ctx.lineTo(length, halfWidth);
      ctx.lineTo(0, halfWidth * TRAPEZOID_TAPER);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return turretIndex;
    }

    case 'pronounced': {
      const length = addon.length * scale;
      const halfWidth = (addon.width * scale) / 2;
      ctx.save();
      ctx.translate(addon.centerX * scale, 0);
      ctx.fillStyle = COLORS.barrel;
      ctx.strokeStyle = outline(COLORS.barrel);
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(-length / 2, -halfWidth);
      ctx.lineTo(length / 2, -halfWidth * TRAPEZOID_TAPER);
      ctx.lineTo(length / 2, halfWidth * TRAPEZOID_TAPER);
      ctx.lineTo(-length / 2, halfWidth);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return turretIndex;
    }

    case 'autoTurret': {
      const angle = opts.turretAngles?.[turretIndex] ?? 0;
      drawTurret(ctx, addon.turret.baseRadius * scale, addon.turret.barrel, scale, lineWidth, angle, 0, 0);
      return turretIndex + 1;
    }

    case 'autoRing': {
      const ring = opts.ringSpin ?? 0;
      for (let i = 0; i < addon.count; i++) {
        const mount = ring + (Math.PI * 2 * i) / addon.count;
        const dist = addon.turret.mountDistance * radius;
        const angle = opts.turretAngles?.[turretIndex + i] ?? mount;
        drawTurret(
          ctx,
          addon.turret.baseRadius * scale,
          addon.turret.barrel,
          scale,
          lineWidth,
          angle,
          Math.cos(mount) * dist,
          Math.sin(mount) * dist,
        );
      }
      return turretIndex + addon.count;
    }

    default:
      return turretIndex;
  }
}

/** A turret: a grey disc with its own barrel, aiming independently of the body. */
function drawTurret(
  ctx: CanvasRenderingContext2D,
  baseRadius: number,
  barrel: BarrelDefinition,
  scale: number,
  lineWidth: number,
  angle: number,
  x: number,
  y: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  drawBarrel(ctx, barrel, scale, lineWidth, 0);
  ctx.fillStyle = COLORS.barrel;
  ctx.strokeStyle = outline(COLORS.barrel);
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Traces a regular polygon. Used for bodies, shapes and guards alike. */
export function polygonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotation = 0,
): void {
  for (let i = 0; i < sides; i++) {
    const a = rotation + (Math.PI * 2 * i) / sides;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * How far a tank's artwork reaches from its centre, as a multiple of body radius.
 *
 * Icons need this to size themselves: an Annihilator's stubby wide barrel and a
 * Ranger's long thin one occupy very different amounts of room.
 */
export function artExtent(def: TankDefinition): number {
  let extent = 1;
  for (const barrel of def.barrels) {
    const tip = barrel.size / BASE_BODY_RADIUS;
    const halfWidth = barrel.width / 2 / BASE_BODY_RADIUS;
    const cap = barrel.cap === 'trapLauncher' ? (barrel.width * (20 / 42)) / BASE_BODY_RADIUS : 0;
    extent = Math.max(extent, Math.hypot(tip + cap, halfWidth + Math.abs(barrel.offset) / BASE_BODY_RADIUS));
  }
  for (const addon of [...def.preAddons, ...def.postAddons]) {
    if (addon.kind === 'launcher') extent = Math.max(extent, addon.length / BASE_BODY_RADIUS);
    if (addon.kind === 'guard') {
      for (const g of addon.guards) extent = Math.max(extent, g.sizeRatio);
    }
    if (addon.kind === 'autoRing') {
      extent = Math.max(
        extent,
        addon.turret.mountDistance + addon.turret.barrel.size / BASE_BODY_RADIUS,
      );
    }
  }
  return extent;
}
