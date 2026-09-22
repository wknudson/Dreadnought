/**
 * The title screen, and the pause and death overlays.
 *
 * Each builder returns a detached element and takes a callback for every button.
 * The title reads the saved bests to show beside each difficulty, and the codex
 * to know which colours are open, but writes nothing itself; the colour and difficulty picked go back through the callbacks
 * for the caller to keep.
 */

import { PLAYER_COLORS } from '../data/colors.ts';
import { allBests, loadCodex, type DifficultyId } from '../core/storage.ts';
import { isColorUnlocked, markedCount, nextColorUnlock } from '../core/codex.ts';
import { TANKS } from '../data/tanks.ts';
import { getTank, ROOT_TANK_ID } from '../data/tanks.ts';
import { paintTankInto } from '../render/iconCache.ts';
import { el, button } from './dom.ts';

/** How to play, in the terms of whatever device is being used. */
function controlHint(): string {
  const touch = (navigator.maxTouchPoints ?? 0) > 0;
  return touch
    ? 'Left thumb to drive, right thumb to aim and fire. ALT is the secondary action, AUTO holds the trigger down.'
    : 'Move with WASD. Aim with the mouse, fire with click or space. Right click or Shift is the secondary action. E toggles auto-fire, C auto-spin, Escape pauses.';
}

const DIFFICULTIES: { id: DifficultyId; name: string; blurb: string }[] = [
  { id: 'easy', name: 'Easy', blurb: 'Fewer enemies, and they hit softer.' },
  { id: 'normal', name: 'Normal', blurb: 'The intended fight.' },
  { id: 'hard', name: 'Hard', blurb: 'More of them, tougher, and quicker to arrive.' },
];

export interface TitleOptions {
  colorId: string;
  difficulty: DifficultyId;
  onColorChange(id: string): void;
  onDifficultyChange(id: DifficultyId): void;
  onPlay(): void;
  onViewTree(): void;
}

/**
 * The title screen.
 *
 * The colour swatches are real tanks drawn by the same renderer the game uses,
 * so what you pick is exactly what you get. Colours the codex has not unlocked
 * are still drawn, dimmed, so the player can see what they are working towards.
 */
export function buildTitle(options: TitleOptions): HTMLElement {
  const won = markedCount(loadCodex());
  const open = (id: string): boolean => {
    const color = PLAYER_COLORS.find((c) => c.id === id);
    return !!color && isColorUnlocked(color, won);
  };
  // A saved colour that is not open falls back the same way the game does.
  let colorId = open(options.colorId) ? options.colorId : PLAYER_COLORS[0]!.id;
  let difficulty = options.difficulty;

  const bests = allBests();
  const basic = getTank(ROOT_TANK_ID);

  const swatches = PLAYER_COLORS.map((color) => {
    const canvas = el('canvas', { class: 'swatch-canvas', width: 64, height: 64 });
    canvas.style.width = '64px';
    canvas.style.height = '64px';
    const locked = !isColorUnlocked(color, won);
    const lockText = `${color.name}: win with ${color.unlockAt} tanks to unlock`;
    const wrap = el('button', {
      type: 'button',
      class: `swatch${color.id === colorId ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`,
      'aria-label': locked ? lockText : color.name,
      title: locked ? lockText : color.name,
      'aria-disabled': locked ? 'true' : undefined,
      'data-color': color.id,
    }, canvas);
    wrap.addEventListener('click', () => {
      if (locked) return;
      colorId = color.id;
      for (const other of swatches) other.classList.toggle('is-selected', other.dataset.color === colorId);
      options.onColorChange(colorId);
    });
    // Paint once the element has a size to measure.
    queueMicrotask(() => paintTankInto(canvas, basic, color.hex));
    return wrap;
  });

  const difficultyButtons = DIFFICULTIES.map((d) => {
    const best = bests[d.id];
    const b = el(
      'button',
      {
        type: 'button',
        class: `difficulty${d.id === difficulty ? ' is-selected' : ''}`,
        'data-difficulty': d.id,
      },
      el('span', { class: 'difficulty-name' }, d.name),
      el('span', { class: 'difficulty-blurb' }, d.blurb),
      el(
        'span',
        { class: 'difficulty-best' },
        best ? `Best: wave ${best.wave}, ${best.score.toLocaleString()} points` : 'No run yet',
      ),
    );
    b.addEventListener('click', () => {
      difficulty = d.id;
      for (const other of difficultyButtons) {
        other.classList.toggle('is-selected', other.dataset.difficulty === difficulty);
      }
      options.onDifficultyChange(difficulty);
    });
    return b;
  });

  return el(
    'div',
    { class: 'screen title-screen' },
    el(
      'div',
      { class: 'title-card' },
      el('h1', { class: 'title' }, 'Dreadnought'),
      el(
        'p',
        { class: 'tagline' },
        'Survive the waves. Climb the tank tree. Lose everything when you die.',
      ),

      el('h2', { class: 'section' }, 'Your tank'),
      el('div', { class: 'swatches' }, ...swatches),
      el('p', { class: 'codex-progress' }, codexLine(won)),

      el('h2', { class: 'section' }, 'Difficulty'),
      el('div', { class: 'difficulties' }, ...difficultyButtons),

      el(
        'div',
        { class: 'title-actions' },
        button('Play', options.onPlay, { class: 'btn btn-primary' }),
        button('Tank Tree', options.onViewTree, { class: 'btn' }),
      ),

      el('p', { class: 'hint' }, controlHint()),
    ),
  );
}

/** How far the codex has come, and what it is working towards. */
function codexLine(won: number): string {
  const next = nextColorUnlock(won);
  const tail = next === null ? 'every colour unlocked' : `next colour at ${next}`;
  return `Codex ${won} / ${TANKS.length} won · ${tail}`;
}

/** The pause overlay, shown over a frozen run. */
export function buildPause(onResume: () => void, onQuit: () => void): HTMLElement {
  return el(
    'div',
    { class: 'screen overlay-screen' },
    el(
      'div',
      { class: 'panel' },
      el('h2', {}, 'Paused'),
      el(
        'div',
        { class: 'title-actions' },
        button('Resume', onResume, { class: 'btn btn-primary' }),
        button('Give up', onQuit, { class: 'btn' }),
      ),
    ),
  );
}

export interface DeathSummary {
  wave: number;
  score: number;
  level: number;
  tank: string;
  seed: number;
  isBest: boolean;
}

/** The end-of-run screen. */
export function buildDeath(
  summary: DeathSummary,
  onAgain: () => void,
  onTitle: () => void,
): HTMLElement {
  const stat = (label: string, value: string): HTMLElement =>
    el('div', { class: 'death-stat' }, el('span', { class: 'v' }, value), el('span', { class: 'k' }, label));

  return el(
    'div',
    { class: 'screen overlay-screen' },
    el(
      'div',
      { class: 'panel' },
      el('h2', {}, summary.isBest ? 'A new best' : 'You were destroyed'),
      el(
        'div',
        { class: 'death-stats' },
        stat('Wave', String(summary.wave)),
        stat('Score', summary.score.toLocaleString()),
        stat('Level', String(summary.level)),
      ),
      el('p', { class: 'death-tank' }, `Finished as ${summary.tank}`),
      el('p', { class: 'hint' }, `Seed ${summary.seed}`),
      el(
        'div',
        { class: 'title-actions' },
        button('Play again', onAgain, { class: 'btn btn-primary' }),
        button('Title', onTitle, { class: 'btn' }),
      ),
    ),
  );
}
