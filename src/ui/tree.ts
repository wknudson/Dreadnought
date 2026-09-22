/**
 * The tank tree screen: its ring layout, and the viewer that draws it.
 *
 * The layout is computed from the roster when the viewer is built rather than
 * authored, so a new tank finds its place without being positioned by hand. The
 * nodes are drawn from cached icons, and the selected tank's preview through
 * `drawTank` itself.
 */

import { TANKS, getTank, ROOT_TANK_ID, visibleStats } from '../data/tanks.ts';
import type { TankDefinition } from '../data/schema.ts';
import { COLORS, outline } from '../data/colors.ts';
import { tankIcon } from '../render/iconCache.ts';
import { artExtent, drawTank } from '../render/drawTank.ts';
import { clamp, vec, type Vec2 } from '../core/math.ts';
import { el, button } from './dom.ts';
import { describeTank } from './describe.ts';

/** Ring radius for each tier, in tree-space units. */
const RING_RADIUS = [0, 320, 620, 960];
/** Body radius a node is drawn at, per tier. */
const NODE_RADIUS = [46, 34, 28, 22];

interface Node {
  def: TankDefinition;
  /** Position in tree space. */
  pos: Vec2;
  angle: number;
  radius: number;
  /**
   * Extra distance to push this node's label out by.
   *
   * Thirty-three tanks share the outer ring, so their labels are staggered onto
   * two lines. Without it the long names run together into one grey smear.
   */
  labelLift: number;
}

/**
 * Lays the roster out as rings around the Basic Tank.
 *
 * Each ring is one tier. Within a ring the tanks are sorted by where their
 * parents sit, then spread evenly, which keeps a branch together as it fans
 * outward without needing a true tree: several tanks have two parents, and a
 * few hang directly off the root two tiers below them.
 */
function layout(): Map<string, Node> {
  const nodes = new Map<string, Node>();
  const root = getTank(ROOT_TANK_ID);
  nodes.set(root.id, {
    def: root,
    pos: vec(0, 0),
    angle: -Math.PI / 2,
    radius: NODE_RADIUS[0]!,
    labelLift: 0,
  });

  // Tier 2 anchors the whole picture. This order puts branches that later share
  // a child next to each other, so those links stay short.
  const TIER2_ORDER = ['twin', 'flank-guard', 'machine-gun', 'sniper'];

  for (const tier of [2, 3, 4] as const) {
    const ring = TANKS.filter((d) => d.tier === tier);

    const sortKey = (def: TankDefinition): number => {
      if (tier === 2) {
        const i = TIER2_ORDER.indexOf(def.id);
        return i < 0 ? TIER2_ORDER.length : i;
      }
      // Sit between the parents already placed. A tank hanging off the root
      // alone has nothing to sit between, so it goes to the end of the ring.
      const placed = def.upgradesFrom
        .map((id) => nodes.get(id))
        .filter((n): n is Node => !!n && n.def.id !== ROOT_TANK_ID);
      if (!placed.length) return Number.POSITIVE_INFINITY;
      const sum = placed.reduce((acc, n) => acc + n.angle, 0);
      return sum / placed.length;
    };

    const ordered = ring
      .map((def) => ({ def, key: sortKey(def) }))
      .sort((a, b) => a.key - b.key || a.def.name.localeCompare(b.def.name));

    ordered.forEach(({ def }, i) => {
      // Start each ring at twelve o'clock and go clockwise.
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / ordered.length;
      const r = RING_RADIUS[tier - 1]!;
      nodes.set(def.id, {
        def,
        angle,
        pos: vec(Math.cos(angle) * r, Math.sin(angle) * r),
        radius: NODE_RADIUS[tier - 1]!,
        labelLift: tier === 4 && i % 2 === 1 ? 15 : 0,
      });
    });
  }

  return nodes;
}

/**
 * The tank tree screen.
 *
 * Renders to the main canvas and puts its detail panel in the DOM. Drag to pan,
 * scroll or pinch to zoom, click a tank to inspect it.
 */
export class TreeViewer {
  private readonly nodes = layout();
  private readonly order: Node[];

  private offset: Vec2 = vec(0, 0);
  private zoom = 0.6;
  /** Cleared once the first frame has sized the view to the whole tree. */
  private needsFit = true;
  private selected: string | null = null;
  private hovered: string | null = null;

  private dragging = false;
  private dragFrom: Vec2 = vec(0, 0);
  private dragOrigin: Vec2 = vec(0, 0);
  private pinchDistance = 0;

  /** Rotation of the selected tank's preview, advanced each frame. */
  private previewAngle = -Math.PI / 2;

  private width = 0;
  private height = 0;

  readonly panel: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly preview: HTMLCanvasElement;

  private readonly detachers: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly color: string,
    onBack: () => void,
  ) {
    this.order = [...this.nodes.values()].sort((a, b) => a.def.tier - b.def.tier);
    this.preview = el('canvas', { class: 'tree-preview', width: 150, height: 150 });
    this.detail = el('div', { class: 'tree-detail' });
    this.panel = el(
      'div',
      { class: 'screen tree-screen' },
      el(
        'div',
        { class: 'tree-bar' },
        button('Back', onBack, { class: 'btn btn-small' }),
        el('h2', { class: 'tree-title' }, 'Tank Tree'),
        el('span', { class: 'tree-count' }, `${TANKS.length} tanks`),
      ),
      el('aside', { class: 'tree-side' }, this.preview, this.detail),
    );
    this.select(ROOT_TANK_ID);
    this.attach();
  }

  private attach(): void {
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (ev: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ): void => {
      const h = handler as EventListener;
      this.canvas.addEventListener(type, h, opts);
      this.detachers.push(() => this.canvas.removeEventListener(type, h, opts));
    };

    on('mousedown', (e) => {
      this.dragging = true;
      this.dragFrom = vec(e.clientX, e.clientY);
      this.dragOrigin = vec(this.offset.x, this.offset.y);
    });
    on('mousemove', (e) => {
      const point = vec(e.clientX, e.clientY);
      if (this.dragging) {
        this.offset.x = this.dragOrigin.x + (point.x - this.dragFrom.x) / this.zoom;
        this.offset.y = this.dragOrigin.y + (point.y - this.dragFrom.y) / this.zoom;
      } else {
        this.hovered = this.hitTest(point)?.def.id ?? null;
        this.canvas.style.cursor = this.hovered ? 'pointer' : 'grab';
      }
    });
    on('mouseup', (e) => {
      const point = vec(e.clientX, e.clientY);
      const moved = Math.hypot(point.x - this.dragFrom.x, point.y - this.dragFrom.y);
      // A click is a drag that went nowhere.
      if (this.dragging && moved < 5) {
        const hit = this.hitTest(point);
        if (hit) this.select(hit.def.id);
      }
      this.dragging = false;
    });
    on('mouseleave', () => {
      this.dragging = false;
      this.hovered = null;
    });
    on('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    const touchOpts: AddEventListenerOptions = { passive: false };
    on('touchstart', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0]!;
        this.dragging = true;
        this.dragFrom = vec(t.clientX, t.clientY);
        this.dragOrigin = vec(this.offset.x, this.offset.y);
      } else if (e.touches.length === 2) {
        this.dragging = false;
        this.pinchDistance = this.touchSpread(e);
      }
      e.preventDefault();
    }, touchOpts);
    on('touchmove', (e) => {
      if (e.touches.length === 1 && this.dragging) {
        const t = e.touches[0]!;
        this.offset.x = this.dragOrigin.x + (t.clientX - this.dragFrom.x) / this.zoom;
        this.offset.y = this.dragOrigin.y + (t.clientY - this.dragFrom.y) / this.zoom;
      } else if (e.touches.length === 2 && this.pinchDistance > 0) {
        const spread = this.touchSpread(e);
        this.zoomBy(spread / this.pinchDistance);
        this.pinchDistance = spread;
      }
      e.preventDefault();
    }, touchOpts);
    on('touchend', (e) => {
      if (this.dragging && e.changedTouches.length) {
        const t = e.changedTouches[0]!;
        const moved = Math.hypot(t.clientX - this.dragFrom.x, t.clientY - this.dragFrom.y);
        if (moved < 8) {
          const hit = this.hitTest(vec(t.clientX, t.clientY));
          if (hit) this.select(hit.def.id);
        }
      }
      this.dragging = false;
      this.pinchDistance = 0;
    });
  }

  private touchSpread(e: TouchEvent): number {
    const [a, b] = [e.touches[0]!, e.touches[1]!];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  private zoomBy(factor: number): void {
    this.zoom = clamp(this.zoom * factor, 0.2, 2.5);
  }

  private treeToScreen(p: Vec2): Vec2 {
    return vec(
      (p.x + this.offset.x) * this.zoom + this.width / 2,
      (p.y + this.offset.y) * this.zoom + this.height / 2,
    );
  }

  private hitTest(screen: Vec2): Node | null {
    // Walk outward-in so a small outer node still wins over a large inner one.
    for (let i = this.order.length - 1; i >= 0; i--) {
      const node = this.order[i]!;
      const s = this.treeToScreen(node.pos);
      const reach = node.radius * artExtent(node.def) * this.zoom;
      if (Math.hypot(screen.x - s.x, screen.y - s.y) <= Math.max(reach, 18)) return node;
    }
    return null;
  }

  select(id: string): void {
    this.selected = id;
    this.renderDetail(getTank(id));
  }

  get selectedId(): string | null {
    return this.selected;
  }

  private renderDetail(def: TankDefinition): void {
    const parents = def.upgradesFrom.map((id) => getTank(id).name);
    const children = def.upgradesTo.map((id) => getTank(id).name);
    const stats = visibleStats(def);

    const rows: Node0[] = [];
    type Node0 = HTMLElement;
    const row = (label: string, value: string): HTMLElement =>
      el('div', { class: 'row' }, el('span', { class: 'k' }, label), el('span', { class: 'v' }, value));

    rows.push(row('Tier', String(def.tier)));
    rows.push(row('Unlocks at', def.unlockLevel === 0 ? 'Start' : `Level ${def.unlockLevel}`));
    rows.push(row('Barrels', String(def.barrels.length || 'none')));
    if (def.fieldFactor !== 1) {
      rows.push(row('View', `${Math.round((1 / def.fieldFactor) * 100)}%`));
    }
    const caps = stats.filter((s) => s.cap !== 7);
    if (caps.length) rows.push(row('Stat cap', `${caps[0]!.cap} on ${caps.length} stats`));
    if (def.hiddenStats?.length) rows.push(row('Drops', `${def.hiddenStats.length} stats`));
    if (def.flags.invisible) rows.push(row('Special', 'Turns invisible'));
    if (def.flags.zoom) rows.push(row('Special', 'Extends the camera'));
    if (def.flags.necroCapture) rows.push(row('Special', 'Raises dead squares'));

    const kinds = new Set(def.barrels.map((b) => b.projectile.kind));
    if (kinds.size) rows.push(row('Fires', [...kinds].join(', ')));

    this.detail.replaceChildren(
      el('h3', {}, def.name),
      el('p', { class: 'tree-blurb' }, describeTank(def)),
      el('div', { class: 'tree-rows' }, ...rows),
      parents.length
        ? el('div', { class: 'tree-links' }, el('span', { class: 'k' }, 'Upgrades from'), el('span', {}, parents.join(', ')))
        : el('div', { class: 'tree-links' }, el('span', { class: 'k' }, 'Where every run begins')),
      children.length
        ? el('div', { class: 'tree-links' }, el('span', { class: 'k' }, 'Upgrades to'), el('span', {}, children.join(', ')))
        : el('div', { class: 'tree-links' }, el('span', { class: 'k' }, 'The end of its branch')),
      el('div', { class: 'tree-stats' }, ...stats.map((s) => el('span', { class: 'chip' }, s.label))),
    );
  }

  /**
   * Sizes the view so the whole tree is visible.
   *
   * The outer ring is wide, and a tree you have to hunt around for is a poor
   * first impression, so the default is to show all of it at once.
   */
  private fitToView(): void {
    const reach = RING_RADIUS[3]! + NODE_RADIUS[3]! * 3;
    // Leave room for the detail panel on the right and the bar along the top.
    const usableW = Math.max(240, this.width - (this.width > 720 ? 330 : 40));
    const usableH = Math.max(240, this.height - 110);
    this.zoom = clamp(Math.min(usableW, usableH) / (reach * 2), 0.2, 2.5);
    // Nudge the centre left so the panel does not sit over the tree.
    const shift = this.width > 720 ? 150 / this.zoom : 0;
    this.offset = vec(-shift, 20 / this.zoom);
  }

  /** Advances the spinning preview and draws the tree. Called once per frame. */
  render(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number): void {
    const resized = width !== this.width || height !== this.height;
    this.width = width;
    this.height = height;
    if (this.needsFit || (resized && this.needsFit)) {
      this.fitToView();
      this.needsFit = false;
    }
    this.previewAngle += dt * 0.6;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);
    this.drawBackdropGrid(ctx, width, height);

    // Edges first so nodes sit on top of them.
    ctx.lineCap = 'round';
    for (const node of this.order) {
      for (const parentId of node.def.upgradesFrom) {
        const parent = this.nodes.get(parentId);
        if (!parent) continue;
        const active =
          this.selected === node.def.id ||
          this.selected === parentId ||
          this.hovered === node.def.id;
        this.drawEdge(ctx, parent, node, active);
      }
    }

    for (const node of this.order) this.drawNode(ctx, node);

    if (this.selected) this.drawPreview();
  }

  private drawBackdropGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const step = 50 * this.zoom;
    if (step < 6) return;
    ctx.save();
    ctx.globalAlpha = COLORS.gridAlpha * 0.7;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const originX = ((this.offset.x * this.zoom + width / 2) % step + step) % step;
    const originY = ((this.offset.y * this.zoom + height / 2) % step + step) % step;
    for (let x = originX; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = originY; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Links a parent to a child.
   *
   * The curve bows along the ring rather than cutting across it, which keeps the
   * long links readable: a tank with two parents on opposite sides of the circle
   * would otherwise draw a chord straight through the middle of the diagram.
   */
  private drawEdge(ctx: CanvasRenderingContext2D, parent: Node, child: Node, active: boolean): void {
    const from = this.treeToScreen(parent.pos);
    const to = this.treeToScreen(child.pos);

    // Control points sit at the midpoint radius, on each end's own bearing.
    const midRadius = (RING_RADIUS[parent.def.tier - 1]! + RING_RADIUS[child.def.tier - 1]!) / 2;
    const c1 = this.treeToScreen(
      vec(Math.cos(parent.angle) * midRadius, Math.sin(parent.angle) * midRadius),
    );
    const c2 = this.treeToScreen(
      vec(Math.cos(child.angle) * midRadius, Math.sin(child.angle) * midRadius),
    );

    ctx.save();
    ctx.strokeStyle = active ? this.color : COLORS.border;
    ctx.globalAlpha = active ? 0.95 : 0.28;
    ctx.lineWidth = (active ? 3.5 : 2) * Math.max(0.6, this.zoom);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawNode(ctx: CanvasRenderingContext2D, node: Node): void {
    const s = this.treeToScreen(node.pos);
    const radius = node.radius * this.zoom;
    const reach = radius * artExtent(node.def);
    // Skip anything scrolled off screen.
    if (s.x + reach < 0 || s.x - reach > this.width || s.y + reach < 0 || s.y - reach > this.height) {
      return;
    }

    const isSelected = this.selected === node.def.id;
    const isHovered = this.hovered === node.def.id;

    if (isSelected || isHovered) {
      ctx.save();
      ctx.globalAlpha = isSelected ? 0.3 : 0.16;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, reach + 10 * this.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Icons are cached at a fixed size and scaled, which keeps fifty tanks cheap.
    const iconSize = 128;
    const icon = tankIcon(node.def, iconSize, this.color);
    const drawn = reach * 2 * (iconSize / (iconSize * 0.92)) * 0.92;
    ctx.drawImage(icon, s.x - drawn / 2, s.y - drawn / 2, drawn, drawn);

    // Names are the point of this screen, so they stay on unless the view is
    // zoomed far enough out that they would overlap into noise.
    if (this.zoom > 0.26 || isSelected || isHovered) {
      const fontSize = Math.max(9, 13 * Math.min(1.1, Math.max(0.78, this.zoom)));
      ctx.save();
      ctx.font = `700 ${fontSize}px Ubuntu, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = fontSize * 0.28;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#000000';
      ctx.globalAlpha = isSelected || isHovered ? 1 : 0.8;
      const y = s.y + reach + 4 + node.labelLift * this.zoom;
      ctx.strokeText(node.def.name, s.x, y);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(node.def.name, s.x, y);
      ctx.restore();
    }
  }

  /** Paints the slowly rotating tank in the side panel. */
  private drawPreview(): void {
    const ctx = this.preview.getContext('2d');
    if (!ctx || !this.selected) return;
    const def = getTank(this.selected);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 150;
    if (this.preview.width !== size * dpr) {
      this.preview.width = size * dpr;
      this.preview.height = size * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    const radius = (size / 2 / artExtent(def)) * 0.82;
    drawTank(ctx, def, { color: this.color, angle: this.previewAngle, radius });
    ctx.restore();
  }

  /** Centres the view on a tank, used when opening the tree from a run. */
  focus(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;
    this.needsFit = false;
    this.zoom = 0.8;
    this.offset = vec(-node.pos.x, -node.pos.y);
    this.select(id);
  }

  destroy(): void {
    for (const detach of this.detachers) detach();
    this.detachers.length = 0;
    this.canvas.style.cursor = '';
  }
}

export { outline };
