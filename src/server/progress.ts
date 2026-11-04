import type { AdminProgressResponse, GameAggregate, GameProgress, ProgressEntry } from '../shared/api.ts';
import type { ProgressRow } from './db.ts';

const STUCK_LIMIT = 3;

export function parseProgress(json: string): GameProgress {
  try {
    const value = JSON.parse(json) as Partial<GameProgress>;
    return {
      currentStep: typeof value.currentStep === 'string' ? value.currentStep : null,
      completedSteps: Array.isArray(value.completedSteps) ? value.completedSteps : [],
      activeSeconds: typeof value.activeSeconds === 'number' ? value.activeSeconds : 0,
      finished: value.finished === true,
    };
  } catch {
    return { currentStep: null, completedSteps: [], activeSeconds: 0, finished: false };
  }
}

export function buildProgress(rows: ProgressRow[]): AdminProgressResponse {
  const entries: ProgressEntry[] = [];
  const perGame = new Map<string, { seconds: number; started: number; finished: number; stuck: Map<string, number> }>();

  for (const row of rows) {
    const progress = parseProgress(row.progress);
    entries.push({
      studentId: row.student.id,
      name: row.student.name,
      group: row.student.group,
      level: row.student.level,
      gameId: row.gameId,
      currentStep: progress.currentStep,
      completedCount: progress.completedSteps.length,
      activeSeconds: progress.activeSeconds,
      finished: progress.finished,
      updatedAt: row.updatedAt,
    });

    let game = perGame.get(row.gameId);
    if (!game) {
      game = { seconds: 0, started: 0, finished: 0, stuck: new Map() };
      perGame.set(row.gameId, game);
    }
    game.started++;
    game.seconds += progress.activeSeconds;
    if (progress.finished) game.finished++;
    else if (progress.currentStep !== null) {
      game.stuck.set(progress.currentStep, (game.stuck.get(progress.currentStep) ?? 0) + 1);
    }
  }

  const games: GameAggregate[] = [...perGame.entries()]
    .map(([gameId, game]) => ({
      gameId,
      started: game.started,
      finished: game.finished,
      averageActiveSeconds: Math.round(game.seconds / game.started),
      stuckSteps: [...game.stuck.entries()]
        .map(([stepId, count]) => ({ stepId, count }))
        .sort((a, b) => b.count - a.count || a.stepId.localeCompare(b.stepId))
        .slice(0, STUCK_LIMIT),
    }))
    .sort((a, b) => a.gameId.localeCompare(b.gameId));

  return { entries, games };
}
