import * as Blockly from 'blockly/core';
import { describe, expect, it, vi } from 'vitest';
import { PointerGate, RESTING_MS } from './pointerGate.ts';
import { ignoreTouchLongPress } from './touch.ts';
import { ZOOM } from './workspace.ts';

const pass = { swallow: false, cancelGesture: false };
const swallow = { swallow: true, cancelGesture: false };
/** Clock values: the first finger lands at T; LATER is when it counts as resting. */
const T = 1000;
const LATER = T + RESTING_MS;

describe('pointer gate: one finger at a time for Blockly', () => {
  it('lets a single finger through from down to up', () => {
    const gate = new PointerGate();
    expect(gate.down(1, true, false, T)).toEqual(pass);
    expect(gate.activePointer).toBe(1);
    expect(gate.move(1)).toEqual(pass);
    expect(gate.up(1)).toEqual(pass);
    expect(gate.activePointer).toBeNull();
  });

  it('hides a second finger that lands while a block is being dragged, down to its up', () => {
    const gate = new PointerGate();
    gate.down(1, true, false, T);
    expect(gate.down(2, true, true, T)).toEqual(swallow);
    expect(gate.move(2)).toEqual(swallow);
    expect(gate.move(1)).toEqual(pass);
    expect(gate.up(2)).toEqual(swallow);
    expect(gate.move(1)).toEqual(pass);
    expect(gate.up(1)).toEqual(pass);
  });

  it('hides a second finger even outside the editor while a drag goes on', () => {
    const gate = new PointerGate();
    gate.down(1, true, false, T);
    expect(gate.down(2, false, true, T)).toEqual(swallow);
    expect(gate.up(2)).toEqual(swallow);
  });

  it('keeps the overruled finger hidden after the active one lifts', () => {
    const gate = new PointerGate();
    gate.down(1, true, false, T);
    gate.down(2, true, true, T);
    gate.up(1);
    expect(gate.move(2)).toEqual(swallow);
    expect(gate.up(2)).toEqual(swallow);
    expect(gate.move(2)).toEqual(pass);
  });

  it('hides moves of a finger that was already down outside the editor (a resting palm)', () => {
    const gate = new PointerGate();
    expect(gate.down(7, false, false, T)).toEqual(pass);
    expect(gate.activePointer).toBeNull();
    gate.down(1, true, false, T);
    expect(gate.move(7)).toEqual(swallow);
    expect(gate.up(7)).toEqual(swallow);
  });

  it('hides a second finger that lands just after the first, before its drag has started', () => {
    const gate = new PointerGate();
    gate.down(1, true, false, T);
    expect(gate.down(2, true, false, LATER - 1)).toEqual(swallow);
    expect(gate.activePointer).toBe(1);
    expect(gate.move(2)).toEqual(swallow);
    expect(gate.move(1)).toEqual(pass);
  });

  it('lets a new finger take over from a resting one, cancelling the old gesture', () => {
    const gate = new PointerGate();
    gate.down(1, true, false, T);
    expect(gate.down(2, true, false, LATER)).toEqual({ swallow: false, cancelGesture: true });
    expect(gate.activePointer).toBe(2);
    expect(gate.move(1)).toEqual(swallow);
    expect(gate.up(1)).toEqual(swallow);
    expect(gate.move(2)).toEqual(pass);
  });

  it('lets a tap outside the editor through when the finger on the editor is only resting', () => {
    const gate = new PointerGate();
    gate.down(1, true, false, T);
    expect(gate.down(2, false, false, LATER)).toEqual({ swallow: false, cancelGesture: true });
    expect(gate.activePointer).toBeNull();
    expect(gate.up(2)).toEqual(pass);
    expect(gate.move(1)).toEqual(swallow);
  });

  it('ends the gesture by hand when the browser cancels the active finger', () => {
    const gate = new PointerGate();
    gate.down(1, true, false, T);
    expect(gate.cancel(1)).toEqual({ swallow: false, cancelGesture: true });
    expect(gate.activePointer).toBeNull();
    expect(gate.down(3, true, false, T)).toEqual(pass);
    expect(gate.activePointer).toBe(3);
  });

  it('does not track pointers that land outside the editor', () => {
    const gate = new PointerGate();
    gate.down(1, false, false, T);
    expect(gate.activePointer).toBeNull();
    expect(gate.move(1)).toEqual(pass);
    expect(gate.cancel(1)).toEqual(pass);
  });

  it('forgets everything on reset', () => {
    const gate = new PointerGate();
    gate.down(1, true, false, T);
    gate.down(2, true, true, T);
    gate.reset();
    expect(gate.activePointer).toBeNull();
    expect(gate.move(2)).toEqual(pass);
  });
});

describe('long press on touch', () => {
  const fakeGesture = () => ({
    targetBlock: null,
    startBubble: null,
    startComment: null,
    startWorkspace_: null,
    flyout: null,
    dispose: vi.fn(),
  });
  const press = (pointerType: string, button = 0) => ({ pointerType, button, preventDefault: vi.fn(), stopPropagation: vi.fn() });

  it('does not open the context menu or end the gesture', () => {
    ignoreTouchLongPress();
    const g = fakeGesture();
    Blockly.Gesture.prototype.handleRightClick.call(g as unknown as Blockly.Gesture, press('touch') as unknown as PointerEvent);
    Blockly.Gesture.prototype.handleRightClick.call(g as unknown as Blockly.Gesture, press('pen') as unknown as PointerEvent);
    expect(g.dispose).not.toHaveBeenCalled();
  });

  it('keeps the right click of a mouse and of a pen button', () => {
    ignoreTouchLongPress();
    ignoreTouchLongPress();
    const g = fakeGesture();
    Blockly.Gesture.prototype.handleRightClick.call(g as unknown as Blockly.Gesture, press('mouse', 2) as unknown as PointerEvent);
    Blockly.Gesture.prototype.handleRightClick.call(g as unknown as Blockly.Gesture, press('pen', 2) as unknown as PointerEvent);
    expect(g.dispose).toHaveBeenCalledTimes(2);
  });
});

describe('workspace zoom', () => {
  it('never pinch- or wheel-zooms, so the blocks keep their size', () => {
    expect(ZOOM(0.8)).toEqual({ controls: false, wheel: false, pinch: false, startScale: 0.8 });
  });
});
