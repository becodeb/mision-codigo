import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPoller } from './poll.ts';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const ok = () => Promise.resolve();

describe('createPoller', () => {
  it('runs about every interval and not before', async () => {
    const task = vi.fn(ok);
    const poller = createPoller(task, { intervalMs: 10_000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(task).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('stops for good: no more runs after stop', async () => {
    const task = vi.fn(ok);
    const poller = createPoller(task, { intervalMs: 1_000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(1_000);
    poller.stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(task).toHaveBeenCalledTimes(1);
    poller.poke();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('does not schedule again when stopped while a request is in flight', async () => {
    let finish: () => void = () => undefined;
    const task = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const poller = createPoller(task, { intervalMs: 1_000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(1_000);
    poller.stop();
    finish();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('never overlaps requests', async () => {
    let finish: () => void = () => undefined;
    const task = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const poller = createPoller(task, { intervalMs: 1_000, minGapMs: 0 });
    poller.start();
    await vi.advanceTimersByTimeAsync(1_000);
    poller.poke();
    poller.poke();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(task).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(task).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('pokes run at once, but not twice in a burst', async () => {
    const task = vi.fn(ok);
    const poller = createPoller(task, { intervalMs: 10_000, minGapMs: 2_000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(5_000);
    poller.poke();
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);
    poller.poke();
    await vi.advanceTimersByTimeAsync(500);
    expect(task).toHaveBeenCalledTimes(1);
    // The next regular run counts from the poke, not from the start.
    await vi.advanceTimersByTimeAsync(9_500);
    expect(task).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('asks for nothing while the page is hidden and resumes when it is visible again', async () => {
    let visible = false;
    const task = vi.fn(ok);
    const poller = createPoller(task, { intervalMs: 1_000, minGapMs: 0, isVisible: () => visible });
    poller.start();
    await vi.advanceTimersByTimeAsync(10_000);
    poller.poke();
    expect(task).not.toHaveBeenCalled();
    visible = true;
    poller.poke();
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('keeps going after errors, slows down, and recovers the normal pace', async () => {
    let fail = true;
    const task = vi.fn(() => (fail ? Promise.reject(new Error('offline')) : Promise.resolve()));
    const poller = createPoller(task, { intervalMs: 10_000, maxDelayMs: 40_000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(task).toHaveBeenCalledTimes(1);
    // One failure: next try after 20 s, not 10.
    await vi.advanceTimersByTimeAsync(19_999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    // Two failures: 40 s, and never more than the cap.
    await vi.advanceTimersByTimeAsync(40_000);
    expect(task).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(task).toHaveBeenCalledTimes(4);
    fail = false;
    await vi.advanceTimersByTimeAsync(40_000);
    expect(task).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(task).toHaveBeenCalledTimes(6);
    poller.stop();
  });

  it('survives a task that throws synchronously', async () => {
    const task = vi.fn(() => {
      throw new Error('boom');
    });
    const poller = createPoller(task as unknown as () => Promise<unknown>, { intervalMs: 1_000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(task).toHaveBeenCalledTimes(2);
    poller.stop();
  });
});
