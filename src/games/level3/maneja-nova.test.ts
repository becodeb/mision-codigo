import { describe, expect, it } from 'vitest';
import { Game } from '../../runtime/testing.ts';
import { manejaNova } from './maneja-nova.ts';

/** Holds the arrow that closes the biggest gap until Nova touches the sprite (or the score moves), like a child would. */
function flyTo(game: Game, id: string): void {
  const score = game.machine.score;
  for (let i = 0; i < 200 && game.machine.score === score && !game.machine.touchingTarget(game.sprite('nova'), id); i++) {
    const nova = game.sprite('nova');
    const target = game.sprite(id);
    const dx = target.x - nova.x;
    const dy = target.y - nova.y;
    game.hold(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowUp' : 'ArrowDown', 80).run(40);
  }
}

describe('maneja-nova', () => {
  it('is not won by a child who does nothing', () => {
    const game = new Game(manejaNova.solution.program);
    game.flag();
    game.run(180_000);
    expect(game.machine.stats.won).toBe(false);
    // A drifting planet may brush against an idle Nova, but three minutes of waiting do not reach a new world.
    expect(game.machine.score ?? 0).toBeLessThan(5);
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

  it('does not score by tapping the planet: landing needs Nova to touch it', () => {
    const game = new Game(manejaNova.solution.program);
    game.flag();
    game.run(100);
    const planet = game.sprite('planeta');
    game.machine.tapAt(planet.x, planet.y + 15);
    game.run(300);
    expect(game.machine.score).toBe(0);
    game.machine.dispose();
  });

  it('scores a point and sends the planet elsewhere when Nova flies into it', () => {
    // Without the meteorite, which sits on the way.
    const program = { ...manejaNova.solution.program, sprites: manejaNova.solution.program.sprites.filter((s) => s.id !== 'meteorito') };
    const game = new Game(program);
    game.flag();
    game.run(100);
    const before = { x: game.sprite('planeta').x, y: game.sprite('planeta').y };
    flyTo(game, 'planeta');
    game.run(300);
    expect(game.machine.score).toBe(1);
    const after = game.sprite('planeta');
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
    game.machine.dispose();
  });

  it('keeps the home planet hidden until 5 points, and the meteorite costs a point on contact', () => {
    const game = new Game(manejaNova.solution.program);
    game.flag();
    game.run(100);
    expect(game.sprite('hogar').visible).toBe(false);
    const rock = game.sprite('meteorito');
    game.machine.tapAt(rock.x, rock.y + 15);
    game.run(200);
    expect(game.machine.score).toBe(0);
    flyTo(game, 'meteorito');
    game.run(200);
    expect(game.machine.score).toBe(-1);
    game.machine.dispose();
  });
});
