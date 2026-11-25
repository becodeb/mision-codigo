// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showcaseFor } from '../games/showcase/index.ts';
import { IDLE_MS } from './coach.ts';
import { StudioSession } from './session.ts';

const make = (level: 1 | 3) => new StudioSession({ game: showcaseFor(level), level, initial: null, onSave: () => undefined });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('the coach inside a session', () => {
  it('reads the controls of the child\'s program, and follows it when it changes', () => {
    const s = make(3);
    expect(s.controls.movers).toEqual(['nova']);
    expect(s.controls).toBe(s.controls);
    s.doc.sprites.find((x) => x.id === 'nova')!.code = null;
    s.program = { ...s.program, sprites: s.program.sprites.map((x) => (x.id === 'nova' ? { ...x, scripts: [] } : x)) };
    expect(s.controls.movers).toEqual([]);
  });

  it('keeps quiet under a modal or the entry screen and comes back when it closes', () => {
    const s = make(1);
    s.coach.start();
    expect(s.coach.view().tap).toBe(true);
    s.setModal(true);
    expect(s.coach.view()).toMatchObject({ tap: false, bubble: null });
    s.setModal(false);
    expect(s.coach.view().tap).toBe(true);
  });

  it('answers a key typed before «Empezar» only when the game listens to it after the flag', () => {
    const arrows = make(3);
    arrows.coach.key('ArrowLeft');
    expect(arrows.coach.view().bubble).toBeNull();
    const flag = make(3);
    flag.program = { ...flag.program, sprites: flag.program.sprites.map((x) => (x.id === 'nova' ? { ...x, scripts: [{ hat: { type: 'a_flag', fields: {}, inputs: {}, body: [], elseBody: [] }, body: [{ type: 'a_arrows', fields: {}, inputs: {}, body: [], elseBody: [] }] }] } : x)) } as typeof flag.program;
    flag.coach.key('ArrowLeft');
    expect(flag.coach.view()).toMatchObject({ flag: true, bubble: { kind: 'flag' } });
  });

  it('stops its timers with the session', () => {
    const s = make(1);
    s.coach.start();
    s.coach.dispose();
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
