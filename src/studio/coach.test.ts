import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showcaseFor } from '../games/showcase/index.ts';
import type { ProjectProgram } from '../language/ir.ts';
import { BUBBLE_MS, Coach, IDLE_MS, type BubbleKind } from './coach.ts';
import { controlsOf } from './controls.ts';

/** A coach over a program, with what the host would be told. */
function rig(level: 1 | 2 | 3 | 4 | 5, program: ProjectProgram = showcaseFor(level).setup) {
  const log = { changed: 0, said: [] as [BubbleKind, string][], hidden: false, held: false, dead: false, program };
  const coach = new Coach({
    controls: () => controlsOf(log.program),
    hidden: () => log.hidden,
    held: () => log.held,
    dead: () => log.dead,
    changed: () => { log.changed++; },
    say: (kind, why) => { log.said.push([kind, why]); },
  });
  return { coach, log };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('keys games (levels 3 to 5)', () => {
  it('shows the keys hint from the flag until the first key the game uses', () => {
    const { coach } = rig(3);
    expect(coach.view()).toMatchObject({ playing: false, keys: false, tap: false });
    coach.start();
    expect(coach.view()).toMatchObject({ playing: true, keys: true, tap: false });
    coach.key('ArrowLeft');
    expect(coach.view().keys).toBe(false);
  });

  it('brings the hint back after 8 seconds without a key, and says it, but never at the start', () => {
    const { coach, log } = rig(4);
    coach.start();
    expect(log.said).toEqual([]);
    coach.key('ArrowUp');
    vi.advanceTimersByTime(IDLE_MS - 1);
    expect(coach.view().keys).toBe(false);
    vi.advanceTimersByTime(1);
    expect(coach.view().keys).toBe(true);
    expect(log.said).toEqual([['keys', 'idle']]);
  });

  it('a key pressed while playing resets the quiet time', () => {
    const { coach } = rig(3);
    coach.start();
    coach.key('ArrowRight');
    vi.advanceTimersByTime(IDLE_MS - 100);
    coach.key('ArrowRight');
    vi.advanceTimersByTime(IDLE_MS - 100);
    expect(coach.view().keys).toBe(false);
    vi.advanceTimersByTime(100);
    expect(coach.view().keys).toBe(true);
  });

  it('clicking a character or the empty stage answers with the keys, for a while', () => {
    const { coach, log } = rig(3);
    coach.start();
    coach.key('ArrowDown');
    coach.miss('nova');
    expect(coach.view()).toMatchObject({ keys: true, bubble: { kind: 'keys' } });
    expect(log.said).toEqual([['keys', 'miss']]);
    vi.advanceTimersByTime(BUBBLE_MS);
    expect(coach.view().bubble).toBeNull();
    expect(coach.view().keys).toBe(true);
    coach.miss(null);
    expect(coach.view().bubble?.kind).toBe('keys');
  });

  it('a new bubble gets a new number so the screen plays it again', () => {
    const { coach } = rig(3);
    coach.start();
    coach.miss(null);
    const first = coach.view().bubble!.n;
    coach.miss(null);
    expect(coach.view().bubble!.n).toBe(first + 1);
  });

  it('the wrong attempts do nothing while stopped: dragging to place is fine in the editor', () => {
    const { coach } = rig(3);
    coach.miss('nova');
    coach.miss(null);
    expect(coach.view().bubble).toBeNull();
  });

  it('before «Empezar», a key that only works once the game runs answers with the green button', () => {
    const { coach, log } = rig(4);
    coach.key('ArrowLeft');
    expect(coach.view()).toMatchObject({ playing: false, flag: true, bubble: { kind: 'flag' } });
    expect(log.said).toEqual([['flag', 'miss']]);
    vi.advanceTimersByTime(BUBBLE_MS);
    expect(coach.view().flag).toBe(false);
  });

  it('a key that works any time (a key hat) says nothing while stopped', () => {
    const { coach } = rig(3);
    coach.key('ArrowLeft');
    expect(coach.view().bubble).toBeNull();
  });

  it('nothing before «Empezar» after the game ended, and «Parar» brings the answer back', () => {
    const { coach } = rig(4);
    coach.start();
    coach.end();
    coach.key('ArrowLeft');
    expect(coach.view().bubble).toBeNull();
    expect(coach.view().playing).toBe(false);
    coach.stop();
    coach.key('ArrowLeft');
    expect(coach.view().bubble?.kind).toBe('flag');
  });

  it('keys typed in the editor are ignored while a modal covers the stage', () => {
    const { coach, log } = rig(4);
    log.hidden = true;
    coach.key('ArrowLeft');
    log.hidden = false;
    expect(coach.view().bubble).toBeNull();
  });
});

describe('click games (levels 1 and 2)', () => {
  it('shows the hand from the flag until the main character is clicked', () => {
    const { coach } = rig(1);
    coach.start();
    expect(coach.view()).toMatchObject({ keys: false, tap: true });
    expect(coach.click('toby')).toBe(true);
    expect(coach.view().tap).toBe(true);
    expect(coach.click('estrella')).toBe(true);
    expect(coach.view().tap).toBe(false);
  });

  it('comes back after 8 quiet seconds, and says it', () => {
    const { coach, log } = rig(2);
    coach.start();
    coach.click('boo');
    vi.advanceTimersByTime(IDLE_MS);
    expect(coach.view().tap).toBe(true);
    expect(log.said).toEqual([['tap', 'idle']]);
  });

  it('a click on a clone answers to its original', () => {
    const { coach } = rig(2);
    coach.start();
    expect(coach.click('boo#3')).toBe(true);
    expect(coach.view().tap).toBe(false);
  });

  it('pressing an arrow or the space bar answers with the click, and brings the hand', () => {
    const { coach, log } = rig(1);
    coach.start();
    coach.click('estrella');
    coach.key('ArrowRight');
    expect(coach.view()).toMatchObject({ tap: true, bubble: { kind: 'tap' } });
    expect(log.said).toEqual([['tap', 'miss']]);
    coach.click('estrella');
    coach.key(' ');
    expect(coach.view().bubble?.kind).toBe('tap');
  });

  it('two wrong clicks in a row bring the hand back without a bubble; a good click starts over', () => {
    const { coach, log } = rig(1);
    coach.start();
    coach.click('estrella');
    coach.miss(null);
    expect(coach.view().tap).toBe(false);
    coach.click('toby');
    coach.miss('nube');
    expect(coach.view().tap).toBe(false);
    coach.miss(null);
    expect(coach.view()).toMatchObject({ tap: true, bubble: null });
    expect(log.said).toEqual([]);
  });

  it('a click on a character with a click script is never wrong', () => {
    const { coach } = rig(1);
    coach.start();
    coach.miss('toby');
    coach.miss('michi');
    expect(coach.view().bubble).toBeNull();
  });
});

describe('what covers the stage', () => {
  it('keeps quiet while a modal, a question or a stopped tutorial is open, and the hint is there when it is gone', () => {
    const { coach, log } = rig(1);
    coach.start();
    log.hidden = true;
    expect(coach.view()).toMatchObject({ tap: false, bubble: null });
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(log.said).toEqual([]);
    log.hidden = false;
    expect(coach.view().tap).toBe(true);
  });

  it('stops everything when the game stops or ends, and clears its timers', () => {
    const { coach, log } = rig(3);
    coach.start();
    coach.key('ArrowUp');
    coach.stop();
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(coach.view()).toMatchObject({ playing: false, keys: false });
    expect(log.said).toEqual([]);
    coach.start();
    coach.end();
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(coach.view().keys).toBe(false);
    coach.start();
    coach.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('follows the program the child edits: a game with nothing to press shows nothing', () => {
    const empty = { ...showcaseFor(3).setup, sprites: showcaseFor(3).setup.sprites.map((s) => ({ ...s, scripts: [] })) };
    const { coach } = rig(3, empty);
    coach.start();
    expect(coach.view()).toMatchObject({ keys: false, tap: false });
    vi.advanceTimersByTime(IDLE_MS);
    expect(coach.view()).toMatchObject({ keys: false, tap: false });
  });

  it('does not come back while a key is held', () => {
    const { coach, log } = rig(4);
    coach.start();
    coach.key('ArrowRight');
    log.held = true;
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(coach.view().keys).toBe(false);
    log.held = false;
    vi.advanceTimersByTime(IDLE_MS);
    expect(coach.view().keys).toBe(true);
  });

  it('points at «Empezar» when the game is over and nothing is left to click', () => {
    const { coach, log } = rig(2);
    coach.start();
    coach.click('boo');
    log.dead = true;
    vi.advanceTimersByTime(IDLE_MS);
    expect(coach.view()).toMatchObject({ tap: false, flag: true, bubble: { kind: 'again' } });
    vi.advanceTimersByTime(BUBBLE_MS);
    expect(coach.view().flag).toBe(false);
    vi.advanceTimersByTime(IDLE_MS - BUBBLE_MS);
    expect(coach.view().flag).toBe(true);
  });
});
