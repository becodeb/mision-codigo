import { describe, expect, it, vi } from 'vitest';
import type { AdminStudent } from '../shared/api.ts';
import type { LevelId } from '../shared/levels.ts';
import {
  DEFAULT_LAST_USED,
  LAST_USED_KEY,
  createLevelSaver,
  findDuplicate,
  groupByLevel,
  loadLastUsed,
  saveLastUsed,
  searchRoster,
  sortByName,
  withLevel,
} from './roster.ts';

let nextId = 1;
const kid = (name: string, level: LevelId = 1, group = '3.º A'): AdminStudent => ({
  id: nextId++,
  name,
  group,
  level,
  createdAt: '2026-11-04T12:00:00.000Z',
});

const roster = () => [kid('Sofía', 2), kid('Mateo', 1), kid('Álvaro', 2, '4.º B'), kid('Luna', 5), kid('joaquín', 1, '')];

describe('searchRoster', () => {
  it('ignores accents and case in the name', () => {
    expect(searchRoster(roster(), 'SOFIA').map((s) => s.name)).toEqual(['Sofía']);
    expect(searchRoster(roster(), 'alvaro').map((s) => s.name)).toEqual(['Álvaro']);
    expect(searchRoster(roster(), 'JOAQUIN').map((s) => s.name)).toEqual(['joaquín']);
  });

  it('also matches the group and trims the query', () => {
    expect(searchRoster(roster(), '  4.º b ').map((s) => s.name)).toEqual(['Álvaro']);
  });

  it('keeps everybody for an empty query and nobody for a miss', () => {
    expect(searchRoster(roster(), '   ')).toHaveLength(5);
    expect(searchRoster(roster(), 'zzz')).toEqual([]);
  });
});

describe('sortByName and groupByLevel', () => {
  it('sorts alphabetically without letting accents or case break the order', () => {
    expect(sortByName(roster()).map((s) => s.name)).toEqual(['Álvaro', 'joaquín', 'Luna', 'Mateo', 'Sofía']);
  });

  it('does not mutate the input', () => {
    const list = roster();
    const before = list.map((s) => s.id);
    sortByName(list);
    expect(list.map((s) => s.id)).toEqual(before);
  });

  it('returns the five levels in order, with empty ones kept, and sorted names inside', () => {
    const groups = groupByLevel(roster());
    expect(groups.map((g) => g.level)).toEqual([1, 2, 3, 4, 5]);
    expect(groups[0].students.map((s) => s.name)).toEqual(['joaquín', 'Mateo']);
    expect(groups[1].students.map((s) => s.name)).toEqual(['Álvaro', 'Sofía']);
    expect(groups[2].students).toEqual([]);
    expect(groups[4].students.map((s) => s.name)).toEqual(['Luna']);
  });
});

describe('withLevel', () => {
  it('changes only the matching student', () => {
    const list = roster();
    const next = withLevel(list, list[1].id, 4);
    expect(next.map((s) => s.level)).toEqual([2, 4, 2, 5, 1]);
    expect(list[1].level).toBe(1);
  });
});

describe('findDuplicate', () => {
  it('finds the same name in the same group ignoring case and accents', () => {
    const list = roster();
    expect(findDuplicate(list, 'sofia', '3.º a')?.name).toBe('Sofía');
  });

  it('lets the same name through in another group', () => {
    expect(findDuplicate(roster(), 'Sofía', '4.º B')).toBeUndefined();
  });
});

describe('remembered quick add values', () => {
  const memory = (initial?: string) => {
    const data = new Map<string, string>(initial === undefined ? [] : [[LAST_USED_KEY, initial]]);
    return {
      data,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
  };

  it('starts from level 1 and no grade', () => {
    expect(loadLastUsed(memory())).toEqual(DEFAULT_LAST_USED);
    expect(loadLastUsed(null)).toEqual({ group: '', level: 1 });
  });

  it('round-trips what was saved', () => {
    const store = memory();
    saveLastUsed(store, { group: '4.º B', level: 3 });
    expect(loadLastUsed(store)).toEqual({ group: '4.º B', level: 3 });
  });

  it('falls back field by field on junk', () => {
    expect(loadLastUsed(memory('{"group":7,"level":9}'))).toEqual(DEFAULT_LAST_USED);
    expect(loadLastUsed(memory('{"group":"2.º","level":4}'))).toEqual({ group: '2.º', level: 4 });
    expect(loadLastUsed(memory('not json'))).toEqual(DEFAULT_LAST_USED);
    expect(loadLastUsed(memory('null'))).toEqual(DEFAULT_LAST_USED);
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadLastUsed(broken)).toEqual(DEFAULT_LAST_USED);
    expect(() => saveLastUsed(broken, { group: 'x', level: 2 })).not.toThrow();
  });
});

describe('createLevelSaver', () => {
  function setup() {
    const shown = new Map<number, LevelId>([[1, 1]]);
    const calls: { resolve: () => void; reject: (e: unknown) => void; level: LevelId }[] = [];
    const onSaved = vi.fn();
    const onError = vi.fn();
    const saver = createLevelSaver({
      save: (_id, level) =>
        new Promise<void>((resolve, reject) => {
          calls.push({ resolve, reject, level });
        }),
      apply: (id, level) => void shown.set(id, level),
      onSaved,
      onError,
    });
    const tap = (level: LevelId) => saver.change(1, shown.get(1)!, level);
    return { shown, calls, onSaved, onError, saver, tap };
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('shows the new level before the server answers', () => {
    const { shown, tap, calls } = setup();
    tap(3);
    expect(shown.get(1)).toBe(3);
    expect(calls).toHaveLength(1);
  });

  it('keeps the level and reports the save once the server accepts', async () => {
    const { shown, tap, calls, onSaved, onError } = setup();
    tap(3);
    calls[0].resolve();
    await flush();
    expect(shown.get(1)).toBe(3);
    expect(onSaved).toHaveBeenCalledWith(1, 3);
    expect(onError).not.toHaveBeenCalled();
  });

  it('rolls back to the confirmed level and reports the error when the save fails', async () => {
    const { shown, tap, calls, onSaved, onError } = setup();
    tap(4);
    calls[0].reject(new Error('offline'));
    await flush();
    expect(shown.get(1)).toBe(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('ignores a tap on the level already shown', () => {
    const { tap, calls } = setup();
    tap(1);
    expect(calls).toHaveLength(0);
  });

  it('rolls back to the last confirmed level, not to the one before an unconfirmed tap', async () => {
    const { shown, tap, calls, onError } = setup();
    tap(2);
    tap(5);
    calls[0].resolve();
    await flush();
    expect(shown.get(1)).toBe(5);
    calls[1].reject(new Error('offline'));
    await flush();
    expect(shown.get(1)).toBe(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('lets a stale failure pass without undoing the newer tap', async () => {
    const { shown, tap, calls, onSaved, onError } = setup();
    tap(2);
    tap(3);
    calls[0].reject(new Error('offline'));
    await flush();
    expect(shown.get(1)).toBe(3);
    expect(onError).not.toHaveBeenCalled();
    calls[1].resolve();
    await flush();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(1, 3);
  });

  it('forgets the confirmed level after a reload', async () => {
    const { shown, tap, calls, saver } = setup();
    tap(2);
    calls[0].resolve();
    await flush();
    saver.forget();
    shown.set(1, 4);
    tap(5);
    calls[1].reject(new Error('offline'));
    await flush();
    expect(shown.get(1)).toBe(4);
  });
});
