/** End to end: a mini game built from IR, played with virtual keys. */
import { describe, expect, it } from 'vitest';
import {
  addScore, changeVar, eq, forever, goTo, ifThen, moveWithArrows, onFlag, onPoints, onReceive, onTouching, project, say, send, setScore, setVar, sound, sprite, variable, wait, win,
} from '../language/ir.ts';
import { Game } from './testing.ts';

const miniGame = () =>
  project('parque', [
    sprite('hero', 'toby', [
      onFlag(setScore(0), forever(moveWithArrows(6))),
      onTouching('star', addScore(1), sound('magia'), send('m1')),
      onPoints(3, say('¡Ganaste!'), wait(0.2), win()),
    ], { x: -150, y: -100 }),
    sprite('star', 'star', [
      onFlag(setVar('i', 0)),
      onReceive('m1', changeVar('i', 1),
        ifThen(eq(variable('i'), 1), goTo(-120, 80)), ifThen(eq(variable('i'), 2), goTo(120, -80)), ifThen(eq(variable('i'), 3), goTo(0, 100))),
    ], { x: 120, y: 40 }),
  ], { variables: ['i'] });

/** A tiny player: holds the arrows that bring the hero toward the star until they touch. */
function walkToStar(g: Game): void {
  const reached = g.runUntil(() => {
    const hero = g.sprite('hero');
    const star = g.sprite('star');
    const dx = star.x - hero.x;
    const dy = star.y - hero.y;
    const want: Record<string, boolean> = {
      ArrowRight: dx > 6, ArrowLeft: dx < -6, ArrowUp: dy > 6, ArrowDown: dy < -6,
    };
    for (const [key, down] of Object.entries(want)) {
      if (down) g.machine.keyDown(key);
      else g.machine.keyUp(key);
    }
    return g.machine.touchingTarget(hero, 'star') || g.machine.ended !== null;
  }, 20_000);
  expect(reached).toBe(true);
  for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) g.release(k);
}

describe('collect three stars to win', () => {
  it('scores each star, moves it, and wins at three points', () => {
    const g = new Game(miniGame());
    g.flag();
    g.run(100);
    expect(g.machine.score).toBe(0);

    const seen: number[] = [];
    for (let star = 1; star <= 3; star++) {
      const before = { x: g.sprite('star').x, y: g.sprite('star').y };
      walkToStar(g);
      g.run(200);
      seen.push(g.machine.score ?? -1);
      if (star < 3) {
        expect(g.machine.ended).toBeNull();
        expect([g.sprite('star').x, g.sprite('star').y]).not.toEqual([before.x, before.y]);
      }
    }
    expect(seen).toEqual([1, 2, 3]);

    g.run(1000);
    expect(g.machine.ended).toBe('win');
    expect(g.host.endLog).toEqual(['win']);
    expect(g.host.sfxLog.filter((s) => s === 'magia')).toHaveLength(3);
    expect(g.host.spoken.map((s) => s.text)).toContain('¡Ganaste!');
    expect(g.machine.running).toBe(false);
    expect(g.machine.threadCount).toBe(0);

    const x = g.sprite('hero').x;
    g.hold('ArrowLeft', 500);
    expect(g.sprite('hero').x).toBe(x);

    const st = g.machine.stats;
    expect(st.won).toBe(true);
    expect(st.maxScore).toBe(3);
    expect(st.ranBy('hero', 'score')).toBe(true);
    expect(st.ranHat('points')).toBe(true);
    expect(st.ranHat('touching')).toBe(true);
    expect(g.machine.snapshot()).toMatchObject({ score: 3, ended: 'win' });
  });

  it('the same game is deterministic for a seed', () => {
    const play = () => {
      const g = new Game(miniGame());
      g.flag();
      walkToStar(g);
      g.run(100);
      return [g.sprite('star').x, g.sprite('star').y, g.time.now()];
    };
    expect(play()).toEqual(play());
  });

  it('losing the run on a new flag starts clean', () => {
    const g = new Game(miniGame());
    g.flag();
    g.machine.setScore(3);
    g.run(1000);
    expect(g.machine.ended).toBe('win');
    g.flag();
    g.run(100);
    expect(g.machine.ended).toBeNull();
    expect(g.machine.score).toBe(0);
    expect(g.sprite('hero').x).toBe(-150);
  });
});
