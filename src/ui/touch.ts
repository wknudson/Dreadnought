import { el } from './dom.ts';
import type { InputManager } from '../core/input.ts';

/**
 * The on-screen controls for playing with thumbs.
 *
 * The two joysticks are drawn on the canvas and anchor wherever a finger lands,
 * so only the things a stick cannot express need buttons: pausing, the secondary
 * action, and the auto-fire toggle. The layer itself ignores touches, or it
 * would swallow the joysticks underneath it.
 */
export interface TouchControls {
  root: HTMLElement;
  /** Keeps the auto-fire button in step with the toggle it reflects. */
  refresh(): void;
  destroy(): void;
}

function holdButton(
  label: string,
  className: string,
  onDown: () => void,
  onUp: () => void,
): HTMLButtonElement {
  const button = el('button', { type: 'button', class: `touch-btn ${className}` }, label);
  const down = (e: Event): void => {
    e.preventDefault();
    button.classList.add('is-held');
    onDown();
  };
  const up = (e: Event): void => {
    e.preventDefault();
    button.classList.remove('is-held');
    onUp();
  };
  button.addEventListener('touchstart', down, { passive: false });
  button.addEventListener('touchend', up);
  button.addEventListener('touchcancel', up);
  // Also usable with a mouse, which makes it testable without a phone.
  button.addEventListener('mousedown', down);
  button.addEventListener('mouseup', up);
  button.addEventListener('mouseleave', up);
  return button;
}

function tapButton(label: string, className: string, onTap: () => void): HTMLButtonElement {
  const button = el('button', { type: 'button', class: `touch-btn ${className}` }, label);
  const fire = (e: Event): void => {
    e.preventDefault();
    onTap();
  };
  button.addEventListener('touchstart', fire, { passive: false });
  button.addEventListener('click', fire);
  return button;
}

export function buildTouchControls(input: InputManager, onPause: () => void): TouchControls {
  const autoFire = tapButton('AUTO', 'touch-auto', () => {
    input.autoFire = !input.autoFire;
    refresh();
  });

  const secondary = holdButton(
    'ALT',
    'touch-secondary',
    () => {
      input.touch.secondaryHeld = true;
    },
    () => {
      input.touch.secondaryHeld = false;
    },
  );

  const pause = tapButton('II', 'touch-pause', onPause);

  function refresh(): void {
    autoFire.classList.toggle('is-on', input.autoFire);
  }
  refresh();

  return {
    root: el('div', { class: 'touch-layer' }, pause, autoFire, secondary),
    refresh,
    destroy: () => {
      input.touch.secondaryHeld = false;
    },
  };
}
