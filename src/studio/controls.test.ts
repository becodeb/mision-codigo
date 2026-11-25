import { describe, expect, it } from 'vitest';
import { SHOWCASE, showcaseFor } from '../games/showcase/index.ts';
import { addScore, fClick, fJump, forever, ifThen, keyPressed, moveWithArrows, onClick, onFlag, onKey, project, setSize, sprite } from '../language/ir.ts';
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
    expect(goal(1)).toBe('Tocá a {estrella} todas las veces que puedas');
    expect(goal(2)).toBe('Tocá a {boo} antes de que se esconda');
    expect(goal(3)).toBe('Juntá **10** {estrella} y esquivá {meteorito}');
    expect(goal(4)).toBe('Atajá **10** {manzana} y esquivá {bomba}');
    expect(goal(5)).toBe('Juntá **10** {moneda} y esquivá {rayo}');
  });

  it('takes the number from the program: changed, or left out when nothing wins', () => {
    const p = setup(4);
    p.sprites.find((s) => s.id === 'coni')!.scripts.find((s) => s.hat.type === 'a_points')!.hat.fields.N = 5;
    expect(goal(4, p)).toBe('Atajá **5** {manzana} y esquivá {bomba}');
    p.sprites.find((s) => s.id === 'coni')!.scripts = p.sprites.find((s) => s.id === 'coni')!.scripts.filter((s) => s.hat.type !== 'a_points');
    expect(goal(4, p)).toBe('Atajá {manzana} y esquivá {bomba}');
  });
});
