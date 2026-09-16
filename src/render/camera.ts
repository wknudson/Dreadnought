import { lerp, vec, type Vec2 } from '../core/math.ts';

/**
 * Follows the player and converts between world and screen space.
 *
 * Zoom follows diep.io's own formula, so the view widens both as a tank levels
 * and according to its class. A Ranger sees roughly twice the arena a Basic Tank
 * does at the same level.
 */
export class Camera {
  /** Centre of the view, in world coordinates. */
  pos: Vec2 = vec();
  /** Pixels per diep unit. */
  zoom = 0.55;

  /** Canvas size in CSS pixels. */
  private width = 1920;
  private height = 1080;

  /** Where the camera is easing toward. */
  private target: Vec2 = vec();
  private targetZoom = 0.55;

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Points the camera at a tank.
   *
   * `fieldOfView` comes from the tank; the window scaling keeps the same slice of
   * the world visible whatever the window size, so a wide monitor is not an
   * advantage.
   */
  follow(pos: Vec2, fieldOfView: number, offset: Vec2 | null = null): void {
    this.target.x = pos.x + (offset?.x ?? 0);
    this.target.y = pos.y + (offset?.y ?? 0);
    const windowScale = Math.max(this.height / 1080, this.width / 1920);
    this.targetZoom = fieldOfView * windowScale;
  }

  /** Snaps to the target without easing, for a fresh run or a respawn. */
  snap(): void {
    this.pos.x = this.target.x;
    this.pos.y = this.target.y;
    this.zoom = this.targetZoom;
  }

  /** Eases toward the target. Called once per rendered frame. */
  update(dt: number): void {
    const t = 1 - Math.pow(0.001, dt);
    this.pos.x = lerp(this.pos.x, this.target.x, t);
    this.pos.y = lerp(this.pos.y, this.target.y, t);
    this.zoom = lerp(this.zoom, this.targetZoom, t);
  }

  worldToScreen(world: Vec2): Vec2 {
    return vec(
      (world.x - this.pos.x) * this.zoom + this.width / 2,
      (world.y - this.pos.y) * this.zoom + this.height / 2,
    );
  }

  screenToWorld(screen: Vec2): Vec2 {
    return vec(
      (screen.x - this.width / 2) / this.zoom + this.pos.x,
      (screen.y - this.height / 2) / this.zoom + this.pos.y,
    );
  }

  /** The world rectangle currently on screen, padded so nothing pops at the edge. */
  visibleBounds(pad = 200): { minX: number; minY: number; maxX: number; maxY: number } {
    const halfW = this.width / 2 / this.zoom + pad;
    const halfH = this.height / 2 / this.zoom + pad;
    return {
      minX: this.pos.x - halfW,
      minY: this.pos.y - halfH,
      maxX: this.pos.x + halfW,
      maxY: this.pos.y + halfH,
    };
  }

  /** Applies the camera transform so world coordinates can be drawn directly. */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.pos.x, -this.pos.y);
  }
}
