import { describe, expect, it } from 'vitest';
import {
  addScore, changeVar, changeY, face, forever, goTo, hide, onFlag, project, show, sprite, wait,
} from '../language/ir.ts';
import { StatsRecorder } from './stats.ts';
import { play } from './support.ts';

describe('sampled values', () => {
  it('keeps first, last, range, changes and how many different values were seen', () => {
    const st = new StatsRecorder();
    expect(st.sampled('k')).toBeUndefined();
    for (const v of [3, 3, 5, 1, 5]) st.sample('k', v);
    expect(st.sampled('k')).toEqual({ count: 5, first: 3, last: 5, changes: 3, min: 1, max: 5, distinct: 3 });
    st.sample('f', 'feliz');
    st.sample('f', 'triste');
    expect(st.sampled('f')).toMatchObject({ first: 'feliz', last: 'triste', changes: 1, distinct: 2 });
    st.reset();
    expect(st.sampled('k')).toBeUndefined();
  });

  it('counts the blocks that ran per script, apart from the other scripts of the sprite', () => {
    const g = play(project('parque', [sprite('a', 'toby', [onFlag(hide(), show(), hide()), onFlag(show())])]));
    g.run(200);
    expect(g.machine.stats.blockRuns('a', 0, ['a_hide'])).toBe(2);
    expect(g.machine.stats.blockRuns('a', 1, ['a_hide'])).toBe(0);
    expect(g.machine.stats.blockRuns('a', undefined, ['a_show', 'a_hide'])).toBe(4);
    expect(g.machine.stats.blockRuns('b', undefined, ['a_hide'])).toBe(0);
  });
});

describe('what the runtime measures while a program runs', () => {
  it('records how far a sprite really moved, and clones apart from the original', () => {
    const g = play(project('parque', [sprite('a', 'toby', [onFlag(goTo(0, 100), changeY(-50), changeY(-50), changeY(-50))])]));
    g.run(400);
    const y = g.machine.stats.sampled('y|a')!;
    expect(y.max - y.min).toBe(150);
    expect(g.machine.stats.sampled('cy|a')).toBeUndefined();
  });

  it('records the wait, the variable and the face as they change', () => {
    const g = play(project('parque', [sprite('a', 'michi', [onFlag(face('triste'), changeVar('v', 2), wait(0.1), face('feliz'), changeVar('v', 2))])], { variables: ['v'] }));
    g.run(500);
    expect(g.machine.stats.sampled('wait|a#0')).toMatchObject({ count: 1, first: 0.1 });
    expect(g.machine.stats.sampled('var|v')).toMatchObject({ first: 2, last: 4, distinct: 2 });
    /* The face it started with counts, so triste then feliz is two changes. */
    expect(g.machine.stats.sampled('face|a')).toMatchObject({ first: 'feliz', changes: 2, distinct: 2 });
  });

  it('does not count the score going up, or the first score of a run, as a drop', () => {
    const g = play(project('parque', [sprite('a', 'toby', [onFlag(addScore(1), forever(wait(1)))])]));
    g.run(300);
    expect(g.machine.stats.scoreDrops).toBe(0);
  });
});
