import { getTank } from '../data/tanks.ts';
import type { TankDefinition } from '../data/schema.ts';
import { paintTankInto } from '../render/iconCache.ts';
import { el, button } from './dom.ts';
import { describeTank } from './describe.ts';
import { cardDescription, cardRarity, cardTitle, type Card } from '../data/cards.ts';

export interface ClassChoiceOptions {
  current: TankDefinition;
  options: string[];
  color: string;
  level: number;
  /** The next level at which another class choice comes round, if any. */
  nextChanceAt: number | null;
  onPick(id: string): void;
  onSkip(): void;
}

/**
 * The class upgrade panel, shown with the game paused.
 *
 * Skipping is a real option rather than a courtesy: staying on a lower tier is
 * how diep.io's tier-skipping tanks are reached, since Smasher only appears as a
 * choice for a tank that is still Basic at level 30.
 */
export function buildClassUpgrade(options: ClassChoiceOptions): HTMLElement {
  const cards = options.options.map((id) => {
    const def = getTank(id);
    const canvas = el('canvas', { class: 'choice-icon' });
    canvas.style.width = '92px';
    canvas.style.height = '92px';

    const card = el(
      'button',
      { type: 'button', class: 'choice' },
      canvas,
      el('span', { class: 'choice-name' }, def.name),
      el('span', { class: 'choice-blurb' }, describeTank(def)),
      el('span', { class: 'choice-tier' }, `Tier ${def.tier}`),
    );
    card.addEventListener('click', () => options.onPick(id));
    queueMicrotask(() => paintTankInto(canvas, def, options.color));
    return card;
  });

  return el(
    'div',
    { class: 'screen overlay-screen' },
    el(
      'div',
      { class: 'panel panel-wide' },
      el('h2', {}, `Level ${options.level}: choose a class`),
      el('p', { class: 'panel-sub' }, `Currently ${options.current.name}`),
      el('div', { class: 'choices' }, ...cards),
      el(
        'div',
        { class: 'title-actions' },
        button(`Stay as ${options.current.name}`, options.onSkip, { class: 'btn btn-small' }),
      ),
      options.nextChanceAt
        ? el('p', { class: 'hint' }, `Staying keeps these open until level ${options.nextChanceAt}.`)
        : el('p', { class: 'hint' }, 'This is the last class choice of the run.'),
    ),
  );
}


export interface CardChoiceOptions {
  hand: readonly Card[];
  level: number;
  /** Rerolls the player has left to spend. */
  rerolls: number;
  onPick(card: Card): void;
  onReroll(): void;
}

/**
 * The pick-one-of-three offered at each level that pays out.
 *
 * Stat cards carry the colour diep.io uses for that stat, which is the one piece
 * of the original interface worth keeping here: players who know the game read
 * the colour before they read the word.
 */
export function buildCardChoice(options: CardChoiceOptions): HTMLElement {
  const cards = options.hand.map((card) => {
    const rarity = cardRarity(card);
    const accent = card.kind === 'stat' ? card.color : rarity === 'rare' ? '#F9C846' : '#7FD1F5';

    const button = el(
      'button',
      { type: 'button', class: `choice card card-${rarity}` },
      el('span', { class: 'card-pip', style: `background:${accent}` }),
      el('span', { class: 'choice-name' }, cardTitle(card)),
      el('span', { class: 'choice-blurb' }, cardDescription(card)),
      el('span', { class: 'choice-tier' }, rarity),
    );
    button.style.setProperty('--accent-card', accent);
    button.addEventListener('click', () => options.onPick(card));
    return button;
  });

  return el(
    'div',
    { class: 'screen overlay-screen' },
    el(
      'div',
      { class: 'panel panel-wide' },
      el('h2', {}, `Level ${options.level}`),
      el('p', { class: 'panel-sub' }, 'Choose one'),
      el('div', { class: 'choices' }, ...cards),
      options.rerolls > 0
        ? el(
            'div',
            { class: 'title-actions' },
            button(`Reroll (${options.rerolls} left)`, options.onReroll, { class: 'btn btn-small' }),
          )
        : null,
    ),
  );
}

export interface RunWonOptions {
  score: number;
  level: number;
  tank: string;
  seed: number;
  onAgain(): void;
  onTitle(): void;
}

/** Shown when the final wave falls. */
export function buildVictory(options: RunWonOptions): HTMLElement {
  return el(
    'div',
    { class: 'screen overlay-screen' },
    el(
      'div',
      { class: 'panel' },
      el('h2', {}, 'The arena is yours'),
      el(
        'p',
        { class: 'death-tank' },
        `You cleared every wave as ${options.tank}, at level ${options.level}.`,
      ),
      el(
        'div',
        { class: 'death-stats' },
        el(
          'div',
          { class: 'death-stat' },
          el('span', { class: 'v' }, options.score.toLocaleString()),
          el('span', { class: 'k' }, 'Score'),
        ),
      ),
      el('p', { class: 'hint' }, `Seed ${options.seed}`),
      el(
        'div',
        { class: 'title-actions' },
        button('Play again', options.onAgain, { class: 'btn btn-primary' }),
        button('Title', options.onTitle, { class: 'btn' }),
      ),
    ),
  );
}
