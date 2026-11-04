import { describe, expect, it } from 'vitest';
import {
  fBackdrop, fClick, fDown, fFace, fFlag, fGrow, fHide, fJump, fLeft, fNote, fRandom, fRecv, fRepeat, fRight, fSay, fSend, fShow,
  fShrink, fSound, fSpin, fStar, fText, fUp, fWait,
} from '../language/ir.ts';
import { HH, HW } from './geometry.ts';
import { play, solo } from './support.ts';
import { Game } from './testing.ts';

describe('picture tier: movement', () => {
  it('walks 50 to the right in about 380 ms and faces right', () => {
    const g = play(solo([fFlag(fRight())], { x: -100, dir: -90, flip: -1 }));
    g.run(200);
    const mid = g.sprite('a').x;
    expect(mid).toBeGreaterThan(-100);
    expect(mid).toBeLessThan(-50);
    g.run(400);
    expect(g.sprite('a').x).toBeCloseTo(-50, 5);
    expect(g.sprite('a').dir).toBe(90);
    expect(g.sprite('a').flip).toBe(1);
    expect(g.host.sfxLog).toContain('step');
  });

  it('left, up and down move 50, 40 and 40', () => {
    const g = play(solo([fFlag(fLeft(), fUp(), fUp(), fDown())]));
    g.run(2500);
    expect(g.sprite('a').x).toBeCloseTo(-50, 5);
    expect(g.sprite('a').y).toBeCloseTo(40, 5);
    expect(g.sprite('a').flip).toBe(-1);
  });

  it('bobs while walking and settles when done', () => {
    const g = play(solo([fFlag(fRight())]));
    g.runUntil(() => g.sprite('a').bob > 0, 1000);
    expect(g.sprite('a').bob).toBeGreaterThan(0);
    g.run(600);
    expect(g.sprite('a').bob).toBe(0);
  });

  it('never leaves the stage', () => {
    const g = play(solo([fFlag(fRepeat(9, fRight(), fRight()))], { x: 200 }));
    g.run(20_000);
    expect(g.sprite('a').x).toBe(HW - 12);
  });

  it('blocks run one after another, not together', () => {
    const g = play(solo([fFlag(fRight(), fRight())]));
    g.run(500);
    expect(g.sprite('a').x).toBeLessThan(60);
    g.run(400);
    expect(g.sprite('a').x).toBeCloseTo(100, 5);
  });

  it('jump rises 70 and lands in about half a second', () => {
    const g = play(solo([fFlag(fJump())]));
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      g.run(20);
      peak = Math.max(peak, g.sprite('a').jy);
    }
    expect(peak).toBeGreaterThan(65);
    expect(peak).toBeLessThanOrEqual(70);
    expect(g.sprite('a').jy).toBe(0);
    expect(g.host.sfxLog).toContain('jump');
  });

  it('spin turns a full circle in about 650 ms', () => {
    const g = play(solo([fFlag(fSpin(), fRight())]));
    g.run(300);
    expect(g.sprite('a').rot).toBeGreaterThan(0);
    g.run(400);
    expect(g.sprite('a').rot).toBe(0);
    expect(g.sprite('a').x).toBeGreaterThan(0);
    expect(g.host.sfxLog).toContain('boing');
  });

  it('appears somewhere else with fRandom, inside the stage', () => {
    const g = play(solo([fFlag(fRandom())], { x: 0, y: 0 }), { seed: 7 });
    g.run(100);
    const s = g.sprite('a');
    expect(s.x).not.toBe(0);
    expect(Math.abs(s.x)).toBeLessThanOrEqual(HW - 12);
    expect(s.y).toBeGreaterThanOrEqual(-HH + 4);
    expect(s.y).toBeLessThanOrEqual(HH - 40);
  });
});

describe('picture tier: looks', () => {
  it('grows by a quarter and shrinks back, within 30..260', () => {
    const g = play(solo([fFlag(fGrow(), fGrow())]));
    g.run(1000);
    expect(g.sprite('a').size).toBeCloseTo(156.25, 5);
    const h = play(solo([fFlag(fRepeat(9, fShrink()))]));
    h.run(20_000);
    expect(h.sprite('a').size).toBe(30);
    const k = play(solo([fFlag(fRepeat(9, fGrow()))]));
    k.run(20_000);
    expect(k.sprite('a').size).toBe(260);
  });

  it('changes the face and holds for 350 ms', () => {
    const g = play(solo([fFlag(fFace('triste'), fRight())]));
    g.run(100);
    expect(g.sprite('a').face).toBe('triste');
    expect(g.sprite('a').x).toBe(0);
    g.run(400);
    expect(g.sprite('a').x).toBeGreaterThan(0);
  });

  it('objects ignore the face block', () => {
    const g = play(solo([fFlag(fFace('enojo'))], { art: 'star' }));
    g.run(600);
    expect(g.sprite('a').face).toBe('feliz');
  });

  it('hides and shows', () => {
    const g = play(solo([fFlag(fHide(), fWait(1), fShow())]));
    g.run(100);
    expect(g.sprite('a').visible).toBe(false);
    g.run(1200);
    expect(g.sprite('a').visible).toBe(true);
  });

  it('changes the scene', () => {
    const g = play(solo([fFlag(fBackdrop('espacio'))]));
    g.run(100);
    expect(g.machine.backdrop).toBe('espacio');
  });

  it('a star adds one to the shared points', () => {
    const g = play(solo([fFlag(fStar(), fStar())]));
    g.run(100);
    expect(g.machine.score).toBe(2);
    expect(g.machine.stats.ran('score')).toBe(true);
    expect(g.machine.stats.ran('star')).toBe(true);
  });
});

describe('picture tier: speech without a voice', () => {
  it('shows a phrase for the duration estimate and then moves on', () => {
    const g = play(solo([fFlag(fSay('HOLA'), fRight())]));
    g.run(100);
    expect(g.sprite('a').bubble?.text).toBe('👋 ¡Hola!');
    expect(g.host.spoken[0].text).toBe('👋 ¡Hola!');
    g.run(900);
    expect(g.sprite('a').bubble).not.toBeNull();
    g.run(900);
    expect(g.sprite('a').bubble).toBeNull();
    expect(g.sprite('a').x).toBeGreaterThan(0);
  });

  it('uses the character voice settings', () => {
    const g = play(solo([fFlag(fText('Hola'))], { art: 'robi' }));
    g.run(40);
    expect(g.host.spoken[0].opts).toEqual({ pitch: 0.55, rate: 0.9 });
  });

  it('waits for a real voice but not past the estimate', async () => {
    const long = 'Hola, esto es una frase bastante larga para el cuento';
    const g = new Game(solo([fFlag(fText(long), fRight())]));
    g.host.voice = true;
    g.flag();
    g.run(2000);
    expect(g.sprite('a').bubble).not.toBeNull();
    g.host.finishSpeech();
    await g.settle();
    g.run(500);
    expect(g.sprite('a').bubble).toBeNull();
    expect(g.sprite('a').x).toBeGreaterThan(0);

    const mute = new Game(solo([fFlag(fText(long))]));
    mute.host.voice = true;
    mute.flag();
    mute.run(5000);
    expect(mute.sprite('a').bubble).not.toBeNull();
    mute.run(500);
    expect(mute.sprite('a').bubble).toBeNull();
  });
});

describe('picture tier: time, sound and messages', () => {
  it('waits and repeats', () => {
    const g = play(solo([fFlag(fWait(2), fRepeat(3, fRight()))]));
    g.run(1900);
    expect(g.sprite('a').x).toBe(0);
    g.run(3000);
    expect(g.sprite('a').x).toBeCloseTo(150, 5);
  });

  it('plays sounds and notes, each holding half a second', () => {
    const g = play(solo([fFlag(fSound('miau'), fNote('sol'), fRight())]));
    g.run(300);
    expect(g.host.sfxLog).toEqual(['miau']);
    expect(g.host.noteLog).toEqual([]);
    g.run(400);
    expect(g.host.noteLog).toEqual(['sol']);
    expect(g.sprite('a').x).toBe(0);
    g.run(900);
    expect(g.sprite('a').x).toBeGreaterThan(0);
  });

  it('sends a coloured envelope that only that colour receives', () => {
    const g = play({
      ...solo([fFlag(fSend('red'))]),
      sprites: [
        ...solo([fFlag(fSend('red'))]).sprites,
        { id: 'r', art: 'michi', name: 'r', x: 0, y: 0, scripts: [fRecv('red', fRight())] },
        { id: 'b', art: 'michi', name: 'b', x: 0, y: 0, scripts: [fRecv('blue', fRight())] },
      ],
    });
    g.run(1000);
    expect(g.sprite('r').x).toBeCloseTo(50, 5);
    expect(g.sprite('b').x).toBe(0);
    expect(g.machine.stats.ranHat('recv')).toBe(true);
    expect(g.machine.stats.ran('broadcast')).toBe(true);
  });

  it('counts hats and ops per sprite for guide checks', () => {
    const g = play(solo([fFlag(fSay('HOLA')), fClick(fRight())]));
    g.run(100);
    const st = g.machine.stats;
    expect(st.ranBy('a', 'say')).toBe(true);
    expect(st.ranBy('a', 'move')).toBe(false);
    g.tap('a');
    g.run(500);
    expect(st.ranBy('a', 'move')).toBe(true);
    expect(st.ranHat('click')).toBe(true);
    expect(st.ranHatBy('a', 'flag')).toBe(true);
  });
});
