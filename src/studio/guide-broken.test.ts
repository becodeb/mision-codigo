import { describe, expect, it } from 'vitest';
import { GAMES } from '../games/catalog.ts';
import { ProofGame } from '../games/proof.ts';
import type { GameDefinition, StepContext } from '../games/types.ts';
import { fClick, fFace, fRight, fSay, fStar, fUp, type Script } from '../language/ir.ts';
import { GuideTracker, taughtBlocks } from './guide.ts';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

async function finished(game: GameDefinition) {
  const program = clone(game.solution.program);
  const driver = new ProofGame(game, program);
  await game.solution.play(driver);
  driver.poll();
  const tracker = new GuideTracker(game, { completed: [...driver.done].map((id) => ({ id, at: '2026-11-18T00:00:00Z' })) });
  return { driver, tracker, program };
}

describe('the guide notices deleted code', () => {
  describe.each(GAMES.map((g) => [g.id, g] as const))('%s', (_id, game) => {
    it('does not complain about a finished project, even after reopening it', async () => {
      const { driver, tracker, program } = await finished(game);
      expect(tracker.broken(program)?.step.id ?? null).toBeNull();
      driver.machine.dispose();
    });

    it('points at an earlier step when every script is deleted', async () => {
      const { driver, tracker, program } = await finished(game);
      const emptied = clone(program);
      emptied.sprites.forEach((s) => (s.scripts = []));
      const judged = tracker.steps.filter((s) => taughtBlocks(s.step).length > 0);
      expect(judged.length).toBeGreaterThan(0);
      expect(tracker.broken(emptied)).not.toBeNull();
      driver.machine.dispose();
    });
  });
});

describe('a concrete deletion', () => {
  it('chispa-facil: deleting the coin jump points at «La moneda salta»', async () => {
    const game = GAMES.find((g) => g.id === 'chispa-facil')!;
    const { driver, tracker, program } = await finished(game);
    const edited = clone(program);
    for (const sc of edited.sprites.find((s) => s.id === 'moneda')!.scripts) sc.body = sc.body.filter((blk) => blk.type !== 'a_random');
    expect(tracker.broken(edited)?.step.id).toBe('reaparece');
    driver.machine.dispose();
  });
});

describe('the warning never traps a child who did it another way', () => {
  /** Plays a variant of the solution; the tracker is the one a reopened project would have. */
  async function finishedWith(id: string, scripts: Record<string, Script[]>) {
    const game = GAMES.find((g) => g.id === id)!;
    const program = clone(game.solution.program);
    for (const [sid, list] of Object.entries(scripts)) program.sprites.find((s) => s.id === sid)!.scripts = clone(list);
    const driver = new ProofGame(game, program);
    await game.solution.play(driver);
    driver.poll();
    const tracker = new GuideTracker(game, { completed: [...driver.done].map((sid) => ({ id: sid, at: '2026-11-18T00:00:00Z' })) });
    const ctx: StepContext = { stats: driver.machine.stats, program, machine: driver.machine, ui: { backdropChosen: true } };
    return { driver, tracker, program, ctx };
  }

  it('m1-mar: Michi escaping to the right (not to the left like the example) is not «borraste algo»', async () => {
    const { driver, tracker, program, ctx } = await finishedWith('m1-mar', { michi: [fClick(fFace('sorpresa'), fSay('MIEDO'), fRight(), fRight())] });
    expect(tracker.finished).toBe(true);
    expect(tracker.broken(program, ctx)).toBeNull();
    /* Reopened: no runs yet, judged by the code alone. */
    expect(tracker.broken(program)).toBeNull();
    driver.machine.dispose();
  });

  it('m1-arregla: an apple that gives its star without the sound of the example is not «borraste algo»', async () => {
    const { driver, tracker, program } = await finishedWith('m1-arregla', { manzana: [fClick(fStar())] });
    expect(tracker.finished).toBe(true);
    expect(tracker.broken(program)).toBeNull();
    driver.machine.dispose();
  });

  it('m1-mar: the warning goes away as soon as the step is rebuilt, with other blocks and in another order', async () => {
    const { driver, tracker, program, ctx } = await finishedWith('m1-mar', {});
    const erased = clone(program);
    erased.sprites.find((s) => s.id === 'michi')!.scripts = [fClick(fFace('sorpresa'), fSay('MIEDO'))];
    expect(tracker.broken(erased, { ...ctx, program: erased })?.step.id).toBe('michi-escapa');
    const rebuilt = clone(program);
    rebuilt.sprites.find((s) => s.id === 'michi')!.scripts = [fClick(fUp(), fFace('sorpresa'), fUp(), fSay('MIEDO'))];
    expect(tracker.broken(rebuilt, { ...ctx, program: rebuilt })).toBeNull();
    driver.machine.dispose();
  });

  it('a warning dismissed with «Seguir igual» is left out, and the next broken step still shows', async () => {
    const { driver, tracker, program, ctx } = await finishedWith('m1-mar', {});
    const emptied = clone(program);
    emptied.sprites.forEach((s) => (s.scripts = []));
    const all = tracker.brokenSteps(emptied, { ...ctx, program: emptied }).map((f) => f.step.id);
    expect(all.length).toBeGreaterThan(1);
    expect(tracker.broken(emptied, ctx, new Set([all[0]]))?.step.id).toBe(all[1]);
    expect(tracker.broken(emptied, ctx, new Set(all))).toBeNull();
    driver.machine.dispose();
  });

  it('a step moved past («Seguir sin este paso») turns done as soon as its check passes later', () => {
    const game = GAMES.find((g) => g.id === 'm1-circo')!;
    const tracker = new GuideTracker(game);
    expect(tracker.skip('salta')).toBe(true);
    const driver = new ProofGame(game, clone(game.solution.program));
    driver.tap('toby');
    driver.run(2000);
    const fresh = tracker.evaluate({ stats: driver.machine.stats, program: game.solution.program, machine: driver.machine, ui: { backdropChosen: true } });
    expect(fresh.map((f) => f.step.id)).toContain('salta');
    expect(tracker.isDone('salta')).toBe(true);
    expect(tracker.isSkipped('salta')).toBe(false);
    driver.machine.dispose();
  });
});
