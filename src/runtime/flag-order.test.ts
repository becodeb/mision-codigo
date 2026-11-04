import { describe, expect, it } from 'vitest';
import { forever, lose, lt, onFlag, repeatUntil, setScore, setVar, sprite, variable, wait, waitUntil, project, changeVar, add } from '../language/ir.ts';
import { Game } from './testing.ts';

describe('flag scripts and variables that are set later', () => {
  it('a wait that comes before the script setting the variable does not fire at once', () => {
    const game = new Game(
      project('parque', [
        sprite('a', 'toby', [onFlag(waitUntil(lt(variable('vidas'), 1)), lose()), onFlag(setVar('vidas', 3), forever(wait(10)))]),
      ], { variables: ['vidas'] }),
    );
    game.flag();
    game.run(500);
    expect(game.machine.ended).toBeNull();
    expect(game.machine.vars.get('vidas')).toBe(3);
    game.machine.dispose();
  });

  it('works for «repetir hasta que» across sprites, and for points', () => {
    const game = new Game(
      project('parque', [
        sprite('a', 'toby', [onFlag(repeatUntil(lt(variable('tiempo'), 1), wait(1), changeVar('tiempo', -1)), lose())]),
        sprite('b', 'michi', [onFlag(setVar('tiempo', 5), setScore(7), forever(wait(10)))]),
      ], { variables: ['tiempo'] }),
    );
    game.flag();
    game.run(2_000);
    expect(game.machine.ended).toBeNull();
    expect(game.machine.score).toBe(7);
    game.run(6_000);
    expect(game.machine.ended).toBe('lose');
    game.machine.dispose();
  });

  it('leaves calculated values to the script that runs them', () => {
    const game = new Game(
      project('parque', [sprite('a', 'toby', [onFlag(setVar('n', add(1, 2)), forever(wait(10)))])], { variables: ['n'] }),
    );
    game.flag();
    expect(game.machine.vars.get('n')).toBe(0);
    game.run(100);
    expect(game.machine.vars.get('n')).toBe(3);
    game.machine.dispose();
  });
});
