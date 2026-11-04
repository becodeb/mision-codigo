import type { GameProgress } from '../shared/api.ts';
import type { LevelId } from '../shared/levels.ts';
import type { GameDefinition } from '../games/types.ts';

/** What the workshop shell gives the studio. The project document is opaque to the shell. */
export interface StudioProps {
  /** Null means the free project. */
  game: GameDefinition | null;
  level: LevelId;
  initial: { project: unknown; progress: GameProgress } | null;
  /** Called often; the shell debounces saving and owns the offline fallback. */
  onSave: (project: unknown, progress: GameProgress) => void;
  onExit: () => void;
  /** The next game of the level, offered when this one is finished. */
  next: { title: string; open: () => void } | null;
}
