import { describe, expect, it } from 'vitest';
import type { ProjectProgram } from '../../language/ir.ts';
import { HW, overlaps } from '../../runtime/geometry.ts';
import { Game } from '../../runtime/testing.ts';
import { SHOWCASE } from './index.ts';

const setupOf = (id: string): ProjectProgram => SHOWCASE.find((g) => g.id === id)!.setup;

/** A real click: on the middle of the drawing, so a hidden sprite or one standing behind another answers as on the stage. */
function click(g: Game, id: string): string | null {
  const b = g.machine.hitbox(id)!;
  return g.machine.tapAt(b.x, b.feet + b.h / 2);
}

describe('La gran carrera', () => {
  const setup = setupOf('muestra-carrera');
  const start = (id: string): number => setup.sprites.find((s) => s.id === id)!.x;

  it('a click is a step: a child who clicks every half second reaches the treasure in about eight clicks', () => {
    for (const racer of ['tomi', 'coni']) {
      const g = new Game(setup, { seed: 1 });
      g.flag();
      g.run(3000);
      let clicks = 0;
      let last = g.sprite(racer).x;
      while (!overlaps(g.sprite(racer), g.sprite('tesoro')) && clicks < 20) {
        expect(click(g, racer), `click ${clicks}`).toBe(racer);
        g.run(500);
        clicks++;
        expect(g.sprite(racer).x, `${racer} step ${clicks}`).toBeGreaterThan(last);
        last = g.sprite(racer).x;
      }
      expect(clicks).toBeGreaterThanOrEqual(7);
      expect(clicks).toBeLessThanOrEqual(10);
      expect(g.machine.score).toBe(clicks);
    }
  });

  it('each racer answers to its own clicks only', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(3000);
    for (let i = 0; i < 4; i++) { click(g, 'tomi'); g.run(500); }
    expect(g.sprite('tomi').x).toBeCloseTo(start('tomi') + 200, 0);
    expect(g.sprite('coni').x).toBe(start('coni'));
    expect(g.sprite('tesoro').x).toBe(start('tesoro'));
  });

  it('whoever keeps clicking stays on the stage, and the racers start on their own lanes without touching anything', () => {
    const g = new Game(setup, { seed: 1 });
    for (const a of g.machine.instances) for (const b of g.machine.instances) if (a !== b) expect(overlaps(a, b), `${a.id} ${b.id}`).toBe(false);
    g.flag();
    for (let i = 0; i < 30; i++) { click(g, 'tomi'); click(g, 'coni'); g.run(450); }
    g.run(1500);
    for (const racer of ['tomi', 'coni']) expect(g.sprite(racer).x).toBeLessThanOrEqual(HW - 12);
  });

  it('the treasure celebrates with a star, a sound and a jump', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(3000);
    const sounds = g.host.sfxLog.length;
    expect(click(g, 'tesoro')).toBe('tesoro');
    g.run(100);
    expect(g.machine.score).toBe(1);
    expect(g.sprite('tesoro').jy).toBeGreaterThan(0);
    g.run(1500);
    expect(g.host.sfxLog.slice(sounds)).toContain('fanfarria');
    expect(g.sprite('tesoro').jy).toBe(0);
  });

  it('the green flag puts everybody back at the start', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(3000);
    for (let i = 0; i < 6; i++) { click(g, 'tomi'); click(g, 'coni'); g.run(500); }
    click(g, 'tesoro');
    g.run(300);
    expect(g.sprite('tomi').x).toBeGreaterThan(start('tomi') + 100);
    g.flag();
    g.run(100);
    for (const s of setup.sprites) {
      expect(g.sprite(s.id).x, s.id).toBe(s.x);
      expect(g.sprite(s.id).y, s.id).toBe(s.y);
    }
    expect(g.machine.score).toBeNull();
  });
});

describe('El concierto', () => {
  const setup = setupOf('muestra-concierto');
  const NOTES: Record<string, string[]> = { robi: ['do', 'mi', 'sol'], michi: ['re', 'fa', 'la'], toby: ['mi', 'sol', 'si'], pulpi: ['sol', 'mi', 'do'] };

  it('each musician plays its own notes, in order, and dances while it plays', () => {
    for (const [id, notes] of Object.entries(NOTES)) {
      const g = new Game(setup, { seed: 1 });
      g.flag();
      g.run(4000);
      const before = g.host.noteLog.length;
      expect(click(g, id)).toBe(id);
      g.run(150);
      expect(g.machine.threadCount, `${id}: play and dance at once`).toBeGreaterThanOrEqual(2);
      g.run(2500);
      expect(g.host.noteLog.slice(before), id).toEqual(notes);
      expect(g.machine.score).toBe(1);
    }
  });

  it('nobody leaves the stage or grows after twenty clicks each, in any order', () => {
    const g = new Game(setup, { seed: 3 });
    g.flag();
    g.run(4000);
    for (let i = 0; i < 20; i++) for (const id of Object.keys(NOTES)) { click(g, id); g.run(120 + ((i * 37) % 200)); }
    g.run(4000);
    for (const s of setup.sprites.filter((x) => x.id in NOTES)) {
      const now = g.sprite(s.id);
      expect([now.x, now.y, now.size, now.jy], s.id).toEqual([s.x, s.y, s.size ?? 100, 0]);
    }
  });

  it('the musicians do not overlap each other at the start, and the lights change the stage until the flag', () => {
    const g = new Game(setup, { seed: 1 });
    for (const a of g.machine.instances) for (const b of g.machine.instances) if (a !== b) expect(overlaps(a, b), `${a.id} ${b.id}`).toBe(false);
    g.flag();
    g.run(4000);
    expect(g.machine.backdrop).toBe('teatro');
    expect(click(g, 'luces')).toBe('luces');
    g.run(1500);
    expect(g.machine.backdrop).toBe('espacio');
    g.flag();
    g.run(100);
    expect(g.machine.backdrop).toBe('teatro');
  });
});

describe('Reacción en cadena', () => {
  const setup = setupOf('muestra-cadena');

  /** The moment each link first moves (or scores), after one click on the ball. */
  function chain(g: Game): Record<string, number> {
    const at: Record<string, number> = {};
    const t0 = g.time.now();
    const score0 = g.machine.score ?? 0;
    expect(click(g, 'pelota')).toBe('pelota');
    for (let t = 0; t < 6000; t += 16) {
      g.run(16);
      const now = g.time.now() - t0;
      if (g.sprite('pelota').rot !== 0) at.pelota ??= now;
      if (g.sprite('toby').jy > 0) at.toby ??= now;
      if (g.sprite('pulpi').rot !== 0) at.pulpi ??= now;
      if ((g.machine.score ?? 0) > score0) at.estrella ??= now;
    }
    return at;
  }

  it('one click runs the four links in order', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(4000);
    const at = chain(g);
    expect(Object.keys(at).sort()).toEqual(['estrella', 'pelota', 'pulpi', 'toby']);
    expect(at.pelota).toBeLessThan(at.toby);
    expect(at.toby).toBeLessThan(at.pulpi);
    expect(at.pulpi).toBeLessThan(at.estrella);
    expect(g.machine.score).toBe(1);
    expect(g.machine.errors).toEqual([]);
  });

  it('it can start again without the flag, and does the same again', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(4000);
    const first = chain(g);
    const places = g.machine.snapshot().sprites.map((s) => [s.id, s.x, s.size]);
    expect(places).toEqual(setup.sprites.map((s) => [s.id, s.x, s.size ?? 100]));
    const second = chain(g);
    expect(second).toEqual(first);
    expect(g.machine.score).toBe(2);
    expect(g.machine.snapshot().sprites.map((s) => [s.id, s.x, s.size])).toEqual(places);
  });

  it('only the ball starts the chain: nobody else answers to a click', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(4000);
    for (const id of ['toby', 'pulpi', 'estrella']) click(g, id);
    g.run(3000);
    expect(g.machine.score ?? 0).toBe(0);
  });
});

describe('La feria de las pelotas', () => {
  const setup = setupOf('muestra-feria');
  const TARGETS = ['pelota', 'manzana', 'moneda'];

  it('catching a target scores once, hides it, and brings it back', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(500);
    for (const id of TARGETS) {
      const score = g.machine.score ?? 0;
      expect(click(g, id), id).toBe(id);
      g.run(300);
      expect(g.machine.score, id).toBe(score + 1);
      expect(g.sprite(id).visible, id).toBe(false);
      expect(click(g, id), `${id} is not there to click twice`).not.toBe(id);
      g.run(3500);
      expect(g.sprite(id).visible, id).toBe(true);
    }
    expect(g.machine.score).toBe(3);
  });

  it('the bomb makes noise and scores nothing, however many times it is touched', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    g.run(500);
    const sounds = g.host.sfxLog.length;
    for (let i = 0; i < 5; i++) { expect(click(g, 'bomba')).toBe('bomba'); g.run(900); }
    expect(g.machine.score ?? 0).toBe(0);
    expect(g.host.sfxLog.slice(sounds)).toContain('explosion');
    expect(g.sprite('bomba').visible).toBe(true);
  });

  it('the targets move at different rhythms and never leave the stage', () => {
    const g = new Game(setup, { seed: 1 });
    g.flag();
    const seen: Record<string, Set<string>> = {};
    for (let t = 0; t < 30_000; t += 100) {
      g.run(100);
      for (const s of setup.sprites) {
        const now = g.sprite(s.id);
        expect(Math.abs(now.x), s.id).toBeLessThanOrEqual(HW - 12);
        (seen[s.id] ??= new Set()).add(`${Math.round(now.x)},${Math.round(now.y)}`);
      }
    }
    for (const id of [...TARGETS, 'bomba']) expect(seen[id].size, id).toBeGreaterThan(2);
    expect(g.sprite('moneda').x).toBeGreaterThan(150);
  });

  it('nothing overlaps at the start, and nothing stands where a child cannot click it', () => {
    const g = new Game(setup, { seed: 1 });
    for (const a of g.machine.instances) for (const b of g.machine.instances) if (a !== b) expect(overlaps(a, b), `${a.id} ${b.id}`).toBe(false);
  });

  it('the fair ends: Pipo says goodbye after the last target, and everything is back on show', () => {
    const g = new Game(setup, { seed: 5 });
    g.flag();
    g.run(500);
    click(g, 'pelota');
    g.run(40_000);
    expect(g.host.spoken.map((s) => s.text).at(-1)).toContain('Chau');
    for (const s of setup.sprites) expect(g.sprite(s.id).visible, s.id).toBe(true);
    expect(g.machine.errors).toEqual([]);
  });
});
