/**
 * Vector and angle helpers used by the simulation, the renderer and the UI.
 *
 * Vectors are plain `{ x, y }` objects rather than a class, so an entity's
 * position can be handed to any of these as it stands. Angles are in radians,
 * and the helpers here that compare two of them go through `wrapAngle`, so a
 * turn never takes the long way round.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Wraps an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = (a + Math.PI) % TAU;
  if (r <= 0) r += TAU;
  return r - Math.PI;
}

/** Shortest signed turn from `a` to `b`. */
export const angleDelta = (a: number, b: number): number => wrapAngle(b - a);

/** Moves `a` toward `b` by at most `maxStep` radians. */
export function turnToward(a: number, b: number, maxStep: number): number {
  const d = angleDelta(a, b);
  return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep;
}

export const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const dist = (a: Vec2, b: Vec2): number => Math.sqrt(dist2(a, b));

/**
 * Where to aim to hit a target that keeps moving.
 *
 * Solves for the time at which a projectile leaving `origin` at `speed` meets a
 * target travelling from `target` at `targetVel`. Returns the target's present
 * position when there is no solution, which happens when the target is simply
 * faster than the projectile.
 */
export function predictIntercept(
  origin: Vec2,
  target: Vec2,
  targetVel: Vec2,
  speed: number,
): Vec2 {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const a = targetVel.x * targetVel.x + targetVel.y * targetVel.y - speed * speed;
  const b = 2 * (dx * targetVel.x + dy * targetVel.y);
  const c = dx * dx + dy * dy;

  let t: number;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-6) return { ...target };
    t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return { ...target };
    const root = Math.sqrt(disc);
    const t1 = (-b + root) / (2 * a);
    const t2 = (-b - root) / (2 * a);
    // Prefer the soonest arrival that lies in the future.
    const candidates = [t1, t2].filter((v) => v > 0);
    if (!candidates.length) return { ...target };
    t = Math.min(...candidates);
  }
  return vec(target.x + targetVel.x * t, target.y + targetVel.y * t);
}
