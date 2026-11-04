import { describe, expect, it } from 'vitest';
import { blockInfo } from '../language/catalog.ts';
import type { BlockType } from '../language/catalog.ts';
import { Game } from '../runtime/testing.ts';
import { GAMES, MIN_STEPS } from './catalog.ts';
import { blocksOfProject } from './checks.ts';
import { ProofGame, proveGame, stepsOf } from './proof.ts';
import { NO_UI, type GameDefinition, type StepContext } from './types.ts';

/** Literals come with the sockets, so they never need to be in a toolbox. */
const IMPLICIT = new Set<string>(['v_num', 'v_text']);

/** The data-point names the studio renders. A wrong name would silently point at nothing. */
const POINTS = new Set(['flag', 'stop', 'show', 'add-sprite', 'sprites', 'backdrops', 'stage', 'workspace', 'toolbox', 'guide', 'sound', 'exit', 'keys', 'example']);

function allowedBlocks(game: GameDefinition): Set<BlockType> {
  return new Set([...game.toolbox, ...stepsOf(game).flatMap((s) => s.unlock ?? [])]);
}

function contextOf(game: GameDefinition, runner: Game): StepContext {
  return { stats: runner.machine.stats, program: game.setup, machine: runner.machine, ui: NO_UI };
}

describe('catalog', () => {
  it('has unique game ids', () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(GAMES.map((g) => [g.id, g] as const))('%s', (_id, game) => {
    it('has the phases, steps and challenges a class needs', () => {
      expect(game.phases.length).toBeGreaterThanOrEqual(3);
      expect(stepsOf(game).length).toBeGreaterThanOrEqual(MIN_STEPS[game.level]);
      expect(game.challenges.length).toBeGreaterThanOrEqual(3);
      const ids = stepsOf(game).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('gives every step past the first phase a hint ladder', () => {
      for (const phase of game.phases.slice(1)) {
        for (const step of phase.steps) {
          if (step.point) continue;
          expect(step.hints.length, step.id).toBeGreaterThanOrEqual(1);
          expect(step.demo, step.id).toBeUndefined();
        }
      }
    });

    it('points only at parts of the studio that exist', () => {
      for (const step of stepsOf(game)) {
        if (step.point) expect(POINTS.has(step.point), step.point).toBe(true);
      }
    });

    it('offers only blocks of its level and tier', () => {
      const tier = game.level <= 2 ? 'picture' : 'text';
      for (const type of allowedBlocks(game)) {
        const info = blockInfo(type);
        expect(info, type).toBeDefined();
        expect(info!.tier, type).toBe(tier);
        expect(info!.level, type).toBeLessThanOrEqual(game.level);
      }
    });

    it('solves itself using only the blocks it offers', () => {
      const allowed = allowedBlocks(game);
      for (const block of blocksOfProject(game.solution.program)) {
        if (IMPLICIT.has(block.type)) continue;
        expect(allowed.has(block.type), block.type).toBe(true);
      }
    });

    it('does not pass any step on the untouched project', () => {
      const runner = new Game(game.setup);
      const ctx = contextOf(game, runner);
      const passed = stepsOf(game).filter((s) => s.check(ctx)).map((s) => s.id);
      runner.machine.dispose();
      expect(passed).toEqual([]);
    });

    it('lets a child pass a pick-a-place step by tapping any place, the marked one included', () => {
      const places = stepsOf(game).filter((s) => s.point === 'backdrops');
      const runner = new Game(game.setup);
      const base = contextOf(game, runner);
      for (const step of places) {
        expect(step.check(base), step.id).toBe(false);
        const tapped = step.check({ ...base, ui: { backdropChosen: true } });
        /* Only banda-parque asks for a musician too. */
        expect(tapped, step.id).toBe(game.id === 'banda-parque' ? false : true);
      }
      runner.machine.dispose();
    });

    it('does not finish a phase by only pressing the flag on the starter', () => {
      const runner = new Game(game.setup);
      runner.flag();
      runner.run(10_000);
      const ctx = contextOf(game, runner);
      const passed = game.phases.map((p) => p.steps[p.steps.length - 1]).filter((s) => s.check(ctx)).map((s) => s.id);
      runner.machine.dispose();
      expect(passed).toEqual([]);
    });

    it('is proven by playing its solution', async () => {
      const { missing, errors } = await proveGame(game);
      expect(missing).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
});

/**
 * A step whose text sends the child to try something must not pass the instant the flag goes up: the program
 * has to have lived and done it. The text match catches the wording; the list names steps that describe
 * a behavior (it falls, it jumps, the face changes) without saying «probalo».
 */
const TRY = /probalo|probarlo|probar\b|comprob|\bjugá|\bdejá |dejala|dejate|mirá cómo|a propósito|\bjuntá|\batrapá|esperá|tocala|tocá la comida/i;
const BEHAVIOR = new Set([
  'tres-vidas:cae', 'tres-vidas:clon-cae', 'tres-vidas:velocidad', 'tres-vidas:ritmo',
  'contrarreloj:salta', 'contrarreloj:bonus', 'contrarreloj:trampa', 'contrarreloj:bonus-suma',
  'mascota-virtual:dormida', 'mascota-virtual:cara-dos', 'mascota-virtual:cara-tres', 'mascota-virtual:animo',
  'tesoro:castigo', 'tesoro:mover', 'chispa:heroe',
]);

describe('steps that ask the child to try something', () => {
  it.each(GAMES.map((g) => [g.id, g] as const))('%s: none passes on the flag and one frame, with no input', (_id, game) => {
    const driver = new ProofGame(game, game.solution.program);
    driver.flag();
    driver.run(20);
    const early = stepsOf(game)
      .filter((s) => (TRY.test(s.text) || BEHAVIOR.has(`${game.id}:${s.id}`)) && driver.done.has(s.id))
      .map((s) => s.id);
    driver.machine.dispose();
    expect(early).toEqual([]);
  });

  it('names only steps that exist', () => {
    const real = new Set(GAMES.flatMap((g) => stepsOf(g).map((s) => `${g.id}:${s.id}`)));
    for (const key of BEHAVIOR) expect(real.has(key), key).toBe(true);
  });
});
