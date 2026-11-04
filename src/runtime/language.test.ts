import { describe, expect, it } from 'vitest';
import {
  addScore, ask, backdrop, bounce, changeSize, changeVar, changeX, changeY, face, forever, glide, goTo, goToRandom, goToSprite, hide, ifElse, ifThen,
  jump, lose, move, moveWithArrows, note, onFlag, point, pointDeg, pointTowards, project, repeat, repeatUntil, say, sayFor, score, send, setScore,
  setSize, setVar, setX, setY, show, sound, sprite, stopAll, stopThis, thinkFor, turn, variable, wait, waitUntil, win, gt, lt, eq, not,
  answer, onReceive, text,
} from '../language/ir.ts';
import { HH, HW } from './geometry.ts';
import { REPEAT_CAP } from './exec.ts';
import { play, solo } from './support.ts';

describe('motion', () => {
  it('moves along the direction: 0 up, 90 right, 180 down, -90 left', () => {
    const g = play(solo([onFlag(point('0'), move(10), point('90'), move(10), point('180'), move(4), point('-90'), move(2))]));
    g.run(300);
    expect(g.sprite('a').x).toBe(8);
    expect(g.sprite('a').y).toBe(6);
  });

  it('sets and changes coordinates and clamps to the stage', () => {
    const g = play(solo([onFlag(goTo(1000, 1000), changeX(-5), changeY(-10), setX(50), setY(-1000))]));
    g.run(300);
    expect(g.sprite('a').x).toBe(50);
    expect(g.sprite('a').y).toBe(-HH + 4);
    const h = play(solo([onFlag(goTo(1000, 1000))]));
    h.run(100);
    expect([h.sprite('a').x, h.sprite('a').y]).toEqual([HW - 12, HH - 40]);
  });

  it('changeX turns the drawing toward where it goes', () => {
    const g = play(solo([onFlag(changeX(-5))], { x: 0 }));
    g.run(100);
    expect(g.sprite('a').flip).toBe(-1);
  });

  it('glides over the given seconds with an eased path', () => {
    const g = play(solo([onFlag(glide(1, 100, 50), move(1))]));
    g.run(500);
    expect(g.sprite('a').x).toBeGreaterThan(40);
    expect(g.sprite('a').x).toBeLessThan(55);
    g.run(600);
    expect(g.sprite('a').x).toBe(101);
    expect(g.sprite('a').y).toBe(50);
  });

  it('go to random lands anywhere on the stage, reproducibly', () => {
    const run = (seed: number) => { const g = play(solo([onFlag(goToRandom())]), { seed }); g.run(100); return [g.sprite('a').x, g.sprite('a').y]; };
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
  });

  it('turns, points at an angle and normalizes it', () => {
    const g = play(solo([onFlag(pointDeg(270), turn(-10))]));
    g.run(100);
    expect(g.sprite('a').dir).toBe(-100);
    const h = play(solo([onFlag(pointDeg(0), turn(190))]));
    h.run(100);
    expect(h.sprite('a').dir).toBe(-170);
  });

  it('points toward and goes to another sprite', () => {
    const prog = project('parque', [
      sprite('a', 'toby', [onFlag(pointTowards('b'), move(10), goToSprite('c'))], { x: 0, y: 0 }),
      sprite('b', 'michi', [], { x: 100, y: 0 }),
      sprite('c', 'nova', [], { x: -50, y: 30 }),
    ]);
    const g = play(prog);
    g.run(200);
    expect(g.sprite('a').dir).toBe(90);
    expect([g.sprite('a').x, g.sprite('a').y]).toEqual([-50, 30]);
    const h = play(project('parque', [sprite('a', 'toby', [onFlag(pointTowards('b'))], { x: 0, y: 0 }), sprite('b', 'michi', [], { x: 0, y: 100 })]));
    h.run(100);
    expect(h.sprite('a').dir).toBe(0);
  });

  it('move with arrows follows the held keys at the given speed', () => {
    const g = play(solo([onFlag(forever(moveWithArrows(5)))]));
    g.run(100);
    expect(g.sprite('a').x).toBe(0);
    g.press('ArrowRight').press('ArrowUp');
    g.run(100);
    const { x, y } = g.sprite('a');
    expect(x).toBeGreaterThan(0);
    expect(x).toBe(y);
    expect(g.sprite('a').flip).toBe(1);
    g.release('ArrowRight').release('ArrowUp').press('ArrowLeft');
    g.run(60);
    expect(g.sprite('a').flip).toBe(-1);
    expect(g.sprite('a').dir).toBe(-90);
    expect(g.sprite('a').x).toBeLessThan(x);
    expect(g.machine.stats.ran('arrows')).toBe(true);
    expect(g.machine.stats.ran('move')).toBe(true);
  });

  it('jump with the text tier is the same hop', () => {
    const g = play(solo([onFlag(jump())]));
    let peak = 0;
    for (let i = 0; i < 30; i++) { g.run(20); peak = Math.max(peak, g.sprite('a').jy); }
    expect(peak).toBeGreaterThan(65);
    expect(g.sprite('a').jy).toBe(0);
  });

  it('bounce does nothing away from the borders', () => {
    const g = play(solo([onFlag(point('45' as never), bounce())]));
    g.run(100);
    expect(g.sprite('a').dir).toBe(45);
  });
});

describe('looks and sound', () => {
  it('say stays, say for goes away, think for makes a thought', () => {
    const g = play(solo([onFlag(say('hola'), wait(1), sayFor('chau', 1), thinkFor('mmm', 1))]));
    g.run(100);
    expect(g.sprite('a').bubble?.text).toBe('hola');
    g.run(1000);
    expect(g.sprite('a').bubble?.text).toBe('chau');
    g.run(1000);
    expect(g.sprite('a').bubble).toMatchObject({ text: 'mmm', kind: 'think' });
    g.run(1100);
    expect(g.sprite('a').bubble).toBeNull();
    expect(g.host.spoken.map((s) => s.text)).toEqual(['hola', 'chau']);
  });

  it('say with empty text clears the bubble', () => {
    const g = play(solo([onFlag(say('hola'), say(''))]));
    g.run(100);
    expect(g.sprite('a').bubble).toBeNull();
  });

  it('numbers can be said', () => {
    const g = play(solo([onFlag(setVar('n', 7), say(variable('n')))], { variables: ['n'] }));
    g.run(100);
    expect(g.sprite('a').bubble?.text).toBe('7');
  });

  it('size is clamped to 10..300', () => {
    const g = play(solo([onFlag(changeSize(1000), setSize(5))]));
    g.run(100);
    expect(g.sprite('a').size).toBe(10);
    const h = play(solo([onFlag(setSize(1000))]));
    h.run(100);
    expect(h.sprite('a').size).toBe(300);
  });

  it('face, show, hide, backdrop, sound and note', () => {
    const g = play(solo([onFlag(face('risa'), hide(), backdrop('mar'), sound('tambor'), note('re'), show())]));
    g.run(200);
    expect(g.sprite('a').face).toBe('risa');
    expect(g.sprite('a').visible).toBe(true);
    expect(g.machine.backdrop).toBe('mar');
    expect(g.host.sfxLog).toEqual(['tambor']);
    expect(g.host.noteLog).toEqual(['re']);
  });
});

describe('control', () => {
  it('wait pauses by the given seconds', () => {
    const g = play(solo([onFlag(wait(0.5), changeVar('n', 1))], { variables: ['n'] }));
    g.run(400);
    expect(g.machine.vars.get('n')).toBe(0);
    g.run(200);
    expect(g.machine.vars.get('n')).toBe(1);
  });

  it('repeat runs the body that many times; zero and negative do nothing', () => {
    const g = play(solo([onFlag(repeat(4, changeVar('n', 1)), repeat(0, changeVar('n', 100)), repeat(-3, changeVar('n', 100)))], { variables: ['n'] }));
    g.run(1000);
    expect(g.machine.vars.get('n')).toBe(4);
  });

  it('repeat is capped at 500', () => {
    const g = play(solo([onFlag(repeat(100_000, changeVar('n', 1)))], { variables: ['n'] }));
    g.run(30_000);
    expect(g.machine.vars.get('n')).toBe(REPEAT_CAP);
    expect(g.machine.threadCount).toBe(0);
  });

  it('every loop iteration yields a frame, so an empty forever cannot hang', () => {
    const g = play(solo([onFlag(forever())]));
    g.run(2000);
    expect(g.machine.threadCount).toBe(1);
    g.machine.stopAll();
    expect(g.machine.threadCount).toBe(0);
  });

  it('empty repeat-until and wait-until also yield', () => {
    const g = play(solo([onFlag(repeatUntil(eq(1, 2))), onFlag(waitUntil(eq(1, 2)))]));
    g.run(1000);
    expect(g.machine.threadCount).toBe(2);
  });

  it('a loop of instant blocks still advances time frame by frame', () => {
    const g = play(solo([onFlag(forever(changeVar('n', 1)))], { variables: ['n'] }));
    g.run(1000);
    expect(g.machine.vars.get('n')).toBe(50);
  });

  it('if and if/else pick a branch', () => {
    const g = play(solo([onFlag(
      ifThen(gt(2, 1), changeVar('a', 1)), ifThen(lt(2, 1), changeVar('a', 10)),
      ifElse(eq('Hola', 'hola'), [changeVar('b', 1)], [changeVar('b', 10)]),
      ifElse(not(eq(1, 1)), [changeVar('c', 1)], [changeVar('c', 10)]),
    )], { variables: ['a', 'b', 'c'] }));
    g.run(200);
    expect(['a', 'b', 'c'].map((k) => g.machine.vars.get(k))).toEqual([1, 1, 10]);
  });

  it('repeat until stops when the condition turns true', () => {
    const g = play(solo([onFlag(repeatUntil(gt(variable('n'), 4), changeVar('n', 2)), setVar('done', 1))], { variables: ['n', 'done'] }));
    g.run(500);
    expect(g.machine.vars.get('n')).toBe(6);
    expect(g.machine.vars.get('done')).toBe(1);
  });

  it('wait until holds a script until another one flips the condition', () => {
    const g = play(solo([onFlag(waitUntil(eq(variable('go'), 1)), setVar('after', 1)), onFlag(wait(1), setVar('go', 1))], { variables: ['go', 'after'] }));
    g.run(900);
    expect(g.machine.vars.get('after')).toBe(0);
    g.run(300);
    expect(g.machine.vars.get('after')).toBe(1);
  });

  it('stop this script ends only the caller', () => {
    const g = play(solo([onFlag(changeVar('n', 1), stopThis(), changeVar('n', 100)), onFlag(wait(0.1), changeVar('m', 1))], { variables: ['n', 'm'] }));
    g.run(300);
    expect(g.machine.vars.get('n')).toBe(1);
    expect(g.machine.vars.get('m')).toBe(1);
  });

  it('stop all halts every script of every sprite', () => {
    const g = play(project('parque', [
      sprite('a', 'toby', [onFlag(wait(0.2), stopAll(), changeVar('after', 1))]),
      sprite('b', 'michi', [onFlag(forever(changeVar('n', 1)))]),
    ], { variables: ['n', 'after'] }));
    g.run(1000);
    const n = Number(g.machine.vars.get('n'));
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(15);
    expect(g.machine.vars.get('after')).toBe(0);
    expect(g.machine.threadCount).toBe(0);
    expect(g.machine.ended).toBeNull();
  });

  it('win and lose end the run', () => {
    const w = play(solo([onFlag(wait(0.1), win(), changeVar('after', 1))], { variables: ['after'] }));
    w.run(500);
    expect(w.machine.ended).toBe('win');
    expect(w.machine.vars.get('after')).toBe(0);
    expect(w.host.endLog).toEqual(['win']);
    const l = play(solo([onFlag(lose())]));
    l.run(100);
    expect(l.machine.ended).toBe('lose');
    expect(l.machine.stats.lost).toBe(true);
  });
});

describe('points', () => {
  it('set, add and read', () => {
    const g = play(solo([onFlag(setScore(5), addScore(3), setVar('r', score()))], { variables: ['r'] }));
    g.run(100);
    expect(g.machine.score).toBe(8);
    expect(g.machine.vars.get('r')).toBe(8);
    expect(g.machine.stats.maxScore).toBe(8);
  });

  it('are null until used, and read as zero', () => {
    const g = play(solo([onFlag(setVar('r', score()))], { variables: ['r'] }));
    g.run(100);
    expect(g.machine.score).toBeNull();
    expect(g.machine.vars.get('r')).toBe(0);
  });

  it('snapshot exposes what checks need', () => {
    const g = play(solo([onFlag(addScore(2), setVar('v', 'x'), say('hi'))], { variables: ['v'], lists: ['l'] }));
    g.run(100);
    g.machine.setShown(true);
    const snap = g.machine.snapshot();
    expect(snap).toMatchObject({ score: 2, vars: { v: 'x' }, lists: { l: [] }, ended: null, shown: true, backdrop: 'parque' });
    expect(snap.sprites[0]).toMatchObject({ id: 'a', says: 'hi', visible: true });
  });
});

describe('ask', () => {
  it('waits for the answer, then continues with it', async () => {
    const g = play(solo([onFlag(ask('¿Cómo te llamás?'), setVar('name', answer()))], { variables: ['name'] }));
    g.run(200);
    expect(g.host.asked).toEqual(['¿Cómo te llamás?']);
    expect(g.machine.vars.get('name')).toBe(0);
    g.host.reply('Ana');
    await g.settle();
    g.run(100);
    expect(g.machine.vars.get('name')).toBe('Ana');
    expect(g.machine.answer).toBe('Ana');
  });

  it('stopping while a question is open abandons it', async () => {
    const g = play(solo([onFlag(ask('?'), changeVar('n', 1))], { variables: ['n'] }));
    g.run(100);
    g.machine.stopAll();
    expect(g.host.askCancels).toBeGreaterThan(0);
    g.host.reply('tarde');
    await g.settle();
    g.run(100);
    expect(g.machine.vars.get('n')).toBe(0);
    expect(g.machine.answer).toBe('');
  });

  it('the answer survives a message', async () => {
    const g = play(project('parque', [sprite('a', 'toby', [onFlag(ask('?'), send('m1')), onReceive('m1', setVar('got', answer()))])], { variables: ['got'] }));
    g.run(100);
    g.host.reply('sí');
    await g.settle();
    g.run(200);
    expect(g.machine.vars.get('got')).toBe('sí');
  });
});

describe('malformed programs', () => {
  it('values in statement position, hats in a body and unknown types do nothing', () => {
    const odd = [score(), { ...move(5), type: 'a_nope' as never }, ...onFlag().body];
    const g = play(solo([onFlag(...odd, changeVar('n', 1), onFlag().hat)], { variables: ['n'] }));
    g.run(200);
    expect(g.machine.errors).toEqual([]);
    expect(g.machine.vars.get('n')).toBe(1);
  });

  it('missing sockets read as zero or empty text', () => {
    const g = play(solo([onFlag({ ...move(5), inputs: {} }, say({ ...text('x'), fields: {} }))]));
    g.run(200);
    expect(g.machine.errors).toEqual([]);
    expect(g.sprite('a').x).toBe(0);
  });
});
