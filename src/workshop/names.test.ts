import { describe, expect, it } from 'vitest';
import type { StudentListItem } from '../shared/api.ts';
import { filterStudents, groupStudents, normalize } from './names.ts';

const s = (id: number, name: string, group: string): StudentListItem => ({ id, name, group });

const students = [
  s(1, 'Sofía', '3.º A'),
  s(2, 'Joaquín', '3.º A'),
  s(3, 'Mateo', '1.º B'),
  s(4, 'Ana María', ''),
  s(5, 'Álvaro', '1.º B'),
];

describe('normalize', () => {
  it('drops accents, case and extra spaces', () => {
    expect(normalize('  JoaQUÍN  ')).toBe('joaquin');
    expect(normalize('Ana   María')).toBe('ana maria');
  });
});

describe('filterStudents', () => {
  it('returns everyone for an empty query', () => {
    expect(filterStudents(students, '')).toHaveLength(5);
    expect(filterStudents(students, '   ')).toHaveLength(5);
  });

  it('ignores accents and case, in both directions', () => {
    expect(filterStudents(students, 'sofia').map((x) => x.id)).toEqual([1]);
    expect(filterStudents(students, 'JOAQUIN').map((x) => x.id)).toEqual([2]);
    expect(filterStudents(students, 'alvaro').map((x) => x.id)).toEqual([5]);
    expect(filterStudents(students, 'Álv').map((x) => x.id)).toEqual([5]);
  });

  it('matches inside the name and finds nothing for a stranger', () => {
    expect(filterStudents(students, 'ia').map((x) => x.id)).toEqual([1, 4]);
    expect(filterStudents(students, 'zzz')).toEqual([]);
  });
});

describe('groupStudents', () => {
  it('sorts groups and names, with the group-less last', () => {
    const groups = groupStudents(students);
    expect(groups.map((g) => g.group)).toEqual(['1.º B', '3.º A', '']);
    expect(groups[0].students.map((x) => x.name)).toEqual(['Álvaro', 'Mateo']);
    expect(groups[1].students.map((x) => x.name)).toEqual(['Joaquín', 'Sofía']);
  });

  it('returns no groups for no students', () => {
    expect(groupStudents([])).toEqual([]);
  });
});
