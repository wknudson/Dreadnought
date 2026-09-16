import type { TankDefinition } from '../data/schema.ts';
import { artExtent, drawTank } from './drawTank.ts';

/**
 * Pre-rendered tank icons.
 *
 * The tree viewer draws fifty tanks every frame, and some of them carry eleven
 * barrels. Rendering each once into its own small canvas turns that from
 * hundreds of paths per frame into fifty bitmap blits.
 */
const cache = new Map<string, HTMLCanvasElement>();

function createCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/**
 * An icon for a tank, sized so its longest barrel just fits.
 *
 * `size` is the width of the square canvas in device pixels; the body is scaled
 * down to leave room for whatever sticks out, so a Ranger and an Octo Tank end
 * up occupying the same box.
 */
export function tankIcon(def: TankDefinition, size: number, color: string): HTMLCanvasElement {
  const key = `${def.id}:${size}:${color}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Fit the whole silhouette, not just the body, inside the square.
    const radius = (size / 2 / artExtent(def)) * 0.92;
    ctx.translate(size / 2, size / 2);
    drawTank(ctx, def, { color, angle: -Math.PI / 2, radius });
  }
  cache.set(key, canvas);
  return canvas;
}

/** Drops every cached icon. Call after a colour change. */
export function clearIconCache(): void {
  cache.clear();
}

/**
 * Draws a tank into an existing canvas element, sized to fit.
 *
 * Used for the small previews embedded in menus, where the element already
 * exists in the document and only needs its contents painted.
 */
export function paintTankInto(
  canvas: HTMLCanvasElement,
  def: TankDefinition,
  color: string,
  angle = -Math.PI / 2,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssSize = canvas.clientWidth || Number.parseInt(canvas.style.width, 10) || 64;
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  const radius = (cssSize / 2 / artExtent(def)) * 0.9;
  ctx.translate(cssSize / 2, cssSize / 2);
  drawTank(ctx, def, { color, angle, radius });
}
