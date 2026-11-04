import { describe, expect, it } from 'vitest';
import { Game } from '../../runtime/testing.ts';
import { proveGame } from '../proof.ts';
import { mascotaVirtual } from './mascota-virtual.ts';

describe('mascota-virtual', () => {
  it('a child who does nothing does not win: the pet gets sick', () => {
    const g = new Game(mascotaVirtual.solution.program);
    g.flag();
    g.run(120_000);
    expect(g.machine.stats.won).toBe(false);
    expect(g.machine.ended).toBe('lose');
    expect(g.machine.errors).toEqual([]);
    g.machine.dispose();
  });

  it('a sleeping pet does not eat', () => {
    const g = new Game(mascotaVirtual.solution.program);
    g.flag();
    g.run(200);
    g.tap('nube');
    g.run(100);
    expect(g.machine.vars.get('durmiendo')).toBe(1);
    const before = Number(g.machine.vars.get('comida'));
    g.tap('manzana');
    g.run(60);
    expect(Number(g.machine.vars.get('comida'))).toBeLessThanOrEqual(before);
    g.machine.dispose();
  });

  it.each([2, 3, 4])('plays without runtime errors with random seed %i', async (seed) => {
    const { errors } = await proveGame(mascotaVirtual, seed);
    expect(errors).toEqual([]);
  });
});
