import { describe, expect, it } from 'vitest';
import { Game } from '../../runtime/testing.ts';
import { Pilot, centerOf } from './autopilot.ts';
import { tesoro } from './tesoro.ts';

const walkInto = (game: Game, id: string, done: () => boolean, hazards: string[] = []): void => {
  const pilot = new Pilot(game, { hero: 'explorador', speed: 2.5, hazards });
  game.runUntil(() => {
    const c = centerOf(game.sprite(id));
    pilot.steer(c.x, c.y);
    return done();
  }, 60_000);
  pilot.release();
};

describe('tesoro', () => {
  it('neither wins nor loses for a child who does nothing', () => {
    const game = new Game(tesoro.solution.program);
    game.flag();
    game.run(180_000);
    expect(game.machine.stats.won).toBe(false);
    expect(game.machine.stats.lost).toBe(false);
    expect(game.machine.score).toBe(0);
    game.machine.dispose();
  });

  it('takes a point and sends the explorer home when a guard catches it in phase 1', () => {
    const game = new Game(tesoro.solution.program);
    game.flag();
    game.run(100);
    // Pick up the treasure first so there is a point to lose.
    walkInto(game, 'tesoro', () => (game.machine.score ?? 0) >= 1, ['guardia', 'guardia2']);
    game.run(300);
    expect(game.machine.score).toBe(1);
    walkInto(game, 'guardia', () => (game.machine.score ?? 0) < 1);
    game.run(300);
    expect(game.machine.score).toBe(0);
    expect(game.sprite('explorador').x).toBeLessThan(-150);
    expect(game.machine.ended).toBeNull();
    game.machine.dispose();
  });

  it('moves the treasure after each find', () => {
    const game = new Game(tesoro.solution.program);
    game.flag();
    game.run(100);
    const before = { x: game.sprite('tesoro').x, y: game.sprite('tesoro').y };
    walkInto(game, 'tesoro', () => (game.machine.score ?? 0) >= 1, ['guardia', 'guardia2']);
    game.run(300);
    expect([game.sprite('tesoro').x, game.sprite('tesoro').y]).not.toEqual([before.x, before.y]);
    game.machine.dispose();
  });
});
