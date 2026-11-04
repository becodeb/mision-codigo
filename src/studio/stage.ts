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
  /** Any pointer activity, for unlocking sound and counting the child as active. */
  onActivity(): void;
}

export interface RenderExtras {
  selectedId: string | null;
  /** True while nothing runs, so the selected sprite gets its stronger shadow. */
  idle: boolean;
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

export class StageRenderer {
  private readonly backdropLayer: SVGGElement;
  private readonly spriteLayer: SVGGElement;
  private readonly bubbleLayer: SVGGElement;
  private readonly monitorLayer: SVGGElement;
  private readonly nodes = new Map<string, Node>();
  private backdropId = '';
  private drag: { id: string; startX: number; startY: number; ox: number; oy: number; moved: boolean; pointerId: number } | null = null;
  private readonly offs: (() => void)[] = [];

  private readonly svg: SVGSVGElement;
  private readonly cb: StageCallbacks;

  constructor(svg: SVGSVGElement, cb: StageCallbacks) {
    this.svg = svg;
    this.cb = cb;
    svg.innerHTML = '<g class="bd"></g><g class="sprites"></g><g class="bubbles"></g><g class="monitors"></g>';
    const layer = (cls: string) => svg.querySelector(`.${cls}`) as SVGGElement;
    this.backdropLayer = layer('bd');
    this.spriteLayer = layer('sprites');
    this.bubbleLayer = layer('bubbles');
    this.monitorLayer = layer('monitors');
    this.listen('pointerdown', (e) => this.down(e as PointerEvent));
    this.listen('pointermove', (e) => this.move(e as PointerEvent));
    this.listen('pointerup', (e) => this.up(e as PointerEvent));
    this.listen('pointercancel', (e) => this.up(e as PointerEvent, true));
  }

  private listen(type: string, fn: (e: Event) => void): void {
    this.svg.addEventListener(type, fn);
    this.offs.push(() => this.svg.removeEventListener(type, fn));
  }

  dispose(): void {
    this.offs.forEach((off) => off());
    this.offs.length = 0;
    this.nodes.clear();
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
    this.cb.onActivity();
    const g = (e.target as Element).closest('.spr') as SVGGElement | null;
    if (!g) return;
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
    this.bubbleLayer.innerHTML = html;
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
    this.monitorLayer.innerHTML = html;
  }
}
