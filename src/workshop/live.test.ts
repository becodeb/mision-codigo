import { describe, expect, it } from 'vitest';
import type { SessionResponse, StudentListItem } from '../shared/api.ts';
import { sameSession, sameStudents } from './live.ts';

const session = (patch: Partial<SessionResponse['student']> = {}, activeClass: 1 | 2 = 1): SessionResponse => ({
  student: { id: 7, name: 'Luna', group: '3.º A', level: 2, ...patch },
  activeClass,
});

describe('sameSession', () => {
  it('is true for the same data', () => {
    expect(sameSession(session(), session())).toBe(true);
  });

  it.each([
    ['level', session({ level: 3 })],
    ['name', session({ name: 'Lu' })],
    ['group', session({ group: '4.º B' })],
    ['active class', session({}, 2)],
  ])('notices a different %s', (_label, other) => {
    expect(sameSession(session(), other)).toBe(false);
  });
});

describe('sameStudents', () => {
  const list = (...names: string[]): StudentListItem[] => names.map((name, i) => ({ id: i + 1, name, group: '' }));

  it('is true for an identical list', () => {
    expect(sameStudents(list('Ana', 'Beto'), list('Ana', 'Beto'))).toBe(true);
    expect(sameStudents([], [])).toBe(true);
  });

  it('notices an added, removed or renamed child', () => {
    expect(sameStudents(list('Ana'), list('Ana', 'Beto'))).toBe(false);
    expect(sameStudents(list('Ana', 'Beto'), list('Ana'))).toBe(false);
    expect(sameStudents(list('Ana', 'Beto'), list('Ana', 'Bea'))).toBe(false);
  });
});
