// Comparisons that decide whether a poll found something new. Pure.
import type { SessionResponse, StudentListItem } from '../shared/api.ts';

/** True when nothing a child can see in the chooser differs: who, team, group and active class. */
export function sameSession(a: SessionResponse, b: SessionResponse): boolean {
  return (
    a.activeClass === b.activeClass &&
    a.student.id === b.student.id &&
    a.student.name === b.student.name &&
    a.student.group === b.student.group &&
    a.student.level === b.student.level
  );
}

export function sameStudents(a: readonly StudentListItem[], b: readonly StudentListItem[]): boolean {
  return a.length === b.length && a.every((s, i) => s.id === b[i].id && s.name === b[i].name && s.group === b[i].group);
}
