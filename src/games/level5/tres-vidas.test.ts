import { describe, expect, it } from 'vitest';
import { ProofGame, proveGame } from '../proof.ts';
import { tresVidas } from './tres-vidas.ts';

describe('tres-vidas', () => {
  it('a child who does nothing does not win', () => {
    const g = new ProofGame(tresVidas, tresVidas.solution.program);
    g.flag();
    g.run(120_000);
    expect(g.machine.stats.won).toBe(false);
    expect(g.machine.ended).not.toBe('win');
    expect(g.machine.errors).toEqual([]);
    g.machine.dispose();
  });

  it.each([2, 3, 4])('plays without runtime errors with random seed %i', async (seed) => {
    const { errors } = await proveGame(tresVidas, seed);
    expect(errors).toEqual([]);
  });
});
