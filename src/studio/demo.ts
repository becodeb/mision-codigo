/**
 * The animated hand. «Mostrame» plays what `planDemo` decided: it points at the sprite or the add button, drags
 * the next missing block from the toolbox to where it belongs, or shows how to try the result. Everything it
 * draws is a ghost on an overlay, so the child's program is never touched. `pointAt` just bounces the hand over
 * an element of the page. Browser only; the decisions live in demoPlan.ts.
 */
import type { BlockType } from '../language/catalog.ts';
import { describePlan, tryTarget, type DemoPlan, type Slot } from './demoPlan.ts';
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

/** Bumped by every new demo, so an older animation notices it was replaced and stops touching the page. */
let running = 0;

function clearLayer(root: HTMLElement): void {
  const layer = root.querySelector<HTMLElement>('.mc-demo');
  if (!layer) return;
  layer.hidden = true;
  layer.innerHTML = '';
  layer.onclick = null;
}

function setCaption(layer: HTMLElement, text: string): void {
  layer.querySelector('.cap')?.remove();
  if (!text) return;
  const cap = document.createElement('div');
  cap.className = 'cap';
  cap.textContent = text;
  layer.appendChild(cap);
}

/** Bounces the hand over an element and flashes it. */
export async function pointAt(deps: DemoDeps, selector: string, caption = ''): Promise<void> {
  const token = ++running;
  clearLayer(deps.root);
  const el = resolvePoint(deps.root, selector);
  if (!el) return;
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  await sleep(250);
  if (token !== running) return;
  el.classList.remove('mc-attn');
  void el.offsetWidth;
  el.classList.add('mc-attn');
  window.setTimeout(() => el.classList.remove('mc-attn'), 3200);
  const layer = overlay(deps.root);
  const r = el.getBoundingClientRect();
  const x = r.left + Math.min(r.width / 2, 60);
  const y = r.top + r.height / 2;
  layer.className = 'mc-demo passive';
  layer.hidden = false;
  layer.innerHTML = `<div class="hand">${HAND}</div>`;
  setCaption(layer, caption);
  if (caption) deps.say(caption);
  const hand = layer.querySelector<HTMLElement>('.hand')!;
  await tween(1800, (t) => { hand.style.transform = `translate(${x - 22}px, ${(y - 6 + Math.abs(Math.sin(t * Math.PI * 3)) * 18).toFixed(1)}px)`; }, () => token === running);
  if (token === running && layer.classList.contains('passive')) clearLayer(deps.root);
}

interface Origin { x: number; y: number; sc: number; r: DOMRect; bb: DOMRect }

function originOf(block: { getSvgRoot(): SVGGElement }): Origin {
  const root = block.getSvgRoot();
  const r = root.getBoundingClientRect();
  const bb = root.getBBox();
  const sc = bb.width ? r.width / bb.width : 1;
  return { x: r.left - bb.x * sc, y: r.top - bb.y * sc, sc, r, bb };
}

/** Screen position where a dragged block's top left corner lands to snap into `slot`, or `null` when the block is not there any more. */
function slotPoint(editor: BlockEditor, slot: Slot): { x: number; y: number } | null {
  const owner = editor.blockById(slot.parent);
  if (!owner) return null;
  const conn = slot.kind === 'next' ? owner.nextConnection : owner.getInput(slot.kind === 'do' ? 'DO' : 'ELSE')?.connection;
  if (!conn) return null;
  const ao = originOf(owner);
  const off = (conn as unknown as { getOffsetInBlock(): { x: number; y: number } }).getOffsetInBlock();
  return { x: ao.x + off.x * ao.sc, y: ao.y + off.y * ao.sc };
}

interface Run {
  layer: HTMLElement;
  hand: HTMLElement;
  setHand(x: number, y: number): void;
  alive(): boolean;
  skipped(): boolean;
}

function begin(deps: DemoDeps, token: number, caption: string): Run {
  const layer = overlay(deps.root);
  layer.className = 'mc-demo';
  layer.hidden = false;
  layer.innerHTML = `<div class="hand">${HAND}</div><button class="demo-skip" type="button">Saltar</button>`;
  const hand = layer.querySelector<HTMLElement>('.hand')!;
  let skip = false;
  layer.onclick = () => { skip = true; };
  const run: Run = {
    layer,
    hand,
    setHand: (x, y) => { hand.style.transform = `translate(${(x - 22).toFixed(1)}px, ${(y - 6).toFixed(1)}px)`; },
    alive: () => token === running && !skip,
    skipped: () => skip,
  };
  run.setHand(window.innerWidth * 0.5, window.innerHeight + 60);
  setCaption(layer, caption);
  return run;
}

/** Ends an animation if it is still the current one: removes the overlay. */
function finish(deps: DemoDeps, token: number): void {
  if (token === running) clearLayer(deps.root);
}

/** A free spot in the workspace for a new hat: below the last script, at the left margin. */
function freeSpot(editor: BlockEditor, host: HTMLElement | null): { x: number; y: number } {
  const hostRect = host?.getBoundingClientRect();
  let bottom = 0;
  let left: number | null = null;
  for (const b of editor.topBlocks()) {
    const r = b.getSvgRoot().getBoundingClientRect();
    bottom = Math.max(bottom, r.bottom);
    left = left === null ? r.left : Math.min(left, r.left);
  }
  return { x: left ?? (hostRect?.left ?? 0) + 120, y: Math.min(bottom + 70, (hostRect?.bottom ?? 600) - 60) };
}

/** Drags a block from the toolbox to a free spot (a new event) or to a connection of the child's own program. */
async function dragDemo(deps: DemoDeps, type: BlockType, target: { slot: Slot } | { hat: true }, caption: string): Promise<void> {
  const editor = deps.editor;
  if (!editor) return;
  const root = deps.root;
  const token = ++running;
  clearLayer(root);
  if (editor.tier === 'text') {
    editor.openCategoryOf(type);
    await sleep(350);
    if (token !== running) return;
  }
  const src = editor.flyoutBlock(type);
  if (!src || !editor.showInFlyout(src)) {
    await pointAt(deps, 'toolbox', caption);
    return;
  }
  if (window.innerWidth < 1000) {
    root.querySelector('.mc-code')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await sleep(450);
    if (token !== running) return;
  }
  const host = root.querySelector<HTMLElement>('.mc-blockly');
  if ('slot' in target) {
    const owner = editor.blockById(target.slot.parent);
    if (owner) {
      editor.reveal(owner);
      await sleep(500);
      if (token !== running) return;
    }
  }
  const dest = ('slot' in target ? slotPoint(editor, target.slot) : null) ?? freeSpot(editor, host);
  const o = originOf(src);
  const run = begin(deps, token, '');
  const { layer, hand, setHand, alive } = run;

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

  const hx = window.innerWidth * 0.5;
  const hy = window.innerHeight + 60;
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
    if (alive()) {
      deps.sfx('tick');
      ghost.classList.add('dropped');
      setCaption(layer, caption);
      deps.say(caption);
      if ('hat' in target) {
        /* An empty mouth under the new hat says «something goes here». */
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.style.transform = `translate(${dest.x.toFixed(1)}px, ${(dest.y + o.r.height - 2).toFixed(1)}px)`;
        slot.style.width = `${Math.max(120, o.r.width * 0.9).toFixed(0)}px`;
        layer.appendChild(slot);
        await sleep(500);
        if (alive()) {
          const sx = dest.x + 56;
          const sy = dest.y + o.r.height + 22;
          await tween(700, (t) => { const e = ease(t); setHand(lerp(dest.x + dx, sx, e), lerp(dest.y + dy, sy, e) + Math.abs(Math.sin(t * Math.PI * 2)) * 10); }, alive);
          await sleep(1200);
        }
      } else {
        await sleep(1300);
      }
    }
  }
  ghost.classList.add('fade');
  await sleep(run.skipped() ? 0 : 350);
  finish(deps, token);
}

/** Moves the hand to the thing that starts the program and presses it, without pressing it for real. */
async function tryDemo(deps: DemoDeps, plan: Extract<DemoPlan, { kind: 'try' }>): Promise<void> {
  const root = deps.root;
  const token = ++running;
  clearLayer(root);
  const how = tryTarget(plan.hat, plan.spriteId);
  const caption = how.caption;
  const pick = (): HTMLElement | null => {
    if (how.target === 'sprite') return root.querySelector<HTMLElement>(`.mc-stage .spr[data-id="${plan.spriteId}"]`) ?? resolvePoint(root, 'stage');
    if (how.target === 'keys') return resolvePoint(root, 'keys') ?? resolvePoint(root, 'stage');
    return resolvePoint(root, how.target);
  };
  const el = pick();
  if (!el) return;
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  await sleep(300);
  if (token !== running) return;
  const run = begin(deps, token, caption);
  deps.say(caption);
  const rb = el.getBoundingClientRect();
  const tx = rb.left + rb.width / 2;
  const ty = rb.top + rb.height / 2;
  const hx = window.innerWidth * 0.5;
  const hy = window.innerHeight + 60;
  await tween(900, (t) => { const e = ease(t); run.setHand(lerp(hx, tx, e), lerp(hy, ty, e)); }, run.alive);
  if (run.alive()) {
    run.hand.classList.add('press');
    deps.sfx('pop');
    const ring = document.createElement('div');
    ring.className = 'ring';
    ring.style.left = `${tx}px`;
    ring.style.top = `${ty}px`;
    run.layer.appendChild(ring);
    await sleep(900);
    run.hand.classList.remove('press');
    await sleep(700);
  }
  finish(deps, token);
}

/** Plays a plan from `planDemo`. A new call replaces an animation still in flight. */
export async function runDemo(deps: DemoDeps, plan: DemoPlan): Promise<void> {
  const text = describePlan(plan);
  switch (plan.kind) {
    case 'add-sprite':
      return pointAt(deps, 'add-sprite', text);
    case 'select-sprite':
      return pointAt(deps, resolvePoint(deps.root, `[data-sprite="${plan.spriteId}"]`) ? `[data-sprite="${plan.spriteId}"]` : 'sprites', text);
    case 'hat':
      return dragDemo(deps, plan.hat.type, { hat: true }, text);
    case 'block':
      return dragDemo(deps, plan.block.type, { slot: plan.slot }, text);
    case 'try':
      return tryDemo(deps, plan);
  }
}

/** Cancels a demo in progress, for example when the studio closes. */
export function cancelDemo(root: HTMLElement): void {
  running++;
  clearLayer(root);
}
