import { describe, expect, it } from 'vitest';
import { KNOWN_GAME_IDS } from '../shared/gameIds.ts';
import { ALL_GAMES } from './catalog.ts';

describe('known game ids', () => {
  it('lets the server store every game in the catalog', () => {
    const missing = ALL_GAMES.map((g) => g.id).filter((id) => !KNOWN_GAME_IDS.has(id));
    expect(missing).toEqual([]);
  });
});
