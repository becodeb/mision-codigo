import { describe, expect, it } from 'vitest';
import { parseHow, sayHow } from './chips.ts';

const name = (id: string): string => ({ toby: 'Toby', tomi: 'Tomi' })[id] ?? id;

describe('a step, said aloud', () => {
  it('names blocks with words, sprites with their names and the green button as «Empezar»', () => {
    expect(sayHow('Tocá **▶** y leé lo que dice {toby}', name)).toBe('Tocá Empezar y leé lo que dice Toby');
    expect(sayHow('Poné [f_spin] abajo del [f_jump]', name)).toBe('Poné el giro abajo del salto');
    expect(sayHow('Poné otro [f_right] abajo del [f_right] de {tomi}', name)).toBe('Poné otro paso abajo del paso de Tomi');
    expect(sayHow('Poné otra [f_star] abajo de la que ya hay', name)).toBe('Poné otra estrella abajo de la que ya hay');
    expect(sayHow('Poné dos [f_note] más, abajo de la última nota', name)).toBe('Poné dos notas más, abajo de la última nota');
  });

  it('never reads a block id', () => {
    for (const t of ['Poné [f_right]', 'Poné [f_grow]', 'Poné [f_hide]', 'Poné [f_random]']) expect(sayHow(t, name)).not.toMatch(/f_/);
  });

  it('parses the marks of a sentence', () => {
    expect(parseHow('En [a_setsize], cambiá el **100** por **70**').map((p) => p.kind)).toEqual(['text', 'block', 'text', 'button', 'text', 'button']);
  });
});
