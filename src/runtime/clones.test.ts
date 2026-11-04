import { describe, expect, it } from 'vitest';
import {
  changeVar, changeX, createClone, deleteClone, forever, goTo, moveWithArrows, onClick, onCloneStart, onFlag, onReceive, project, repeat, send, setSize,
  sprite, stopAll, wait,
} from '../language/ir.ts';
import { CLONE_CAP } from './machine.ts';
import { play, solo } from './support.ts';

const clones = (g: ReturnType<typeof play>) => g.machine.instances.filter((i) => i.isClone);

describe('clones', () => {
  it('a clone starts as a copy of its parent and runs only the clone scripts', () => {
    const g = play(solo([
      onFlag(goTo(40, 10), setSize(150), createClone(), changeVar('flags', 1)),
      onCloneStart(changeX(30), changeVar('starts', 1)),
    ], { variables: ['flags', 'starts'] }));
    g.run(200);
    expect(clones(g)).toHaveLength(1);
    const c = clones(g)[0];
    expect(c.id).toBe('a#1');
    expect(c.size).toBe(150);
    expect(c.x).toBe(70);
    expect(g.sprite('a').x).toBe(40);
    expect(g.machine.vars.get('flags')).toBe(1);
    expect(g.machine.vars.get('starts')).toBe(1);
    expect(g.machine.stats.ranHat('clone')).toBe(true);
  });

  it('flag scripts do not run again on a clone', () => {
    const g = play(solo([onFlag(createClone(), wait(0.5), changeVar('n', 1))], { variables: ['n'] }));
    g.run(1000);
    expect(g.machine.vars.get('n')).toBe(1);
  });

  it('at most 30 clones exist at once', () => {
    const g = play(solo([onFlag(forever(createClone()))]));
    g.run(5000);
    expect(clones(g)).toHaveLength(CLONE_CAP);
    expect(g.machine.errors).toEqual([]);
  });

  it('a clone can clone another sprite', () => {
    const g = play(project('parque', [
      sprite('maker', 'toby', [onFlag(createClone('shot'))], { x: 0, y: 0 }),
      sprite('shot', 'bolt', [onCloneStart(changeVar('shots', 1))], { x: 80, y: 20 }),
    ], { variables: ['shots'] }));
    g.run(200);
    const c = clones(g)[0];
    expect(c.spriteId).toBe('shot');
    expect(c.x).toBe(80);
    expect(g.machine.vars.get('shots')).toBe(1);
  });

  it('delete clone removes the clone and its scripts, never an original', () => {
    const g = play(solo([
      onFlag(createClone(), deleteClone(), changeVar('after', 1)),
      onCloneStart(wait(0.2), deleteClone(), changeVar('never', 1)),
    ], { variables: ['after', 'never'] }));
    g.run(100);
    expect(clones(g)).toHaveLength(1);
    g.run(300);
    expect(clones(g)).toHaveLength(0);
    expect(g.machine.vars.get('never')).toBe(0);
    expect(g.machine.vars.get('after')).toBe(1);
    expect(g.machine.instances).toHaveLength(1);
  });

  it('clones answer messages and taps on their own', () => {
    const g = play(solo([
      onFlag(createClone(), createClone()),
      onReceive('m1', changeVar('heard', 1)),
      onClick(changeVar('tapped', 1)),
    ], { variables: ['heard', 'tapped'] }));
    g.run(100);
    g.machine.broadcast('m1');
    g.run(100);
    expect(g.machine.vars.get('heard')).toBe(3);
    g.tap('a#1');
    g.run(100);
    expect(g.machine.vars.get('tapped')).toBe(1);
  });

  it('clones move independently', () => {
    const g = play(solo([
      onFlag(createClone(), createClone()),
      onCloneStart(forever(moveWithArrows(2))),
    ]));
    g.run(100);
    g.press('ArrowRight');
    g.run(200);
    const xs = clones(g).map((c) => c.x);
    expect(xs[0]).toBeGreaterThan(0);
    expect(xs[0]).toBe(xs[1]);
    expect(g.sprite('a').x).toBe(0);
  });

  it('stop all and the next flag delete them', () => {
    const g = play(solo([onFlag(repeat(5, createClone()), wait(0.5), stopAll())]));
    g.run(300);
    expect(clones(g)).toHaveLength(5);
    g.run(600);
    expect(clones(g)).toHaveLength(0);
    const h = play(solo([onFlag(createClone())]));
    h.run(100);
    h.flag();
    expect(clones(h)).toHaveLength(0);
  });

  it('stats credit clone work to the sprite', () => {
    const g = play(solo([onFlag(createClone()), onCloneStart(changeX(1))]));
    g.run(200);
    expect(g.machine.stats.ranBy('a', 'move')).toBe(true);
    expect(g.machine.stats.ranBy('a', 'clone')).toBe(true);
  });

  it('send does not recurse forever when clones message each other', () => {
    const g = play(solo([onFlag(send('m1')), onReceive('m1', createClone(), send('m1'))]));
    g.run(3000);
    expect(clones(g).length).toBeLessThanOrEqual(CLONE_CAP);
    expect(g.machine.errors).toEqual([]);
  });
});
