import { FixedLoop, SECONDS_PER_TICK } from './core/loop.ts';
import { InputManager, emptyIntent, type Intent } from './core/input.ts';
import { seedFromLocation } from './core/rng.ts';
import { loadSettings, saveSettings, type Settings } from './core/storage.ts';
import { Camera } from './render/camera.ts';
import { drawWorld } from './render/drawWorld.ts';
import { drawHud, drawTouchSticks, drawDebug, type HudState } from './render/hud.ts';
import { Run, type PendingChoice } from './sim/run.ts';
import { PLAYER_COLORS } from './data/colors.ts';
import { vec } from './core/math.ts';

export type Screen = 'title' | 'tree' | 'run' | 'dead';
export type Overlay = null | 'pause' | 'cards' | 'classUpgrade';

/**
 * The shell: owns the canvas, the loop, and which screen is showing.
 *
 * The simulation only advances while a run is on screen with no overlay over it,
 * which is what makes the card and upgrade panels pause the game rather than
 * needing the sim to know about them.
 */
export class App {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly input: InputManager;
  readonly camera = new Camera();

  screen: Screen = 'title';
  overlay: Overlay = null;
  run: Run | null = null;
  settings: Settings;

  /** Width and height in CSS pixels. */
  width = 0;
  height = 0;

  private readonly loop: FixedLoop;
  private readonly intent: Intent = emptyIntent();
  private hud: HudState = { wave: 0, countdown: 0 };
  private lastFrame = performance.now();
  private showDebug = false;

  /**
   * Screens that present a pending choice to the player.
   *
   * A choice with no handler registered is taken automatically rather than
   * halting the game, which lets progression run before its interface exists.
   */
  private readonly choiceHandlers = new Map<PendingChoice, (run: Run) => void>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d context unavailable');
    this.ctx = ctx;

    this.settings = loadSettings();
    this.input = new InputManager(canvas);
    this.input.autoFire = this.settings.autoFire;
    this.input.autoSpin = this.settings.autoSpin;

    this.loop = new FixedLoop(
      () => this.tick(),
      (alpha) => this.render(alpha),
    );

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screen === 'run' && !this.overlay) this.setOverlay('pause');
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F2') this.showDebug = !this.showDebug;
    });
  }

  start(): void {
    this.loop.start();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.resize(this.width, this.height);
  }

  /** Starts a fresh run and shows it. */
  startRun(): void {
    const color = PLAYER_COLORS.find((c) => c.id === this.settings.colorId) ?? PLAYER_COLORS[0]!;
    this.run = new Run({
      seed: seedFromLocation(),
      difficulty: this.settings.difficulty,
      color: color.hex,
    });
    this.camera.follow(this.run.player.pos, this.run.player.fieldOfView());
    this.camera.snap();
    this.screen = 'run';
    this.overlay = null;
    this.loop.resetClock();
  }

  setScreen(screen: Screen): void {
    this.screen = screen;
    this.overlay = null;
    this.loop.resetClock();
  }

  /** Registers the interface that resolves a kind of pending choice. */
  onChoice(kind: PendingChoice, handler: (run: Run) => void): void {
    this.choiceHandlers.set(kind, handler);
  }

  setOverlay(overlay: Overlay): void {
    this.overlay = overlay;
    this.loop.resetClock();
  }

  /** True when the world should be advancing. */
  private get simRunning(): boolean {
    return this.screen === 'run' && this.overlay === null && !!this.run;
  }

  private tick(): void {
    if (this.input.consumePause() && this.screen === 'run') {
      this.setOverlay(this.overlay === 'pause' ? null : 'pause');
      return;
    }
    if (!this.simRunning || !this.run) return;

    const run = this.run;
    this.input.sample((screen) => this.camera.screenToWorld(screen), this.intent);
    // Aim is relative to the tank, not the screen centre, once the camera lags.
    const aim = this.intent.autoSpin
      ? this.input.tickAim(this.intent)
      : Math.atan2(
          this.intent.aimWorld.y - run.player.pos.y,
          this.intent.aimWorld.x - run.player.pos.x,
        );
    run.applyIntent(this.intent, aim);
    run.tick();

    // A level-up that earned a choice holds the game until it is answered.
    while (run.waitingOnChoice && !this.overlay) {
      const next = run.pendingChoices[0]!;
      const handler = this.choiceHandlers.get(next);
      if (handler) {
        handler(run);
        this.setOverlay(next === 'class' ? 'classUpgrade' : 'cards');
      } else {
        // No interface for this choice yet: take it and carry on.
        run.consumeChoice(next);
      }
    }

    if (run.over) this.setScreen('dead');

    if (this.input.autoFire !== this.settings.autoFire || this.input.autoSpin !== this.settings.autoSpin) {
      this.settings = saveSettings({
        autoFire: this.input.autoFire,
        autoSpin: this.input.autoSpin,
      });
    }
  }

  private render(alpha: number): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    const { ctx } = this;
    if (this.screen === 'run' || this.screen === 'dead') {
      const run = this.run;
      if (!run) return;

      const zoomOffset = this.intent.secondary && run.player.def.flags.zoom
        ? vec(Math.cos(run.player.angle) * 1500, Math.sin(run.player.angle) * 1500)
        : null;
      this.camera.follow(run.player.pos, run.player.fieldOfView(), zoomOffset);
      this.camera.update(dt);

      drawWorld(ctx, run.world, this.camera, this.simRunning ? alpha : 1, this.width, this.height);
      drawHud(ctx, run, this.hud, this.width, this.height);
      if (this.input.touchAvailable && !this.input.usingMouse) {
        drawTouchSticks(ctx, this.input.touch);
      }
      if (this.showDebug) {
        drawDebug(
          ctx,
          [
            `tick ${run.world.tick}`,
            `entities ${run.world.entities.length}`,
            `zoom ${this.camera.zoom.toFixed(3)}`,
            `seed ${run.seed}`,
          ],
          this.width,
        );
      }
    }
  }

  /** Seconds one simulation tick represents, for anything timing itself in ticks. */
  static readonly tickSeconds = SECONDS_PER_TICK;
}
