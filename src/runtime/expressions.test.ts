import { describe, expect, it } from 'vitest';
import {
  add, and, changeVar, distanceTo, div, eq, goTo, gt, join, listAdd, listClear, listDelete, listHas, listItem, listLength, listSet, lt, mod, mul,
  not, num, onFlag, or, posX, posY, project, randomBetween, repeat, setVar, sprite, sub, text, timer, touching, variable, wait,
} from '../language/ir.ts';
import { MAX_LIST, MAX_TEXT } from './values.ts';
import { evaluate, play, solo } from './support.ts';

describe('arithmetic', () => {
  it('adds, subtracts, multiplies, divides and takes the remainder', () => {
    expect(evaluate(add(2, 3))).toBe(5);
    expect(evaluate(sub(2, 3))).toBe(-1);
    expect(evaluate(mul(4, 2.5))).toBe(10);
    expect(evaluate(div(9, 4))).toBe(2.25);
    expect(evaluate(mod(7, 3))).toBe(1);
    expect(evaluate(mod(-1, 3))).toBe(2);
  });

  it('numbers typed as text still count', () => {
    expect(evaluate(add('2', '3'))).toBe(5);
    expect(evaluate(add('hola', 3))).toBe(3);
  });

  it('dividing by zero gives zero instead of poisoning positions', () => {
    expect(evaluate(div(5, 0))).toBe(0);
    expect(evaluate(div(0, 0))).toBe(0);
    expect(evaluate(mod(5, 0))).toBe(0);
  });

  it('nests', () => {
    expect(evaluate(add(mul(2, 3), sub(10, div(8, 2))))).toBe(12);
  });

  it('huge results stay finite', () => {
    expect(evaluate(mul(1e308, 1e308))).toBe(0);
  });
});

describe('comparison and logic', () => {
  it('compares numbers as numbers', () => {
    expect([evaluate(gt(10, 9)), evaluate(lt(10, 9)), evaluate(eq(1, '1.0')), evaluate(gt('10', '9'))]).toEqual([true, false, true, true]);
  });

  it('compares text without caring about case', () => {
    expect([evaluate(eq('Hola', 'hOLA')), evaluate(lt('a', 'B')), evaluate(eq('a', 'b')), evaluate(gt('abc', '10'))]).toEqual([true, true, false, true]);
  });

  it('and, or, not', () => {
    expect([evaluate(and(eq(1, 1), eq(2, 2))), evaluate(and(eq(1, 1), eq(2, 3))), evaluate(or(eq(1, 2), eq(2, 2))), evaluate(or(eq(1, 2), eq(2, 3))), evaluate(not(eq(1, 2)))])
      .toEqual([true, false, true, false, true]);
  });

  it('truthiness follows Scratch for non-booleans', () => {
    expect([evaluate(not(0)), evaluate(not('')), evaluate(not('false')), evaluate(not('hola')), evaluate(not(3))]).toEqual([true, true, true, false, false]);
  });
});

describe('text', () => {
  it('joins text and numbers', () => {
    expect(evaluate(join('Puntos: ', 12))).toBe('Puntos: 12');
    expect(evaluate(join(join('a', 'b'), 'c'))).toBe('abc');
  });

  it('cannot grow past the text limit by doubling', () => {
    const g = play(solo([onFlag(setVar('s', 'xy'), repeat(30, setVar('s', join(variable('s'), variable('s')))))], { variables: ['s'] }));
    g.run(2000);
    expect(String(g.machine.vars.get('s')).length).toBe(MAX_TEXT);
    expect(g.machine.errors).toEqual([]);
  });
});

describe('random', () => {
  it('gives whole numbers between the ends, both included', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed < 60; seed++) seen.add(evaluate(randomBetween(1, 4), { seed }) as number);
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('accepts the ends in either order', () => {
    for (let seed = 1; seed < 20; seed++) {
      const v = evaluate(randomBetween(5, -5), { seed }) as number;
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('gives fractions when an end is fractional', () => {
    const vs = [1, 2, 3, 4, 5].map((seed) => evaluate(randomBetween(0, 1.5), { seed }) as number);
    expect(vs.some((v) => !Number.isInteger(v))).toBe(true);
    for (const v of vs) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1.5); }
  });

  it('is reproducible for a seed', () => {
    expect(evaluate(randomBetween(1, 1000), { seed: 9 })).toBe(evaluate(randomBetween(1, 1000), { seed: 9 }));
  });
});

describe('position, distance and timer', () => {
  it('reads x and y', () => {
    const g = play(solo([onFlag(goTo(30, -20), setVar('px', posX()), setVar('py', posY()))], { variables: ['px', 'py'] }));
    g.run(100);
    expect([g.machine.vars.get('px'), g.machine.vars.get('py')]).toEqual([30, -20]);
  });

  it('measures the distance to another sprite', () => {
    const g = play(project('parque', [
      sprite('a', 'toby', [onFlag(setVar('d', distanceTo('b')), setVar('none', distanceTo('nobody')))], { x: 0, y: 0 }),
      sprite('b', 'michi', [], { x: 30, y: 40 }),
    ], { variables: ['d', 'none'] }));
    g.run(100);
    expect(g.machine.vars.get('d')).toBe(50);
    expect(g.machine.vars.get('none')).toBe(0);
  });

  it('the timer counts seconds since the green flag', () => {
    const g = play(solo([onFlag(wait(2), setVar('t', timer()))], { variables: ['t'] }));
    g.run(2500);
    const t = Number(g.machine.vars.get('t'));
    expect(t).toBeGreaterThanOrEqual(2);
    expect(t).toBeLessThan(2.2);
  });

  it('touching as a value is false for a missing sprite', () => {
    expect(evaluate(touching('nobody'))).toBe(false);
  });
});

describe('variables', () => {
  it('start at zero, can be set and changed', () => {
    const g = play(solo([onFlag(setVar('b', 'hola'), changeVar('a', 5), changeVar('a', -2), changeVar('b', 1), setVar('c', variable('a')))], { variables: ['a', 'b', 'c'] }));
    g.run(100);
    expect([g.machine.vars.get('a'), g.machine.vars.get('b'), g.machine.vars.get('c')]).toEqual([3, 1, 3]);
  });

  it('reading an unknown variable gives zero and setting one creates it', () => {
    expect(evaluate(variable('nope'))).toBe(0);
    const g = play(solo([onFlag(setVar('fresh', 4))]));
    g.run(100);
    expect(g.machine.vars.get('fresh')).toBe(4);
  });

  it('green flag resets them', () => {
    const g = play(solo([onFlag(changeVar('n', 1))], { variables: ['n'] }));
    g.run(100);
    g.flag();
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(1);
  });
});

describe('lists', () => {
  const prog = (...body: Parameters<typeof onFlag>) => play(solo([onFlag(...body)], { lists: ['l'], variables: ['r'] }));

  it('add, read by position, length and contains', () => {
    const g = prog(listAdd('l', 'a'), listAdd('l', 10), listAdd('l', 'c'), setVar('r', join(listItem('l', 1), listItem('l', 2))), setVar('n', listLength('l')),
      setVar('has', listHas('l', 'C')), setVar('hasnt', listHas('l', 'z')));
    g.run(200);
    expect(g.machine.lists.get('l')).toEqual(['a', 10, 'c']);
    expect(g.machine.vars.get('r')).toBe('a10');
    expect(g.machine.vars.get('n')).toBe(3);
    expect(g.machine.vars.get('has')).toBe(true);
    expect(g.machine.vars.get('hasnt')).toBe(false);
  });

  it('delete, replace and clear ignore positions out of range', () => {
    const g = prog(listAdd('l', 1), listAdd('l', 2), listAdd('l', 3), listDelete('l', 2), listSet('l', 1, 'x'), listSet('l', 9, 'no'), listDelete('l', 0), listDelete('l', 7));
    g.run(200);
    expect(g.machine.lists.get('l')).toEqual(['x', 3]);
    const h = prog(listAdd('l', 1), listClear('l'));
    h.run(200);
    expect(h.machine.lists.get('l')).toEqual([]);
  });

  it('an item out of range reads as empty text', () => {
    const g = prog(setVar('r', listItem('l', 3)));
    g.run(100);
    expect(g.machine.vars.get('r')).toBe('');
  });

  it('cannot grow past the list limit', () => {
    const g = prog(repeat(500, listAdd('l', 1), listAdd('l', 2), listAdd('l', 3)));
    g.run(20_000);
    expect(g.machine.lists.get('l')!.length).toBe(MAX_LIST);
  });

  it('lists start empty on every flag', () => {
    const g = prog(listAdd('l', 1));
    g.run(100);
    g.flag();
    g.run(100);
    expect(g.machine.lists.get('l')).toEqual([1]);
  });

  it('literals nest as sockets', () => {
    expect(evaluate(add(num(1), num(2)))).toBe(3);
    expect(evaluate(join(text('a'), num(1)))).toBe('a1');
  });
});
