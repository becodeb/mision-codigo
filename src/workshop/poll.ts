// A quiet background poller: one request at a time, paused while the page is hidden,
// slowing down when the server cannot be reached. It never reports errors; callers decide
// what a failure means. No DOM here, so it is unit tested with fake timers.

export interface PollerOptions {
  intervalMs?: number;
  /** Longest wait between attempts after repeated failures. */
  maxDelayMs?: number;
  /** A `poke` closer than this to the last run is ignored (focus and visibility often fire together). */
  minGapMs?: number;
  isVisible?: () => boolean;
  now?: () => number;
}

export interface Poller {
  start: () => void;
  stop: () => void;
  /** Run now instead of waiting for the next tick. A no-op when stopped, hidden or already running. */
  poke: () => void;
}

export const POLL_INTERVAL_MS = 10_000;

export function createPoller(task: () => Promise<unknown>, options: PollerOptions = {}): Poller {
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  const maxDelayMs = options.maxDelayMs ?? 60_000;
  const minGapMs = options.minGapMs ?? 2_000;
  const isVisible = options.isVisible ?? (() => true);
  const now = options.now ?? Date.now;

  let running = false;
  let inflight = false;
  let failures = 0;
  let lastRun = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const delay = () => Math.min(intervalMs * 2 ** failures, maxDelayMs);

  function schedule(wait: number) {
    clearTimeout(timer);
    timer = running ? setTimeout(tick, wait) : undefined;
  }

  function tick() {
    timer = undefined;
    if (!running) return;
    // While hidden nothing is requested; the visibility event pokes when the page comes back.
    if (!isVisible()) return schedule(intervalMs);
    run();
  }

  function run() {
    if (inflight) return;
    inflight = true;
    lastRun = now();
    let outcome: Promise<unknown>;
    try {
      outcome = Promise.resolve(task());
    } catch (error) {
      outcome = Promise.reject(error);
    }
    outcome.then(
      () => {
        failures = 0;
      },
      () => {
        failures += 1;
      },
    ).finally(() => {
      inflight = false;
      schedule(delay());
    });
  }

  return {
    start() {
      if (running) return;
      running = true;
      failures = 0;
      schedule(intervalMs);
    },
    stop() {
      running = false;
      clearTimeout(timer);
      timer = undefined;
    },
    poke() {
      if (!running || inflight || !isVisible() || now() - lastRun < minGapMs) return;
      clearTimeout(timer);
      run();
    },
  };
}
