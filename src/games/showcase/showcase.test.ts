import { describe, expect, it } from 'vitest';
import { ART } from '../../art/index.ts';
import { blockInfo, type BlockType } from '../../language/catalog.ts';
import { blocklyToIr, flattenScripts, irToBlockly } from '../../language/convert.ts';
import type { Block, ProjectProgram, Script, SpriteProgram } from '../../language/ir.ts';
import { Game } from '../../runtime/testing.ts';
import { LEVEL_IDS } from '../../shared/levels.ts';
import { applyPlan, planDemo, type SpriteView } from '../../studio/demoPlan.ts';
import { Pilot, centerOf, touchingNow } from '../level4/autopilot.ts';
import { stepsOf } from '../proof.ts';
import type { GameStep, StepContext } from '../types.ts';
import { SHOWCASE, showcaseFor, showcasesFor } from './index.ts';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** The program as the editor gives it back: through Blockly's own format and back. */
function throughEditor(p: ProjectProgram): ProjectProgram {
  return { ...clone(p), sprites: p.sprites.map((s) => ({ ...clone(s), scripts: blocklyToIr(irToBlockly(s.scripts)) })) };
}

function contextOf(program: ProjectProgram, tried: boolean): StepContext {
  const game = new Game(program, { seed: 1 });
  return { stats: game.machine.stats, program, machine: game.machine, ui: { backdropChosen: true, tried } };
}

const kindOf = (art: string): string => (ART as Record<string, { kind: string } | undefined>)[art]?.kind ?? '';
const viewOf = (s: SpriteProgram): SpriteView => ({ id: s.id, name: s.name, art: s.art, kind: kindOf(s.art), scripts: s.scripts });
const demoOf = (step: GameStep): Script[] => (step.demoScript ? (Array.isArray(step.demoScript) ? [...step.demoScript] : [step.demoScript as Script]) : []);

let ids = 0;
function mark(scripts: Script[]): void {
  const visit = (b: Block): void => {
    b.id ??= `m${++ids}`;
    b.body.forEach(visit);
    b.elseBody.forEach(visit);
  };
  for (const sc of scripts) { visit(sc.hat); sc.body.forEach(visit); }
}

describe('showcase games', () => {
  it('has at least one for each level, and the entry game is the first of its list', () => {
    for (const level of LEVEL_IDS) {
      expect(showcaseFor(level)?.level).toBe(level);
      expect(showcasesFor(level)[0]).toBe(showcaseFor(level));
      expect(showcasesFor(level).every((g) => g.level === level)).toBe(true);
    }
    expect(new Set(SHOWCASE.map((g) => g.id)).size).toBe(SHOWCASE.length);
  });

  it('lists the games of a level by order, then in the order of the catalog', () => {
    const level = SHOWCASE[0].level;
    const entry = SHOWCASE.find((g) => g.level === level)!;
    const second = { ...entry, id: 'fake-second', order: 2 };
    const zero = { ...entry, id: 'fake-first', order: 0 };
    SHOWCASE.push(second, zero);
    try {
      expect(showcasesFor(level).map((g) => g.id)).toEqual(['fake-first', ...SHOWCASE.filter((g) => g.level === level && g.order === 1).map((g) => g.id), 'fake-second']);
      expect(showcaseFor(level).id).toBe('fake-first');
    } finally {
      SHOWCASE.splice(SHOWCASE.indexOf(second), 1);
      SHOWCASE.splice(SHOWCASE.indexOf(zero), 1);
    }
  });

  describe.each(SHOWCASE.map((g) => [g.id, g] as const))('%s', (_id, game) => {
    const cards = stepsOf(game);

    it('has enough things to change, of both kinds, with everything its card needs', () => {
      expect(cards.length).toBeGreaterThanOrEqual(9);
      expect(cards.filter((c) => c.card!.kind === 'code').length).toBeGreaterThanOrEqual(5);
      expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
      for (const c of cards) {
        expect(c.card!.how.length, c.id).toBeGreaterThanOrEqual(2);
        expect(c.card!.label.length, c.id).toBeLessThanOrEqual(24);
        /* «Mostrame» always has something to show: a block to bring, a block to change, or a part of the screen. */
        expect(!!c.demoScript || !!c.card!.block || !!c.point, c.id).toBe(true);
        if (c.card!.sprite) expect(game.setup.sprites.some((s) => s.id === c.card!.sprite), c.id).toBe(true);
      }
    });

    it('names only sprites of the game in its texts', () => {
      const texts = cards.flatMap((c) => c.card!.how.map((h) => h.t)).concat(game.showcase!.pillars.map((p) => p.broken));
      for (const t of texts) for (const m of t.matchAll(/\{(\w+)\}/g)) expect(game.setup.sprites.some((s) => s.id === m[1]), t).toBe(true);
    });

    it('draws real blocks in its steps, and every step belongs to something the hand does', () => {
      for (const c of cards) {
        for (const h of c.card!.how) {
          for (const m of h.t.matchAll(/\[(\w+)\]/g)) expect(game.toolbox, `${c.id}: ${m[1]}`).toContain(m[1]);
          expect(['add', 'point', 'modal', 'change', 'tune', 'try'].includes(h.on) || game.toolbox.includes(h.on as BlockType), `${c.id}: ${h.on}`).toBe(true);
        }
        expect(new Set(c.card!.how.map((h) => h.on)).size, c.id).toBe(c.card!.how.length);
        if (c.id !== 'fondo' && c.id !== 'personaje') expect(c.card!.how.at(-1)!.on, c.id).toBe('try');
      }
    });

    it('offers every block it is made of and every block a card needs', () => {
      const offered = new Set<BlockType>(game.toolbox);
      const missing = new Set<string>();
      const check = (scripts: readonly Script[]): void => {
        for (const b of flattenScripts(scripts)) if (b.type !== 'v_num' && b.type !== 'v_text' && !offered.has(b.type)) missing.add(b.type);
      };
      game.setup.sprites.forEach((s) => check(s.scripts));
      for (const c of cards) { check(demoOf(c)); c.example?.forEach((e) => check(e.scripts)); }
      const solved = clone(game.setup);
      cards.forEach((c) => c.card!.solve(solved));
      solved.sprites.forEach((s) => check(s.scripts));
      expect([...missing]).toEqual([]);
      for (const t of game.toolbox) expect(blockInfo(t)!.tier).toBe(game.level <= 2 ? 'picture' : 'text');
    });

    it('gives no card for free, not even after playing', () => {
      const ctx = contextOf(throughEditor(game.setup), true);
      expect(cards.filter((c) => c.check(ctx)).map((c) => c.id)).toEqual([]);
    });

    it.each(cards.map((c) => [c.id, c] as const))('card %s is completed by doing it, and by nothing else', (id, step) => {
      const p = clone(game.setup);
      step.card!.solve(p);
      const solved = throughEditor(p);
      const done = cards.filter((c) => c.check(contextOf(solved, true))).map((c) => c.id);
      expect(done).toContain(id);
      /* A change may also count for a sister card (the same block), but not for most of the wall. */
      expect(done.length).toBeLessThanOrEqual(2);
      const runner = new Game(solved, { seed: 2 });
      runner.flag();
      runner.run(4000);
      solved.sprites.forEach((s) => runner.tap(s.id));
      runner.run(3000);
      expect(runner.machine.errors).toEqual([]);
    });

    it('asks to try the code cards before they count', () => {
      for (const step of cards) {
        const p = clone(game.setup);
        step.card!.solve(p);
        const early = step.check(contextOf(throughEditor(p), false));
        expect(early, step.id).toBe(step.id === 'fondo' || step.id === 'personaje');
      }
    });

    it('can have every card done at once, and every card keeps its check', () => {
      const p = clone(game.setup);
      cards.forEach((c) => c.card!.solve(p));
      const all = throughEditor(p);
      expect(cards.filter((c) => !c.check(contextOf(all, true))).map((c) => c.id)).toEqual([]);
      expect(game.showcase!.pillars.filter((x) => !x.ok(all)).map((x) => x.id)).toEqual([]);
    });

    it('the hand can lead every demo to its end', () => {
      for (const step of cards) {
        const scripts = demoOf(step);
        if (!scripts.length) continue;
        const sprites = clone(game.setup).sprites;
        if (step.card!.newSprite) sprites.push({ id: 's1', art: 'heart', name: 'Nuevo', x: 0, y: 0, scripts: [] });
        sprites.forEach((s) => mark(s.scripts));
        const target = step.card!.newSprite ? 's1' : step.card!.sprite!;
        let plan = planDemo({ scripts, sprite: target }, sprites.map(viewOf), target);
        for (let i = 0; i < 20 && plan.kind !== 'try'; i++) {
          expect(['hat', 'block', 'move'], `${step.id}: ${plan.kind}`).toContain(plan.kind);
          applyPlan(sprites.find((s) => s.id === target)!, plan);
          plan = planDemo({ scripts, sprite: target }, sprites.map(viewOf), target);
        }
        expect(plan.kind, step.id).toBe('try');
      }
    });

    it('the hand finds the block of every «change this» card', () => {
      for (const step of cards) {
        const want = step.card!.block;
        if (!want) continue;
        const s = game.setup.sprites.find((x) => x.id === step.card!.sprite)!;
        expect(flattenScripts(s.scripts).some((b) => b.type === want.type && (!want.where || want.where(b))), step.id).toBe(true);
      }
    });

    it('starts whole, notices each part that is taken away, and can put it back', () => {
      for (const pillar of game.showcase!.pillars) {
        expect(pillar.ok(throughEditor(game.setup)), pillar.id).toBe(true);
        const broken = clone(game.setup);
        broken.sprites.forEach((s) => { s.scripts = []; });
        expect(pillar.ok(broken), pillar.id).toBe(false);
        broken.sprites.find((s) => s.id === pillar.restore.sprite)!.scripts.push(clone(pillar.restore.script));
        expect(pillar.ok(throughEditor(broken)), pillar.id).toBe(true);
      }
    });

    it('never makes a child lose for sitting still at the start', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const runner = new Game(game.setup, { seed });
        runner.flag();
        runner.run(12_000);
        expect(runner.machine.ended, `seed ${seed}`).not.toBe('lose');
        expect(runner.machine.errors).toEqual([]);
      }
    });
  });
});

/** Steers like a distracted child: looks every `delay` ms and goes straight for the prize, without dodging. */
function playArrows(id: string, hero: string, prize: string, hazards: string[], delay: number, seed: number, maxMs = 180_000): { ended: string | null; ms: number } {
  const game = SHOWCASE.find((g) => g.id === id)!;
  const g = new Game(game.setup, { seed });
  g.flag();
  const pilot = new Pilot(g, { hero, speed: 4, hazards, horizon: 20 });
  let t = 0;
  let next = 0;
  let stuck = 0;
  while (t < maxMs && !g.machine.ended) {
    if (t >= next) {
      next = t + delay;
      const touching = touchingNow(g.sprite(hero), g.sprite(prize));
      stuck = touching ? stuck + 1 : 0;
      const to = stuck > 2 ? { x: 0, y: 0 } : g.sprite(prize).visible ? centerOf(g.sprite(prize)) : { x: g.sprite(hero).x, y: centerOf(g.sprite(hero)).y };
      pilot.steer(to.x, to.y);
    }
    /* A held arrow fires its key scripts on the studio's own clock. */
    for (const key of [...g.machine.keys]) if (t % 64 < 16) g.machine.keyDown(key, true);
    g.run(16);
    t += 16;
  }
  return { ended: g.machine.ended, ms: t };
}

describe('a child who reacts slowly can win', () => {
  it.each([
    ['muestra-nova', 'nova', 'estrella'],
    ['muestra-manzanas', 'coni', 'manzana'],
    ['muestra-chispa', 'chispa', 'moneda'],
  ])('%s', (id, hero, prize) => {
    const results = Array.from({ length: 10 }, (_, i) => playArrows(id, hero, prize, [], 350, i + 1));
    const won = results.filter((r) => r.ended === 'win');
    expect(won.length, JSON.stringify(results)).toBeGreaterThanOrEqual(6);
  });

  it('La estrella que se escapa: every tap counts', () => {
    const g = new Game(SHOWCASE[0].setup, { seed: 4 });
    g.flag();
    for (let i = 0; i < 5; i++) { g.tap('estrella'); g.run(900); }
    expect(g.machine.score).toBe(5);
  });

  it('La noche de Boo: shows up nine times and each catch counts once', () => {
    const g = new Game(SHOWCASE[1].setup, { seed: 4 });
    g.flag();
    let shown = 0;
    let before = true;
    for (let t = 0; t < 40_000; t += 50) {
      const now = g.sprite('boo').visible;
      if (now && !before) { shown++; g.run(600); if (g.sprite('boo').visible) g.tap('boo'); }
      before = now;
      g.run(50);
    }
    expect(shown).toBeGreaterThanOrEqual(9);
    expect(g.machine.score).toBeGreaterThanOrEqual(8);
  });
});
