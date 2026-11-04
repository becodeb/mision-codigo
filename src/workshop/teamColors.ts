// Accent color of each team. Kept apart from the chooser model so the teacher panel can use it
// without pulling the whole games catalog into its bundle.
import type { LevelId } from '../shared/levels.ts';

export const TEAM_COLORS: Record<LevelId, string> = {
  1: '#FFC21A',
  2: '#4C97FF',
  3: '#2DB34A',
  4: '#F0524F',
  5: '#7C4DFF',
};

/** Text color that stays readable on top of each team color. */
export const TEAM_INK: Record<LevelId, string> = {
  1: '#241a4d',
  2: '#241a4d',
  3: '#241a4d',
  4: '#ffffff',
  5: '#ffffff',
};
