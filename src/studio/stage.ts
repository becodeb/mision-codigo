/**
 * Draws the runtime's stage into an SVG (480 x 360, origin at the centre, y up) and turns pointer events
 * into taps and drags. It reads a `StageView` and holds no program logic of its own.
 */
import { ART, BACKDROPS, CHARACTERS, faceSVG, type ArtId } from '../art/index.ts';
import { HH, HW, clampXY } from '../runtime/geometry.ts';
import type { StageView } from '../runtime/host.ts';
import type { SpriteInstance } from '../runtime/instance.ts';
import { toStr } from '../runtime/values.ts';

const NS = 'http://www.w3.org/2000/svg';
const HAND_PATH = 'M22 6c3.3 0 6 2.7 6 6v20.5l2.6-1.3c3-1.4 6.4-.2 7.6 2.6l.6 1.4 1.8-.8c3-1.3 6.3.1 7.4 3l.5 1.2c3-1 6.3.9 6.8 4l.7 4.4c1.4 9-2.6 17.2-10.5 21.4l-1.7.9c-2.9 1.5-6.1 2.3-9.4 2.3h-3.8c-6.5 0-12.5-3.4-15.8-9l-8-13.4c-1.6-2.7-.8-6.2 1.9-7.8 2.4-1.5 5.6-.9 7.3 1.4l2.9 4V12c0-3.3 2.7-6 6-6z';
/** Where each arrow sits in the inverted T (column, row) and what is drawn on it. */
const ARROW_CAP: Record<string, { col: number; row: number; glyph: string }> = {
  ArrowUp: { col: 1, row: 0, glyph: '▲' },
  ArrowLeft: { col: 0, row: 1, glyph: '◀' },
  ArrowDown: { col: 1, row: 1, glyph: '▼' },
  ArrowRight: { col: 2, row: 1, glyph: '▶' },
};
const CAP = 30;
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export interface StageCallbacks {
  /** A sprite instance was pressed and released without moving. */
  onTap(instanceId: string): void;
  /** Whether the instance may be dragged now (only originals, only while stopped). */
  canDrag(instanceId: string): boolean;
  /** Pointer went down on a sprite; lets the editor select it. */
  onPress(instanceId: string): void;
  onDrag(instanceId: string, x: number, y: number): void;
  onDragEnd(instanceId: string): void;
  /** A press that did nothing: a drag that is not allowed (id), or the empty stage (null). */
  onMiss(instanceId: string | null): void;
  /** Any pointer activity, for unlocking sound and counting the child as active. */
  onActivity(): void;
}

/** What the coach draws on the stage: where to press and what to click. Sprite ids, so clones and moves are followed. */
export interface CoachDraw {
  /** The arrow keys the program uses, and the space bar. */
  keys: { arrows: readonly string[]; space: boolean; ids: string[]; /** Draw the keycaps (not on a touch screen, which has its own). */ caps: boolean } | null;
  /** Sprites to click, with the hand on them. */
  taps: string[];
}

export interface RenderExtras {
  selectedId: string | null;
  /** True while nothing runs, so the selected sprite gets its stronger shadow. */
  idle: boolean;
  /** Sprites with a click script: the pointer cursor is only for them while a game plays. */
  clickable?: ReadonlySet<string>;
  coach?: CoachDraw | null;
}

interface Node {
  g: SVGGElement;
  face: string;
  art: string;
}

function wrapText(text: string, max = 17): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.length ? lines.slice(0, 5) : [''];
}

interface CoachNode {
  kind: 'ring' | 'keys' | 'tap';
  /** The sprite it follows. */
  id: string;
  g: SVGGElement | null;
  w: number;
  h: number;
  at: string;
  r: number;
}

export class StageRenderer {
  private readonly backdropLayer: SVGGElement;
  private readonly spriteLayer: SVGGElement;
  private readonly bubbleLayer: SVGGElement;
  private readonly monitorLayer: SVGGElement;
  private readonly coachLayer: SVGGElement;
  private readonly nodes = new Map<string, Node>();
  private backdropId = '';
  /* What each layer shows: writing the same markup again on every frame is slow on a small laptop. */
  private bubbleHtml = '';
  private monitorHtml = '';
  /* The coach is built when it changes; each frame only moves what it built. */
  private coachKey = '';
  private coachNodes: CoachNode[] = [];
  private drag: { id: string; startX: number; startY: number; ox: number; oy: number; moved: boolean; pointerId: number } | null = null;
  private readonly offs: (() => void)[] = [];

  private readonly svg: SVGSVGElement;
  private readonly cb: StageCallbacks;

  constructor(svg: SVGSVGElement, cb: StageCallbacks) {
    this.svg = svg;
    this.cb = cb;
    svg.innerHTML = '<g class="bd"></g><g class="sprites"></g><g class="bubbles"></g><g class="monitors"></g><g class="coach" pointer-events="none"></g>';
    const layer = (cls: string) => svg.querySelector(`.${cls}`) as SVGGElement;
    this.backdropLayer = layer('bd');
    this.spriteLayer = layer('sprites');
    this.bubbleLayer = layer('bubbles');
    this.monitorLayer = layer('monitors');
    this.coachLayer = layer('coach');
    this.listen('pointerdown', (e) => this.down(e as PointerEvent));
    this.listen('pointermove', (e) => this.move(e as PointerEvent));
    this.listen('pointerup', (e) => this.up(e as PointerEvent));
    this.listen('pointercancel', (e) => this.up(e as PointerEvent, true));
    /* A drag whose pointer was lost without an up or a cancel would otherwise block every later touch. */
    this.listen('lostpointercapture', (e) => this.up(e as PointerEvent, true));
  }

  private listen(type: string, fn: (e: Event) => void): void {
    this.svg.addEventListener(type, fn);
    this.offs.push(() => this.svg.removeEventListener(type, fn));
  }

  dispose(): void {
    this.offs.forEach((off) => off());
    this.offs.length = 0;
    this.nodes.clear();
    this.coachNodes = [];
    this.svg.innerHTML = '';
  }

  /** Stage coordinates (y up) of a pointer event. */
  private point(e: PointerEvent): { x: number; y: number } {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x - HW, y: HH - p.y };
  }

  private down(e: PointerEvent): void {
    /* One sprite at a time: a second finger used to take over the drag and leave the first sprite half moved. */
    if (this.drag && e.pointerId !== this.drag.pointerId) {
      e.preventDefault();
      return;
    }
    this.cb.onActivity();
    const g = (e.target as Element).closest('.spr') as SVGGElement | null;
    if (!g) {
      this.cb.onMiss(null);
      return;
    }
    const id = g.dataset.id!;
    this.cb.onPress(id);
    const p = this.point(e);
    const inst = this.last.get(id);
    this.drag = { id, startX: p.x, startY: p.y, ox: inst?.x ?? 0, oy: inst?.y ?? 0, moved: false, pointerId: e.pointerId };
    try { this.svg.setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ }
    e.preventDefault();
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const p = this.point(e);
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    if (Math.hypot(dx, dy) > 5) d.moved = true;
    if (d.moved && this.cb.canDrag(d.id)) {
      const [x, y] = clampXY(d.ox + dx, d.oy + dy);
      this.cb.onDrag(d.id, x, y);
    }
  }

  private up(e: PointerEvent, cancelled = false): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    try { this.svg.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (d.moved && this.cb.canDrag(d.id)) this.cb.onDragEnd(d.id);
    else if (!d.moved && !cancelled) this.cb.onTap(d.id);
    else if (d.moved && !cancelled) this.cb.onMiss(d.id);
  }

  setBackdrop(id: string): void {
    if (id === this.backdropId) return;
    this.backdropId = id;
    const def = (BACKDROPS as Record<string, { svg: (p: string) => string }>)[id];
    this.backdropLayer.innerHTML = def ? def.svg('st-') : '';
  }

  private readonly last = new Map<string, SpriteInstance>();

  render(view: StageView, extras: RenderExtras): void {
    this.setBackdrop(view.backdrop);
    const seen = new Set<string>();
    const bubbles: { inst: SpriteInstance; px: number; top: number }[] = [];
    this.last.clear();
    for (const inst of view.instances) {
      seen.add(inst.id);
      this.last.set(inst.id, inst);
      const def = (ART as Record<string, (typeof ART)[ArtId] | undefined>)[inst.artId];
      if (!def) continue;
      let node = this.nodes.get(inst.id);
      if (node && node.art !== inst.artId) {
        node.g.remove();
        this.nodes.delete(inst.id);
        node = undefined;
      }
      if (!node) {
        const g = document.createElementNS(NS, 'g') as SVGGElement;
        g.setAttribute('class', 'spr');
        g.dataset.id = inst.id;
        const hitW = Math.max(def.r * 2, 44);
        g.innerHTML =
          `<ellipse class="shadow" cx="0" cy="2" rx="${Math.max(18, def.r * 0.8)}" ry="7" fill="#000" opacity=".16"/>` +
          `<g class="art">${def.svg(String(inst.face))}</g>` +
          `<rect class="hit" x="${-hitW / 2}" y="${-Math.max(def.h, 40)}" width="${hitW}" height="${Math.max(def.h, 40)}" fill="transparent"/>`;
        this.spriteLayer.appendChild(g);
        node = { g, face: String(inst.face), art: inst.artId };
        this.nodes.set(inst.id, node);
      }
      const sc = inst.size / 100;
      const px = HW + inst.x;
      const py = HH - inst.y - inst.jy - inst.bob;
      node.g.setAttribute(
        'transform',
        `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${inst.rot.toFixed(1)} 0 ${((-def.h * sc) / 2).toFixed(1)}) scale(${(inst.flip * sc).toFixed(3)} ${sc.toFixed(3)})`,
      );
      node.g.style.display = inst.visible ? '' : 'none';
      node.g.classList.toggle('clk', extras.clickable?.has(inst.spriteId) === true);
      if (def.hasFace && node.face !== String(inst.face)) {
        const fg = node.g.querySelector('.face');
        const chars = CHARACTERS as Record<string, { face: Parameters<typeof faceSVG>[1] }>;
        if (fg && chars[inst.artId]) fg.innerHTML = faceSVG(String(inst.face), chars[inst.artId].face);
        node.face = String(inst.face);
      }
      const shadow = node.g.querySelector('.shadow');
      shadow?.setAttribute('opacity', extras.idle && extras.selectedId === inst.id ? '.32' : '.16');
      if (inst.bubble && inst.visible) bubbles.push({ inst, px, top: py - def.h * sc - 6 });
    }
    for (const [id, node] of this.nodes) {
      if (!seen.has(id)) {
        node.g.remove();
        this.nodes.delete(id);
      }
    }
    /* Keep the drawing order equal to the runtime's: a clone made later is drawn on top. */
    let prev: Element | null = null;
    for (const inst of view.instances) {
      const node = this.nodes.get(inst.id);
      if (!node) continue;
      if (prev ? prev.nextElementSibling !== node.g : this.spriteLayer.firstElementChild !== node.g) this.spriteLayer.insertBefore(node.g, prev ? prev.nextElementSibling : this.spriteLayer.firstChild);
      prev = node.g;
    }
    this.renderBubbles(bubbles);
    this.renderMonitors(view);
    this.renderCoach(extras.coach ?? null);
  }

  /** Rings, keycaps and the hand over the sprites they are about. Rebuilt only when the coach changes. */
  private renderCoach(draw: CoachDraw | null): void {
    const key = draw ? JSON.stringify(draw) : '';
    if (key !== this.coachKey) {
      this.coachKey = key;
      this.coachNodes = [];
      let html = '';
      const add = (kind: CoachNode['kind'], id: string, inner: string, size = { w: 0, h: 0 }): void => {
        html += `<g class="co-at" data-n="${this.coachNodes.length}">${inner}</g>`;
        this.coachNodes.push({ kind, id, g: null, w: size.w, h: size.h, at: '', r: 0 });
      };
      const ring = '<circle class="co-ring" r="40" fill="none" stroke="#FFC93C" stroke-width="5"/>';
      if (draw?.keys) {
        for (const id of draw.keys.ids) add('ring', id, ring);
        if (draw.keys.caps && draw.keys.ids[0]) {
          const arrows = draw.keys.arrows.filter((k) => ARROW_CAP[k]);
          const top = arrows.includes('ArrowUp');
          const rows = arrows.length ? (top ? 2 : 1) : 0;
          const cap = (x: number, y: number, w: number, text: string, size: number): string =>
            `<g transform="translate(${x} ${y})"><g class="co-cap"><rect y="3" width="${w}" height="${CAP}" rx="8" fill="#241A4D" opacity=".4"/><rect width="${w}" height="${CAP}" rx="8" fill="#fff" stroke="#241A4D" stroke-width="3"/>` +
            `<text x="${w / 2}" y="${CAP * 0.68}" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="${size}" fill="#241A4D">${text}</text></g></g>`;
          let caps = arrows.map((k) => cap(ARROW_CAP[k].col * 34, ARROW_CAP[k].row === 0 || !top ? 0 : 34, CAP, ARROW_CAP[k].glyph, 15)).join('');
          const gridH = rows * 34 - 4;
          const spaceY = rows ? gridH + 6 : 0;
          if (draw.keys.space) caps += cap(0, spaceY, 98, 'espacio', 15);
          add('keys', draw.keys.ids[0], caps, { w: 98, h: draw.keys.space ? spaceY + CAP : gridH });
        }
      }
      for (const id of draw?.taps ?? []) {
        add('tap', id, `${ring}<g class="co-bob"><g transform="translate(${-22 * 0.8} ${12 - 6 * 0.8}) scale(.8)"><path d="${HAND_PATH}" fill="#fff" stroke="#241A4D" stroke-width="3.5" stroke-linejoin="round"/></g></g>`);
      }
      this.coachLayer.innerHTML = html;
      for (const el of Array.from(this.coachLayer.children) as SVGGElement[]) this.coachNodes[Number(el.dataset.n)].g = el;
    }
    for (const n of this.coachNodes) this.placeCoach(n);
  }

  /** Puts one coach element where its sprite is now. Only the transform changes. */
  private placeCoach(n: CoachNode): void {
    const g = n.g;
    const inst = this.last.get(n.id);
    const def = inst ? (ART as Record<string, (typeof ART)[ArtId] | undefined>)[inst.artId] : undefined;
    if (!g || !inst || !def) return;
    const show = inst.visible;
    if (g.style.display !== (show ? '' : 'none')) g.style.display = show ? '' : 'none';
    if (!show) return;
    const sc = inst.size / 100;
    const px = HW + inst.x;
    const cy = HH - inst.y - inst.jy - inst.bob - (def.h * sc) / 2;
    const radius = Math.round(Math.max(def.r, def.h * 0.42) * sc + 10);
    let at: string;
    if (n.kind === 'keys') {
      /* Beside the sprite, on the side with more room, and inside the stage. */
      const left = px < HW ? px + radius + 10 : px - radius - 10 - n.w;
      const x = clamp(left, 6, 480 - n.w - 6);
      const y = clamp(cy - n.h / 2, 6, 360 - n.h - 6);
      at = `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
    } else {
      at = `translate(${px.toFixed(1)} ${cy.toFixed(1)})`;
      if (n.r !== radius) {
        n.r = radius;
        g.querySelector('.co-ring')?.setAttribute('r', String(radius));
      }
    }
    if (at !== n.at) {
      n.at = at;
      g.setAttribute('transform', at);
    }
  }

  private renderBubbles(list: { inst: SpriteInstance; px: number; top: number }[]): void {
    let html = '';
    for (const { inst, px, top } of list) {
      const b = inst.bubble!;
      const lines = wrapText(b.text);
      const lh = 19;
      const w = Math.max(54, Math.max(...lines.map((l) => l.length)) * 8.6 + 26);
      const h = lines.length * lh + 18;
      const bx = clamp(px - w / 2 + 14, 6, 480 - w - 6);
      const by = clamp(top - h - 12, 4, 356 - h);
      const tipX = clamp(px, bx + 14, bx + w - 14);
      const tipY = Math.max(by + h + 2, Math.min(top + 4, by + h + 18));
      const tail =
        b.kind === 'think'
          ? `<circle cx="${tipX}" cy="${by + h + 8}" r="5" fill="#fff" stroke="#241A4D" stroke-width="2.5"/><circle cx="${tipX + 4}" cy="${by + h + 17}" r="3" fill="#fff" stroke="#241A4D" stroke-width="2"/>`
          : `<path d="M${tipX - 9} ${by + h - 2} L${tipX} ${tipY} L${tipX + 7} ${by + h - 2}" fill="#fff" stroke="#241A4D" stroke-width="3" stroke-linejoin="round"/><path d="M${tipX - 7} ${by + h - 1.5} H${tipX + 6}" stroke="#fff" stroke-width="4"/>`;
      html +=
        `<g><rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="${b.kind === 'think' ? h / 2.2 : 14}" fill="#fff" stroke="#241A4D" stroke-width="3"/>${tail}` +
        lines.map((l, i) => `<text x="${bx + w / 2}" y="${by + 22 + i * lh}" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="700" font-size="16" fill="#241A4D">${esc(l)}</text>`).join('') +
        '</g>';
    }
    if (html !== this.bubbleHtml) this.bubbleLayer.innerHTML = this.bubbleHtml = html;
  }

  /** Points, variables and lists, stacked at the top left like Scratch's monitors. */
  private renderMonitors(view: StageView): void {
    let y = 8;
    let html = '';
    const box = (label: string, value: string): void => {
      const text = `${label} ${value}`;
      const w = Math.min(230, 28 + text.length * 8.4);
      html += `<g transform="translate(8 ${y})"><rect width="${w}" height="30" rx="9" fill="#fff" stroke="#241A4D" stroke-width="3"/><text x="12" y="21" font-family="Chakra Petch, monospace" font-weight="700" font-size="15" fill="#241A4D">${esc(text.slice(0, 26))}</text></g>`;
      y += 36;
    };
    if (view.score !== null) box('★ Puntos:', String(Math.round(view.score * 1000) / 1000));
    for (const [name, value] of view.vars) box(`${name}:`, toStr(value));
    for (const [name, items] of view.lists) {
      const shown = items.slice(0, 4);
      const w = 190;
      const h = 30 + Math.max(1, shown.length) * 20 + (items.length > 4 ? 18 : 0);
      html += `<g transform="translate(8 ${y})"><rect width="${w}" height="${h}" rx="9" fill="#fff" stroke="#241A4D" stroke-width="3"/>` +
        `<text x="12" y="21" font-family="Chakra Petch, monospace" font-weight="700" font-size="14" fill="#B4580A">${esc(name.slice(0, 16))} (${items.length})</text>` +
        (shown.length ? shown.map((v, i) => `<text x="14" y="${42 + i * 20}" font-family="Chakra Petch, monospace" font-size="14" fill="#241A4D">${i + 1}. ${esc(toStr(v).slice(0, 18))}</text>`).join('') : '<text x="14" y="42" font-family="Chakra Petch, monospace" font-size="13" fill="#8A8499">vacía</text>') +
        (items.length > 4 ? `<text x="14" y="${42 + 4 * 20}" font-family="Chakra Petch, monospace" font-size="13" fill="#8A8499">…</text>` : '') + '</g>';
      y += h + 6;
    }
    if (html !== this.monitorHtml) this.monitorLayer.innerHTML = this.monitorHtml = html;
  }
}
