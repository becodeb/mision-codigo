/** Regression tests for the three bugs of the old engine. */
import { describe, expect, it } from 'vitest';
import { bounce, changeVar, forever, goTo, jump, move, moveWithArrows, onFlag, onTouching, point, project, sprite, wait } from '../language/ir.ts';
import { HH, HW, edgeHits } from './geometry.ts';
import { play, solo } from './support.ts';
import { Game } from './testing.ts';

describe('fix 1: the bottom edge can be touched and bounced on', () => {
  it('"touching edge" is true at the floor limit, false in the middle', () => {
    const g = play(solo([onFlag(goTo(0, -1000))], { y: 0 }));
    expect(g.machine.touchingTarget(g.sprite('a'), 'EDGE')).toBe(false);
    g.run(100);
    expect(g.sprite('a').y).toBe(-HH + 4);
    expect(edgeHits(g.sprite('a')).bottom).toBe(true);
    expect(g.machine.touchingTarget(g.sprite('a'), 'EDGE')).toBe(true);
  });

  it('the touching hat fires when a sprite walks down to the floor', () => {
    const g = play(solo([onFlag(forever(moveWithArrows(10))), onTouching('EDGE', changeVar('n', 1))], { y: -100, variables: ['n'] }));
    g.run(200);
    expect(g.machine.vars.get('n')).toBe(0);
    g.hold('ArrowDown', 600);
    expect(g.machine.vars.get('n')).toBe(1);
  });

  it('bounce at the floor sends a downward sprite back up', () => {
    const g = play(solo([onFlag(bounce())], { y: -HH + 4, dir: 180 }));
    g.run(100);
    expect(g.sprite('a').dir).toBe(0);
  });

  it('a ball bounces off the floor and keeps going up and down', () => {
    const g = play(solo([onFlag(point('180'), forever(move(6), bounce()))], { y: 60, art: 'ball' }));
    let bounces = 0;
    let last = g.sprite('a').dir;
    for (let i = 0; i < 400; i++) {
      g.run(20);
      if (g.sprite('a').dir !== last) bounces++;
      last = g.sprite('a').dir;
    }
    expect(bounces).toBeGreaterThanOrEqual(3);
    expect(g.sprite('a').y).toBeGreaterThanOrEqual(-HH + 4);
  });
});

describe('fix 2: jumping moves the hitbox', () => {
  const stage = () => project('parque', [
    sprite('a', 'toby', [onFlag(wait(0.1), jump())], { x: 0, y: 0 }),
    sprite('b', 'toby', [], { x: 0, y: 100 }),
  ]);

  it('a jumper reaches a sprite above it only while it is in the air', () => {
    const g = play(stage());
    const a = g.sprite('a');
    expect(g.machine.touchingTarget(a, 'b')).toBe(false);
    expect(g.machine.hitbox('a')!.y).toBe(45);
    expect(g.runUntil(() => a.jy > 60, 2000)).toBe(true);
    expect(g.machine.touchingTarget(a, 'b')).toBe(true);
    expect(g.machine.hitbox('a')!.y).toBeGreaterThan(100);
    g.run(1000);
    expect(a.jy).toBe(0);
    expect(g.machine.touchingTarget(a, 'b')).toBe(false);
  });

  it('a "when touching" hat catches the jump', () => {
    const prog = project('parque', [
      sprite('a', 'toby', [onFlag(wait(0.1), jump()), onTouching('b', changeVar('hits', 1))], { x: 0, y: 0 }),
      sprite('b', 'toby', [], { x: 0, y: 100 }),
    ], { variables: ['hits'] });
    const g = play(prog);
    g.run(1500);
    expect(g.machine.vars.get('hits')).toBe(1);
  });

  it('jumping at the ceiling touches the top edge', () => {
    const g = new Game(project('parque', [sprite('a', 'toby', [], { x: 0, y: 80 })]));
    const a = g.sprite('a');
    expect(edgeHits(a).top).toBe(false);
    a.jy = 20;
    expect(edgeHits(a).top).toBe(true);
  });
});

describe('fix 3: bounce works at any angle', () => {
  const at = (x: number, y: number, dir: number): number => {
    const g = play(solo([onFlag(bounce())], { x, y, dir }));
    g.run(100);
    return g.sprite('a').dir;
  };
  const R = HW - 12;
  const T = HH - 40;
  const F = -HH + 4;

  it.each([
    ['right wall, 90', R, 0, 90, -90],
    ['right wall, 45', R, 0, 45, -45],
    ['right wall, 120', R, 0, 120, -120],
    ['left wall, -90', -R, 0, -90, 90],
    ['left wall, -30', -R, 0, -30, 30],
    ['left wall, -150', -R, 0, -150, 150],
    ['ceiling, 0', 0, T, 0, 180],
    ['ceiling, 45', 0, T, 45, 135],
    ['ceiling, -60', 0, T, -60, -120],
    ['floor, 180', 0, F, 180, 0],
    ['floor, 135', 0, F, 135, 45],
    ['floor, -135', 0, F, -135, -45],
    ['top-right corner', R, T, 45, -135],
    ['bottom-left corner', -R, F, -135, 45],
  ])('%s', (_name, x, y, dir, expected) => {
    expect(at(x, y, dir)).toBe(expected);
  });

  it.each([
    ['right wall, already leaving', R, 0, -45],
    ['left wall, already leaving', -R, 0, 45],
    ['floor, already leaving', 0, F, 30],
    ['ceiling, already leaving', 0, T, 150],
    ['sliding along the wall', R, 0, 0],
  ])('does not turn around again: %s', (_name, x, y, dir) => {
    expect(at(x, y, dir)).toBe(dir);
  });

  it('mirrors the drawing when the heading flips sides', () => {
    const g = play(solo([onFlag(bounce())], { x: HW - 12, y: 0, dir: 45, flip: 1 }));
    g.run(100);
    expect(g.sprite('a').flip).toBe(-1);
  });

  it('a diagonal ball ricochets around the stage and never leaves it', () => {
    const g = play(solo([onFlag(forever(move(7), bounce()))], { x: 0, y: 0, art: 'ball', dir: 30 }));
    const hit = { l: false, r: false, t: false, b: false };
    for (let i = 0; i < 1500; i++) {
      g.run(20);
      const s = g.sprite('a');
      expect(s.x).toBeGreaterThanOrEqual(-R);
      expect(s.x).toBeLessThanOrEqual(R);
      expect(s.y).toBeGreaterThanOrEqual(F);
      expect(s.y).toBeLessThanOrEqual(T);
      const e = edgeHits(s);
      hit.l ||= e.left; hit.r ||= e.right; hit.t ||= e.top; hit.b ||= e.bottom;
    }
    expect(hit).toEqual({ l: true, r: true, t: true, b: true });
  });
});
