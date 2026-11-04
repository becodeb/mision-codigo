import { describe, expect, it } from 'vitest';
import { Game } from '../../runtime/testing.ts';
import { proveGame } from '../proof.ts';
import { tresVidas } from './tres-vidas.ts';

describe('tres-vidas', () => {
  it('a child who does nothing does not win', () => {
    const g = new Game(tresVidas.solution.program);
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
  }, 30_000);

  it('can be won: the reference player reaches the goal and every step passes', async () => {
    const { missing } = await proveGame(tresVidas);
    expect(missing).toEqual([]);
  }, 30_000);
});
