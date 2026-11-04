import { describe, expect, it } from 'vitest';
import type { GameProgress, ProjectResponse, SaveProjectRequest } from '../shared/api.ts';
import {
  KEEPALIVE_LIMIT_BYTES,
  createAutosave,
  createAutosaveRegistry,
  loadProject,
  localKey,
  readLocal,
} from './autosave.ts';
import type { KeyValueStore, SaveFn } from './autosave.ts';

const progress = (activeSeconds = 0, finished = false): GameProgress => ({
  currentStep: null,
  completedSteps: [],
  activeSeconds,
  finished,
});

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

/** A clock and a timer queue the test drives by hand. */
function fakeClock(start = Date.parse('2026-11-04T19:00:00Z')) {
  let time = start;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => time,
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { at: time + ms, fn });
      return id;
    },
    clearTimer: (id: unknown) => {
      timers.delete(id as number);
    },
    pending: () => timers.size,
    /** Moves time forward, firing due timers in order. */
    async advance(ms: number) {
      const target = time + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        time = Math.max(time, due[1].at);
        due[1].fn();
        await settle();
      }
      time = target;
    },
  };
}

/** Lets promise callbacks run. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

class FakeApi {
  calls: { gameId: string; body: SaveProjectRequest }[] = [];
  failWith: unknown = null;
  /** When set, requests wait until `release()` is called. */
  hold = false;
  private waiting: (() => void)[] = [];
  save: SaveFn = async (gameId, body) => {
    this.calls.push({ gameId, body });
    if (this.hold) await new Promise<void>((resolve) => this.waiting.push(resolve));
    if (this.failWith) throw this.failWith;
    return { gameId, updatedAt: new Date().toISOString() };
  };
  release() {
    this.waiting.splice(0).forEach((resolve) => resolve());
  }
}

const httpError = (status: number) => Object.assign(new Error('http'), { status });

function setup(overrides: { keepalive?: (gameId: string, body: string) => void } = {}) {
  const clock = fakeClock();
  const api = new FakeApi();
  const storage = new MemoryStore();
  const key = localKey(7, 'tesoro');
  const autosave = createAutosave({
    gameId: 'tesoro',
    key,
    save: api.save,
    storage,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    ...overrides,
  });
  return { clock, api, storage, key, autosave };
}

describe('autosave', () => {
  it('writes the local copy immediately and the server a second after the last change', async () => {
    const { clock, api, storage, key, autosave } = setup();
    autosave.update({ v: 1 }, progress(1));
    expect(readLocal(storage, key)?.copy.project).toEqual({ v: 1 });
    expect(api.calls).toHaveLength(0);

    await clock.advance(600);
    autosave.update({ v: 2 }, progress(2)); // resets the debounce
    await clock.advance(600);
    expect(api.calls).toHaveLength(0);

    await clock.advance(500);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0].body.project).toEqual({ v: 2 });
    expect(autosave.status()).toBe('saved');
    expect(autosave.hasPending()).toBe(false);
    expect(readLocal(storage, key)?.synced).toBe(true);
  });

  it('still sends while the child keeps working without a pause', async () => {
    const { clock, api, autosave } = setup();
    for (let i = 0; i < 12; i++) {
      autosave.update({ v: i }, progress(i));
      await clock.advance(500);
    }
    expect(api.calls.length).toBeGreaterThanOrEqual(1);
    expect(api.calls[0].body.project).toEqual({ v: 9 });
  });

  it('keeps the local copy, reports offline and retries until the server answers', async () => {
    const { clock, api, storage, key, autosave } = setup();
    const seen: string[] = [];
    autosave.subscribe((s) => seen.push(s));
    api.failWith = httpError(503);

    autosave.update({ v: 1 }, progress(1));
    await clock.advance(1000);
    expect(autosave.status()).toBe('offline');
    expect(autosave.hasPending()).toBe(true);
    expect(readLocal(storage, key)?.synced).toBe(false);

    // Work continues offline: no extra requests, the local copy follows.
    autosave.update({ v: 2 }, progress(2));
    await clock.advance(2000);
    expect(api.calls).toHaveLength(1);
    expect(readLocal(storage, key)?.copy.project).toEqual({ v: 2 });

    await clock.advance(10_000);
    expect(api.calls).toHaveLength(2); // retry, still failing
    expect(autosave.status()).toBe('offline');

    api.failWith = null;
    await clock.advance(10_000);
    expect(api.calls).toHaveLength(3);
    expect(api.calls[2].body.project).toEqual({ v: 2 }); // the newest copy, not the first one
    expect(autosave.status()).toBe('saved');
    expect(readLocal(storage, key)?.synced).toBe(true);
    expect(seen).toContain('offline');
    expect(seen.at(-1)).toBe('saved');
    expect(clock.pending()).toBe(0);
  });

  it('treats an unreachable server (status 0) and rate limits as offline, other 4xx as rejected', async () => {
    for (const [status, expected] of [
      [0, 'offline'],
      [429, 'offline'],
      [413, 'rejected'],
      [401, 'signedout'],
    ] as const) {
      const { clock, api, autosave } = setup();
      api.failWith = httpError(status);
      autosave.update({}, progress());
      await clock.advance(1000);
      expect(autosave.status()).toBe(expected);
      // Only offline schedules retries.
      expect(clock.pending()).toBe(expected === 'offline' ? 1 : 0);
    }
  });

  it('sends changes made while a request is in flight', async () => {
    const { clock, api, autosave } = setup();
    api.hold = true;
    autosave.update({ v: 1 }, progress(1));
    await clock.advance(1000);
    expect(api.calls).toHaveLength(1);

    autosave.update({ v: 2 }, progress(2));
    api.hold = false;
    api.release();
    await settle();
    await clock.advance(1000);

    expect(api.calls.map((c) => c.body.project)).toEqual([{ v: 1 }, { v: 2 }]);
    expect(autosave.hasPending()).toBe(false);
    expect(autosave.status()).toBe('saved');
  });

  it('never runs two requests at once', async () => {
    const { clock, api, autosave } = setup();
    api.hold = true;
    autosave.update({ v: 1 }, progress());
    await clock.advance(1000);
    const flushing = autosave.flush();
    autosave.update({ v: 2 }, progress());
    void autosave.flush();
    expect(api.calls).toHaveLength(1);
    api.hold = false;
    api.release();
    await flushing;
    await settle();
    expect(api.calls.map((c) => c.body.project)).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it('flush sends immediately without waiting for the debounce', async () => {
    const { api, autosave } = setup();
    autosave.update({ v: 1 }, progress());
    await autosave.flush();
    expect(api.calls).toHaveLength(1);
    expect(autosave.hasPending()).toBe(false);
  });

  it('sends a small unsent copy with keepalive when the page is hidden', () => {
    const sent: { gameId: string; body: string }[] = [];
    const { autosave } = setup({ keepalive: (gameId, body) => sent.push({ gameId, body }) });
    autosave.flushOnHide(); // nothing to send yet
    autosave.update({ v: 1 }, progress(3));
    autosave.flushOnHide();
    expect(sent).toHaveLength(1);
    expect(sent[0].gameId).toBe('tesoro');
    expect(JSON.parse(sent[0].body)).toEqual({ project: { v: 1 }, progress: progress(3) });
  });

  it('skips keepalive when the body is too large, and when nothing is pending', async () => {
    const sent: string[] = [];
    const { autosave } = setup({ keepalive: (_id, body) => sent.push(body) });
    autosave.update({ big: 'x'.repeat(KEEPALIVE_LIMIT_BYTES) }, progress());
    autosave.flushOnHide();
    expect(sent).toHaveLength(0);

    autosave.update({ v: 1 }, progress());
    await autosave.flush();
    autosave.flushOnHide();
    expect(sent).toHaveLength(0);
  });

  it('survives a storage that throws', async () => {
    const clock = fakeClock();
    const api = new FakeApi();
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const autosave = createAutosave({
      gameId: 'g',
      key: 'k',
      save: api.save,
      storage: broken,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    autosave.update({ v: 1 }, progress());
    await clock.advance(1000);
    expect(api.calls).toHaveLength(1);
    expect(autosave.status()).toBe('saved');
  });

  it('stops everything after dispose', async () => {
    const { clock, api, autosave } = setup();
    autosave.update({ v: 1 }, progress());
    autosave.dispose();
    await clock.advance(5000);
    expect(api.calls).toHaveLength(0);
    autosave.update({ v: 2 }, progress());
    expect(clock.pending()).toBe(0);
  });
});

describe('loadProject', () => {
  const key = localKey(1, 'tesoro');
  const server = (updatedAt: string, value = 'server'): ProjectResponse => ({
    gameId: 'tesoro',
    project: { value },
    progress: progress(10),
    updatedAt,
  });
  const writeCopy = (storage: MemoryStore, savedAt: string, synced: boolean) => {
    storage.setItem(key, JSON.stringify({ project: { value: 'local' }, progress: progress(20), savedAt }));
    if (synced) storage.setItem(`${key}:synced`, savedAt);
  };

  it('returns null for a new project', async () => {
    const result = await loadProject({ fetchServer: async () => null, storage: new MemoryStore(), key });
    expect(result).toBeNull();
  });

  it('uses the server when there is no local copy', async () => {
    const result = await loadProject({
      fetchServer: async () => server('2026-11-04T19:00:00.000Z'),
      storage: new MemoryStore(),
      key,
    });
    expect(result).toMatchObject({ source: 'server', needsUpload: false, project: { value: 'server' } });
  });

  it('prefers a newer unsent local copy and asks to upload it', async () => {
    const storage = new MemoryStore();
    writeCopy(storage, '2026-11-04T19:05:00.000Z', false);
    const result = await loadProject({ fetchServer: async () => server('2026-11-04T19:00:00.000Z'), storage, key });
    expect(result).toMatchObject({ source: 'local', needsUpload: true, project: { value: 'local' } });
  });

  it('prefers the server when it is newer than the unsent local copy', async () => {
    const storage = new MemoryStore();
    writeCopy(storage, '2026-11-04T19:00:00.000Z', false);
    const result = await loadProject({ fetchServer: async () => server('2026-11-04T19:30:00.000Z'), storage, key });
    expect(result).toMatchObject({ source: 'server', project: { value: 'server' } });
  });

  it('never prefers a local copy the server already holds', async () => {
    const storage = new MemoryStore();
    writeCopy(storage, '2026-11-04T19:59:00.000Z', true);
    const result = await loadProject({ fetchServer: async () => server('2026-11-04T19:00:00.000Z'), storage, key });
    expect(result).toMatchObject({ source: 'server' });
  });

  it('uses an unsent local copy when the server has no project yet', async () => {
    const storage = new MemoryStore();
    writeCopy(storage, '2026-11-04T19:00:00.000Z', false);
    const result = await loadProject({ fetchServer: async () => null, storage, key });
    expect(result).toMatchObject({ source: 'local', needsUpload: true });
  });

  it('falls back to the local copy when the server is unreachable', async () => {
    const storage = new MemoryStore();
    writeCopy(storage, '2026-11-04T19:00:00.000Z', true);
    const result = await loadProject({
      fetchServer: async () => {
        throw httpError(0);
      },
      storage,
      key,
    });
    expect(result).toMatchObject({ source: 'local', needsUpload: false, project: { value: 'local' } });
  });

  it('refuses to start empty when the server is unreachable and nothing is stored', async () => {
    await expect(
      loadProject({
        fetchServer: async () => {
          throw httpError(0);
        },
        storage: new MemoryStore(),
        key,
      }),
    ).rejects.toMatchObject({ status: 0 });
  });

  it('does not hide an expired session behind the local copy', async () => {
    const storage = new MemoryStore();
    writeCopy(storage, '2026-11-04T19:00:00.000Z', false);
    await expect(
      loadProject({
        fetchServer: async () => {
          throw httpError(401);
        },
        storage,
        key,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('ignores a corrupted local copy', async () => {
    const storage = new MemoryStore();
    storage.setItem(key, '{not json');
    const result = await loadProject({ fetchServer: async () => null, storage, key });
    expect(result).toBeNull();
  });
});

describe('autosave registry', () => {
  it('keeps one controller per game and flushes them together', async () => {
    const clock = fakeClock();
    const api = new FakeApi();
    const registry = createAutosaveRegistry((gameId) =>
      createAutosave({
        gameId,
        key: localKey(1, gameId),
        save: api.save,
        storage: new MemoryStore(),
        now: clock.now,
        setTimer: clock.setTimer,
        clearTimer: clock.clearTimer,
      }),
    );
    expect(registry.get('a')).toBe(registry.get('a'));
    registry.get('a').update({ n: 1 }, progress());
    registry.get('b').update({ n: 2 }, progress());
    expect(registry.hasPending()).toBe(true);
    await registry.flushAll();
    expect(api.calls.map((c) => c.gameId).sort()).toEqual(['a', 'b']);
    expect(registry.hasPending()).toBe(false);
    registry.disposeAll();
  });
});
