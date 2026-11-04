import { describe, expect, it } from 'vitest';
import {
  addScore, changeVar, createClone, forever, goTo, hide, ifThen, moveWithArrows, onCloneStart, onFlag, onTouching, project, show, sprite, touching, wait,
} from '../language/ir.ts';
import { play } from './support.ts';

/** Two characters: `hero` can be moved with `goTo` from its own script, `star` stays put. */
const pair = (heroScripts: Parameters<typeof sprite>[2], starScripts: Parameters<typeof sprite>[2] = [], vars: string[] = ['hits']) =>
  project('parque', [
    sprite('hero', 'toby', heroScripts, { x: -200, y: 0 }),
    sprite('star', 'michi', starScripts, { x: 0, y: 0 }),
  ], { variables: vars });

describe('when touching (edge-triggered)', () => {
  it('fires once per contact, not every frame', () => {
    const g = play(pair([onFlag(goTo(0, 0), wait(2)), onTouching('star', changeVar('hits', 1))]));
    g.run(1500);
    expect(g.machine.vars.get('hits')).toBe(1);
    expect(g.machine.stats.ranHat('touching')).toBe(true);
  });

  it('re-arms after the sprites separate', () => {
    const g = play(pair([
      onFlag(goTo(0, 0), wait(0.5), goTo(-200, 0), wait(0.5), goTo(0, 0), wait(0.5), goTo(-200, 0), wait(0.5), goTo(0, 0)),
      onTouching('star', changeVar('hits', 1)),
    ]));
    g.run(4000);
    expect(g.machine.vars.get('hits')).toBe(3);
  });

  it('is already touching at the start: fires on the first frame, once', () => {
    const g = play(project('parque', [
      sprite('hero', 'toby', [onTouching('star', changeVar('hits', 1))], { x: 0, y: 0 }),
      sprite('star', 'michi', [], { x: 10, y: 0 }),
    ], { variables: ['hits'] }));
    g.run(1000);
    expect(g.machine.vars.get('hits')).toBe(1);
  });

  it('a hidden sprite is not touched, and showing it counts as a new contact', () => {
    const g = play(pair([onFlag(goTo(0, 0)), onTouching('star', changeVar('hits', 1))], [onFlag(hide(), wait(0.5), show())]));
    g.run(300);
    expect(g.machine.vars.get('hits')).toBe(0);
    g.run(600);
    expect(g.machine.vars.get('hits')).toBe(1);
  });

  it('works against the stage edge', () => {
    const g = play(project('parque', [sprite('hero', 'toby', [onFlag(forever(moveWithArrows(10))), onTouching('EDGE', changeVar('hits', 1))], { x: 150, y: 0 })], { variables: ['hits'] }));
    g.run(100);
    expect(g.machine.vars.get('hits')).toBe(0);
    g.hold('ArrowRight', 1000);
    expect(g.machine.vars.get('hits')).toBe(1);
  });

  it('is not polled while stopped', () => {
    const g = play(project('parque', [
      sprite('hero', 'toby', [onTouching('star', changeVar('hits', 1))], { x: 0, y: 0 }),
      sprite('star', 'michi', [], { x: 10, y: 0 }),
    ], { variables: ['hits'] }));
    g.machine.stopAll();
    g.machine.vars.set('hits', 0);
    g.run(500);
    expect(g.machine.vars.get('hits')).toBe(0);
  });

  it('the points can be earned each time the contact starts', () => {
    const g = play(pair([onFlag(goTo(0, 0), wait(0.3), goTo(-200, 0), wait(0.3), goTo(0, 0)), onTouching('star', addScore(1))]));
    g.run(2000);
    expect(g.machine.score).toBe(2);
  });

  it('clones of a sprite are touched too', () => {
    const g = play(project('parque', [
      sprite('hero', 'toby', [onTouching('star', changeVar('hits', 1))], { x: -200, y: 0 }),
      sprite('star', 'michi', [onFlag(createClone()), onCloneStart(goTo(-200, 0))], { x: 150, y: 0 }),
    ], { variables: ['hits'] }));
    g.run(500);
    expect(g.machine.vars.get('hits')).toBe(1);
  });
});

describe('touching as a value', () => {
  it('is true only while the hit circles overlap', () => {
    const g = play(pair([onFlag(forever(ifThen(touching('star'), changeVar('hits', 1))))]));
    g.run(200);
    expect(g.machine.vars.get('hits')).toBe(0);
    g.machine.moveInstance('hero', 0, 0);
    g.run(200);
    expect(Number(g.machine.vars.get('hits'))).toBeGreaterThan(3);
    expect(g.machine.stats.ran('touching')).toBe(true);
  });

  it('keeps the 15 percent tolerance of the old studio', () => {
    const g = play(pair([], []));
    const hero = g.sprite('hero');
    const star = g.sprite('star');
    star.x = 0;
    hero.x = 64;
    expect(g.machine.touchingTarget(hero, 'star')).toBe(true);
    hero.x = 66;
    expect(g.machine.touchingTarget(hero, 'star')).toBe(false);
  });
});

describe('stats that record what really happened', () => {
  it('a touch is recorded only when the sprites overlap, not when the question is asked', () => {
    const g = play(pair([onFlag(forever(ifThen(touching('star'), changeVar('hits', 1))))]));
    g.run(300);
    expect(g.machine.stats.ran('touching')).toBe(true);
    expect(g.machine.stats.touched()).toBe(false);
    expect(g.machine.stats.touched('hero', 'star')).toBe(false);
    g.machine.moveInstance('hero', 0, 0);
    g.run(100);
    expect(g.machine.stats.touched()).toBe(true);
    expect(g.machine.stats.touched('hero', 'star')).toBe(true);
    expect(g.machine.stats.touched('star', 'hero')).toBe(false);
  });

  it('a touching hat records the touch it started from', () => {
    const g = play(pair([onFlag(goTo(0, 0), wait(2)), onTouching('star', changeVar('hits', 1))]));
    g.run(100);
    expect(g.machine.stats.touched('hero', 'star')).toBe(true);
  });

  it('counts a score decrease, but not the first score of a run or a rise', () => {
    const g = play(pair([onFlag(addScore(2), wait(0.3), addScore(-1), wait(0.3), addScore(-1))]));
    g.run(100);
    expect(g.machine.stats.scoreDrops).toBe(0);
    g.run(400);
    expect(g.machine.stats.scoreDrops).toBe(1);
    g.run(400);
    expect(g.machine.stats.scoreDrops).toBe(2);
  });
});
