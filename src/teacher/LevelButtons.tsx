import type { CSSProperties } from 'react';
import { LEVELS, teamName } from '../shared/levels.ts';
import type { LevelId } from '../shared/levels.ts';
import { TEAM_COLORS, TEAM_INK } from '../workshop/teamColors.ts';

interface Props {
  value: LevelId;
  onPick: (level: LevelId) => void;
  /** Spoken name of the group, e.g. «Nivel de Luna». */
  label: string;
}

/** Five big buttons, one per level, in the color of the team. The current one is filled. */
export function LevelButtons({ value, onPick, label }: Props) {
  return (
    <div className="t-lv-row" role="group" aria-label={label}>
      {LEVELS.map(({ id }) => (
        <button
          key={id}
          type="button"
          className="t-lv"
          style={{ '--team': TEAM_COLORS[id], '--on': TEAM_INK[id] } as CSSProperties}
          aria-pressed={value === id}
          aria-label={`Nivel ${id}, ${teamName(id)}`}
          title={teamName(id)}
          onClick={() => onPick(id)}
        >
          {id}
        </button>
      ))}
    </div>
  );
}
