import { getTank } from '../data/tanks.ts';
import type { TankDefinition } from '../data/schema.ts';
import { paintTankInto } from '../render/iconCache.ts';
import { el, button } from './dom.ts';
import { describeTank } from './describe.ts';

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
