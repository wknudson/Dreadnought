/**
 * The diep.io palette, taken from the game's own default colour table.
 *
 * Outlines are not a separate colour: the game darkens each fill toward black by
 * a quarter, which is what `outline` reproduces.
 */

export const COLORS = {
  background: '#CDCDCD',
  grid: '#000000',
  gridAlpha: 0.1,
  outOfBounds: '#000000',
  outOfBoundsAlpha: 0.1,

  barrel: '#999999',
  border: '#555555',

  playerBlue: '#00B2E1',
  enemyRed: '#F14E54',
  teamGreen: '#00E16E',
  teamPurple: '#BF7FF5',
  fallen: '#C0C0C0',
  neutral: '#FFE869',

  square: '#FFE869',
  triangle: '#FC7677',
  pentagon: '#768DFC',
  crasher: '#F177DD',
  shiny: '#8AFF69',
  necroSquare: '#FCC376',

  healthFill: '#85E37D',
  healthBack: '#555555',
  barBack: '#000000',
  xpBar: '#FFDE43',
  scoreBar: '#43FF91',
} as const;

/**
 * Body colours a player may pick at the start of a run.
 *
 * The first six are open from the start. The rest unlock as the codex fills,
 * at the number of won tanks in `unlockAt`, and the last needs all fifty.
 * Nothing here is red, because red is what the enemies are.
 */
export const PLAYER_COLORS: readonly { id: string; name: string; hex: string; unlockAt?: number }[] = [
  { id: 'blue', name: 'Blue', hex: '#00B2E1' },
  { id: 'green', name: 'Green', hex: '#00E16E' },
  { id: 'purple', name: 'Purple', hex: '#BF7FF5' },
  { id: 'gold', name: 'Gold', hex: '#FFE869' },
  { id: 'pink', name: 'Pink', hex: '#F177DD' },
  { id: 'teal', name: 'Teal', hex: '#43FFF9' },
  { id: 'orange', name: 'Orange', hex: '#FF8F3F', unlockAt: 3 },
  { id: 'lime', name: 'Lime', hex: '#A4E34D', unlockAt: 8 },
  { id: 'silver', name: 'Silver', hex: '#B8BEC6', unlockAt: 15 },
  { id: 'navy', name: 'Navy', hex: '#3A55C9', unlockAt: 25 },
  { id: 'ivory', name: 'Ivory', hex: '#F2EEDD', unlockAt: 40 },
  { id: 'obsidian', name: 'Obsidian', hex: '#3B3B45', unlockAt: 50 },
];

/** Stat bar colours, keyed to match STAT_ORDER. */
export const STAT_COLORS = {
  regen: '#FCAD76',
  maxHealth: '#F943FF',
  bodyDamage: '#8543FF',
  bulletSpeed: '#437FFF',
  bulletPen: '#FFDE43',
  bulletDamage: '#FF4343',
  reload: '#82FF43',
  moveSpeed: '#43FFF9',
} as const;

const clamp255 = (n: number): number => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n));

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

export const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((c) => clamp255(c).toString(16).padStart(2, '0')).join('')}`;

/** Scales a colour toward black. Used for outlines and for pressed buttons. */
export function darken(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r * factor, g * factor, b * factor);
}

/** Blends two colours. `t` of 0 returns `a`, 1 returns `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** The outline the game draws around a shape of this fill colour. */
const outlineCache = new Map<string, string>();
export function outline(fill: string): string {
  let cached = outlineCache.get(fill);
  if (cached === undefined) {
    cached = darken(fill, 0.75);
    outlineCache.set(fill, cached);
  }
  return cached;
}
