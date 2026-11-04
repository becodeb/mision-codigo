export interface LoginLimiter {
  /** Seconds until the key may try again, or 0 when it is not blocked. */
  blockedFor(key: string): number;
  recordFailure(key: string): void;
  reset(key: string): void;
}

export function createLoginLimiter(options: {
  maxFailures?: number;
  windowMs?: number;
  now?: () => number;
}): LoginLimiter {
  const maxFailures = options.maxFailures ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const now = options.now ?? Date.now;
  const failures = new Map<string, number[]>();

  function recent(key: string): number[] {
    const cutoff = now() - windowMs;
    const list = (failures.get(key) ?? []).filter((at) => at > cutoff);
    if (list.length === 0) failures.delete(key);
    else failures.set(key, list);
    return list;
  }

  return {
    blockedFor(key) {
      const list = recent(key);
      if (list.length < maxFailures) return 0;
      return Math.max(1, Math.ceil((list[0] + windowMs - now()) / 1000));
    },
    recordFailure(key) {
      if (failures.size > 5000) {
        for (const other of [...failures.keys()]) recent(other);
      }
      const list = recent(key);
      list.push(now());
      failures.set(key, list);
    },
    reset(key) {
      failures.delete(key);
    },
  };
}
