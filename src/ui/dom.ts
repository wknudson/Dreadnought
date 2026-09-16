/** Small helpers for building the DOM overlays. Deliberately minimal. */

type Attrs = Record<string, string | number | boolean | undefined>;

/** Creates an element with attributes and children in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function button(
  label: string,
  onClick: () => void,
  attrs: Attrs = {},
): HTMLButtonElement {
  const b = el('button', { type: 'button', ...attrs }, label);
  b.addEventListener('click', onClick);
  return b;
}

/** The root that every overlay is mounted into. */
export function uiRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>('#ui');
  if (!root) throw new Error('missing #ui root');
  return root;
}

/** Removes everything currently mounted. */
export function clearUi(): void {
  uiRoot().replaceChildren();
}

/** Mounts a single overlay, replacing whatever was there. */
export function mount(...nodes: Node[]): void {
  uiRoot().replaceChildren(...nodes);
}

/** A full-screen panel, optionally dimming what is behind it. */
export function screenPanel(className: string, ...children: Node[]): HTMLElement {
  return el('div', { class: `screen ${className}` }, ...children);
}
