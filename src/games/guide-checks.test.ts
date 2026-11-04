/**
 * Step checks that used to pass without the child doing what the guide asks. Each case builds the shortcut
 * from a reference solution and expects the check to say no, next to the honest version that says yes.
 */
import { describe, expect, it } from 'vitest';
import type { ProjectProgram } from '../language/ir.ts';
import {
  addScore, changeVar, createClone, eq, face, forever, goTo, goToRandom, gt, hide, ifElse, ifThen, lt, moveWithArrows, onClick, onFlag, onPoints, onReceive,
  onTouching, randomBetween, repeat, score, send, setScore, setVar, sound, variable, wait, win,
} from '../language/ir.ts';
import { Game } from '../runtime/testing.ts';
import { Pilot, centerOf } from './level4/autopilot.ts';
import { tesoro } from './level4/tesoro.ts';
import { cazaPulpi } from './level3/caza-pulpi.ts';
import { contrarreloj } from './level5/contrarreloj.ts';
import { mascotaVirtual } from './level5/mascota-virtual.ts';
import { tresVidas } from './level5/tres-vidas.ts';
import { stepsOf } from './proof.ts';
import type { GameDefinition } from './types.ts';

const clone = (p: ProjectProgram): ProjectProgram => structuredClone(p);
const sprite = (p: ProjectProgram, id: string) => p.sprites.find((s) => s.id === id)!;
const passes = (game: GameDefinition, id: string, g: Game, program: ProjectProgram): boolean =>
  stepsOf(game).find((s) => s.id === id)!.check({ stats: g.machine.stats, program, machine: g.machine, ui: { backdropChosen: true } });

/** Presses the flag, lets a moment pass, optionally acts, then lets more time pass. */
function play(program: ProjectProgram, ms: number, act?: (g: Game) => void): Game {
  const g = new Game(program);
  g.flag();
  g.run(300);
  act?.(g);
  g.run(ms);
  return g;
}

describe('guide checks that need the real thing', () => {
  it('tesoro: a penalty that reuses the treasure message does not count', () => {
    const program = clone(tesoro.solution.program);
    sprite(program, 'explorador').scripts = [
      onFlag(setScore(0), goTo(-190, -130), forever(moveWithArrows(5))),
      onTouching('tesoro', addScore(1), sound('magia'), send('m1')),
      onReceive('m1', addScore(-1), goTo(-190, -130), sound('boing')),
    ];
    const g = new Game(program);
    g.flag();
    g.run(100);
    const pilot = new Pilot(g, { hero: 'explorador', speed: 2.5, hazards: ['guardia', 'guardia2'] });
    g.runUntil(() => {
      const c = centerOf(g.sprite('tesoro'));
      pilot.steer(c.x, c.y);
      return g.machine.stats.ranHat('touching');
    }, 60_000);
    pilot.release();
    g.run(300);
    expect(passes(tesoro, 'castigo', g, program)).toBe(false);
    g.machine.dispose();
  });

  it('mascota-virtual: a cap far above the food does not count, and the real one does', () => {
    const program = clone(mascotaVirtual.solution.program);
    sprite(program, 'manzana').scripts = [
      onClick(ifThen(eq(variable('durmiendo'), 0), changeVar('comida', 3), ifThen(gt(variable('comida'), 100), setVar('comida', 100)))),
    ];
    const lazy = play(program, 200, (g) => g.tap('manzana'));
    expect(passes(mascotaVirtual, 'tope', lazy, program)).toBe(false);
    const honest = play(clone(mascotaVirtual.solution.program), 200, (g) => g.tap('manzana'));
    expect(passes(mascotaVirtual, 'tope', honest, mascotaVirtual.solution.program)).toBe(true);
    lazy.machine.dispose();
    honest.machine.dispose();
  });

  it('mascota-virtual: both draining variables need their own protection', () => {
    const program = clone(mascotaVirtual.solution.program);
    sprite(program, 'mascota').scripts[2] = onFlag(forever(wait(3), changeVar('energia', -1)));
    const lazy = play(program, 23_000);
    expect(passes(mascotaVirtual, 'no-negativo', lazy, program)).toBe(false);
    const honest = play(clone(mascotaVirtual.solution.program), 23_000);
    expect(passes(mascotaVirtual, 'no-negativo', honest, mascotaVirtual.solution.program)).toBe(true);
    lazy.machine.dispose();
    honest.machine.dispose();
  });

  it('mascota-virtual: three faces without a sleeping case are not enough', () => {
    const program = clone(mascotaVirtual.solution.program);
    sprite(program, 'mascota').scripts[4] = onFlag(
      forever(ifElse(lt(variable('animo'), 3), [face('triste')], [ifElse(lt(variable('animo'), 6), [face('enojo')], [face('feliz')])])),
    );
    const lazy = play(program, 500);
    expect(passes(mascotaVirtual, 'cara-tres', lazy, program)).toBe(false);
    const honest = play(clone(mascotaVirtual.solution.program), 500);
    expect(passes(mascotaVirtual, 'cara-tres', honest, mascotaVirtual.solution.program)).toBe(true);
    lazy.machine.dispose();
    honest.machine.dispose();
  });

  it('tres-vidas: a wait that grows with the score does not shrink the pause', () => {
    const program = clone(tresVidas.solution.program);
    sprite(program, 'estrella').scripts[0] = onFlag(
      hide(),
      forever(ifElse(lt(randomBetween(1, 10), 8), [createClone()], [createClone('bomba')]), wait(score())),
    );
    const lazy = play(program, 300);
    expect(passes(tresVidas, 'ritmo', lazy, program)).toBe(false);
    const honest = play(clone(tresVidas.solution.program), 300);
    expect(passes(tresVidas, 'ritmo', honest, tresVidas.solution.program)).toBe(true);
    lazy.machine.dispose();
    honest.machine.dispose();
  });

  it('tres-vidas: cloning the same thing in both paths is not a mix', () => {
    const program = clone(tresVidas.solution.program);
    sprite(program, 'estrella').scripts[0] = onFlag(hide(), forever(ifElse(lt(randomBetween(1, 10), 8), [createClone()], [createClone()]), wait(1)));
    const lazy = play(program, 3_000);
    expect(passes(tresVidas, 'mezcla', lazy, program)).toBe(false);
    const honest = play(clone(tresVidas.solution.program), 6_000);
    expect(passes(tresVidas, 'mezcla', honest, tresVidas.solution.program)).toBe(true);
    lazy.machine.dispose();
    honest.machine.dispose();
  });

  it('contrarreloj: a goal under 12 ends the game before the phases, and an old win is not a new one', () => {
    for (const [goal, expected] of [[3, false], [8, false], [12, true], [15, true]] as const) {
      const program = clone(contrarreloj.solution.program);
      const hero = sprite(program, 'heroe');
      hero.scripts = hero.scripts.filter((s) => !(s.hat.type === 'a_points' && Number(s.hat.fields.N) === 15));
      hero.scripts.push(onPoints(goal, win()));
      const g = new Game(program);
      g.machine.stats.won = true;
      expect(passes(contrarreloj, 'meta', g, program), String(goal)).toBe(expected);
      g.machine.dispose();
    }
    const g = new Game(contrarreloj.solution.program);
    g.machine.stats.won = true;
    expect(passes(contrarreloj, 'final', g, contrarreloj.solution.program)).toBe(false);
    g.machine.dispose();
  });

  it('caza-pulpi: the pause that comes with the block is not a tuned rhythm', () => {
    for (const [pause, expected] of [[1, false], [0.8, true]] as const) {
      const program = clone(cazaPulpi.solution.program);
      sprite(program, 'pulpi').scripts[0] = onFlag(setScore(0), repeat(60, wait(pause), goToRandom()));
      const g = new Game(program);
      g.machine.score = 5;
      expect(passes(cazaPulpi, 'ritmo', g, program), String(pause)).toBe(expected);
      g.machine.dispose();
    }
  });
});
