/** Injectable time: the machine never reads a global clock or schedules frames on its own. */

export interface Clock {
  /** Milliseconds on a monotonic clock. */
  now(): number;
}

export interface FrameScheduler {
  /** Runs `cb` once on the next frame. Returns a function that cancels the request. */
  requestFrame(cb: () => void): () => void;
}

export type TimeSource = Clock & FrameScheduler;

/**
 * Deterministic virtual time for tests and headless proofs. `advance` moves the clock one whole
 * frame at a time, running the frame callbacks registered before each step.
 */
export class ManualTime implements TimeSource {
  private t = 0;
  private nextId = 1;
  private pending = new Map<number, () => void>();

  /** `frameMs` is the length of one virtual frame (20 ms = 50 frames per second). */
  readonly frameMs: number;

  constructor(frameMs = 20) {
    this.frameMs = frameMs;
  }

  now(): number {
    return this.t;
  }

  requestFrame(cb: () => void): () => void {
    const id = this.nextId++;
    this.pending.set(id, cb);
    return () => {
      this.pending.delete(id);
    };
  }

  /** Runs one frame: advances the clock by `frameMs`, then fires the requested callbacks. */
  step(): void {
    this.t += this.frameMs;
    const due = [...this.pending.values()];
    this.pending.clear();
    for (const cb of due) cb();
  }

  /** Runs `n` frames. */
  frames(n: number): void {
    for (let i = 0; i < n; i++) this.step();
  }

  /** Runs as many whole frames as fit in `ms` (rounded to the nearest frame). */
  advance(ms: number): void {
    this.frames(Math.round(ms / this.frameMs));
  }
}
