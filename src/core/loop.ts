/** Simulation rate. diep.io runs at 25 ticks per second and every tuning number follows from it. */
export const TICKS_PER_SECOND = 25;
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
export const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;

/** Ticks to run in one frame before giving up and dropping the backlog. */
const MAX_CATCHUP_TICKS = 5;

/**
 * A fixed-timestep accumulator.
 *
 * The simulation always advances in whole ticks so its behaviour does not depend
 * on frame rate. Rendering reads `alpha`, the fraction of the way into the next
 * pending tick, and interpolates between each entity's previous and current
 * position so motion stays smooth on a 120 Hz display as much as a 30 Hz one.
 */
export class FixedLoop {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private frameHandle = 0;

  /** How far into the next tick we are, 0 to 1. Read this when rendering. */
  alpha = 0;

  private readonly onTick: () => void;
  private readonly onRender: (alpha: number) => void;

  constructor(onTick: () => void, onRender: (alpha: number) => void) {
    this.onTick = onTick;
    this.onRender = onRender;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    const frame = (now: number): void => {
      if (!this.running) return;
      this.frameHandle = requestAnimationFrame(frame);
      this.advance(now);
    };
    this.frameHandle = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  /** Discards accumulated time. Call after a pause so the sim does not fast-forward. */
  resetClock(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  private advance(now: number): void {
    const elapsed = now - this.lastTime;
    this.lastTime = now;
    // A long stall (an inactive tab, a breakpoint) must not become a burst of ticks.
    this.accumulator += Math.min(elapsed, MS_PER_TICK * MAX_CATCHUP_TICKS);

    let ticks = 0;
    while (this.accumulator >= MS_PER_TICK && ticks < MAX_CATCHUP_TICKS) {
      this.accumulator -= MS_PER_TICK;
      this.onTick();
      ticks++;
    }

    this.alpha = this.accumulator / MS_PER_TICK;
    this.onRender(this.alpha);
  }
}
