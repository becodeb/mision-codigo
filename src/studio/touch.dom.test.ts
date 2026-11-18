// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lockPageGestures } from './touch.ts';

const ORIGINAL = 'width=device-width, initial-scale=1, viewport-fit=cover';

function fire(target: EventTarget, type: string, extra: Record<string, unknown> = {}): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(e, k, { value: v });
  target.dispatchEvent(e);
  return e;
}

describe('page gestures while the studio is open', () => {
  let root: HTMLElement;
  let outside: HTMLElement;
  beforeEach(() => {
    document.head.innerHTML = `<meta name="viewport" content="${ORIGINAL}">`;
    document.body.innerHTML = '<div class="mc-studio"><p>texto</p><input></div><div class="other"></div>';
    root = document.querySelector('.mc-studio')!;
    outside = document.querySelector('.other')!;
  });
  afterEach(() => {
    document.documentElement.className = '';
  });

  const viewport = () => document.querySelector('meta[name="viewport"]')!.getAttribute('content');

  it('turns off page zoom and puts everything back on close', () => {
    const unlock = lockPageGestures(root);
    expect(viewport()).toContain('user-scalable=no');
    expect(viewport()).toContain('maximum-scale=1');
    expect(document.documentElement.classList.contains('mc-touch-lock')).toBe(true);
    unlock();
    expect(viewport()).toBe(ORIGINAL);
    expect(document.documentElement.classList.contains('mc-touch-lock')).toBe(false);
  });

  it('stops two-finger moves and iOS pinch gestures, but not one finger', () => {
    const unlock = lockPageGestures(root);
    expect(fire(root, 'touchmove', { touches: [{}, {}] }).defaultPrevented).toBe(true);
    expect(fire(root, 'touchmove', { touches: [{}] }).defaultPrevented).toBe(false);
    expect(fire(document, 'gesturestart').defaultPrevented).toBe(true);
    unlock();
    expect(fire(root, 'touchmove', { touches: [{}, {}] }).defaultPrevented).toBe(false);
    expect(fire(document, 'gesturestart').defaultPrevented).toBe(false);
  });

  it('stops trackpad pinch zoom over the studio only', () => {
    const unlock = lockPageGestures(root);
    expect(fire(root.querySelector('p')!, 'wheel', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(fire(root.querySelector('p')!, 'wheel', { ctrlKey: false }).defaultPrevented).toBe(false);
    expect(fire(outside, 'wheel', { ctrlKey: true }).defaultPrevented).toBe(false);
    unlock();
  });

  it('stops the long-press menu of touch, not the right click of a mouse, nor in text fields', () => {
    const unlock = lockPageGestures(root);
    const p = root.querySelector('p')!;
    expect(fire(p, 'contextmenu', { pointerType: 'touch' }).defaultPrevented).toBe(true);
    expect(fire(p, 'contextmenu', { pointerType: 'mouse' }).defaultPrevented).toBe(false);
    expect(fire(root.querySelector('input')!, 'contextmenu', { pointerType: 'touch' }).defaultPrevented).toBe(false);
    expect(fire(outside, 'contextmenu', { pointerType: 'touch' }).defaultPrevented).toBe(false);
    unlock();
  });
});
