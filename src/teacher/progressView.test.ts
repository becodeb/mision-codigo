import { describe, expect, it } from 'vitest';
import type { GameDefinition } from '../games/types.ts';
import type { AdminStudent, ProgressEntry } from '../shared/api.ts';
import { formatMinutes, gameRows, gameTitle, groupsOf, notStarted, progressRows, stepTitle, totalSteps } from './progressView.ts';

const tesoro = {
  id: 'tesoro',
  title: 'Búsqueda del tesoro',
  phases: [
    { title: 'F1', goal: '', steps: [{ id: 't1', title: 'Llegá al tesoro' }, { id: 't2', title: 'Sumá un punto' }] },
    { title: 'F2', goal: '', steps: [{ id: 't3', title: 'Un guardia' }] },
  ],
} as unknown as GameDefinition;
const lookup = { gameById: (id: string) => (id === 'tesoro' ? tesoro : undefined) };

const entry = (patch: Partial<ProgressEntry>): ProgressEntry => ({
  studentId: 1,
  name: 'Luna',
  group: '3.º A',
  level: 4,
  gameId: 'tesoro',
  currentStep: 't2',
  completedCount: 1,
  activeSeconds: 600,
  finished: false,
  updatedAt: '2026-11-04T19:00:00.000Z',
  ...patch,
});

describe('titles', () => {
  it('uses the catalog and falls back to the id', () => {
    expect(gameTitle('tesoro', lookup)).toBe('Búsqueda del tesoro');
    expect(gameTitle('libre', lookup)).toBe('Proyecto libre');
    expect(gameTitle('viejo', lookup)).toBe('viejo');
    expect(stepTitle('tesoro', 't3', lookup)).toBe('Un guardia');
    expect(stepTitle('tesoro', 'zzz', lookup)).toBe('zzz');
    expect(stepTitle('viejo', 'a1', lookup)).toBe('a1');
  });

  it('counts the steps of known games only', () => {
    expect(totalSteps('tesoro', lookup)).toBe(3);
    expect(totalSteps('libre', lookup)).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('rounds to whole minutes and flags the first minute', () => {
    expect(formatMinutes(0)).toBe('0');
    expect(formatMinutes(20)).toBe('<1');
    expect(formatMinutes(60)).toBe('1');
    expect(formatMinutes(95)).toBe('2');
    expect(formatMinutes(1500)).toBe('25');
  });
});

describe('progressRows', () => {
  it('shows the current step title, hides it once finished, and sorts by name', () => {
    const rows = progressRows(
      [
        entry({ studentId: 2, name: 'Ana', finished: true, currentStep: 't3' }),
        entry({ studentId: 1, name: 'Zoe' }),
        entry({ studentId: 3, name: 'Ana', gameId: 'libre', currentStep: null, updatedAt: '2026-11-04T19:30:00.000Z' }),
      ],
      null,
      lookup,
    );
    expect(rows.map((r) => r.name)).toEqual(['Ana', 'Ana', 'Zoe']);
    expect(rows[0].gameId).toBe('libre'); // newer first among equal names
    expect(rows[1]).toMatchObject({ finished: true, currentStep: null, totalSteps: 3 });
    expect(rows[2].currentStep).toEqual({ id: 't2', title: 'Sumá un punto' });
    expect(rows[2].minutes).toBe('10');
  });

  it('filters by group', () => {
    const rows = progressRows([entry({ group: 'A' }), entry({ studentId: 2, group: 'B' })], 'B', lookup);
    expect(rows.map((r) => r.studentId)).toEqual([2]);
  });
});

describe('gameRows', () => {
  it('resolves stuck step titles and orders by how many started', () => {
    const rows = gameRows(
      [
        { gameId: 'libre', started: 1, finished: 0, averageActiveSeconds: 30, stuckSteps: [] },
        {
          gameId: 'tesoro',
          started: 5,
          finished: 2,
          averageActiveSeconds: 1200,
          stuckSteps: [{ stepId: 't2', count: 2 }, { stepId: 'raro', count: 1 }],
        },
      ],
      lookup,
    );
    expect(rows.map((r) => r.gameId)).toEqual(['tesoro', 'libre']);
    expect(rows[0].averageMinutes).toBe('20');
    expect(rows[0].stuck).toEqual([
      { id: 't2', title: 'Sumá un punto', count: 2 },
      { id: 'raro', title: 'raro', count: 1 },
    ]);
  });
});

describe('class lists', () => {
  const student = (id: number, name: string, group: string): AdminStudent => ({ id, name, group, level: 1, createdAt: '' });

  it('lists who has not started, sorted', () => {
    const list = notStarted([student(1, 'Zoe', 'A'), student(2, 'Ana', 'A'), student(3, 'Bruno', 'B')], [entry({ studentId: 3 })]);
    expect(list.map((s) => s.name)).toEqual(['Ana', 'Zoe']);
  });

  it('lists distinct non-empty groups', () => {
    expect(groupsOf([student(1, 'a', '3.º B'), student(2, 'b', '3.º A'), student(3, 'c', ''), student(4, 'd', '3.º A')])).toEqual([
      '3.º A',
      '3.º B',
    ]);
  });
});
