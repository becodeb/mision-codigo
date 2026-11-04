import { describe, expect, it } from 'vitest';
import { Game } from '../../runtime/testing.ts';
import { Pilot, centerOf } from './autopilot.ts';
import { chispa } from './chispa.ts';

describe('chispa', () => {
  it('is not won by a child who does nothing', () => {
    const game = new Game(chispa.solution.program);
    game.flag();
    game.run(180_000);
    expect(game.machine.stats.won).toBe(false);
    expect(game.machine.score ?? 0).toBe(0);
    game.machine.dispose();
  });

  it('can be lost: walking into Chispa ends the game', () => {
    const game = new Game(chispa.solution.program);
    game.flag();
    game.run(100);
    const pilot = new Pilot(game, { hero: 'michi', speed: 2.5, hazards: [] });
    game.runUntil(() => {
      const c = centerOf(game.sprite('chispa'));
      pilot.steer(c.x, c.y);
      return game.machine.ended !== null;
    }, 60_000);
    pilot.release();
    expect(game.machine.ended).toBe('lose');
    expect(game.machine.stats.lost).toBe(true);
    game.machine.dispose();
  });

  it('keeps the second dragon hidden until phase 2', () => {
    const game = new Game(chispa.solution.program);
    game.flag();
    game.run(3_000);
    expect(game.sprite('chispita').visible).toBe(false);
    game.machine.dispose();
  });
});
