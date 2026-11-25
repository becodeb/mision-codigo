import { describe, expect, it } from 'vitest';
import { SHOWCASE, showcaseFor } from '../games/showcase/index.ts';
import { addScore, changeVar, fClick, fJump, forever, ifThen, keyPressed, moveWithArrows, onClick, onFlag, onKey, project, send, setSize, sprite } from '../language/ir.ts';
import type { ProjectProgram, Script } from '../language/ir.ts';
import { controlsOf, hasControls, spriteIdOf } from './controls.ts';

const clone = (p: ProjectProgram): ProjectProgram => JSON.parse(JSON.stringify(p)) as ProjectProgram;
const setup = (level: 1 | 2 | 3 | 4 | 5): ProjectProgram => clone(showcaseFor(level).setup);
const addTo = (p: ProjectProgram, id: string, ...scripts: Script[]): void => { p.sprites.find((s) => s.id === id)!.scripts.push(...scripts); };

describe('controls of the showcase games', () => {
  it('level 1: no keys, only the star is the point, the pets are play', () => {
    const c = controlsOf(setup(1));
    expect(c.arrows).toEqual([]);
    expect(c.space).toBe(false);
    expect(c.movers).toEqual([]);
    expect(c.taps).toEqual([{ id: 'toby', main: false }, { id: 'michi', main: false }, { id: 'estrella', main: true }]);
  });

  it('level 2: Boo is the point; the other two react to a click', () => {
    const c = controlsOf(setup(2));
    expect(c.taps.find((t) => t.id === 'boo')?.main).toBe(true);
    expect(c.taps.filter((t) => t.main).length).toBe(1);
    expect(c.taps.map((t) => t.id).sort()).toEqual(['boo', 'coni', 'robi']);
  });

  it('level 3: four arrows from key hats, Nova moves, they work before the flag', () => {
    const c = controlsOf(setup(3));
    expect(c.arrows).toEqual(['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
    expect(c.movers).toEqual(['nova']);
    expect(c.taps).toEqual([]);
    expect(c.late).toEqual([]);
  });

  it.each([4, 5] as const)('level %i: arrows through «mover con flechas», only after the flag', (level) => {
    const c = controlsOf(setup(level));
    expect(c.arrows).toHaveLength(4);
    expect(c.space).toBe(false);
    expect(c.movers).toEqual([level === 4 ? 'coni' : 'chispa']);
    expect(c.late).toHaveLength(4);
    expect(c.taps).toEqual([]);
  });

  const of = (id: string) => controlsOf(SHOWCASE.find((g) => g.id === id)!.setup);

  it('the race: no keys, each racer and the treasure are the point', () => {
    const c = of('muestra-carrera');
    expect(c.arrows).toEqual([]);
    expect(c.taps).toEqual([{ id: 'tesoro', main: true }, { id: 'tomi', main: true }, { id: 'coni', main: true }]);
  });

  it('the concert: the four musicians are the point, the lights are play', () => {
    expect(of('muestra-concierto').taps).toEqual([
      { id: 'robi', main: true }, { id: 'michi', main: true }, { id: 'toby', main: true }, { id: 'pulpi', main: true }, { id: 'luces', main: false },
    ]);
  });

  it('every showcase game has something to do', () => {
    for (const g of SHOWCASE) expect(hasControls(controlsOf(g.setup)), g.id).toBe(true);
  });
});

describe('controls follow the edits', () => {
  it('a new space key shows up, with the sprite that listens to it', () => {
    const p = setup(3);
    addTo(p, 'estrella', onKey(' ', setSize(150)));
    const c = controlsOf(p);
    expect(c.space).toBe(true);
    expect(c.spacers).toEqual(['estrella']);
    expect(c.movers).toEqual(['nova']);
  });

  it('a «¿tecla espacio?» inside a script counts, and only works after the flag', () => {
    const p = setup(4);
    addTo(p, 'bomba', onFlag(forever(ifThen(keyPressed(' '), setSize(80)))));
    const c = controlsOf(p);
    expect(c.space).toBe(true);
    expect(c.spacers).toEqual(['bomba']);
    expect(c.late).toContain(' ');
  });

  it('a new click script makes a new tap; a scoring one is the point', () => {
    const p = setup(3);
    addTo(p, 'meteorito', onClick(setSize(50)));
    expect(controlsOf(p).taps).toEqual([{ id: 'meteorito', main: false }]);
    addTo(p, 'estrella', onClick(addScore(1)));
    expect(controlsOf(p).taps).toEqual([{ id: 'meteorito', main: false }, { id: 'estrella', main: true }]);
  });

  it('with no keys and nothing that scores, every tap is the point', () => {
    const p = project('parque', [sprite('a', 'toby', [fClick(fJump())]), sprite('b', 'michi', [fClick(fJump())])]);
    expect(controlsOf(p).taps).toEqual([{ id: 'a', main: true }, { id: 'b', main: true }]);
  });

  it('a click that sends a message or counts coins is the point', () => {
    const p = project('parque', [sprite('a', 'toby', [onClick(send('go'))]), sprite('b', 'michi', [onClick(changeVar('monedas', 1))]), sprite('c', 'michi', [onClick(setSize(50))])]);
    p.sprites.push(sprite('d', 'michi', [onKey('ArrowLeft', setSize(50))]));
    expect(controlsOf(p).taps).toEqual([{ id: 'a', main: true }, { id: 'b', main: true }, { id: 'c', main: false }]);
  });

  it('tapAll makes every clickable sprite the point, so a quiz points at no answer', () => {
    const quiz = project('aula', [sprite('a', 'toby', [onClick(addScore(1))]), sprite('b', 'michi', [onClick(setSize(50))]), sprite('c', 'michi', [onClick(setSize(60))])]);
    expect(controlsOf(quiz).taps.map((t) => t.main)).toEqual([true, false, false]);
    expect(controlsOf(quiz, true).taps.map((t) => t.main)).toEqual([true, true, true]);
    const keys = project('aula', [sprite('a', 'toby', [onKey('ArrowLeft', setSize(50)), onClick(setSize(50))])]);
    expect(controlsOf(keys, true).taps).toEqual([{ id: 'a', main: true }]);
  });

  it('removing the scripts removes the controls; empty hats do not count', () => {
    const p = setup(3);
    for (const s of p.sprites) s.scripts = s.scripts.filter((x) => x.hat.type !== 'a_key');
    const none = controlsOf(p);
    expect(none.arrows).toEqual([]);
    expect(none.movers).toEqual([]);
    const q = setup(3);
    addTo(q, 'estrella', onKey(' '), onClick());
    const c = controlsOf(q);
    expect(c.space).toBe(false);
    expect(c.taps).toEqual([]);
    const walker = project('parque', [sprite('a', 'toby', [onFlag(moveWithArrows(5))])]);
    expect(hasControls(controlsOf(walker))).toBe(true);
    walker.sprites[0].scripts = [onFlag()];
    expect(hasControls(controlsOf(walker))).toBe(false);
  });

  it('a clone answers to its original', () => {
    expect(spriteIdOf('rayo#4')).toBe('rayo');
    expect(spriteIdOf('nova')).toBe('nova');
  });
});

describe('goal line', () => {
  const goal = (level: 1 | 2 | 3 | 4 | 5, p = setup(level)): string => showcaseFor(level).showcase!.goal(p);

  it('names the goal of each game with marks the legend draws', () => {
    expect(goal(1)).toBe('Atrapá a {estrella} todas las veces que puedas');
    expect(goal(2)).toBe('Atrapá a {boo} antes de que se esconda');
    expect(goal(3)).toBe('Juntá **10** {estrella} y esquivá {meteorito}');
    expect(goal(4)).toBe('Atajá **10** {manzana} y esquivá {bomba}');
    expect(goal(5)).toBe('Juntá **10** {moneda} y esquivá {rayo}');
  });

  it('names the goal of the games of level 1 that come after the first', () => {
    const goalOf = (id: string): string => SHOWCASE.find((g) => g.id === id)!.showcase!.goal(SHOWCASE.find((g) => g.id === id)!.setup);
    expect(goalOf('muestra-carrera')).toBe('Llevá a {tomi} o a {coni} hasta {tesoro}');
    expect(goalOf('muestra-concierto')).toBe('Tocá una canción con {robi}, {michi}, {toby} y {pulpi}');
  });

  it('takes the number from the program: changed, or left out when nothing wins', () => {
    const p = setup(4);
    p.sprites.find((s) => s.id === 'coni')!.scripts.find((s) => s.hat.type === 'a_points')!.hat.fields.N = 5;
    expect(goal(4, p)).toBe('Atajá **5** {manzana} y esquivá {bomba}');
    p.sprites.find((s) => s.id === 'coni')!.scripts = p.sprites.find((s) => s.id === 'coni')!.scripts.filter((s) => s.hat.type !== 'a_points');
    expect(goal(4, p)).toBe('Atajá {manzana} y esquivá {bomba}');
  });
});
