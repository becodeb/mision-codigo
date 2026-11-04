// Pure logic of the «Alumnos» tab: search, order, grouping, remembered values and the
// optimistic level change. No React and no DOM, so every rule here is unit tested.
import type { AdminStudent } from '../shared/api.ts';
import { LEVEL_IDS, isLevelId } from '../shared/levels.ts';
import type { LevelId } from '../shared/levels.ts';
import { normalize } from '../workshop/names.ts';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Case and accent insensitive search over name and group. An empty query keeps everyone. */
export function searchRoster(students: readonly AdminStudent[], query: string): AdminStudent[] {
  const needle = normalize(query);
  if (needle === '') return [...students];
  return students.filter((s) => normalize(`${s.name} ${s.group}`).includes(needle));
}

export function sortByName(students: readonly AdminStudent[]): AdminStudent[] {
  return [...students].sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.group, b.group) || a.id - b.id);
}

export interface LevelGroup {
  level: LevelId;
  students: AdminStudent[];
}

/** One group per level, always all five, each sorted by name. */
export function groupByLevel(students: readonly AdminStudent[]): LevelGroup[] {
  const sorted = sortByName(students);
  return LEVEL_IDS.map((level) => ({ level, students: sorted.filter((s) => s.level === level) }));
}

export function withLevel(students: readonly AdminStudent[], id: number, level: LevelId): AdminStudent[] {
  return students.map((s) => (s.id === id ? { ...s, level } : s));
}

/** The student that would clash with this name in this group, ignoring case and accents. */
export function findDuplicate(students: readonly AdminStudent[], name: string, group: string): AdminStudent | undefined {
  const n = normalize(name);
  const g = normalize(group);
  return students.find((s) => normalize(s.name) === n && normalize(s.group) === g);
}

// ---- Remembered values for the quick add ----

export interface LastUsed {
  group: string;
  level: LevelId;
}

export const LAST_USED_KEY = 'mc.teacher.lastUsed';
export const DEFAULT_LAST_USED: LastUsed = { group: '', level: 1 };

type ReadableStorage = Pick<Storage, 'getItem'> | null;
type WritableStorage = Pick<Storage, 'setItem'> | null;

/** Never throws: private mode, blocked storage and corrupt values fall back to the defaults. */
export function loadLastUsed(storage: ReadableStorage): LastUsed {
  try {
    const raw = storage?.getItem(LAST_USED_KEY);
    if (!raw) return DEFAULT_LAST_USED;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LAST_USED;
    const { group, level } = parsed as Partial<Record<keyof LastUsed, unknown>>;
    return {
      group: typeof group === 'string' ? group.slice(0, 40) : DEFAULT_LAST_USED.group,
      level: isLevelId(level) ? level : DEFAULT_LAST_USED.level,
    };
  } catch {
    return DEFAULT_LAST_USED;
  }
}

export function saveLastUsed(storage: WritableStorage, value: LastUsed): void {
  try {
    storage?.setItem(LAST_USED_KEY, JSON.stringify(value));
  } catch {
    // Remembering is a convenience only.
  }
}

// ---- Optimistic level change ----

export interface LevelSaverOptions {
  /** Persists the level. Rejects when the server refuses or cannot be reached. */
  save: (id: number, level: LevelId) => Promise<unknown>;
  /** Shows a level for a student right now, before or after the server answers. */
  apply: (id: number, level: LevelId) => void;
  onSaved: (id: number, level: LevelId) => void;
  onError: (id: number, error: unknown) => void;
}

export interface LevelSaver {
  /** `shown` is the level on screen right now. */
  change: (id: number, shown: LevelId, next: LevelId) => void;
  /** Forget what is known about one student, or about everyone, after the list was reloaded. */
  forget: (id?: number) => void;
}

/**
 * Applies a level at once and saves it behind the scenes. When the save fails the student goes
 * back to the last level the server confirmed. Fast taps on one student are safe: only the
 * newest request may roll back, and every success updates what counts as confirmed.
 */
export function createLevelSaver(options: LevelSaverOptions): LevelSaver {
  const confirmed = new Map<number, LevelId>();
  const latest = new Map<number, number>();
  let counter = 0;

  return {
    change(id, shown, next) {
      if (shown === next) return;
      if (!confirmed.has(id)) confirmed.set(id, shown);
      const ticket = ++counter;
      latest.set(id, ticket);
      options.apply(id, next);
      options.save(id, next).then(
        () => {
          confirmed.set(id, next);
          if (latest.get(id) === ticket) options.onSaved(id, next);
        },
        (error: unknown) => {
          if (latest.get(id) !== ticket) return;
          options.apply(id, confirmed.get(id) ?? shown);
          options.onError(id, error);
        },
      );
    },
    forget(id) {
      if (id === undefined) {
        confirmed.clear();
        latest.clear();
      } else {
        confirmed.delete(id);
        latest.delete(id);
      }
    },
  };
}
