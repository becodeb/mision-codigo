// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { showcaseFor } from '../games/showcase/index.ts';
import { LEVELS } from '../shared/levels.ts';
import { StudioSession } from './session.ts';

describe('opening a tutorial', () => {
  it('leaves the child on the sprite they were on: going to the right one is a step of the tutorial', () => {
    for (const { id: level } of LEVELS) {
      const game = showcaseFor(level);
      const s = new StudioSession({ game, level, initial: null, onSave: () => undefined });
      for (const { step } of s.tracker.steps) for (const sprite of s.doc.sprites) {
        s.selectSprite(sprite.id);
        s.openCard(step.id);
        expect(s.doc.selected, `${game.id} ${step.id}`).toBe(sprite.id);
        s.openCard(null);
      }
    }
  });
});
