import { describe, expect, it } from 'vitest';
import { Game } from '../../runtime/testing.ts';
import { manejaNova } from './maneja-nova.ts';

describe('maneja-nova', () => {
  it('is not won by a child who does nothing', () => {
    const game = new Game(manejaNova.solution.program);
    game.flag();
    game.run(180_000);
    expect(game.machine.stats.won).toBe(false);
    expect(game.machine.score).toBe(0);
    expect(game.machine.backdrop).toBe('espacio');
    game.machine.dispose();
  });

  it('moves Nova one step per arrow press and keeps her on the stage', () => {
    const game = new Game(manejaNova.solution.program);
    game.flag();
    game.run(100);
    const x0 = game.sprite('nova').x;
    game.press('ArrowRight');
    game.run(100);
    game.release('ArrowRight');
    expect(game.sprite('nova').x).toBeGreaterThan(x0);
    for (let i = 0; i < 40; i++) game.press('ArrowRight').run(40).release('ArrowRight');
    expect(game.sprite('nova').x).toBeLessThanOrEqual(240);
    game.machine.dispose();
  });

  it('keeps the home planet hidden until 5 points, and the meteorite costs a point', () => {
    const game = new Game(manejaNova.solution.program);
    game.flag();
    game.run(100);
    expect(game.sprite('hogar').visible).toBe(false);
    const rock = game.sprite('meteorito');
    game.machine.tapAt(rock.x, rock.y + 15);
    game.run(200);
    expect(game.machine.score).toBe(-1);
    game.machine.dispose();
  });
});
