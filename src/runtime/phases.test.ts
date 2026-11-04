/** "When points reach N", messages and "stop my other scripts": phases without variables. */
import { describe, expect, it } from 'vitest';
import {
  addScore, changeVar, forever, onClick, onFlag, onPoints, onReceive, project, send, setScore, sprite, stopOthers, wait, win,
} from '../language/ir.ts';
import { play, solo } from './support.ts';

/** A "chaser" ticks slowly until the player reaches 5 points, then ticks fast. */
const phased = () =>
  project('parque', [
    sprite('player', 'toby', [onClick(addScore(1))], { x: -100, y: 0 }),
    sprite('chaser', 'chispa', [
      onFlag(forever(changeVar('slow', 1), wait(0.1))),
      onPoints(5, stopOthers(), send('p2'), changeVar('caller', 1)),
      onReceive('p2', forever(changeVar('fast', 1), wait(0.02))),
    ], { x: 100, y: 0 }),
  ], { variables: ['slow', 'fast', 'caller'] });

describe('when points reach N', () => {
  it('fires once, the first time the score reaches N', () => {
    const g = play(solo([onPoints(3, changeVar('n', 1))], { variables: ['n'] }));
    for (let i = 0; i < 6; i++) { g.machine.setScore(i); g.run(60); }
    expect(g.machine.vars.get('n')).toBe(1);
    expect(g.machine.stats.ranHat('points')).toBe(true);
  });

  it('does not fire below N', () => {
    const g = play(solo([onPoints(3, changeVar('n', 1))], { variables: ['n'] }));
    g.machine.setScore(2);
    g.run(200);
    expect(g.machine.vars.get('n')).toBe(0);
  });

  it('fires when the score jumps past N', () => {
    const g = play(solo([onFlag(wait(0.1), setScore(9)), onPoints(5, changeVar('n', 1))], { variables: ['n'] }));
    g.run(400);
    expect(g.machine.vars.get('n')).toBe(1);
  });

  it('does not fire again when the score drops and climbs back', () => {
    const g = play(solo([onPoints(2, changeVar('n', 1))], { variables: ['n'] }));
    g.machine.setScore(2); g.run(60);
    g.machine.setScore(0); g.run(60);
    g.machine.setScore(4); g.run(60);
    expect(g.machine.vars.get('n')).toBe(1);
  });

  it('re-arms on the green flag', () => {
    const g = play(solo([onPoints(1, changeVar('n', 1))], { variables: ['n'] }));
    g.machine.setScore(1);
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(1);
    g.flag();
    g.machine.setScore(1);
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(1);
    expect(g.machine.stats.count('score')).toBe(0);
  });

  it('is not polled before the flag, but starts once a tap wakes the project', () => {
    const g = play(solo([onPoints(1, changeVar('n', 1)), onClick(addScore(1))], { variables: ['n'] }));
    g.machine.stopAll();
    g.machine.setScore(5);
    g.run(200);
    expect(g.machine.vars.get('n')).toBe(0);
    g.tap('a');
    g.run(200);
    expect(g.machine.vars.get('n')).toBe(1);
  });

  it('every sprite has its own trigger', () => {
    const g = play({
      ...solo([onPoints(2, changeVar('n', 1))], { variables: ['n'] }),
    });
    g.machine.setScore(2);
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(1);
  });
});

describe('stop my other scripts', () => {
  it('stops the sprite\'s other threads and keeps the caller going', () => {
    const g = play(solo([
      onFlag(forever(changeVar('loop', 1))),
      onFlag(wait(0.2), stopOthers(), changeVar('after', 1)),
    ], { variables: ['loop', 'after'] }));
    g.run(1000);
    const loop = Number(g.machine.vars.get('loop'));
    expect(loop).toBeGreaterThan(3);
    expect(loop).toBeLessThan(15);
    expect(g.machine.vars.get('after')).toBe(1);
    g.run(500);
    expect(g.machine.vars.get('loop')).toBe(loop);
  });

  it('leaves other sprites alone', () => {
    const g = play(project('parque', [
      sprite('a', 'toby', [onFlag(wait(0.1), stopOthers())]),
      sprite('b', 'michi', [onFlag(forever(changeVar('b', 1)))]),
    ], { variables: ['b'] }));
    g.run(300);
    const b = g.machine.vars.get('b');
    g.run(300);
    expect(Number(g.machine.vars.get('b'))).toBeGreaterThan(Number(b));
    expect(g.machine.stats.ran('stopothers')).toBe(true);
  });

  it('leaves the clones of the sprite alone', () => {
    const g = play(solo([onFlag(wait(0.1), stopOthers())]));
    expect(g.machine.threadCount).toBe(1);
  });
});

describe('phases: at 5 points the slow loop stops and a faster one starts', () => {
  it('plays out', () => {
    const g = play(phased());
    g.run(1000);
    const slowBefore = Number(g.machine.vars.get('slow'));
    expect(slowBefore).toBeGreaterThanOrEqual(8);
    expect(g.machine.vars.get('fast')).toBe(0);

    for (let i = 0; i < 4; i++) { g.tap('player'); g.run(100); }
    expect(g.machine.score).toBe(4);
    expect(g.machine.vars.get('fast')).toBe(0);
    expect(Number(g.machine.vars.get('slow'))).toBeGreaterThan(slowBefore);

    g.tap('player');
    g.run(100);
    expect(g.machine.score).toBe(5);
    const slowAfter = Number(g.machine.vars.get('slow'));
    g.run(1000);
    expect(g.machine.vars.get('slow')).toBe(slowAfter);
    expect(Number(g.machine.vars.get('fast'))).toBeGreaterThan(20);
    expect(g.machine.vars.get('caller')).toBe(1);
  });

  it('a sixth point does not run the phase again, a new flag does', () => {
    const g = play(phased());
    g.machine.setScore(5);
    g.run(300);
    expect(g.machine.vars.get('caller')).toBe(1);
    g.machine.setScore(6);
    g.run(300);
    expect(g.machine.vars.get('caller')).toBe(1);
    g.flag();
    g.run(300);
    expect(g.machine.vars.get('slow')).toBeGreaterThan(0);
    expect(g.machine.vars.get('fast')).toBe(0);
    g.machine.setScore(5);
    g.run(300);
    expect(g.machine.vars.get('caller')).toBe(1);
    expect(Number(g.machine.vars.get('fast'))).toBeGreaterThan(5);
  });

  it('a phase can end the game', () => {
    const g = play(solo([onPoints(2, win())]));
    g.machine.setScore(2);
    g.run(100);
    expect(g.machine.ended).toBe('win');
  });
});
