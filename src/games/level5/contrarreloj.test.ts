import { describe, expect, it } from 'vitest';
import { ProofGame, proveGame } from '../proof.ts';
import { contrarreloj } from './contrarreloj.ts';

describe('contrarreloj', () => {
  it('a child who does nothing does not win', () => {
    const g = new ProofGame(contrarreloj, contrarreloj.solution.program);
    g.flag();
    g.run(120_000);
    expect(g.machine.stats.won).toBe(false);
    expect(g.machine.ended).toBe('lose');
    expect(g.machine.errors).toEqual([]);
    g.machine.dispose();
  });

  it.each([2, 3, 4])('plays without runtime errors with random seed %i', async (seed) => {
    const { errors } = await proveGame(contrarreloj, seed);
    expect(errors).toEqual([]);
  });
});
