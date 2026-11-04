import type { ClassId, LevelId } from '../shared/levels.ts';
import { LEVEL_1 } from './level1/index.ts';
import { LEVEL_2 } from './level2/index.ts';
import { LEVEL_3 } from './level3/index.ts';
import { LEVEL_4 } from './level4/index.ts';
import { LEVEL_5 } from './level5/index.ts';
import type { GameDefinition } from './types.ts';

export const GAMES: GameDefinition[] = [...LEVEL_1, ...LEVEL_2, ...LEVEL_3, ...LEVEL_4, ...LEVEL_5];

/** The minimum guide length per level, from the design's class length rules. */
export const MIN_STEPS: Record<LevelId, number> = { 1: 8, 2: 10, 3: 10, 4: 12, 5: 12 };

export function gameById(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}

/** Games offered to a level in a class, easier first. */
export function gamesFor(level: LevelId, classId: ClassId): GameDefinition[] {
  return GAMES.filter((g) => g.level === level && g.class === classId).sort((a, b) => a.order - b.order);
}
