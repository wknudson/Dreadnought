import { vec, type Vec2 } from './math.ts';

/**
 * What the player is asking for this frame, independent of how they asked.
 *
 * Keyboard, mouse and touch all write into this same shape, so nothing
 * downstream needs to know which device is in use.
 */
export interface Intent {
  /** Movement direction, each component in -1 to 1. */
  move: Vec2;
  /** Aim direction in radians, derived from the pointer or the aim stick. */
  aimAngle: number;
  /** Where the player is aiming, in world coordinates. */
  aimWorld: Vec2;
  fire: boolean;
  secondary: boolean;
  autoFire: boolean;
  autoSpin: boolean;
}

export const emptyIntent = (): Intent => ({
  move: vec(),
  aimAngle: 0,
  aimWorld: vec(),
  fire: false,
  secondary: false,
  autoFire: false,
  autoSpin: false,
});

/** Converts a screen point to a world point. Supplied by the camera. */
export type ScreenToWorld = (screen: Vec2) => Vec2;

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/**
 * Collects keyboard, mouse and touch input into one Intent.
 *
 * Toggles (auto-fire, auto-spin) are edge-triggered on key down and kept here so
 * they survive across frames. One-shot presses like Escape are exposed through
 * `consumePause` so a frame can claim them exactly once.
 */
export class InputManager {
  private readonly held = new Set<string>();
  private pointer: Vec2 = vec();
  private pointerDown = false;
  private rightDown = false;
  private spaceDown = false;
  private shiftDown = false;
  private pauseQueued = false;

  autoFire = false;
  autoSpin = false;

  /** Set once a mouse is seen, which hides the touch controls. */
  usingMouse = false;
  /** True on a touch device, which shows the joysticks. */
  readonly touchAvailable: boolean;

  /** Continuous spin applied when auto-spin is on. */
  private spinAngle = 0;

  private readonly detachers: (() => void)[] = [];

  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.touchAvailable = (navigator.maxTouchPoints ?? 0) > 0;
    this.attach();
  }

  private on<K extends keyof WindowEventMap>(
    target: Window | HTMLElement,
    type: K,
    handler: (ev: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    const h = handler as EventListener;
    target.addEventListener(type, h, options);
    this.detachers.push(() => target.removeEventListener(type, h, options));
  }

  private attach(): void {
    this.on(window, 'keydown', (e) => {
      // Let the browser keep its own shortcuts.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Escape') {
        this.pauseQueued = true;
        return;
      }
      if (e.repeat) return;
      if (e.code === 'KeyE') this.autoFire = !this.autoFire;
      if (e.code === 'KeyC') this.autoSpin = !this.autoSpin;
      if (e.code === 'Space') {
        this.spaceDown = true;
        e.preventDefault();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shiftDown = true;
      if (MOVE_KEYS[e.code]) {
        this.held.add(e.code);
        e.preventDefault();
      }
    });

    this.on(window, 'keyup', (e) => {
      if (e.code === 'Space') this.spaceDown = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shiftDown = false;
      this.held.delete(e.code);
    });

    // A lost focus must not leave keys stuck down.
    this.on(window, 'blur', () => this.releaseAll());

    this.on(window, 'mousemove', (e) => {
      this.usingMouse = true;
      this.pointer = vec(e.clientX, e.clientY);
    });

    this.on(this.canvas, 'mousedown', (e) => {
      this.usingMouse = true;
      this.pointer = vec(e.clientX, e.clientY);
      if (e.button === 0) this.pointerDown = true;
      if (e.button === 2) this.rightDown = true;
    });

    this.on(window, 'mouseup', (e) => {
      if (e.button === 0) this.pointerDown = false;
      if (e.button === 2) this.rightDown = false;
    });

    // Right click aims the secondary action rather than opening a menu.
    this.on(this.canvas, 'contextmenu', (e) => e.preventDefault());

    this.touch.attach(this.canvas, (detach) => this.detachers.push(detach));
  }

  /** The touch joysticks. Public so the HUD can draw them. */
  readonly touch = new TouchSticks();

  releaseAll(): void {
    this.held.clear();
    this.pointerDown = false;
    this.rightDown = false;
    this.spaceDown = false;
    this.shiftDown = false;
    this.touch.reset();
  }

  /** True once per Escape press. */
  consumePause(): boolean {
    const queued = this.pauseQueued;
    this.pauseQueued = false;
    return queued;
  }

  /** Reads the current state into an Intent. */
  sample(screenToWorld: ScreenToWorld, out: Intent = emptyIntent()): Intent {
    let mx = 0;
    let my = 0;
    for (const code of this.held) {
      const dir = MOVE_KEYS[code];
      if (dir) {
        mx += dir[0];
        my += dir[1];
      }
    }

    const stickMove = this.touch.moveVector();
    if (stickMove) {
      mx += stickMove.x;
      my += stickMove.y;
    }

    const mag = Math.hypot(mx, my);
    out.move.x = mag > 1 ? mx / mag : mx;
    out.move.y = mag > 1 ? my / mag : my;

    const aimStick = this.touch.aimVector();
    if (aimStick) {
      out.aimAngle = Math.atan2(aimStick.y, aimStick.x);
      // The aim stick doubles as the trigger once pushed past its deadzone.
      out.aimWorld = vec(0, 0);
      out.fire = this.touch.aimEngaged();
    } else {
      const world = screenToWorld(this.pointer);
      out.aimWorld = world;
      out.aimAngle = Math.atan2(world.y, world.x);
      out.fire = this.pointerDown || this.spaceDown;
    }

    out.secondary = this.rightDown || this.shiftDown || this.touch.secondaryHeld;
    out.autoFire = this.autoFire;
    out.autoSpin = this.autoSpin;
    if (this.autoFire) out.fire = true;
    return out;
  }

  /**
   * The aim angle after auto-spin is applied.
   *
   * Kept separate from `sample` because it advances state, so it must be called
   * exactly once per simulation tick rather than once per rendered frame.
   */
  tickAim(intent: Intent): number {
    if (!intent.autoSpin) return intent.aimAngle;
    this.spinAngle += 0.08;
    return this.spinAngle;
  }

  /** Aim relative to a tank at `origin`, since aimWorld is absolute. */
  static aimAt(origin: Vec2, target: Vec2): number {
    return Math.atan2(target.y - origin.y, target.x - origin.x);
  }

  destroy(): void {
    for (const detach of this.detachers) detach();
    this.detachers.length = 0;
  }
}

const STICK_RADIUS = 70;
const STICK_DEADZONE = 0.25;

interface Stick {
  id: number;
  origin: Vec2;
  current: Vec2;
}

/**
 * Two virtual joysticks: the left half of the screen moves, the right half aims.
 *
 * Each stick anchors wherever the finger lands rather than sitting in a fixed
 * spot, which is far more forgiving than hunting for an on-screen pad.
 */
export class TouchSticks {
  private move: Stick | null = null;
  private aim: Stick | null = null;
  secondaryHeld = false;

  attach(canvas: HTMLCanvasElement, register: (detach: () => void) => void): void {
    const start = (e: TouchEvent): void => {
      // A touch that began on a button belongs to the button, not to a stick.
      if (e.target !== canvas) return;
      for (const t of Array.from(e.changedTouches)) {
        const point = vec(t.clientX, t.clientY);
        const leftHalf = point.x < window.innerWidth / 2;
        const stick: Stick = { id: t.identifier, origin: point, current: point };
        if (leftHalf && !this.move) this.move = stick;
        else if (!leftHalf && !this.aim) this.aim = stick;
      }
      e.preventDefault();
    };
    const move = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        const point = vec(t.clientX, t.clientY);
        if (this.move?.id === t.identifier) this.move.current = point;
        if (this.aim?.id === t.identifier) this.aim.current = point;
      }
      e.preventDefault();
    };
    const end = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        if (this.move?.id === t.identifier) this.move = null;
        if (this.aim?.id === t.identifier) this.aim = null;
      }
    };

    const opts: AddEventListenerOptions = { passive: false };
    canvas.addEventListener('touchstart', start, opts);
    canvas.addEventListener('touchmove', move, opts);
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
    register(() => {
      canvas.removeEventListener('touchstart', start, opts);
      canvas.removeEventListener('touchmove', move, opts);
      canvas.removeEventListener('touchend', end);
      canvas.removeEventListener('touchcancel', end);
    });
  }

  private offset(stick: Stick | null): Vec2 | null {
    if (!stick) return null;
    const dx = stick.current.x - stick.origin.x;
    const dy = stick.current.y - stick.origin.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return vec(0, 0);
    const clamped = Math.min(d, STICK_RADIUS) / STICK_RADIUS;
    return vec((dx / d) * clamped, (dy / d) * clamped);
  }

  moveVector(): Vec2 | null {
    const o = this.offset(this.move);
    if (!o) return null;
    return Math.hypot(o.x, o.y) < STICK_DEADZONE ? vec(0, 0) : o;
  }

  aimVector(): Vec2 | null {
    const o = this.offset(this.aim);
    if (!o || Math.hypot(o.x, o.y) < 0.01) return null;
    return o;
  }

  aimEngaged(): boolean {
    const o = this.offset(this.aim);
    return !!o && Math.hypot(o.x, o.y) >= STICK_DEADZONE;
  }

  /** Stick positions for the HUD to draw. */
  visuals(): { origin: Vec2; knob: Vec2 }[] {
    const out: { origin: Vec2; knob: Vec2 }[] = [];
    for (const stick of [this.move, this.aim]) {
      if (!stick) continue;
      const o = this.offset(stick)!;
      out.push({
        origin: stick.origin,
        knob: vec(stick.origin.x + o.x * STICK_RADIUS, stick.origin.y + o.y * STICK_RADIUS),
      });
    }
    return out;
  }

  reset(): void {
    this.move = null;
    this.aim = null;
    this.secondaryHeld = false;
  }
}

export { STICK_RADIUS };
