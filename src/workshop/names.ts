// Pure helpers for the name screen.
import type { StudentListItem } from '../shared/api.ts';

/** Lowercase and without accents, so «sofia» finds «Sofía» and «JOAQUIN» finds «Joaquín». */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterStudents(students: readonly StudentListItem[], query: string): StudentListItem[] {
  const needle = normalize(query);
  if (needle === '') return [...students];
  return students.filter((s) => normalize(s.name).includes(needle));
}

export interface StudentGroup {
  /** Empty string for children without a group. */
  group: string;
  students: StudentListItem[];
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Groups sorted by name with the group-less children last; names sorted inside each group. */
export function groupStudents(students: readonly StudentListItem[]): StudentGroup[] {
  const groups = new Map<string, StudentListItem[]>();
  for (const student of students) {
    const list = groups.get(student.group) ?? [];
    list.push(student);
    groups.set(student.group, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : collator.compare(a, b)))
    .map(([group, list]) => ({ group, students: list.sort((a, b) => collator.compare(a.name, b.name)) }));
}
