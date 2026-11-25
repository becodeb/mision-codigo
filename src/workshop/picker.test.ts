import { describe, expect, it } from 'vitest';
import { fClick, fJump, project, sprite } from '../language/ir.ts';
import type { GameDefinition } from '../games/types.ts';
import type { GameProgress, ProjectSummary } from '../shared/api.ts';
import { buildPicker, firstToOpen, hasChoice, nextToPlay } from './picker.ts';

function game(id: string, steps: string[], order = 1): GameDefinition {
  return {
    id, level: 3, class: 2, order, title: id,
    setup: project('parque', [sprite('a', 'toby', [fClick(fJump())])]),
    showcase: {},
    phases: [{ title: id, goal: '', steps: steps.map((s) => ({ id: s, title: s, text: '', hints: [], check: () => false })) }],
  } as unknown as GameDefinition;
}

const one = game('one', ['a', 'b', 'c', 'd']);
const two = game('two', ['e', 'f']);
const three = game('three', ['g', 'h']);
const games = [one, two, three];

const saved = (gameId: string, at: string, done: string[], finished = false): ProjectSummary => ({
  gameId,
  updatedAt: at,
  progress: { currentStep: null, completedSteps: done.map((id) => ({ id, at })), activeSeconds: 0, finished } as GameProgress,
});

describe('buildPicker', () => {
  it('lists every game with no progress for a new child', () => {
    const { cards } = buildPicker(3, [], games);
    expect(cards.map((c) => [c.game.id, c.done, c.total, c.started, c.finished, c.last])).toEqual([
      ['one', 0, 4, false, false, false], ['two', 0, 2, false, false, false], ['three', 0, 2, false, false, false],
    ]);
  });

  it('counts the cards done, marks the finished one and the one played last', () => {
    const projects = [saved('one', '2026-11-25T10:00:00Z', ['a', 'b', 'x']), saved('two', '2026-11-25T11:00:00Z', ['e', 'f'], true), saved('three', '2026-11-25T12:00:00Z', ['g'])];
    const { cards } = buildPicker(3, projects, games);
    expect(cards.map((c) => [c.done, c.finished, c.last])).toEqual([[2, false, false], [2, true, false], [1, false, true]]);
  });

  it('a finished game is never «seguí con este» (the unfinished one played last is), and counts as finished when every card is done', () => {
    const { cards } = buildPicker(3, [saved('one', '2026-11-25T10:00:00Z', ['a', 'b', 'c', 'd']), saved('two', '2026-11-25T09:00:00Z', ['e'])], games);
    expect(cards[0]).toMatchObject({ finished: true, last: false, done: 4 });
    expect(cards[1]).toMatchObject({ finished: false, last: true });
    expect(buildPicker(3, [saved('one', 'z', ['a', 'b', 'c', 'd'])], games).cards.some((c) => c.last)).toBe(false);
  });

  it('draws how each game is played from its program', () => {
    expect(buildPicker(3, [], games).cards[0].controls.taps).toEqual([{ id: 'a', main: true }]);
  });
});

describe('firstToOpen', () => {
  it('goes to the first game when nothing was started', () => {
    expect(firstToOpen(3, [], games)).toBe(one);
    expect(firstToOpen(3, [saved('other', '2026-11-25T10:00:00Z', [])], games)).toBe(one);
  });

  it('goes to the game saved last, even a finished one', () => {
    const projects = [saved('one', '2026-11-25T10:00:00Z', ['a']), saved('three', '2026-11-25T12:00:00Z', ['g'], true), saved('two', '2026-11-25T11:00:00Z', [])];
    expect(firstToOpen(3, projects, games)).toBe(three);
  });
});

describe('nextToPlay', () => {
  it('is the first unfinished game after this one, wrapping around', () => {
    expect(nextToPlay(one, [], games)).toBe(two);
    expect(nextToPlay(three, [], games)).toBe(one);
    expect(nextToPlay(one, [saved('two', '2026-11-25T10:00:00Z', ['e', 'f'], true)], games)).toBe(three);
  });

  it('is null when every other game is finished or there is only one', () => {
    const done = [saved('two', 'z', ['e', 'f'], true), saved('three', 'z', ['g', 'h'], true)];
    expect(nextToPlay(one, done, games)).toBeNull();
    expect(nextToPlay(one, [], [one])).toBeNull();
  });
});

describe('hasChoice', () => {
  it('needs more than one game', () => {
    expect(hasChoice(3, [one])).toBe(false);
    expect(hasChoice(3, games)).toBe(true);
  });
});
