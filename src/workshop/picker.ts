// Pure model of the game picker of the open class: the showcase games of a level, how far along each one is, and where to go next.
import { showcasesFor } from '../games/showcase/index.ts';
import type { GameDefinition } from '../games/types.ts';
import type { ProjectSummary } from '../shared/api.ts';
import type { LevelId } from '../shared/levels.ts';
import { controlsOf, type Controls } from '../studio/controls.ts';
import { stepIds } from './chooser.ts';

export interface PickCard {
  game: GameDefinition;
  /** Cards done and cards in all: «3/10». */
  done: number;
  total: number;
  started: boolean;
  finished: boolean;
  /** The unfinished game played last: «Seguí con este». */
  last: boolean;
  /** How it is played, read from the game as it comes. */
  controls: Controls;
}

export interface Picker {
  cards: PickCard[];
}

/** Whether the level has games to choose from. */
export const hasChoice = (level: LevelId, games: readonly GameDefinition[] = showcasesFor(level)): boolean => games.length > 1;

function summaryOf(game: GameDefinition, projects: readonly ProjectSummary[]): ProjectSummary | undefined {
  return projects.find((p) => p.gameId === game.id);
}

/** The game with the most recent save, among the ones the child started (`skip` leaves some out). */
function lastPlayed(games: readonly GameDefinition[], projects: readonly ProjectSummary[], skip: (g: GameDefinition) => boolean = () => false): GameDefinition | null {
  let best: { game: GameDefinition; at: number } | null = null;
  for (const game of games.filter((g) => !skip(g))) {
    const at = Date.parse(summaryOf(game, projects)?.updatedAt ?? '');
    if (Number.isFinite(at) && (!best || at > best.at)) best = { game, at };
  }
  return best?.game ?? null;
}

export function buildPicker(level: LevelId, projects: readonly ProjectSummary[], games: readonly GameDefinition[] = showcasesFor(level)): Picker {
  const progress = games.map((game) => {
    const summary = summaryOf(game, projects);
    const ids = stepIds(game);
    const completed = new Set(summary?.progress.completedSteps.map((s) => s.id));
    const done = ids.filter((id) => completed.has(id)).length;
    return { game, done, total: ids.length, started: !!summary, finished: !!summary && (summary.progress.finished || (ids.length > 0 && done === ids.length)) };
  });
  const last = lastPlayed(games, projects, (g) => progress.find((c) => c.game.id === g.id)!.finished);
  return {
    cards: progress.map((c) => {
      const { game } = c;
      return { ...c, last: last?.id === game.id, controls: controlsOf(game.setup, game.showcase) };
    }),
  };
}

/** Where a child goes on entering: the game they played last, or the first one. */
export function firstToOpen(level: LevelId, projects: readonly ProjectSummary[], games: readonly GameDefinition[] = showcasesFor(level)): GameDefinition {
  return lastPlayed(games, projects) ?? games[0];
}

/** After finishing `current`: the first other game of the level that is not finished, or null. */
export function nextToPlay(current: GameDefinition, projects: readonly ProjectSummary[], games: readonly GameDefinition[] = showcasesFor(current.level)): GameDefinition | null {
  const cards = buildPicker(current.level, projects, games).cards;
  const at = cards.findIndex((c) => c.game.id === current.id);
  const after = [...cards.slice(at + 1), ...cards.slice(0, Math.max(at, 0))];
  return after.find((c) => c.game.id !== current.id && !c.finished)?.game ?? null;
}
