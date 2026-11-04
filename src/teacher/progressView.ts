// Pure view model of the progress tab: names from the catalog, minutes, ordering.
import { GAMES } from '../games/catalog.ts';
import type { GameDefinition } from '../games/types.ts';
import type { AdminStudent, GameAggregate, ProgressEntry } from '../shared/api.ts';

export const FREE_GAME_ID = 'libre';

export interface CatalogLookup {
  gameById: (id: string) => GameDefinition | undefined;
}

const defaultLookup: CatalogLookup = { gameById: (id) => GAMES.find((g) => g.id === id) };

export function gameTitle(gameId: string, lookup: CatalogLookup = defaultLookup): string {
  if (gameId === FREE_GAME_ID) return 'Proyecto libre';
  return lookup.gameById(gameId)?.title ?? gameId;
}

/** Step title from the catalog, falling back to the id when the game or step is unknown. */
export function stepTitle(gameId: string, stepId: string, lookup: CatalogLookup = defaultLookup): string {
  const step = lookup.gameById(gameId)?.phases.flatMap((phase) => phase.steps).find((s) => s.id === stepId);
  return step?.title ?? stepId;
}

export function totalSteps(gameId: string, lookup: CatalogLookup = defaultLookup): number | null {
  const game = lookup.gameById(gameId);
  return game ? game.phases.reduce((sum, phase) => sum + phase.steps.length, 0) : null;
}

/** The time of day on a 24-hour clock, «15:05:09», in the computer's own zone. Built by hand: locale formats may drop AM/PM. */
export function formatClock(date: Date): string {
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

/** Minutes for display: «<1» under a minute, whole minutes otherwise. */
export function formatMinutes(seconds: number): string {
  if (seconds <= 0) return '0';
  if (seconds < 60) return '<1';
  return String(Math.round(seconds / 60));
}

export interface ProgressRow {
  key: string;
  studentId: number;
  name: string;
  group: string;
  gameId: string;
  gameTitle: string;
  /** Null when the child finished or has no current step. */
  currentStep: { id: string; title: string } | null;
  completedCount: number;
  /** Null for the free project, which has no fixed steps. */
  totalSteps: number | null;
  minutes: string;
  finished: boolean;
  updatedAt: string;
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export function progressRows(
  entries: readonly ProgressEntry[],
  group: string | null = null,
  lookup: CatalogLookup = defaultLookup,
): ProgressRow[] {
  return entries
    .filter((entry) => group === null || entry.group === group)
    .map((entry) => ({
      key: `${entry.studentId}:${entry.gameId}`,
      studentId: entry.studentId,
      name: entry.name,
      group: entry.group,
      gameId: entry.gameId,
      gameTitle: gameTitle(entry.gameId, lookup),
      currentStep:
        entry.finished || entry.currentStep === null
          ? null
          : { id: entry.currentStep, title: stepTitle(entry.gameId, entry.currentStep, lookup) },
      completedCount: entry.completedCount,
      totalSteps: totalSteps(entry.gameId, lookup),
      minutes: formatMinutes(entry.activeSeconds),
      finished: entry.finished,
      updatedAt: entry.updatedAt,
    }))
    .sort((a, b) => collator.compare(a.name, b.name) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export interface GameRow {
  gameId: string;
  title: string;
  started: number;
  finished: number;
  averageMinutes: string;
  stuck: { id: string; title: string; count: number }[];
}

export function gameRows(games: readonly GameAggregate[], lookup: CatalogLookup = defaultLookup): GameRow[] {
  return games
    .map((game) => ({
      gameId: game.gameId,
      title: gameTitle(game.gameId, lookup),
      started: game.started,
      finished: game.finished,
      averageMinutes: formatMinutes(game.averageActiveSeconds),
      stuck: game.stuckSteps.map((s) => ({ id: s.stepId, title: stepTitle(game.gameId, s.stepId, lookup), count: s.count })),
    }))
    .sort((a, b) => b.started - a.started || collator.compare(a.title, b.title));
}

/** Students without any project, for the «todavía no empezaron» line. */
export function notStarted(students: readonly AdminStudent[], entries: readonly ProgressEntry[]): AdminStudent[] {
  const started = new Set(entries.map((e) => e.studentId));
  return students.filter((s) => !started.has(s.id)).sort((a, b) => collator.compare(a.name, b.name));
}

export function groupsOf(students: readonly { group: string }[]): string[] {
  return [...new Set(students.map((s) => s.group))].filter((g) => g !== '').sort(collator.compare);
}
