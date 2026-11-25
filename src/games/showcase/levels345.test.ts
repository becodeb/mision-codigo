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

describe('Saltá sin parar', () => {
  const setup = setupOf('muestra-salto');
  const ahead = (g: Game): number => g.sprite('piedra').x - g.sprite('tomi').x;

  /**
   * Presses the space bar when the rock is `reach` px away (a different one each time), like a child who keeps the beat but
   * is a little early or late. Returns how the run ended and how long it took.
   */
  function run(reaches: number[], frameMs: number, seed = 1, maxMs = 90_000): { ended: string | null; ms: number; score: number } {
    const g = new Game(setup, { seed, frameMs });
    g.flag();
    const hand = new Hand(g);
    let ms = 0;
    let n = 0;
    let armed = true;
    while (ms < maxMs && !g.machine.ended) {
      const d = ahead(g);
      if (armed && d > 0 && d <= reaches[n % reaches.length] && g.sprite('piedra').x < 228) { hand.tap(' '); armed = false; }
      if (!armed && d < -20) { armed = true; n++; }
      hand.step();
      ms += frameMs;
    }
    return { ended: g.machine.ended, ms, score: g.machine.score ?? 0 };
  }

  it('a child who jumps at about the right moment wins in half a minute or so, on a slow or a fast screen', () => {
    for (const frameMs of FRAMES) {
      for (const reaches of [[30], [14, 24, 34, 42], [40, 20, 28], [12, 44]]) {
        const r = run(reaches, frameMs);
        expect(r, `${frameMs} ms frames, jumps at ${reaches}`).toMatchObject({ ended: 'win', score: 10 });
        expect(r.ms, `${frameMs} ms`).toBeLessThan(50_000);
        expect(r.ms).toBeGreaterThan(20_000);
      }
    }
  });

  it('jumping far too early or too late loses, and so does never jumping', () => {
    for (const frameMs of FRAMES) {
      for (const reach of [140, 90, 3]) expect(run([reach], frameMs).ended, `${frameMs} ms, jumps at ${reach}`).toBe('lose');
      const idle = new Game(setup, { seed: 1, frameMs });
      idle.flag();
      expect(idle.runUntil(() => idle.machine.ended !== null, 20_000)).toBe(true);
      expect(idle.machine.ended).toBe('lose');
      expect(idle.time.now()).toBeGreaterThan(2500);
      expect(idle.host.sfxLog).toContain('explosion');
    }
  });

  it('each rock that gets through is one point, counted when it has passed', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    const hand = new Hand(g);
    const scores: number[] = [];
    let armed = true;
    for (let t = 0; t < 20_000; t += 20) {
      if (armed && ahead(g) > 0 && ahead(g) <= 30 && g.sprite('piedra').x < 228) { hand.tap(' '); armed = false; }
      if (!armed && ahead(g) < -20) armed = true;
      hand.step();
      if ((g.machine.score ?? 0) !== (scores.at(-1) ?? 0)) scores.push(g.machine.score ?? 0);
    }
    expect(scores.slice(0, 4)).toEqual([1, 2, 3, 4]);
    expect(g.sprite('piedra').x).toBeGreaterThan(-228);
  });

  it('the jump takes Tomi up and brings him back, the rock keeps to the ground and the bolt sleeps until it is called', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(300);
    const top = (): number => g.sprite('tomi').jy;
    g.machine.keyDown(' ');
    g.machine.keyUp(' ');
    let peak = 0;
    for (let t = 0; t < 700; t += 20) { g.run(20); peak = Math.max(peak, top()); }
    expect(peak).toBeGreaterThan(60);
    expect(top()).toBe(0);
    for (const s of ['piedra', 'rayo']) expect(g.sprite(s).y).toBe(setup.sprites.find((x) => x.id === s)!.y);
    expect(g.sprite('rayo').visible).toBe(false);
  });

  it('the flag starts a clean game even in the middle of a run', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(5200);
    expect(g.machine.score ?? 0).toBeGreaterThanOrEqual(0);
    g.machine.keyDown(' ');
    g.run(150);
    g.flag();
    g.run(40);
    expect([g.sprite('tomi').x, g.sprite('tomi').jy, g.sprite('piedra').x, g.machine.score, g.machine.ended]).toEqual([-150, 0, 228, 0, null]);
    expect(g.sprite('rayo').visible).toBe(false);
  });

  it('Tomi does not overlap the rock at the start, and the legend says that the space bar is what makes him jump', () => {
    const g = new Game(setup, { seed: 1 });
    for (const a of g.machine.instances) for (const b of g.machine.instances) if (a !== b) expect(overlaps(a, b), `${a.id} ${b.id}`).toBe(false);
    const c = controlsOf(setup);
    expect(c).toMatchObject({ arrows: [], space: true, movers: [], spacers: ['tomi'], taps: [], late: [] });
    expect(goalOf('muestra-salto')).toBe('Saltá **10** {piedra}');
    const five = clone(setup);
    five.sprites.find((s) => s.id === 'tomi')!.scripts.find((s) => s.hat.type === 'a_points')!.hat.fields.N = 5;
    expect(goalOf('muestra-salto', five)).toBe('Saltá **5** {piedra}');
  });

  it('Tomi runs in place: his face changes all the time he plays', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    const faces = new Set<string>();
    for (let t = 0; t < 2000; t += 50) { g.run(50); faces.add(String(g.sprite('tomi').face)); }
    expect([...faces].sort()).toEqual(['feliz', 'risa']);
  });

  describe('the bolt that flies high (card «Rayo») and ducking (card «Agacharse»)', () => {
    const card = (id: string) => gameOf('muestra-salto').phases[0].steps.find((s) => s.id === id)!.card!;
    /** The game with only the bolt on the road: the rocks are taken away so nothing else gets in the way. */
    function boltOnly(ducks: boolean): ProjectProgram {
      const p = clone(setup);
      card('rayo').solve(p);
      if (ducks) card('agachar').solve(p);
      p.sprites.find((s) => s.id === 'piedra')!.scripts = [];
      p.sprites.find((s) => s.id === 'piedra')!.visible = false;
      return p;
    }
    const withBolt = (p: ProjectProgram, frameMs: number): Game => {
      const g = new Game(p, { seed: 1, frameMs });
      g.flag();
      g.machine.setScore(4);
      return g;
    };

    it('appears when the points get there, and a runner who stays on the ground lets it pass', () => {
      for (const frameMs of FRAMES) {
        const g = withBolt(boltOnly(false), frameMs);
        g.run(60);
        expect(g.sprite('rayo').visible).toBe(true);
        g.run(15_000);
        expect(g.machine.ended).toBeNull();
        expect(g.machine.errors).toEqual([]);
      }
    });

    it('is a thing not to jump over: jumping into it loses', () => {
      for (const frameMs of FRAMES) {
        const g = withBolt(boltOnly(false), frameMs);
        const hand = new Hand(g);
        let armed = true;
        for (let t = 0; t < 15_000 && !g.machine.ended; t += frameMs) {
          const d = g.sprite('rayo').x - g.sprite('tomi').x;
          if (armed && g.sprite('rayo').visible && d > 0 && d <= 50) { hand.tap(' '); armed = false; }
          hand.step();
        }
        expect(g.machine.ended, `${frameMs} ms`).toBe('lose');
      }
    });

    it('a runner who ducks goes under it, and stands up again when the arrow goes up', () => {
      for (const frameMs of FRAMES) {
        const g = withBolt(boltOnly(true), frameMs);
        const hand = new Hand(g);
        let low = 100;
        for (let t = 0; t < 12_000 && !g.machine.ended; t += frameMs) {
          const d = g.sprite('rayo').x - g.sprite('tomi').x;
          hand.hold(...(g.sprite('rayo').visible && d > -80 && d < 140 ? ['ArrowDown'] : []));
          hand.step();
          low = Math.min(low, g.sprite('tomi').size);
        }
        expect(g.machine.ended).toBeNull();
        expect(low).toBeLessThan(70);
        hand.release();
        g.run(200);
        expect(g.sprite('tomi').size).toBe(100);
      }
    });
  });
});

describe('Cuidá el tesoro', () => {
  const setup = setupOf('muestra-guardian');
  const FOES = ['bomba', 'rayo', 'bomba2', 'rayo2'];

  /** Clicks, every `react` ms, the one that is closest to the treasure. */
  function play(react: number, frameMs: number, seed = 1, maxMs = 120_000): { ended: string | null; ms: number; score: number; misses: number } {
    const g = new Game(setup, { seed, frameMs });
    g.flag();
    let ms = 0;
    let look = 0;
    let misses = 0;
    let last = 0;
    while (ms < maxMs && !g.machine.ended) {
      if (ms >= look) {
        look = ms + react;
        const near = FOES.map((id) => g.sprite(id)).filter((s) => s.visible).sort((a, b) => Math.hypot(a.x, a.y + 30) - Math.hypot(b.x, b.y + 30))[0];
        if (near) click(g, near.id);
      }
      g.run(frameMs);
      ms += frameMs;
      if ((g.machine.score ?? 0) < last) misses++;
      last = g.machine.score ?? 0;
    }
    return { ended: g.machine.ended, ms, score: g.machine.score ?? 0, misses };
  }

  it('a child who clicks the closest one twice a second wins with a clean sheet, and one who takes a second each time wins with a few misses', () => {
    for (const frameMs of FRAMES) {
      const quick = play(500, frameMs);
      expect(quick, `${frameMs} ms`).toMatchObject({ ended: 'win', score: 15 });
      expect(quick.ms).toBeLessThan(40_000);
      const slow = play(1300, frameMs);
      expect(slow, `${frameMs} ms`).toMatchObject({ ended: 'win', score: 15 });
      expect(slow.misses).toBeGreaterThan(0);
      expect(slow.ms).toBeLessThan(90_000);
    }
  });

  it('a click on one that flies is a point and sends it away; it comes back by itself, from the same edge, a while later', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(2000);
    expect(g.sprite('bomba').visible).toBe(true);
    expect(click(g, 'bomba')).toBe('bomba');
    click(g, 'bomba');
    g.run(60);
    expect(g.machine.score).toBe(1);
    expect(g.sprite('bomba').visible).toBe(false);
    expect(click(g, 'bomba'), 'not there to be clicked again').not.toBe('bomba');
    let back = 0;
    for (let t = 0; t < 12_000 && !back; t += 20) { g.run(20); if (g.sprite('bomba').visible) back = t; }
    expect(back).toBeGreaterThan(1500);
    expect(g.sprite('bomba').x).toBeLessThan(-150);
  });

  it('what is not stopped hurts: every arrival is a point less, with a bang, and the game never ends by itself', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(40_000);
    expect(g.machine.score!).toBeLessThan(-20);
    expect(g.host.sfxLog.filter((s) => s === 'explosion').length).toBe(-g.machine.score!);
    expect(g.machine.ended).toBeNull();
  });

  it('each one comes from its own side and heads for the treasure', () => {
    const g = new Game(setup, { seed: 1 });
    const from = Object.fromEntries(FOES.map((id) => [id, [Math.sign(g.sprite(id).x), Math.sign(g.sprite(id).y - -30)]]));
    expect(Object.values(from).map((v) => v.join(','))).toEqual(['-1,0', '0,1', '1,0', '0,-1']);
    g.flag();
    const closest: Record<string, number> = {};
    for (let t = 0; t < 20_000; t += 40) {
      g.run(40);
      for (const id of FOES) {
        const s = g.sprite(id);
        if (s.visible) closest[id] = Math.min(closest[id] ?? 999, Math.hypot(s.x, s.y + 30));
      }
    }
    for (const id of FOES) expect(closest[id], id).toBeLessThan(80);
  });

  it('the treasure is not what you click: it has no click, and clicking it changes nothing', () => {
    const c = controlsOf(setup);
    expect(c.taps).toEqual(FOES.map((id) => ({ id, main: true })));
    expect(c.arrows).toEqual([]);
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(300);
    const score = g.machine.score;
    expect(click(g, 'tesoro')).toBe('tesoro');
    g.run(300);
    expect(g.machine.score).toBe(score);
  });

  it('the foes are big enough to click, the treasure is on top of nothing, and nothing overlaps at the start', () => {
    const g = new Game(setup, { seed: 1 });
    for (const a of g.machine.instances) for (const b of g.machine.instances) if (a !== b) expect(overlaps(a, b), `${a.id} ${b.id}`).toBe(false);
    for (const id of FOES) expect(g.machine.hitbox(id)!.r, id).toBeGreaterThanOrEqual(26);
  });

  it('the flag starts a clean game at any moment', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(9000);
    click(g, 'bomba');
    g.flag();
    g.run(40);
    expect(g.machine.score).toBe(0);
    for (const id of FOES) expect([g.sprite(id).x, g.sprite(id).y, g.sprite(id).visible], id).toEqual([setup.sprites.find((s) => s.id === id)!.x, setup.sprites.find((s) => s.id === id)!.y, false]);
  });

  it('the goal and the card «Perder»: with it, an arrival ends the game, and with the number changed the goal follows', () => {
    expect(goalOf('muestra-guardian')).toBe('Cuidá a {tesoro}: espantá **15** veces a {bomba} y a {rayo}');
    const p = clone(setup);
    gameOf('muestra-guardian').phases[0].steps.find((s) => s.id === 'perder')!.card!.solve(p);
    const g = new Game(p, { seed: 1 });
    g.flag();
    expect(g.runUntil(() => g.machine.ended !== null, 20_000)).toBe(true);
    expect(g.machine.ended).toBe('lose');
  });
});

describe('La fábrica de monedas', () => {
  const setup = setupOf('muestra-fabrica');
  const num = (g: Game, name: string): number => Number(g.machine.vars.get(name));
  const started = (frameMs = 20): Game => { const g = new Game(setup, { seed: 1, frameMs }); g.flag(); g.run(100); return g; };
  const set = (g: Game, name: string, v: number): void => { g.machine.vars.set(name, v); };

  /** Taps the coin `cps` times a second and buys what the plan says when there is enough. */
  function play(cps: number, plan: 'coin' | 'helpers' | 'mix', frameMs = 20): { ended: string | null; ms: number; helpers: number; perClick: number } {
    const g = started(frameMs);
    const gap = 1000 / cps;
    let ms = 0;
    let next = 0;
    while (ms < 300_000 && !g.machine.ended) {
      if (ms >= next) {
        next = ms + gap;
        const coins = num(g, 'monedas');
        if (plan !== 'coin' && coins >= 20 && num(g, 'ayudantes') < (plan === 'helpers' ? 6 : 2)) click(g, 'robi');
        else if (plan === 'mix' && coins >= 50 && num(g, 'porClic') < 3) click(g, 'estrella');
        else click(g, 'moneda');
      }
      g.run(frameMs);
      ms += frameMs;
    }
    return { ended: g.machine.ended, ms, helpers: num(g, 'ayudantes'), perClick: num(g, 'porClic') };
  }

  it('a child who taps twice a second wins by buying in a minute or so, and takes longer by tapping alone', () => {
    for (const frameMs of FRAMES) {
      const tapping = play(2, 'coin', frameMs);
      expect(tapping.ended).toBe('win');
      for (const plan of ['helpers', 'mix'] as const) {
        const r = play(2, plan, frameMs);
        expect(r.ended, plan).toBe('win');
        expect(r.ms, `${plan}, ${frameMs} ms frames`).toBeGreaterThan(45_000);
        expect(r.ms, `${plan}, ${frameMs} ms frames`).toBeLessThan(90_000);
        expect(r.ms, plan).toBeLessThan(tapping.ms - 20_000);
      }
    }
  });

  it('the coin gives what each tap is worth, the shop answers with a sound when there is not enough', () => {
    const g = started();
    click(g, 'moneda'); g.run(100);
    expect(num(g, 'monedas')).toBe(1);
    set(g, 'monedas', 19);
    const bips = g.host.sfxLog.filter((s) => s === 'bip').length;
    click(g, 'robi'); click(g, 'estrella'); g.run(100);
    expect([num(g, 'monedas'), num(g, 'ayudantes'), num(g, 'porClic')]).toEqual([19, 0, 1]);
    expect(g.host.sfxLog.filter((s) => s === 'bip').length).toBe(bips + 2);
  });

  it('a helper costs 20 and pays one coin a second, each one; the star costs 50 and makes every tap worth one more', () => {
    const g = started();
    set(g, 'monedas', 20);
    click(g, 'robi'); g.run(100);
    expect([num(g, 'monedas'), num(g, 'ayudantes')]).toEqual([0, 1]);
    g.run(3000);
    expect(num(g, 'monedas')).toBeGreaterThanOrEqual(2);
    expect(num(g, 'monedas')).toBeLessThanOrEqual(4);
    set(g, 'monedas', 40);
    click(g, 'robi'); g.run(100);
    expect(num(g, 'ayudantes')).toBe(2);
    set(g, 'monedas', 0);
    g.run(2000);
    expect(num(g, 'monedas')).toBeGreaterThanOrEqual(3);
    set(g, 'monedas', 50);
    click(g, 'estrella'); g.run(100);
    expect([num(g, 'monedas'), num(g, 'porClic')]).toEqual([0, 2]);
    click(g, 'moneda'); g.run(100);
    expect(num(g, 'monedas')).toBe(2);
  });

  it('wins when there are more than 199, not before', () => {
    const g = started();
    set(g, 'monedas', 199);
    g.run(300);
    expect(g.machine.ended).toBeNull();
    click(g, 'moneda');
    g.run(300);
    expect(g.machine.ended).toBe('win');
    expect(g.host.sfxLog).toContain('fanfarria');
  });

  it('the flag puts the three numbers back, even in the middle of a game', () => {
    const g = started();
    set(g, 'monedas', 120); set(g, 'porClic', 4); set(g, 'ayudantes', 5);
    g.run(500);
    g.flag();
    g.run(40);
    expect([num(g, 'monedas'), num(g, 'porClic'), num(g, 'ayudantes'), g.machine.ended]).toEqual([0, 1, 0, null]);
    g.run(5000);
    expect(num(g, 'monedas')).toBe(0);
  });

  it('every shop says its price, and the three characters stand clear of the numbers at the top left', () => {
    const g = started();
    g.run(2500);
    expect(g.sprite('robi').bubble?.text).toBe('Ayudante: 20');
    expect(g.sprite('estrella').bubble?.text).toBe('Mejora: 50');
    for (const a of g.machine.instances) for (const b of g.machine.instances) if (a !== b) expect(overlaps(a, b), `${a.id} ${b.id}`).toBe(false);
    /* The monitors: three rows of 30 high from the corner, at most 130 wide. */
    for (const s of g.machine.instances) {
      const b = g.machine.hitbox(s.id)!;
      const under = b.x - b.r < -100 && b.feet + b.h > 180 - 8 - 3 * 36;
      expect(under, s.id).toBe(false);
    }
  });

  it('the coin comes first and the two shops answer too; the goal takes its number from the program', () => {
    const c = controlsOf(setup);
    expect(c.taps).toEqual([{ id: 'moneda', main: true }, { id: 'robi', main: true }, { id: 'estrella', main: true }]);
    expect(c.arrows).toEqual([]);
    expect(goalOf('muestra-fabrica')).toBe('Juntá **200** {moneda}');
    const p = clone(setup);
    gameOf('muestra-fabrica').phases[0].steps.find((s) => s.id === 'meta')!.card!.solve(p);
    expect(goalOf('muestra-fabrica', p)).toBe('Juntá **100** {moneda}');
    const none = clone(setup);
    none.sprites.find((s) => s.id === 'moneda')!.scripts = none.sprites.find((s) => s.id === 'moneda')!.scripts.filter((s) => s.body[0]?.type !== 'a_waituntil');
    expect(goalOf('muestra-fabrica', none)).toBe('Juntá {moneda}');
  });
});

describe('Lluvia de meteoritos', () => {
  const setup = setupOf('muestra-meteoritos');
  const rocks = (g: Game) => g.machine.instances.filter((i) => i.spriteId === 'meteorito' && i.isClone);
  const shots = (g: Game) => g.machine.instances.filter((i) => i.spriteId === 'bala' && i.isClone);
  const lives = (g: Game): number => Number(g.machine.vars.get('vidas'));

  /** Goes under the lowest rock and shoots when it is in line, looking every `react` ms. `shoot: false` only parks under the lane. */
  function play(react: number, frameMs: number, shoot = true, maxMs = 240_000): { ended: string | null; ms: number; score: number; lives: number; mostClones: number; leftOver: number } {
    const g = new Game(setup, { seed: 3, frameMs });
    g.flag();
    const hand = new Hand(g);
    let ms = 0;
    let look = 0;
    let ready = 0;
    let most = 0;
    while (ms < maxMs && !g.machine.ended) {
      if (ms >= look) {
        look = ms + react;
        const nova = g.sprite('nova');
        const rock = rocks(g).filter((r) => r.visible && r.y > -150).sort((a, b) => a.y - b.y)[0];
        if (!shoot) hand.hold(nova.x > -52 ? 'ArrowLeft' : nova.x < -48 ? 'ArrowRight' : '');
        else if (rock) {
          const dx = rock.x - nova.x;
          hand.hold(...(Math.abs(dx) < 18 ? [] : [dx > 0 ? 'ArrowRight' : 'ArrowLeft']));
          if (Math.abs(dx) < 30 && ms >= ready) { hand.tap(' '); ready = ms + 350; }
        } else hand.hold();
      }
      hand.step();
      ms += frameMs;
      most = Math.max(most, g.machine.instances.filter((i) => i.isClone).length);
    }
    return { ended: g.machine.ended, ms, score: g.machine.score ?? 0, lives: lives(g), mostClones: most, leftOver: g.machine.instances.filter((i) => i.isClone).length };
  }

  it('a child who looks three or four times a second can win, on a slow or a fast screen, without ever crowding the stage', () => {
    for (const frameMs of FRAMES) {
      for (const react of [150, 300]) {
        const r = play(react, frameMs);
        expect(r, `${frameMs} ms frames, looking every ${react}`).toMatchObject({ ended: 'win', score: 15 });
        expect(r.ms).toBeLessThan(60_000);
        expect(r.ms).toBeGreaterThan(20_000);
        expect(r.mostClones).toBeLessThanOrEqual(8);
        expect(r.leftOver).toBe(0);
        expect(r.lives).toBeGreaterThan(0);
      }
    }
  });

  it('a child who stands in a lane and does not shoot loses, one life at a time', () => {
    for (const frameMs of FRAMES) {
      const r = play(300, frameMs, false);
      expect(r, `${frameMs} ms`).toMatchObject({ ended: 'lose', score: 0, lives: 0 });
      expect(r.ms).toBeGreaterThan(5000);
      expect(r.ms).toBeLessThan(25_000);
    }
  });

  it('sitting still at the start is safe: the rocks fall on the lanes beside Nova', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = new Game(setup, { seed });
      g.flag();
      g.run(45_000);
      expect([lives(g), g.machine.ended, g.machine.score]).toEqual([3, null, 0]);
    }
  });

  it('space shoots one thing straight up from Nova, which goes away at the top; the original stays hidden', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(300);
    g.sprite('nova').x = -50;
    g.machine.keyDown(' '); g.machine.keyUp(' ');
    g.run(100);
    expect(shots(g)).toHaveLength(1);
    const shot = shots(g)[0];
    expect(shot.x).toBe(-50);
    const y0 = shot.y;
    g.run(300);
    expect(shot.y).toBeGreaterThan(y0 + 40);
    expect(shot.x).toBe(-50);
    g.run(1500);
    expect(shots(g)).toHaveLength(0);
    for (const id of ['bala', 'meteorito']) expect(g.sprite(id).visible, id).toBe(false);
  });

  it('a shot and a rock that meet are both gone and it is a point; a rock that meets Nova takes a life and is gone', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(500);
    const rock = rocks(g)[0];
    const nova = g.sprite('nova');
    nova.x = rock.x;
    g.machine.keyDown(' '); g.machine.keyUp(' ');
    for (let t = 0; t < 2500 && rocks(g).includes(rock); t += 20) g.run(20);
    expect(rocks(g)).not.toContain(rock);
    expect(g.machine.score).toBe(1);
    expect(lives(g)).toBe(3);
    expect(shots(g)).toHaveLength(0);
    /* Now one that nobody stops. */
    g.run(1000);
    const next = rocks(g).find((r) => r.visible)!;
    nova.x = next.x;
    for (let t = 0; t < 4000 && rocks(g).includes(next); t += 20) g.run(20);
    expect(lives(g)).toBe(2);
    expect(g.machine.score).toBe(1);
    expect(g.host.sfxLog).toContain('explosion');
  });

  it('two minutes of firing like mad and sweeping from side to side never fills the stage with clones, and nothing is left behind', () => {
    for (const frameMs of FRAMES) {
      const g = new Game(setup, { seed: 2, frameMs });
      g.flag();
      const hand = new Hand(g);
      let most = 0;
      for (let t = 0; t < 120_000 && !g.machine.ended; t += frameMs) {
        hand.hold(Math.floor(t / 1500) % 2 ? 'ArrowLeft' : 'ArrowRight');
        if (t % 100 < frameMs) hand.tap(' ');
        hand.step();
        most = Math.max(most, g.machine.instances.filter((i) => i.isClone).length);
      }
      expect(most, `${frameMs} ms`).toBeLessThanOrEqual(30);
      hand.release();
      if (!g.machine.ended) {
        g.flag();
        g.run(200);
        expect(g.machine.instances.filter((i) => i.isClone).length).toBeLessThanOrEqual(2);
      }
      expect(g.machine.errors).toEqual([]);
    }
  });

  it('the flag starts a clean game: no clones, three lives, no points, Nova in her place', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(3000);
    g.sprite('nova').x = 120;
    g.machine.keyDown(' '); g.machine.keyUp(' ');
    g.run(200);
    expect(g.machine.instances.some((i) => i.isClone)).toBe(true);
    g.flag();
    g.run(40);
    expect([lives(g), g.machine.score, g.sprite('nova').x, g.machine.ended]).toEqual([3, 0, 0, null]);
    expect(g.machine.instances.filter((i) => i.isClone && i.spriteId === 'bala')).toHaveLength(0);
  });

  it('the arrows go sideways, the space bar shoots, and the goal follows the program', () => {
    const c = controlsOf(setup);
    expect(c).toMatchObject({ arrows: ['ArrowLeft', 'ArrowRight'], space: true, movers: ['nova'], spacers: ['nova'], taps: [], late: [] });
    expect(goalOf('muestra-meteoritos')).toBe('Disparale a **15** {meteorito}');
    const p = clone(setup);
    gameOf('muestra-meteoritos').phases[0].steps.find((s) => s.id === 'meta')!.card!.solve(p);
    expect(goalOf('muestra-meteoritos', p)).toBe('Disparale a **8** {meteorito}');
    const g = new Game(setup, { seed: 1 });
    for (const a of g.machine.instances) for (const b of g.machine.instances) if (a !== b) expect(overlaps(a, b), `${a.id} ${b.id}`).toBe(false);
  });
});
