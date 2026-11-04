// Pure model of the game chooser: which games a child sees and how far along each one is.
import { GAMES, gamesFor } from '../games/catalog.ts';
import type { GameDefinition } from '../games/types.ts';
import type { ProjectSummary } from '../shared/api.ts';
import type { ClassId, LevelId } from '../shared/levels.ts';

/** `gameId` of the free project. */
export const FREE_GAME_ID = 'libre';

export type CardStatus =
  | { kind: 'new' }
  | { kind: 'progress'; phase: number; phases: number; done: number; total: number }
  | { kind: 'finished' };

export interface GameCard {
  game: GameDefinition;
  status: CardStatus;
}

export interface Chooser {
  /** The class's games for the level first, then games started from another class or level. */
  cards: GameCard[];
  /** Whether the child has already opened the free project. */
  freeStarted: boolean;
}

export interface CatalogSource {
  games: readonly GameDefinition[];
  gamesFor: (level: LevelId, classId: ClassId) => GameDefinition[];
}

const defaultCatalog: CatalogSource = { games: GAMES, gamesFor };

export function stepIds(game: GameDefinition): string[] {
  return game.phases.flatMap((phase) => phase.steps.map((step) => step.id));
}

/** How far along a game is, from the saved progress. Phases are shown to children; step ids never are. */
export function statusOf(game: GameDefinition, summary: ProjectSummary | undefined): CardStatus {
  if (!summary) return { kind: 'new' };
  if (summary.progress.finished) return { kind: 'finished' };
  const ids = stepIds(game);
  const completed = new Set(summary.progress.completedSteps.map((s) => s.id));
  const done = ids.filter((id) => completed.has(id)).length;
  const phases = game.phases.length;

  // The phase holding the current step, otherwise the first phase that still has an open step.
  let phase = game.phases.findIndex((p) => p.steps.some((s) => s.id === summary.progress.currentStep));
  if (phase < 0) phase = game.phases.findIndex((p) => p.steps.some((s) => !completed.has(s.id)));
  if (phase < 0) phase = Math.max(0, phases - 1);
  return { kind: 'progress', phase: phase + 1, phases, done, total: ids.length };
}

export function buildChooser(
  level: LevelId,
  activeClass: ClassId,
  projects: readonly ProjectSummary[],
  catalog: CatalogSource = defaultCatalog,
): Chooser {
  const byGame = new Map(projects.map((p) => [p.gameId, p]));
  const offered = catalog.gamesFor(level, activeClass);
  const offeredIds = new Set(offered.map((g) => g.id));
  // A game the child already started stays reachable even if the class or their level changed.
  const carried = catalog.games.filter((g) => !offeredIds.has(g.id) && byGame.has(g.id));
  return {
    cards: [...offered, ...carried].map((game) => ({ game, status: statusOf(game, byGame.get(game.id)) })),
    freeStarted: byGame.has(FREE_GAME_ID),
  };
}

/** The game after `current` in its own level and class, easier first. Null at the end or for the free project. */
export function nextGame(current: GameDefinition | null, catalog: CatalogSource = defaultCatalog): GameDefinition | null {
  if (!current) return null;
  const list = catalog.gamesFor(current.level, current.class);
  const index = list.findIndex((g) => g.id === current.id);
  return index >= 0 && index < list.length - 1 ? list[index + 1] : null;
}

export { TEAM_COLORS } from './teamColors.ts';
