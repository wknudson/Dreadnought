import { FixedLoop, SECONDS_PER_TICK } from './core/loop.ts';
import { InputManager, emptyIntent, type Intent } from './core/input.ts';
import { seedFromLocation } from './core/rng.ts';
import {
  loadSettings,
  recordRun,
  saveSettings,
  type DifficultyId,
  type Settings,
} from './core/storage.ts';
import { Camera } from './render/camera.ts';
import { drawWorld } from './render/drawWorld.ts';
import { drawHud, drawTouchSticks, drawDebug, BANNER_TICKS, type HudState } from './render/hud.ts';
import { clearIconCache } from './render/iconCache.ts';
import { Run, type PendingChoice } from './sim/run.ts';
import { PLAYER_COLORS } from './data/colors.ts';
import { vec } from './core/math.ts';
import { clearUi, mount } from './ui/dom.ts';
import { buildDeath, buildPause, buildTitle } from './ui/title.ts';
import { buildCardChoice, buildClassUpgrade, buildVictory } from './ui/overlays.ts';
import { TreeViewer } from './ui/tree.ts';
import { buildTouchControls, type TouchControls } from './ui/touch.ts';

export type Screen = 'title' | 'tree' | 'run' | 'dead';
export type Overlay = null | 'pause' | 'cards' | 'classUpgrade';

/**
 * The shell: owns the canvas, the loop, and which screen is showing.
 *
 * The simulation only advances while a run is on screen with no overlay over it,
 * which is what makes the card and upgrade panels pause the game rather than
 * needing the simulation to know anything about them.
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
  private hud: HudState = { bannerTicks: BANNER_TICKS + 1, bannerText: '' };
  /** The wave the banner is currently announcing, so it shows once per wave. */
  private announcedWave = 0;
  private lastFrame = performance.now();
  private showDebug = false;
  private tree: TreeViewer | null = null;
  private touchControls: TouchControls | null = null;
  /** Where to return when the tree is closed. */
  private treeReturn: Screen = 'title';

  /**
   * Interfaces that resolve a pending choice.
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
      if (document.hidden && this.screen === 'run' && !this.overlay) this.showPause();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F2') this.showDebug = !this.showDebug;
      // Hold shift and press L to jump a level, for reaching the upper tiers
      // without farming. Shift keeps it clear of the movement keys.
      if (e.code === 'KeyL' && e.shiftKey && this.screen === 'run') {
        this.run?.debugGrantLevel();
      }
      // Shift+K skips to the next wave, for reaching a boss without the grind.
      if (e.code === 'KeyK' && e.shiftKey && this.screen === 'run' && this.run) {
        this.run.waves.jumpTo(this.run.wave + 1);
      }
    });

    this.onChoice('class', (run) => this.showClassUpgrade(run));
    this.onChoice('card', (run) => this.showCardChoice(run));
  }

  /** Presents the pick-one-of-three earned by levelling. */
  private showCardChoice(run: Run): void {
    const hand = run.dealHand();
    if (!hand.length) {
      run.consumeChoice('card');
      return;
    }
    this.input.releaseAll();
    const render = (): void => {
      mount(
        buildCardChoice({
          hand: run.hand,
          level: run.level,
          rerolls: run.rerolls,
          onPick: (card) => {
            run.takeCard(card);
            this.afterChoice();
          },
          onReroll: () => {
            if (run.reroll()) render();
          },
        }),
      );
    };
    render();
  }

  /** Presents the class choices earned at levels 15, 30 and 45. */
  private showClassUpgrade(run: Run): void {
    const options = run.classOptions();
    if (!options.length) {
      run.consumeChoice('class');
      return;
    }
    this.input.releaseAll();
    mount(
      buildClassUpgrade({
        current: run.player.def,
        options,
        color: this.playerColor,
        level: run.level,
        nextChanceAt: run.nextClassLevel(),
        onPick: (id) => {
          run.upgradeTo(id);
          this.afterChoice();
        },
        onSkip: () => {
          run.consumeChoice('class');
          this.afterChoice();
        },
      }),
    );
  }

  /**
   * Clears a resolved choice and shows the next one, if the level-up earned
   * more than one. Only when the queue is empty does play resume.
   */
  private afterChoice(): void {
    const run = this.run;
    if (!run) return;
    this.overlay = null;
    clearUi();
    if (run.waitingOnChoice) {
      this.presentNextChoice(run);
      return;
    }
    this.showRunControls();
    this.loop.resetClock();
  }

  /** Opens the interface for the next pending choice, or takes it if there is none. */
  private presentNextChoice(run: Run): void {
    while (run.waitingOnChoice && !this.overlay) {
      const next = run.pendingChoices[0]!;
      const handler = this.choiceHandlers.get(next);
      if (!handler) {
        // No interface for this choice yet: take it and carry on.
        run.consumeChoice(next);
        continue;
      }
      this.overlay = next === 'class' ? 'classUpgrade' : 'cards';
      handler(run);
      // A handler that resolved immediately leaves nothing mounted.
      if (!run.pendingChoices.includes(next)) this.overlay = null;
    }
    this.loop.resetClock();
  }

  start(): void {
    this.showTitle();
    this.loop.start();
  }

  /** The colour the player picked, as a hex string. */
  get playerColor(): string {
    return (PLAYER_COLORS.find((c) => c.id === this.settings.colorId) ?? PLAYER_COLORS[0]!).hex;
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
    this.syncArenaToView();
  }

  /**
   * Sizes the arena against what this screen can actually show.
   *
   * The longer edge is the reference, so a tall phone gets an arena it can see
   * down the length of rather than one four screens wide.
   */
  private syncArenaToView(): void {
    const run = this.run;
    if (!run) return;
    const zoom = run.player.fieldOfView() * Math.max(this.height / 1080, this.width / 1920);
    const halfWidth = this.width / 2 / zoom;
    const halfHeight = this.height / 2 / zoom;
    run.setViewReference(Math.max(halfWidth, halfHeight));
  }

  // --- Screens -------------------------------------------------------------

  showTitle(): void {
    this.closeTree();
    this.screen = 'title';
    this.overlay = null;
    this.run = null;
    mount(
      buildTitle({
        colorId: this.settings.colorId,
        difficulty: this.settings.difficulty,
        onColorChange: (colorId) => {
          this.settings = saveSettings({ colorId });
          // Cached icons carry their colour, so they have to go.
          clearIconCache();
        },
        onDifficultyChange: (difficulty: DifficultyId) => {
          this.settings = saveSettings({ difficulty });
        },
        onPlay: () => this.startRun(),
        onViewTree: () => this.showTree('title'),
      }),
    );
    this.loop.resetClock();
  }

  showTree(from: Screen = 'title'): void {
    this.closeTree();
    this.treeReturn = from;
    this.screen = 'tree';
    this.tree = new TreeViewer(this.canvas, this.playerColor, () => {
      if (this.treeReturn === 'run' && this.run) this.resumeRun();
      else this.showTitle();
    });
    if (from === 'run' && this.run) this.tree.focus(this.run.player.def.id);
    mount(this.tree.panel);
    this.loop.resetClock();
  }

  private closeTree(): void {
    this.tree?.destroy();
    this.tree = null;
    this.touchControls?.destroy();
    this.touchControls = null;
  }

  /**
   * Shows the run itself, with the on-screen controls if this is a touch device.
   *
   * Mounted rather than always present because the layer has to be absent while
   * an overlay is up, or its buttons sit on top of the cards.
   */
  private showRunControls(): void {
    if (!this.input.touchAvailable || this.input.usingMouse) {
      clearUi();
      return;
    }
    this.touchControls = buildTouchControls(this.input, () => this.showPause());
    mount(this.touchControls.root);
  }

  startRun(): void {
    this.closeTree();
    this.announcedWave = 0;
    this.run = new Run({
      seed: seedFromLocation(),
      difficulty: this.settings.difficulty,
      color: this.playerColor,
    });
    this.syncArenaToView();
    this.camera.follow(this.run.player.pos, this.run.player.fieldOfView());
    this.camera.snap();
    this.screen = 'run';
    this.overlay = null;
    this.input.releaseAll();
    this.showRunControls();
    this.loop.resetClock();
  }

  private resumeRun(): void {
    this.closeTree();
    this.screen = 'run';
    this.overlay = null;
    this.showRunControls();
    this.loop.resetClock();
  }

  private showPause(): void {
    if (!this.run) return;
    this.overlay = 'pause';
    this.input.releaseAll();
    mount(
      buildPause(
        () => this.resumeRun(),
        () => this.endRun(),
      ),
    );
    this.loop.resetClock();
  }

  /** Ends the run and shows the summary, whether it was lost or won. */
  private endRun(): void {
    const run = this.run;
    if (!run) return;
    const summary = {
      wave: run.wave,
      score: Math.floor(run.score),
      level: run.level,
      tank: run.player.def.name,
      seed: run.seed,
    };
    const isBest = recordRun(run.difficultyId, summary);
    this.screen = 'dead';
    this.overlay = null;

    mount(
      run.outcome === 'won'
        ? buildVictory({
            score: summary.score,
            level: summary.level,
            tank: summary.tank,
            seed: summary.seed,
            onAgain: () => this.startRun(),
            onTitle: () => this.showTitle(),
          })
        : buildDeath(
            { ...summary, isBest },
            () => this.startRun(),
            () => this.showTitle(),
          ),
    );
    this.loop.resetClock();
  }

  /**
   * Shows the wave banner once per wave.
   *
   * Driven by comparing the wave number rather than by a callback, so a wave
   * that begins while an overlay is up is still announced when play resumes.
   */
  private updateBanner(run: Run): void {
    if (run.wave !== this.announcedWave) {
      this.announcedWave = run.wave;
      this.hud.bannerTicks = 0;
      this.hud.bannerText = run.bossName ?? `Wave ${run.wave}`;
    } else if (this.hud.bannerTicks <= BANNER_TICKS) {
      this.hud.bannerTicks++;
    }
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

  // --- Frame ---------------------------------------------------------------

  private tick(): void {
    if (this.input.consumePause() && this.screen === 'run') {
      if (this.overlay === 'pause') this.resumeRun();
      else if (!this.overlay) this.showPause();
      return;
    }
    if (!this.simRunning || !this.run) return;

    const run = this.run;
    this.input.sample((screen) => this.camera.screenToWorld(screen), this.intent);
    // Aim from the tank, not the screen centre, since the camera lags behind it.
    const aim = this.intent.autoSpin
      ? this.input.tickAim(this.intent)
      : Math.atan2(
          this.intent.aimWorld.y - run.player.pos.y,
          this.intent.aimWorld.x - run.player.pos.x,
        );
    run.applyIntent(this.intent, aim);
    run.tick();
    this.updateBanner(run);

    // A level-up that earned a choice holds the game until it is answered.
    if (run.waitingOnChoice && !this.overlay) this.presentNextChoice(run);

    if (run.over) this.endRun();

    if (
      this.input.autoFire !== this.settings.autoFire ||
      this.input.autoSpin !== this.settings.autoSpin
    ) {
      this.settings = saveSettings({
        autoFire: this.input.autoFire,
        autoSpin: this.input.autoSpin,
      });
      this.touchControls?.refresh();
    }
  }

  private render(alpha: number): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    const { ctx } = this;

    if (this.screen === 'tree' && this.tree) {
      this.tree.render(ctx, this.width, this.height, dt);
      return;
    }

    if (this.screen === 'title') {
      // The menu sits over a plain field; no world exists yet to show.
      ctx.fillStyle = '#c4c4c4';
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }

    const run = this.run;
    if (!run) return;

    const zoomOffset =
      this.intent.secondary && run.player.def.flags.zoom
        ? vec(Math.cos(run.player.angle) * 1500, Math.sin(run.player.angle) * 1500)
        : null;
    this.camera.follow(run.player.pos, run.player.fieldOfView(), zoomOffset);
    this.camera.update(dt);

    drawWorld(
      ctx,
      run.world,
      this.camera,
      this.simRunning ? alpha : 1,
      this.width,
      this.height,
      run.warnings,
    );
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
          `wave ${run.wave} (${run.waves.phase})`,
          `enemies ${run.enemiesLeft}`,
          `zoom ${this.camera.zoom.toFixed(3)}`,
          `seed ${run.seed}`,
        ],
        this.width,
      );
    }
  }

  /** Seconds one simulation tick represents, for anything timing itself in ticks. */
  static readonly tickSeconds = SECONDS_PER_TICK;
}
