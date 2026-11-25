import { describe, expect, it } from 'vitest';
import { controlsOf } from '../../studio/controls.ts';
import type { ProjectProgram } from '../../language/ir.ts';
import { overlaps } from '../../runtime/geometry.ts';
import { Game } from '../../runtime/testing.ts';
import { SHOWCASE } from './index.ts';

const gameOf = (id: string) => SHOWCASE.find((g) => g.id === id)!;
const setupOf = (id: string): ProjectProgram => gameOf(id).setup;
const goalOf = (id: string, p: ProjectProgram = setupOf(id)): string => gameOf(id).showcase!.goal(p);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** A real click: on the middle of the drawing, so a hidden sprite or one standing behind another answers as on the stage. */
function click(g: Game, id: string): string | null {
  const b = g.machine.hitbox(id)!;
  return g.machine.tapAt(b.x, b.feet + b.h / 2);
}

/** Frames of the two screens the studio runs on: 60 and 50 per second. */
const FRAMES = [16, 20];

/**
 * Held keys as the studio sends them: the key fires at once, again after 140 ms and then every 60 ms for as long as it
 * stays down. A key that is not held any more stops at once.
 */
class Hand {
  private readonly held = new Map<string, number>();
  private readonly g: Game;
  constructor(g: Game) { this.g = g; }

  hold(...keys: string[]): void {
    for (const k of [...this.held.keys()]) if (!keys.includes(k)) { this.held.delete(k); this.g.machine.keyUp(k); }
    for (const k of keys) if (!this.held.has(k)) { this.held.set(k, this.g.time.now()); this.g.machine.keyDown(k); }
  }

  /** One key press that goes up at once (the space bar: a tap, not a hold). */
  tap(key: string): void {
    this.g.machine.keyDown(key);
    this.g.machine.keyUp(key);
  }

  /** Runs one frame, firing the repeats that fall inside it. */
  step(): void {
    const { frameMs } = this.g.time;
    const t0 = this.g.time.now();
    this.g.run(frameMs);
    for (const [k, since] of this.held) {
      const before = t0 - since - 140;
      const now = t0 + frameMs - since - 140;
      if (now >= 0 && Math.floor(now / 60) > Math.floor(before / 60)) this.g.machine.keyDown(k, true);
    }
  }

  release(): void { this.hold(); }
}

describe('El camino de piedras', () => {
  const setup = setupOf('muestra-camino');
  const ROCKS = ['piedra', 'piedra2', 'piedra3', 'piedra4'];
  const START = { x: -205, y: -60 };

  /**
   * Plays like a child who looks every `react` ms: stays under the middle rocks, waits when a rock will be in its row by the
   * time it gets there (it guesses where each one is going from the last look), and goes when the way is free.
   */
  function cross(frameMs: number, react: number, maxMs = 120_000): { ms: number; hits: number; ended: string | null; scored: number[] } {
    const g = new Game(setup, { seed: 1, frameMs });
    g.flag();
    const hand = new Hand(g);
    const seen: Record<string, number> = {};
    let ms = 0;
    let look = 0;
    let lookedAt = 0;
    let hits = 0;
    let last = g.sprite('toby').x;
    let score = 0;
    const scored: number[] = [];
    while (ms < maxMs && !g.machine.ended) {
      if (ms >= look) {
        const toby = g.sprite('toby');
        let wait = false;
        for (const id of ROCKS) {
          const r = g.sprite(id);
          const vy = seen[id] === undefined ? 0 : ((r.y - seen[id]) / Math.max(1, ms - lookedAt)) * 1000;
          seen[id] = r.y;
          const dx = r.x - toby.x;
          if (dx > -30 && dx < 130) {
            const arrive = Math.max(0, dx) / 165;
            for (const dt of [0, arrive / 2, arrive, arrive + 0.3]) if (Math.abs(r.y + vy * dt - toby.y) < 60) wait = true;
          }
        }
        lookedAt = ms;
        look = ms + react;
        const keys = wait ? [] : ['ArrowRight'];
        const row = toby.x > -160 ? -110 : START.y;
        if (toby.y > row + 8) keys.push('ArrowDown'); else if (toby.y < row - 8) keys.push('ArrowUp');
        hand.hold(...keys);
      }
      hand.step();
      ms += frameMs;
      const x = g.sprite('toby').x;
      if (x < last - 100 && (g.machine.score ?? 0) === score) hits++;
      if ((g.machine.score ?? 0) > score) scored.push(ms);
      score = g.machine.score ?? 0;
      last = x;
    }
    return { ms, hits, ended: g.machine.ended, scored };
  }

  it('a child who looks three times a second wins, and every crossing takes under twenty seconds', () => {
    for (const frameMs of FRAMES) {
      const r = cross(frameMs, 330);
      expect(r.ended, `${frameMs} ms frames`).toBe('win');
      expect(r.scored).toHaveLength(3);
      expect(r.ms, `${frameMs} ms`).toBeLessThan(40_000);
      expect(r.scored.map((t, i) => t - (r.scored[i - 1] ?? 0)).every((d) => d < 20_000), JSON.stringify(r.scored)).toBe(true);
      expect(r.hits).toBeGreaterThan(0);
    }
  });

  it('walking straight ahead is not enough: a rock sends Toby back to the start, with a sound, and nothing is scored', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    const hand = new Hand(g);
    const sounds = g.host.sfxLog.length;
    hand.hold('ArrowRight');
    let hit = false;
    for (let t = 0; t < 12_000 && !hit; t += 20) {
      hand.step();
      hit = g.sprite('toby').x < START.x + 30 && t > 1000;
    }
    expect(hit).toBe(true);
    expect(g.host.sfxLog.slice(sounds)).toContain('explosion');
    expect(g.sprite('toby').y).toBe(START.y);
    expect(g.machine.score ?? 0).toBe(0);
    expect(g.machine.ended).toBeNull();
  });

  it('every rock sends him back, the glad ones and the quiet ones', () => {
    for (const id of ROCKS) {
      const g = new Game(setup, { seed: 1 });
      g.flag();
      g.run(100);
      const rock = g.sprite(id);
      const toby = g.sprite('toby');
      toby.x = rock.x - 20;
      toby.y = rock.y;
      g.run(200);
      expect(toby.x, id).toBe(START.x);
      expect(toby.y, id).toBe(START.y);
    }
  });

  it('the treasure gives a point and a new start; the third one wins', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    for (let n = 1; n <= 3; n++) {
      const toby = g.sprite('toby');
      toby.x = g.sprite('tesoro').x - 30;
      toby.y = g.sprite('tesoro').y;
      g.run(300);
      expect(g.machine.score).toBe(n);
      if (n < 3) { expect(toby.x).toBe(START.x); expect(g.machine.ended).toBeNull(); }
    }
    g.run(300);
    expect(g.machine.ended).toBe('win');
  });

  it('some rocks glide up and down at their own pace, and the others stay where they are', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    const ys: Record<string, Set<number>> = {};
    for (let t = 0; t < 12_000; t += 100) {
      g.run(100);
      for (const id of ROCKS) (ys[id] ??= new Set()).add(Math.round(g.sprite(id).y));
    }
    expect(ys.piedra.size).toBeGreaterThan(20);
    expect(ys.piedra4.size).toBeGreaterThan(20);
    expect(ys.piedra2.size).toBe(1);
    expect(ys.piedra3.size).toBe(1);
    expect(g.machine.errors).toEqual([]);
  });

  it('nothing overlaps at the start, and the flag puts a game in the middle of a crossing back at the start', () => {
    const g = new Game(setup, { seed: 1 });
    for (const a of g.machine.instances) for (const b of g.machine.instances) if (a !== b) expect(overlaps(a, b), `${a.id} ${b.id}`).toBe(false);
    g.flag();
    const toby = g.sprite('toby');
    toby.x = 0;
    toby.y = -110;
    g.machine.setScore(2);
    g.run(1500);
    g.flag();
    g.run(100);
    expect([g.sprite('toby').x, g.sprite('toby').y, g.machine.score]).toEqual([START.x, START.y, 0]);
    expect(g.machine.ended).toBeNull();
  });

  it('shows the arrows, tells whom they move and has nothing to click; the goal follows the program', () => {
    const c = controlsOf(setup);
    expect(c.arrows).toEqual(['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
    expect(c.movers).toEqual(['toby']);
    expect(c.space).toBe(false);
    expect(c.taps).toEqual([]);
    expect(c.late).toEqual([]);
    expect(goalOf('muestra-camino')).toBe('Llevá a {toby} hasta {tesoro} **3** veces sin tocar {piedra}');
    const two = clone(setup);
    two.sprites.find((s) => s.id === 'toby')!.scripts.find((s) => s.hat.type === 'a_points')!.hat.fields.N = 2;
    expect(goalOf('muestra-camino', two)).toBe('Llevá a {toby} hasta {tesoro} **2** veces sin tocar {piedra}');
    const none = clone(setup);
    none.sprites.find((s) => s.id === 'toby')!.scripts = none.sprites.find((s) => s.id === 'toby')!.scripts.filter((s) => s.hat.type !== 'a_points');
    expect(goalOf('muestra-camino', none)).toBe('Llevá a {toby} hasta {tesoro} sin tocar {piedra}');
  });
});

describe('El concurso de Robi', () => {
  const setup = setupOf('muestra-concurso');
  const ROUNDS = [
    { right: 'b1', wrong: 'a1', question: '¿Cuántas patas tiene una araña?', texts: { a1: 'Seis', b1: 'Ocho' } },
    { right: 'a2', wrong: 'b2', question: '¿Qué planeta está más cerca del Sol?', texts: { a2: 'Mercurio', b2: 'Marte' } },
    { right: 'b3', wrong: 'a3', question: '¿Cuál es el océano más grande?', texts: { a3: 'Atlántico', b3: 'Pacífico' } },
  ];
  const ALL = ROUNDS.flatMap((r) => [r.right, r.wrong]);
  const shown = (g: Game): string[] => ALL.filter((id) => g.sprite(id).visible);
  const says = (g: Game, id: string): string | null => g.sprite(id).bubble?.text ?? null;
  const started = (seed = 1, frameMs = 20): Game => { const g = new Game(setup, { seed, frameMs }); g.flag(); g.run(300); return g; };

  it('asks three questions in order, shows only the two characters of the question, and each says its answer', () => {
    const g = started();
    ROUNDS.forEach((r, i) => {
      expect(says(g, 'robi'), `question ${i + 1}`).toBe(r.question);
      expect(shown(g).sort(), `question ${i + 1}`).toEqual([r.right, r.wrong].sort());
      for (const [id, text] of Object.entries(r.texts)) expect(says(g, id)).toBe(text);
      expect(click(g, r.right)).toBe(r.right);
      g.run(300);
    });
    expect(g.machine.ended).toBe('win');
    expect(g.machine.score).toBe(3);
    expect(g.host.endLog).toEqual(['win']);
  });

  it('the right one is not always on the same side', () => {
    const slot = (id: string): number => setup.sprites.find((s) => s.id === id)!.x;
    expect(ROUNDS.map((r) => slot(r.right) > slot(r.wrong))).toEqual([true, false, true]);
    expect(new Set(ROUNDS.flatMap((r) => Object.values(r.texts))).size).toBe(6);
  });

  it('a wrong answer sounds sad, scores nothing and stays on the same question, however many times', () => {
    for (const [i, r] of ROUNDS.entries()) {
      const g = started();
      for (let k = 0; k < i; k++) { click(g, ROUNDS[k].right); g.run(300); }
      const score = g.machine.score ?? 0;
      const sounds = g.host.sfxLog.length;
      for (let n = 0; n < 4; n++) {
        expect(click(g, r.wrong)).toBe(r.wrong);
        g.run(100);
        expect(g.sprite(r.wrong).face).toBe('triste');
        g.run(1200);
        expect(g.sprite(r.wrong).face).toBe('feliz');
      }
      expect(g.host.sfxLog.slice(sounds).filter((s) => s === 'bip')).toHaveLength(4);
      expect([g.machine.score ?? 0, says(g, 'robi'), shown(g).sort(), g.machine.ended]).toEqual([score, r.question, [r.right, r.wrong].sort(), null]);
    }
  });

  it('an answer of another question is not there to be clicked: where it would stand a click lands on one of this question, or on nothing', () => {
    for (let round = 0; round < 3; round++) {
      const here = ROUNDS[round];
      for (const id of ALL.filter((x) => x !== here.right && x !== here.wrong)) {
        const g = started();
        for (let k = 0; k < round; k++) { click(g, ROUNDS[k].right); g.run(300); }
        expect(g.sprite(id).visible, `${id} in round ${round + 1}`).toBe(false);
        expect([here.right, here.wrong], id).toContain(click(g, id));
      }
    }
  });

  it('a child who clicks at random for two minutes only ever scores with the right one of the question being asked', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const g = started(seed);
      const slots = ['a1', 'b1'].map((id) => g.machine.hitbox(id)!);
      let round = 0;
      let scored = 0;
      for (let t = 0; t < 120_000 && !g.machine.ended; t += 250) {
        const slot = slots[(seed * 7 + t / 250 + Math.floor(t / 3000)) % 2];
        const before = g.machine.score ?? 0;
        const hit = g.machine.tapAt(slot.x, slot.feet + slot.h / 2);
        g.run(250);
        const gained = (g.machine.score ?? 0) - before;
        expect(hit === (ROUNDS[round]?.right ?? '') ? gained === 1 : gained === 0, `seed ${seed}, round ${round + 1}, hit ${hit}`).toBe(true);
        if (gained) { scored++; round++; expect(says(g, 'robi')).toBe(ROUNDS[round]?.question ?? says(g, 'robi')); }
      }
      expect([g.machine.ended, scored, g.machine.score]).toEqual(['win', 3, 3]);
    }
  });

  it('the right one counts once, even when it is clicked twice in a hurry, and takes the question with it', () => {
    const g = started();
    expect(click(g, 'b1')).toBe('b1');
    click(g, 'b1');
    g.run(300);
    expect(g.machine.score).toBe(1);
    expect(click(g, 'b1'), 'gone').not.toBe('b1');
    expect(shown(g).sort()).toEqual(['a2', 'b2']);
    g.run(200);
    expect(g.machine.score).toBe(1);
  });

  it('the words stay on the screen: nobody stops talking while the child thinks', () => {
    const g = started();
    g.run(60_000);
    expect([says(g, 'robi'), says(g, 'a1'), says(g, 'b1')]).toEqual([ROUNDS[0].question, 'Seis', 'Ocho']);
    expect(g.machine.errors).toEqual([]);
  });

  it('the flag starts a clean game at any moment, at the first question', () => {
    const g = started();
    click(g, 'b1'); g.run(300);
    click(g, 'a2'); g.run(300);
    expect(g.machine.score).toBe(2);
    g.flag();
    g.run(300);
    expect(g.machine.score).toBe(0);
    expect(says(g, 'robi')).toBe(ROUNDS[0].question);
    expect(shown(g).sort()).toEqual(['a1', 'b1']);
    click(g, 'b1'); g.run(300);
    expect(g.machine.score).toBe(1);
  });

  it('sitting still or clicking nowhere never ends the game', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const g = started(seed);
      for (let t = 0; t < 30_000; t += 500) { g.machine.tapAt(0, 150); g.run(500); }
      expect(g.machine.ended).toBeNull();
    }
  });

  it('every character to click is a point of the game, the pictures show the right faces and nothing overlaps at the start', () => {
    const c = controlsOf(setup, true);
    expect(c.taps.map((t) => t.id)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'b3']);
    expect(c.taps).toHaveLength(6);
    expect(c.taps.every((t) => t.main)).toBe(true);
    expect(c.arrows).toEqual([]);
    const g = new Game(setup, { seed: 1 });
    for (const a of g.machine.instances) for (const b of g.machine.instances) if (a !== b) expect(overlaps(a, b), `${a.id} ${b.id}`).toBe(false);
    expect(goalOf('muestra-concurso')).toBe('Respondé bien las **3** preguntas de {robi}');
    const two = clone(setup);
    two.sprites.find((s) => s.id === 'robi')!.scripts.find((s) => s.hat.type === 'a_points')!.hat.fields.N = 2;
    expect(goalOf('muestra-concurso', two)).toBe('Respondé bien las **2** preguntas de {robi}');
  });
});
