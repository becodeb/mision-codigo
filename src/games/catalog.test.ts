import { describe, expect, it } from 'vitest';
import { ART } from '../art/index.ts';
import { blockInfo } from '../language/catalog.ts';
import type { BlockType } from '../language/catalog.ts';
import { flattenScripts } from '../language/convert.ts';
import type { Block, ProjectProgram, Script, SpriteProgram } from '../language/ir.ts';
import { Game } from '../runtime/testing.ts';
import { planDemo, type DemoPlan, type SpriteView } from '../studio/demoPlan.ts';
import { GAMES, MIN_STEPS } from './catalog.ts';
import { blocksOfProject } from './checks.ts';
import { proveGame, stepsOf } from './proof.ts';
import type { GameDefinition, GameStep, StepContext } from './types.ts';

/** Literals come with the sockets, so they never need to be in a toolbox. */
const IMPLICIT = new Set<string>(['v_num', 'v_text']);

/** The data-point names the studio renders. A wrong name would silently point at nothing. */
const POINTS = new Set(['flag', 'stop', 'show', 'add-sprite', 'sprites', 'backdrops', 'stage', 'workspace', 'toolbox', 'guide', 'sound', 'exit', 'keys', 'example']);

function allowedBlocks(game: GameDefinition): Set<BlockType> {
  return new Set([...game.toolbox, ...stepsOf(game).flatMap((s) => s.unlock ?? [])]);
}

function contextOf(game: GameDefinition, runner: Game): StepContext {
  return { stats: runner.machine.stats, program: game.setup, machine: runner.machine };
}


const goalScripts = (step: GameStep): Script[] => (step.demoScript ? (Array.isArray(step.demoScript) ? [...step.demoScript] : [step.demoScript as Script]) : []);
const kindOf = (art: string): string => (ART as Record<string, { kind: string } | undefined>)[art]?.kind ?? '';
const viewOf = (s: SpriteProgram): SpriteView => ({ id: s.id, name: s.name, art: s.art, kind: kindOf(s.art), scripts: s.scripts });
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Blocks on offer at a step: the game's toolbox and every unlock up to and including that step. */
function offeredAt(game: GameDefinition, stepId: string): Set<BlockType> {
  const out = new Set<BlockType>(game.toolbox);
  for (const s of stepsOf(game)) {
    (s.unlock ?? []).forEach((t) => out.add(t));
    if (s.id === stepId) break;
  }
  return out;
}

/** Gives every block an id, like the workspace does, so the hand's plans can point at them. */
function markIds(scripts: Script[], counter: { n: number }): void {
  const mark = (b: Block): void => {
    b.id ??= `x${++counter.n}`;
    b.body.forEach(mark);
    b.elseBody.forEach(mark);
  };
  for (const sc of scripts) {
    mark(sc.hat);
    sc.body.forEach(mark);
  }
}

/** Does with the IR what the child does with the mouse after the hand showed it: the block lands where the plan says. */
function applyPlan(scripts: Script[], plan: DemoPlan): void {
  if (plan.kind === 'hat') {
    scripts.push({ hat: { ...clone(plan.hat), id: undefined, body: [], elseBody: [] }, body: [] });
    return;
  }
  if (plan.kind !== 'block') return;
  /* What the toolbox hands over is the block alone: the child fills in its mouth and menus. */
  const piece: Block = { ...clone(plan.block), id: undefined, body: [], elseBody: [] };
  const { parent, kind } = plan.slot;
  for (const sc of scripts) {
    if (sc.hat.id === parent) {
      sc.body.unshift(piece);
      return;
    }
    const visit = (list: Block[]): boolean => {
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.id === parent) {
          if (kind === 'next') list.splice(i + 1, 0, piece);
          else (kind === 'do' ? b.body : b.elseBody).unshift(piece);
          return true;
        }
        if (visit(b.body) || visit(b.elseBody)) return true;
      }
      return false;
    };
    if (visit(sc.body)) return;
  }
  throw new Error(`the plan points at a block that is not there: ${String(parent)}`);
}

/** The setup plus the sprites the child adds in the solution, without their code. */
function startProject(game: GameDefinition): ProjectProgram {
  const program = clone(game.setup);
  program.variables = [...new Set([...program.variables, ...game.solution.program.variables])];
  program.lists = [...new Set([...program.lists, ...game.solution.program.lists])];
  for (const sp of game.solution.program.sprites) {
    if (!program.sprites.some((s) => s.id === sp.id)) program.sprites.push({ ...clone(sp), scripts: [] });
  }
  return program;
}

/** What a child does to try the scripts: the flag, a tap on each sprite, and the keys the scripts listen to. */
function tryIt(runner: Game, program: ProjectProgram, scripts: readonly Script[]): void {
  runner.flag();
  runner.run(400);
  for (const sp of program.sprites) runner.tap(sp.id);
  runner.run(400);
  for (const key of new Set(scripts.filter((sc) => sc.hat.type === 'a_key').map((sc) => String(sc.hat.fields.K)))) runner.hold(key, 600);
  runner.run(15_000);
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
          expect(step.demoScript, step.id).toBeUndefined();
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

    it('has a demo script only where it can show a block, and only blocks the step offers', () => {
      for (const step of stepsOf(game)) {
        if (!step.demoScript) {
          expect(step.demoSprite, step.id).toBeUndefined();
          expect(step.demoEach, step.id).toBeUndefined();
          continue;
        }
        const scripts = goalScripts(step);
        expect(scripts.length, step.id).toBeGreaterThan(0);
        const offered = offeredAt(game, step.id);
        for (const sc of scripts) {
          expect(blockInfo(sc.hat.type)?.kind, `${step.id} hat`).toBe('hat');
          for (const b of flattenScripts([sc])) {
            if (IMPLICIT.has(b.type)) continue;
            expect(offered.has(b.type), `${step.id}: ${b.type} is not offered yet`).toBe(true);
          }
        }
      }
    });

    it('builds what each step asks for when the child follows the hand, press by press', () => {
      const program = startProject(game);
      const counter = { n: 0 };
      let selected = program.sprites[0]?.id ?? null;
      const failures: string[] = [];
      for (const step of stepsOf(game)) {
        if (!step.demoScript) continue;
        const goal = { scripts: goalScripts(step), sprite: step.demoSprite, each: step.demoEach };
        let plan: DemoPlan | null = null;
        let presses = 0;
        for (; presses < 40; presses++) {
          for (const sp of program.sprites) markIds(sp.scripts, counter);
          plan = planDemo(goal, program.sprites.map(viewOf), selected);
          if (plan.kind === 'try') break;
          if (plan.kind === 'select-sprite') selected = plan.spriteId;
          else if (plan.kind === 'add-sprite') throw new Error(`${step.id}: the hand asks for a sprite the solution never adds`);
          else applyPlan(program.sprites.find((sp) => sp.id === selected)!.scripts, plan);
        }
        if (plan?.kind !== 'try') {
          failures.push(`${step.id}: the hand never finished (40 presses)`);
          continue;
        }
        const snapshot = clone(program);
        /* A «cuando toque a …» script is tried by letting the two touch. */
        for (const sc of goalScripts(step)) {
          const other = sc.hat.type === 'a_touching' ? snapshot.sprites.find((x) => x.id === sc.hat.fields.T) : undefined;
          const mine = snapshot.sprites.find((x) => x.id === selected);
          if (other && mine) Object.assign(other, { x: mine.x, y: mine.y });
        }
        const runner = new Game(snapshot);
        tryIt(runner, snapshot, goalScripts(step));
        const ctx: StepContext = { stats: runner.machine.stats, program: snapshot, machine: runner.machine };
        let ok = false;
        try { ok = step.check(ctx) === true; } catch { ok = false; }
        runner.machine.dispose();
        if (!ok) failures.push(`${step.id}: the check still fails after ${presses} presses`);
      }
      expect(failures).toEqual([]);
    });

    it('does not pass any step on the untouched project', () => {
      const runner = new Game(game.setup);
      const ctx = contextOf(game, runner);
      const passed = stepsOf(game).filter((s) => s.check(ctx)).map((s) => s.id);
      runner.machine.dispose();
      expect(passed).toEqual([]);
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
