import { describe, expect, it } from 'vitest';
import { Game } from '../../runtime/testing.ts';
import { cazaPulpi } from './caza-pulpi.ts';

describe('caza-pulpi', () => {
  it('is not won by a child who does nothing', () => {
    const game = new Game(cazaPulpi.solution.program);
    game.flag();
    game.run(180_000);
    expect(game.machine.stats.won).toBe(false);
    expect(game.machine.ended).toBeNull();
    expect(game.machine.score).toBe(0);
    game.machine.dispose();
  });

  it('gives a point and moves Pulpi when it is tapped', () => {
    const game = new Game(cazaPulpi.solution.program);
    game.flag();
    game.run(100);
    const before = { x: game.sprite('pulpi').x, y: game.sprite('pulpi').y };
    game.machine.tapAt(before.x, before.y + 20);
    game.run(200);
    expect(game.machine.score).toBe(1);
    expect([game.sprite('pulpi').x, game.sprite('pulpi').y]).not.toEqual([before.x, before.y]);
    game.machine.dispose();
  });

  it('keeps the second target hidden until phase 2', () => {
    const game = new Game(cazaPulpi.solution.program);
    game.flag();
    game.run(2_000);
    expect(game.sprite('pulpito').visible).toBe(false);
    game.machine.dispose();
  });
});

describe('caza-pulpi ending', () => {
  it('wins on exactly ten points: the win sign does not leave time for more taps to score', () => {
    const game = new Game(cazaPulpi.solution.program);
    game.flag();
    game.run(400);
    /* A quick child: six taps a second, alternating between the two targets. */
    for (let turn = 0; turn < 600 && !game.machine.ended; turn++) {
      const s = game.sprite(turn % 2 ? 'pulpito' : 'pulpi');
      if (s.visible) game.machine.tapAt(s.x, s.y + 20);
      game.run(160);
    }
    expect(game.machine.ended).toBe('win');
    expect(game.machine.score).toBe(10);
    game.run(2_000);
    expect(game.machine.score).toBe(10);
    game.machine.dispose();
  });
});
