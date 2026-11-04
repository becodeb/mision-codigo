import { describe, expect, it } from 'vitest';
import { ManualTime } from './time.ts';

describe('ManualTime', () => {
  it('moves the clock one whole frame per step', () => {
    const t = new ManualTime(20);
    t.step();
    t.step();
    expect(t.now()).toBe(40);
  });

  it('advance rounds to whole frames', () => {
    const t = new ManualTime(20);
    t.advance(1000);
    expect(t.now()).toBe(1000);
    t.advance(30);
    expect(t.now()).toBe(1040);
  });

  it('runs a requested frame once, with the clock already advanced', () => {
    const t = new ManualTime(20);
    const seen: number[] = [];
    t.requestFrame(() => seen.push(t.now()));
    t.frames(3);
    expect(seen).toEqual([20]);
  });

  it('keeps a frame loop alive by re-requesting', () => {
    const t = new ManualTime(10);
    let n = 0;
    const loop = () => { n++; t.requestFrame(loop); };
    t.requestFrame(loop);
    t.frames(7);
    expect(n).toBe(7);
  });

  it('cancels a request', () => {
    const t = new ManualTime(20);
    let n = 0;
    const cancel = t.requestFrame(() => n++);
    cancel();
    t.frames(2);
    expect(n).toBe(0);
  });
});
