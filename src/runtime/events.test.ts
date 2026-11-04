import { describe, expect, it } from 'vitest';
import {
  addScore, changeVar, fClick, fRight, forever, ifThen, keyPressed, move, onClick, onFlag, onKey, onReceive, point, project, say,
  send, sprite, wait,
} from '../language/ir.ts';
import { play, solo } from './support.ts';
import { Game } from './testing.ts';

describe('threads', () => {
  it('flag starts every sprite\'s flag scripts and reports how many', () => {
    const g = new Game(project('parque', [
      sprite('a', 'toby', [onFlag(move(10)), onFlag(move(5))], { x: 0, y: 0 }),
      sprite('b', 'michi', [onFlag(move(1))], { x: 0, y: 0 }),
    ]));
    expect(g.flag()).toBe(3);
    g.run(100);
    expect(g.sprite('a').x).toBe(15);
    expect(g.sprite('b').x).toBe(1);
  });

  it('retriggering a hat restarts that script from the top', () => {
    const g = play(solo([fClick(fRight())]));
    g.tap('a');
    g.run(200);
    const partial = g.sprite('a').x;
    expect(partial).toBeGreaterThan(0);
    g.tap('a');
    g.run(1000);
    expect(g.sprite('a').x).toBeCloseTo(partial + 50, 5);
  });

  it('different scripts of one sprite run side by side', () => {
    const g = play(solo([onFlag(forever(changeVar('x', 1))), onFlag(forever(changeVar('y', 1)))], { variables: ['x', 'y'] }));
    g.run(200);
    expect(g.machine.vars.get('x')).toBe(g.machine.vars.get('y'));
    expect(Number(g.machine.vars.get('x'))).toBeGreaterThan(5);
  });

  it('a script that is waiting does not block the others', () => {
    const g = play(solo([onFlag(wait(10), changeVar('late', 1)), onFlag(changeVar('early', 1))], { variables: ['late', 'early'] }));
    g.run(100);
    expect(g.machine.vars.get('early')).toBe(1);
    expect(g.machine.vars.get('late')).toBe(0);
    expect(g.machine.threadCount).toBe(1);
  });

  it('green flag again restarts the world, stopAll keeps it', () => {
    const g = play(solo([onFlag(move(40))]));
    g.run(100);
    expect(g.sprite('a').x).toBe(40);
    g.machine.stopAll();
    expect(g.sprite('a').x).toBe(40);
    g.flag();
    g.run(100);
    expect(g.sprite('a').x).toBe(40);
  });

  it('stopAll ends every thread, clears bubbles and cancels speech', () => {
    const g = play(solo([onFlag(forever(changeVar('n', 1))), onFlag(say('hola'))], { variables: ['n'] }));
    g.run(100);
    expect(g.sprite('a').bubble).not.toBeNull();
    g.machine.stopAll();
    const n = g.machine.vars.get('n');
    g.run(200);
    expect(g.machine.vars.get('n')).toBe(n);
    expect(g.machine.threadCount).toBe(0);
    expect(g.sprite('a').bubble).toBeNull();
    expect(g.host.speechCancels).toBeGreaterThan(0);
    expect(g.machine.running).toBe(false);
  });
});

describe('messages', () => {
  const program = () =>
    project('parque', [
      sprite('a', 'toby', [onFlag(send('p2'), send('fb'))]),
      sprite('b', 'michi', [onReceive('p2', changeVar('hits', 1)), onReceive('fb', changeVar('end', 1))]),
      sprite('c', 'nova', [onReceive('m1', changeVar('hits', 100))]),
    ], { variables: ['hits', 'end'] });

  it('delivers to every sprite that listens for that message', () => {
    const g = play(program());
    g.run(200);
    expect(g.machine.vars.get('hits')).toBe(1);
    expect(g.machine.vars.get('end')).toBe(1);
    expect(g.machine.stats.ranHat('recv')).toBe(true);
  });

  it('a receiver can answer with another message', () => {
    const g = play(project('parque', [
      sprite('a', 'toby', [onFlag(send('m1')), onReceive('m2', changeVar('done', 1))]),
      sprite('b', 'michi', [onReceive('m1', send('m2'))]),
    ], { variables: ['done'] }));
    g.run(200);
    expect(g.machine.vars.get('done')).toBe(1);
  });

  it('sending again restarts a receiver that is still running', () => {
    const g = play(project('parque', [
      sprite('a', 'toby', [onFlag(send('m1'), wait(0.3), send('m1'))]),
      sprite('b', 'michi', [onReceive('m1', wait(0.5), changeVar('n', 1))]),
    ], { variables: ['n'] }));
    g.run(2000);
    expect(g.machine.vars.get('n')).toBe(1);
  });
});

describe('input', () => {
  it('a key hat fires on key down, once per press unless repeating', () => {
    const g = play(solo([onKey('ArrowRight', changeVar('n', 1))], { variables: ['n'] }));
    g.press('ArrowRight');
    g.run(100);
    g.press('ArrowRight');
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(1);
    g.machine.keyDown('ArrowRight', true);
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(2);
    g.release('ArrowRight');
    g.press('ArrowRight');
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(3);
  });

  it('only the matching key fires', () => {
    const g = play(solo([onKey('ArrowLeft', changeVar('n', 1))], { variables: ['n'] }));
    g.press('ArrowRight');
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(0);
  });

  it('a key held is readable by "key pressed" until released', () => {
    const g = play(solo([onFlag(forever(ifThen(keyPressed(' '), changeVar('n', 1))))], { variables: ['n'] }));
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(0);
    g.hold(' ', 200);
    const n = Number(g.machine.vars.get('n'));
    expect(n).toBeGreaterThan(5);
    g.run(200);
    expect(g.machine.vars.get('n')).toBe(n);
  });

  it('taps hit the topmost visible sprite', () => {
    const g = new Game(project('parque', [
      sprite('under', 'toby', [onClick(changeVar('u', 1))], { x: 0, y: 0 }),
      sprite('over', 'toby', [onClick(changeVar('o', 1))], { x: 0, y: 0 }),
    ], { variables: ['u', 'o'] }));
    expect(g.machine.tapAt(0, 40)).toBe('over');
    g.run(100);
    expect(g.machine.vars.get('o')).toBe(1);
    expect(g.machine.vars.get('u')).toBe(0);
    expect(g.machine.tapAt(200, 100)).toBeNull();
  });

  it('a hidden sprite cannot be tapped', () => {
    const g = new Game(project('parque', [sprite('a', 'toby', [onClick(changeVar('n', 1))], { x: 0, y: 0, visible: false })], { variables: ['n'] }));
    expect(g.machine.tapAt(0, 40)).toBeNull();
  });

  it('a tap runs its script even before the flag, like the old studio', () => {
    const g = new Game(solo([fClick(fRight())]));
    g.tap('a');
    g.run(600);
    expect(g.sprite('a').x).toBeCloseTo(50, 5);
  });

  it('point hat helper compiles: point + move go the way they say', () => {
    const g = play(solo([onFlag(point('0'), move(20), point('180'), move(5))]));
    g.run(200);
    expect(g.sprite('a').x).toBe(0);
    expect(g.sprite('a').y).toBe(15);
  });
});

describe('win and lose', () => {
  it('addScore then win stops everything and reports once', () => {
    const g = play(solo([onFlag(addScore(1)), onFlag(forever(changeVar('n', 1))), onClick(changeVar('t', 1))], { variables: ['n', 't'] }));
    g.run(100);
    g.machine.finish('win');
    g.machine.finish('lose');
    expect(g.machine.ended).toBe('win');
    expect(g.host.endLog).toEqual(['win']);
    const n = g.machine.vars.get('n');
    g.run(200);
    expect(g.machine.vars.get('n')).toBe(n);
    g.tap('a');
    g.press('ArrowLeft');
    g.run(100);
    expect(g.machine.vars.get('t')).toBe(0);
    expect(g.machine.stats.won).toBe(true);
    expect(g.machine.stats.lost).toBe(false);
  });

  it('the next green flag starts over', () => {
    const g = play(solo([onFlag(changeVar('n', 1))], { variables: ['n'] }));
    g.run(100);
    g.machine.finish('lose');
    g.flag();
    g.run(100);
    expect(g.machine.ended).toBeNull();
    expect(g.machine.vars.get('n')).toBe(1);
  });
});
