/**
 * Calm touch for the studio. Children use it on tablets and touch laptops, where two fingers, a resting palm or a
 * long press used to zoom the page, zoom the workspace, make dragged blocks jump or pop up Blockly's menus.
 *
 * - `installBlocklyTouchFixes` (once): Blockly sees one finger at a time (see `PointerGate`), a finger the browser
 *   cancels ends its drag where it was, a long press no longer opens the right-click menu, and a slightly shaky
 *   tap stays a tap.
 * - `lockPageGestures` (while the studio is open): no page pinch-zoom, double-tap zoom, rubber band or
 *   pull-to-refresh, and no long-press menus over the studio.
 */
import * as Blockly from 'blockly/core';
import { PointerGate } from './pointerGate.ts';

/** Blockly workspaces live in `.injectionDiv`; the flyout and the toolbox are inside it too. */
const EDITOR = '.injectionDiv';

function workspaces(): Blockly.WorkspaceSvg[] {
  return Blockly.common.getAllWorkspaces().filter((ws): ws is Blockly.WorkspaceSvg => ws instanceof Blockly.WorkspaceSvg);
}

/** Whether Blockly is moving something: a block, a workspace or a flyout. */
function blocklyDragging(): boolean {
  return workspaces().some((ws) => {
    try { return ws.isDragging(); } catch { return false; }
  });
}

/** Ends every gesture in progress. A block being dragged stays where the finger last had it. */
export function cancelBlocklyGestures(): void {
  for (const ws of workspaces()) {
    try { ws.cancelCurrentGesture(); } catch { /* a workspace being disposed has no gesture to end */ }
  }
}

const isTouchLike = (e: PointerEvent): boolean => e.pointerType !== 'mouse';

let longPressPatched = false;

/**
 * Blockly opens the context menu after a 750 ms press. With a finger, that is a child holding a block before
 * dragging it: the drag was lost and a menu with «Limpiar bloques» (which rearranges every block) or «Eliminar 12
 * bloques» appeared under the finger. A real right click (mouse, or a pen's barrel button) still opens it.
 */
export function ignoreTouchLongPress(): void {
  if (longPressPatched) return;
  longPressPatched = true;
  const proto = Blockly.Gesture.prototype as unknown as { handleRightClick(e: PointerEvent): void };
  const rightClick = proto.handleRightClick;
  proto.handleRightClick = function (this: Blockly.Gesture, e: PointerEvent): void {
    if (e.pointerType && e.pointerType !== 'mouse' && e.button !== 2) return;
    rightClick.call(this, e);
  };
}

let installed = false;

export function installBlocklyTouchFixes(): void {
  ignoreTouchLongPress();
  if (installed || typeof window === 'undefined') return;
  installed = true;

  /* Window capture runs before Blockly's listeners on the blocks, the workspace and the document. */
  const gate = new PointerGate();
  const apply = (e: PointerEvent, decision: { swallow: boolean; cancelGesture: boolean }): void => {
    if (decision.cancelGesture) cancelBlocklyGestures();
    if (decision.swallow) e.stopPropagation();
  };
  const opts = { capture: true, passive: true } as const;
  window.addEventListener('pointerdown', (e) => {
    const onEditor = isTouchLike(e) && e.target instanceof Element && e.target.closest(EDITOR) !== null;
    apply(e, gate.down(e.pointerId, onEditor, gate.activePointer !== null && blocklyDragging(), performance.now()));
  }, opts);
  window.addEventListener('pointermove', (e) => apply(e, gate.move(e.pointerId)), opts);
  window.addEventListener('pointerup', (e) => apply(e, gate.up(e.pointerId)), opts);
  window.addEventListener('pointercancel', (e) => apply(e, gate.cancel(e.pointerId)), opts);
  window.addEventListener('blur', () => gate.reset());

  /* A finger wobbles more than a mouse: a few pixels of wobble on a tap should not move the block. */
  if (window.matchMedia?.('(any-pointer: coarse)').matches) {
    Blockly.config.dragRadius = Math.max(Blockly.config.dragRadius, 10);
    Blockly.config.flyoutDragRadius = Math.max(Blockly.config.flyoutDragRadius, 14);
  }
}

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
const LOCK_CLASS = 'mc-touch-lock';

const isTextField = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

/**
 * Keeps the page still under the studio: no pinch or double-tap zoom (CSS `touch-action` plus the viewport tag
 * for Android and gesture events for iOS Safari), no page scroll with two fingers, no rubber band or
 * pull-to-refresh, no trackpad pinch zoom, no long-press menus. Returns a function that undoes it all.
 */
export function lockPageGestures(root: HTMLElement): () => void {
  const html = document.documentElement;
  html.classList.add(LOCK_CLASS);

  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const previous = meta?.getAttribute('content') ?? null;
  meta?.setAttribute('content', VIEWPORT_LOCKED);

  const offs: (() => void)[] = [];
  const on = <K extends keyof DocumentEventMap>(type: K, fn: (e: DocumentEventMap[K]) => void, options: AddEventListenerOptions): void => {
    document.addEventListener(type, fn as EventListener, options);
    offs.push(() => document.removeEventListener(type, fn as EventListener, options));
  };
  const stop = (e: Event): void => { if (e.cancelable) e.preventDefault(); };

  /* iOS Safari ignores `user-scalable=no`; its own gesture events are the way to stop the page zoom. */
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, stop, { passive: false });
    offs.push(() => document.removeEventListener(type, stop));
  }
  /* Two fingers never scroll or zoom the page. Blockly listens to pointer events, which this does not touch. */
  on('touchmove', (e) => { if (e.touches.length > 1) stop(e); }, { passive: false });
  /* A trackpad pinch arrives as ctrl + wheel and would zoom the whole page; inside the workspace Blockly takes it. */
  on('wheel', (e) => { if (e.ctrlKey && root.contains(e.target as Node)) stop(e); }, { passive: false });
  /* A long press shows the browser's menu (copy, search, save image) over the studio; a mouse right click still does. */
  on('contextmenu', (e) => {
    const pointer = (e as MouseEvent & { pointerType?: string }).pointerType;
    if (pointer && pointer !== 'mouse' && root.contains(e.target as Node) && !isTextField(e.target)) stop(e);
  }, { capture: true });

  return () => {
    offs.forEach((off) => off());
    html.classList.remove(LOCK_CLASS);
    if (meta && previous !== null) meta.setAttribute('content', previous);
  };
}
