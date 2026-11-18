import { describe, expect, it } from 'vitest';
import { GAMES } from '../games/catalog.ts';
import { ProofGame } from '../games/proof.ts';
import type { GameDefinition } from '../games/types.ts';
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
