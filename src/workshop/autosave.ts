// Autosave with an offline fallback. Pure logic: the network, the storage and the clock are injected,
// so it is tested with fakes (see autosave.test.ts).
//
// Rules:
// - Every change is written to the local copy first, so a server failure never loses work.
// - The server copy is updated a second after the last change (and at least every few seconds while
//   the child keeps working).
// - After a failure the newest copy is retried periodically until it goes through.
import type { GameProgress, ProjectResponse, SaveProjectRequest, SaveProjectResponse } from '../shared/api.ts';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'rejected' | 'signedout';

export type SaveFn = (gameId: string, body: SaveProjectRequest) => Promise<SaveProjectResponse>;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What the browser keeps for one student and game. */
export interface LocalCopy {
  project: unknown;
  progress: GameProgress;
  /** ISO time of the last change, from the injected clock. Strictly increasing per controller. */
  savedAt: string;
}

export const DEBOUNCE_MS = 1000;
export const MAX_WAIT_MS = 5000;
export const RETRY_MS = 10_000;
/** Browsers cap keepalive request bodies at 64 KiB; stay under it. */
export const KEEPALIVE_LIMIT_BYTES = 60_000;

export function localKey(studentId: number, gameId: string): string {
  return `mc:project:${studentId}:${gameId}`;
}
const syncKey = (key: string): string => `${key}:synced`;

function safely<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function isProgress(value: unknown): value is GameProgress {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return Array.isArray(p.completedSteps) && typeof p.activeSeconds === 'number' && typeof p.finished === 'boolean';
}

export interface StoredCopy {
  copy: LocalCopy;
  /** True when the server already holds this exact copy. */
  synced: boolean;
}

export function readLocal(storage: KeyValueStore | null, key: string): StoredCopy | null {
  if (!storage) return null;
  return safely(() => {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalCopy>;
    if (typeof parsed.savedAt !== 'string' || !isProgress(parsed.progress) || !('project' in parsed)) return null;
    const copy: LocalCopy = { project: parsed.project, progress: parsed.progress, savedAt: parsed.savedAt };
    return { copy, synced: storage.getItem(syncKey(key)) === copy.savedAt };
  }, null);
}

function writeLocal(storage: KeyValueStore | null, key: string, copy: LocalCopy): void {
  if (!storage) return;
  safely(() => storage.setItem(key, JSON.stringify(copy)), undefined);
}

function markSynced(storage: KeyValueStore | null, key: string, savedAt: string): void {
  if (!storage) return;
  safely(() => storage.setItem(syncKey(key), savedAt), undefined);
}

export type Timer = unknown;

export interface AutosaveOptions {
  gameId: string;
  /** Storage key of the local copy, see `localKey`. */
  key: string;
  save: SaveFn;
  storage: KeyValueStore | null;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (timer: Timer) => void;
  debounceMs?: number;
  maxWaitMs?: number;
  retryMs?: number;
  /** Sends a small body with `fetch(..., { keepalive: true })` while the page is closing. */
  keepalive?: (gameId: string, body: string) => void;
}

export interface Autosave {
  /** Called by the studio on every change. */
  update(project: unknown, progress: GameProgress): void;
  /** Sends the newest copy now. Resolves when it was sent or failed. */
  flush(): Promise<void>;
  /** For the `pagehide` event: sends the newest unsent copy with keepalive when it is small enough. */
  flushOnHide(): void;
  status(): SaveStatus;
  /** True while the server does not hold the newest copy. */
  hasPending(): boolean;
  subscribe(listener: (status: SaveStatus) => void): () => void;
  dispose(): void;
}

function classify(error: unknown): 'signedout' | 'rejected' | 'offline' {
  const status = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
  if (typeof status !== 'number' || status === 0 || status >= 500) return 'offline';
  if (status === 401) return 'signedout';
  if (status === 408 || status === 429) return 'offline';
  return 'rejected';
}

export function createAutosave(options: AutosaveOptions): Autosave {
  const {
    gameId,
    key,
    save,
    storage,
    now = Date.now,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
    debounceMs = DEBOUNCE_MS,
    maxWaitMs = MAX_WAIT_MS,
    retryMs = RETRY_MS,
    keepalive,
  } = options;

  let latest: LocalCopy | null = null;
  /** Bumped on every change. */
  let revision = 0;
  let syncedRevision = 0;
  let lastStamp = 0;
  let current: SaveStatus = 'idle';
  let disposed = false;
  let inflight: Promise<void> | null = null;
  let resendRequested = false;
  let debounceTimer: Timer | null = null;
  let retryTimer: Timer | null = null;
  let firstPendingAt = 0;
  const listeners = new Set<(status: SaveStatus) => void>();

  function setStatus(next: SaveStatus): void {
    if (current === next) return;
    current = next;
    for (const listener of [...listeners]) listener(next);
  }

  function clearDebounce(): void {
    if (debounceTimer !== null) clearTimer(debounceTimer);
    debounceTimer = null;
  }
  function clearRetry(): void {
    if (retryTimer !== null) clearTimer(retryTimer);
    retryTimer = null;
  }

  const hasPending = (): boolean => latest !== null && syncedRevision !== revision;

  function scheduleRetry(): void {
    clearRetry();
    if (disposed) return;
    retryTimer = setTimer(() => {
      retryTimer = null;
      void send();
    }, retryMs);
  }

  function send(): Promise<void> {
    clearDebounce();
    if (inflight) {
      resendRequested = true;
      return inflight;
    }
    if (!hasPending() || latest === null) return Promise.resolve();
    clearRetry();
    const sentRevision = revision;
    const sent = latest;
    setStatus('saving');
    inflight = (async () => {
      try {
        await save(gameId, { project: sent.project, progress: sent.progress });
        syncedRevision = sentRevision;
        markSynced(storage, key, sent.savedAt);
        setStatus(sentRevision === revision ? 'saved' : 'saving');
      } catch (error) {
        const kind = classify(error);
        setStatus(kind);
        if (kind === 'offline') scheduleRetry();
      }
    })().finally(() => {
      inflight = null;
    });
    return inflight.then(() => {
      // Changes that arrived while the request was running and whose timer already fired.
      if (resendRequested && !disposed && current === 'saving' && hasPending()) {
        resendRequested = false;
        return send();
      }
      resendRequested = false;
      return undefined;
    });
  }

  function schedule(): void {
    if (disposed) return;
    // While offline the retry timer owns sending: do not hammer a server that is down.
    if (current === 'offline') return;
    clearDebounce();
    const waited = now() - firstPendingAt;
    const delay = Math.max(0, Math.min(debounceMs, maxWaitMs - waited));
    debounceTimer = setTimer(() => {
      debounceTimer = null;
      void send();
    }, delay);
  }

  return {
    update(project, progress) {
      if (disposed) return;
      if (!hasPending()) firstPendingAt = now();
      lastStamp = Math.max(now(), lastStamp + 1);
      latest = { project, progress, savedAt: new Date(lastStamp).toISOString() };
      revision += 1;
      writeLocal(storage, key, latest);
      schedule();
    },
    flush() {
      return send();
    },
    flushOnHide() {
      if (!keepalive || !hasPending() || latest === null) return;
      const body = JSON.stringify({ project: latest.project, progress: latest.progress } satisfies SaveProjectRequest);
      if (new TextEncoder().encode(body).length > KEEPALIVE_LIMIT_BYTES) return;
      keepalive(gameId, body);
    },
    status: () => current,
    hasPending,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      clearDebounce();
      clearRetry();
      listeners.clear();
    },
  };
}

// ---- Loading ----

export interface LoadedProject {
  project: unknown;
  progress: GameProgress;
  source: 'server' | 'local';
  /** True when the local copy is newer than the server: hand it back to the autosave to upload it. */
  needsUpload: boolean;
}

export interface LoadOptions {
  /** Resolves null when the server has no project yet (404). Throws for anything else. */
  fetchServer: () => Promise<ProjectResponse | null>;
  storage: KeyValueStore | null;
  key: string;
}

/**
 * Chooses what the studio starts from: the newer of the server and the local copy. A local copy the
 * server already holds never wins over the server, so work saved from another computer is not lost.
 * Returns null for a new project. When the server cannot be reached and there is no local copy, it
 * throws: starting empty could later overwrite a project that exists on the server.
 */
export async function loadProject({ fetchServer, storage, key }: LoadOptions): Promise<LoadedProject | null> {
  const stored = readLocal(storage, key);
  let server: ProjectResponse | null;
  try {
    server = await fetchServer();
  } catch (error) {
    if (stored && classify(error) === 'offline') {
      return { project: stored.copy.project, progress: stored.copy.progress, source: 'local', needsUpload: !stored.synced };
    }
    throw error;
  }

  const useLocal =
    stored !== null && !stored.synced && (server === null || Date.parse(stored.copy.savedAt) > Date.parse(server.updatedAt));
  if (useLocal && stored) {
    return { project: stored.copy.project, progress: stored.copy.progress, source: 'local', needsUpload: true };
  }
  if (server === null) return null;
  return { project: server.project, progress: server.progress, source: 'server', needsUpload: false };
}

// ---- Registry ----

/**
 * Keeps one autosave per game for the signed-in child. A controller outlives the studio screen, so
 * a copy that could not be sent keeps retrying after the child went back to the chooser.
 */
export interface AutosaveRegistry {
  get(gameId: string): Autosave;
  hasPending(): boolean;
  /** For `pagehide`: asks every controller to send its unsent copy with keepalive. */
  flushAllOnHide(): void;
  /** Tries to send everything now, giving up after `timeoutMs`. */
  flushAll(timeoutMs?: number): Promise<void>;
  disposeAll(): void;
}

export function createAutosaveRegistry(make: (gameId: string) => Autosave): AutosaveRegistry {
  const controllers = new Map<string, Autosave>();
  return {
    get(gameId) {
      let controller = controllers.get(gameId);
      if (!controller) {
        controller = make(gameId);
        controllers.set(gameId, controller);
      }
      return controller;
    },
    hasPending: () => [...controllers.values()].some((c) => c.hasPending()),
    flushAllOnHide() {
      for (const controller of controllers.values()) controller.flushOnHide();
    },
    async flushAll(timeoutMs = 2500) {
      const all = Promise.all([...controllers.values()].map((c) => c.flush())).then(() => undefined);
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
      await Promise.race([all, timeout]);
    },
    disposeAll() {
      for (const controller of controllers.values()) controller.dispose();
      controllers.clear();
    },
  };
}
