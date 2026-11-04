/**
 * The animated hand: «Mostrame» drags a block from the toolbox to the script, then presses the flag;
 * `pointAt` just bounces the hand over an element of the page. Browser only.
 */
import type { BlockType } from '../language/catalog.ts';
import type { BlockEditor } from './workspace.ts';

const HAND =
  '<svg viewBox="0 0 64 72" width="64" height="72" aria-hidden="true"><path d="M22 6c3.3 0 6 2.7 6 6v20.5l2.6-1.3c3-1.4 6.4-.2 7.6 2.6l.6 1.4 1.8-.8c3-1.3 6.3.1 7.4 3l.5 1.2c3-1 6.3.9 6.8 4l.7 4.4c1.4 9-2.6 17.2-10.5 21.4l-1.7.9c-2.9 1.5-6.1 2.3-9.4 2.3h-3.8c-6.5 0-12.5-3.4-15.8-9l-8-13.4c-1.6-2.7-.8-6.2 1.9-7.8 2.4-1.5 5.6-.9 7.3 1.4l2.9 4V12c0-3.3 2.7-6 6-6z" fill="#fff" stroke="#241A4D" stroke-width="3.5" stroke-linejoin="round"/><path d="M28 36v9M37 38v7M45 41v5" stroke="#241A4D" stroke-width="3" stroke-linecap="round" opacity=".3"/></svg>';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function tween(ms: number, fn: (t: number) => void, alive: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - t0) / ms);
      if (alive()) fn(t);
      if (t < 1 && alive()) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** Resolves a short point name (`flag`) or a CSS selector to an element inside the studio. */
export function resolvePoint(root: HTMLElement, selector: string): HTMLElement | null {
  const sel = /^[a-z][a-z0-9-]*$/i.test(selector) ? `[data-point="${selector}"]` : selector;
  try {
    return root.querySelector<HTMLElement>(sel);
  } catch {
    return null;
  }
}

export interface DemoDeps {
  root: HTMLElement;
  editor: BlockEditor | null;
  sfx(name: string): void;
  say(text: string): void;
}

function overlay(root: HTMLElement): HTMLElement {
  let layer = root.querySelector<HTMLElement>('.mc-demo');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'mc-demo';
    layer.hidden = true;
    root.appendChild(layer);
  }
  return layer;
}

let running = 0;

/** Bounces the hand over an element and flashes it. */
export async function pointAt(deps: DemoDeps, selector: string): Promise<void> {
  const el = resolvePoint(deps.root, selector);
  if (!el) return;
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  await sleep(250);
  el.classList.remove('mc-attn');
  void el.offsetWidth;
  el.classList.add('mc-attn');
  window.setTimeout(() => el.classList.remove('mc-attn'), 3200);
  const layer = overlay(deps.root);
  if (!layer.hidden && !layer.classList.contains('passive')) return;
  const token = ++running;
  const r = el.getBoundingClientRect();
  const x = r.left + Math.min(r.width / 2, 60);
  const y = r.top + r.height / 2;
  layer.className = 'mc-demo passive';
  layer.hidden = false;
  layer.innerHTML = `<div class="hand">${HAND}</div>`;
  const hand = layer.querySelector<HTMLElement>('.hand')!;
  await tween(1800, (t) => { hand.style.transform = `translate(${x - 22}px, ${(y - 6 + Math.abs(Math.sin(t * Math.PI * 3)) * 18).toFixed(1)}px)`; }, () => token === running);
  if (token === running && layer.classList.contains('passive')) {
    layer.hidden = true;
    layer.innerHTML = '';
  }
}

interface Origin { x: number; y: number; sc: number; r: DOMRect; bb: DOMRect }

function originOf(block: { getSvgRoot(): SVGGElement }): Origin {
  const root = block.getSvgRoot();
  const r = root.getBoundingClientRect();
  const bb = root.getBBox();
  const sc = bb.width ? r.width / bb.width : 1;
  return { x: r.left - bb.x * sc, y: r.top - bb.y * sc, sc, r, bb };
}

/** Drags `type` from the toolbox to the end of the flag script and presses the flag. */
export async function handDemo(deps: DemoDeps, type: BlockType, isHat: boolean): Promise<void> {
  const editor = deps.editor;
  if (!editor) return;
  const root = deps.root;
  const token = ++running;
  if (editor.tier === 'text') {
    editor.openCategoryOf(type);
    await sleep(350);
  }
  const src = editor.flyoutBlock(type);
  if (!src) {
    await pointAt(deps, 'toolbox');
    return;
  }
  if (window.innerWidth < 1000) {
    root.querySelector('.mc-code')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await sleep(450);
  }
  const hat = editor.topBlocks().find((b) => b.type === 'f_flag' || b.type === 'a_flag');
  const host = root.querySelector<HTMLElement>('.mc-blockly');
  const hostRect = host?.getBoundingClientRect();
  let dest: { x: number; y: number };
  if (isHat || !hat) {
    let bottom = 0;
    let left: number | null = null;
    for (const b of editor.topBlocks()) {
      const r = b.getSvgRoot().getBoundingClientRect();
      bottom = Math.max(bottom, r.bottom);
      left = left === null ? r.left : Math.min(left, r.left);
    }
    dest = { x: left ?? (hostRect?.left ?? 0) + 120, y: Math.min(bottom + 70, (hostRect?.bottom ?? 600) - 60) };
  } else {
    let last = hat;
    while (last.getNextBlock()) last = last.getNextBlock()! as typeof hat;
    const ao = originOf(last);
    const off = last.nextConnection ? last.nextConnection.getOffsetInBlock() : { x: 0, y: 0 };
    dest = { x: ao.x + off.x * ao.sc, y: ao.y + off.y * ao.sc };
  }

  const layer = overlay(root);
  layer.className = 'mc-demo';
  layer.hidden = false;
  layer.innerHTML = `<div class="hand">${HAND}</div><button class="demo-skip" type="button">Saltar</button>`;
  const hand = layer.querySelector<HTMLElement>('.hand')!;
  let skip = false;
  layer.onclick = () => { skip = true; };
  const alive = (): boolean => token === running && !skip;
  const setHand = (x: number, y: number): void => { hand.style.transform = `translate(${(x - 22).toFixed(1)}px, ${(y - 6).toFixed(1)}px)`; };
  const hx = window.innerWidth * 0.5;
  const hy = window.innerHeight + 60;
  setHand(hx, hy);

  const o = originOf(src);
  const ghost = document.createElement('div');
  ghost.className = 'ghost ' + [...editor.ws.getInjectionDiv().classList].filter((c) => /-renderer$|-theme$/.test(c)).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(o.r.width));
  svg.setAttribute('height', String(o.r.height));
  svg.setAttribute('viewBox', `${o.bb.x} ${o.bb.y} ${o.bb.width} ${o.bb.height}`);
  svg.style.overflow = 'visible';
  const clone = src.getSvgRoot().cloneNode(true) as SVGGElement;
  clone.removeAttribute('transform');
  clone.classList.remove('mc-glow');
  svg.appendChild(clone);
  ghost.appendChild(svg);
  const place = (x: number, y: number): void => { ghost.style.transform = `translate(${(x + o.bb.x * o.sc).toFixed(1)}px, ${(y + o.bb.y * o.sc).toFixed(1)}px)`; };

  const grabX = o.r.left + Math.min(28, o.r.width / 2);
  const grabY = o.r.top + o.r.height / 2;
  await tween(750, (t) => { const e = ease(t); setHand(lerp(hx, grabX, e), lerp(hy, grabY, e)); }, alive);
  if (alive()) {
    hand.classList.add('press');
    deps.sfx('pop');
    place(o.x, o.y);
    layer.appendChild(ghost);
    await sleep(250);
    const dx = grabX - o.x;
    const dy = grabY - o.y;
    await tween(1150, (t) => {
      const e = ease(t);
      const x = lerp(o.x, dest.x, e);
      const y = lerp(o.y, dest.y, e) - Math.sin(t * Math.PI) * 50;
      place(x, y);
      setHand(x + dx, y + dy);
    }, alive);
    hand.classList.remove('press');
    deps.sfx('tick');
    ghost.classList.add('dropped');
    await sleep(500);
    if (alive()) {
      const target = resolvePoint(root, type === 'f_click' || type === 'a_click' ? 'stage' : 'flag');
      if (target) {
        const rb = target.getBoundingClientRect();
        const tx = rb.left + rb.width / 2;
        const ty = rb.top + rb.height / 2;
        const fx = dest.x + dx;
        const fy = dest.y + dy;
        await tween(800, (t) => { const e = ease(t); setHand(lerp(fx, tx, e), lerp(fy, ty, e)); }, alive);
        hand.classList.add('press');
        deps.sfx('pop');
        const ring = document.createElement('div');
        ring.className = 'ring';
        ring.style.left = `${tx}px`;
        ring.style.top = `${ty}px`;
        layer.appendChild(ring);
        await sleep(600);
        hand.classList.remove('press');
      }
    }
  }
  ghost.classList.add('fade');
  await sleep(skip ? 0 : 350);
  if (token === running) {
    layer.hidden = true;
    layer.innerHTML = '';
    layer.onclick = null;
    if (!skip) deps.say('¡Ahora te toca a vos!');
  }
}

/** Cancels a demo in progress, for example when the studio closes. */
export function cancelDemo(root: HTMLElement): void {
  running++;
  const layer = root.querySelector<HTMLElement>('.mc-demo');
  if (layer) {
    layer.hidden = true;
    layer.innerHTML = '';
    layer.onclick = null;
  }
}
