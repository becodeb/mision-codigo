import { describe, expect, it } from 'vitest';
import type { GameDefinition } from '../games/types.ts';
import type { GameProgress, ProjectSummary } from '../shared/api.ts';
import type { ClassId, LevelId } from '../shared/levels.ts';
import { FREE_GAME_ID, buildChooser, nextGame, statusOf } from './chooser.ts';
import type { CatalogSource } from './chooser.ts';

function game(id: string, level: LevelId, classId: ClassId, order: number, stepIds: string[][]): GameDefinition {
  return {
    id,
    level,
    class: classId,
    order,
    title: id,
    phases: stepIds.map((ids, p) => ({
      title: `Fase ${p + 1}`,
      goal: '',
      steps: ids.map((stepId) => ({ id: stepId, title: stepId, text: '', hints: [], check: () => false })),
    })),
  } as unknown as GameDefinition;
}

const a = game('a', 1, 1, 1, [['a1', 'a2'], ['a3'], ['a4']]);
const b = game('b', 1, 1, 2, [['b1']]);
const c = game('c', 1, 2, 1, [['c1']]);
const d = game('d', 2, 1, 1, [['d1']]);

const catalog: CatalogSource = {
  games: [a, b, c, d],
  gamesFor: (level, classId) =>
    [a, b, c, d].filter((g) => g.level === level && g.class === classId).sort((x, y) => x.order - y.order),
};

const summary = (gameId: string, patch: Partial<GameProgress> = {}): ProjectSummary => ({
  gameId,
  updatedAt: '2026-11-04T19:00:00.000Z',
  progress: { currentStep: null, completedSteps: [], activeSeconds: 0, finished: false, ...patch },
});

describe('statusOf', () => {
  it('is new without a project', () => {
    expect(statusOf(a, undefined)).toEqual({ kind: 'new' });
  });

  it('shows the phase of the current step and how many steps are done', () => {
    const status = statusOf(
      a,
      summary('a', { currentStep: 'a3', completedSteps: [{ id: 'a1', at: '' }, { id: 'a2', at: '' }] }),
    );
    expect(status).toEqual({ kind: 'progress', phase: 2, phases: 3, done: 2, total: 4 });
  });

  it('falls back to the first open phase when there is no current step', () => {
    const status = statusOf(a, summary('a', { completedSteps: [{ id: 'a1', at: '' }, { id: 'a2', at: '' }, { id: 'a3', at: '' }] }));
    expect(status).toMatchObject({ kind: 'progress', phase: 3, done: 3 });
  });

  it('ignores unknown step ids and reports finished games', () => {
    expect(statusOf(a, summary('a', { completedSteps: [{ id: 'zzz', at: '' }] }))).toMatchObject({ done: 0 });
    expect(statusOf(a, summary('a', { finished: true }))).toEqual({ kind: 'finished' });
  });
});

describe('buildChooser', () => {
  it('offers the class games of the level, easier first', () => {
    const { cards, freeStarted } = buildChooser(1, 1, [], catalog);
    expect(cards.map((x) => x.game.id)).toEqual(['a', 'b']);
    expect(cards.every((x) => x.status.kind === 'new')).toBe(true);
    expect(freeStarted).toBe(false);
  });

  it('switches with the active class', () => {
    expect(buildChooser(1, 2, [], catalog).cards.map((x) => x.game.id)).toEqual(['c']);
  });

  it('keeps games already started from another class or level, after the offered ones', () => {
    const { cards } = buildChooser(1, 2, [summary('a'), summary('d', { finished: true })], catalog);
    expect(cards.map((x) => x.game.id)).toEqual(['c', 'a', 'd']);
    expect(cards[2].status).toEqual({ kind: 'finished' });
  });

  it('does not duplicate a started game that is also offered', () => {
    expect(buildChooser(1, 1, [summary('a')], catalog).cards.map((x) => x.game.id)).toEqual(['a', 'b']);
  });

  it('never dead-ends: an empty level still yields a chooser the free project can fill', () => {
    const { cards, freeStarted } = buildChooser(5, 1, [summary(FREE_GAME_ID)], catalog);
    expect(cards).toEqual([]);
    expect(freeStarted).toBe(true);
  });

  it('ignores projects of games that left the catalog', () => {
    expect(buildChooser(1, 1, [summary('gone')], catalog).cards.map((x) => x.game.id)).toEqual(['a', 'b']);
  });
});

describe('nextGame', () => {
  it('is the following game of the same level and class', () => {
    expect(nextGame(a, catalog)?.id).toBe('b');
  });

  it('is null at the end of the list and for the free project', () => {
    expect(nextGame(b, catalog)).toBeNull();
    expect(nextGame(null, catalog)).toBeNull();
  });
});
