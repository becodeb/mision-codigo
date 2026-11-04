import { describe, expect, it } from 'vitest';
import { ART, BACKDROPS, CHARACTERS, IMG, OBJECTS, robiSVG } from './index.ts';

describe('art catalog', () => {
  it('has the six characters and the twelve objects', () => {
    expect(Object.keys(CHARACTERS).sort()).toEqual(['chispa', 'michi', 'nova', 'pulpi', 'robi', 'toby']);
    expect(Object.keys(OBJECTS).sort()).toEqual(['apple', 'ball', 'bolt', 'bomb', 'car', 'cloud', 'coin', 'heart', 'paddle', 'rock', 'star', 'treasure']);
    expect(Object.keys(ART)).toHaveLength(18);
  });

  it('every entry has a drawing and positive hit dimensions', () => {
    for (const def of Object.values(ART)) {
      expect(def.h, def.id).toBeGreaterThan(0);
      expect(def.r, def.id).toBeGreaterThan(0);
      expect(def.svg(), def.id).toMatch(/<(path|rect|circle|ellipse|polygon)/);
    }
  });

  it('characters have a face group that follows the expression; objects have none', () => {
    for (const def of Object.values(ART)) {
      const hasFaceGroup = def.svg().includes('class="face"');
      expect(hasFaceGroup, def.id).toBe(def.kind === 'character');
      expect(def.hasFace, def.id).toBe(def.kind === 'character');
    }
    expect(ART.michi.svg('risa')).not.toBe(ART.michi.svg('triste'));
    expect(ART.star.svg('risa')).toBe(ART.star.svg('triste'));
  });

  it('objects are drawn standing on the origin, inside their own size', () => {
    for (const o of Object.values(OBJECTS)) {
      const nums = [...o.art().matchAll(/(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
      expect(Math.min(...nums), o.name).toBeGreaterThanOrEqual(-70);
      expect(o.h).toBeLessThanOrEqual(60);
    }
  });

  it('keeps the original characters\' sizes', () => {
    expect([ART.michi, ART.toby, ART.robi, ART.chispa, ART.nova, ART.pulpi].map((d) => [d.h, d.r])).toEqual([[92, 38], [90, 38], [122, 40], [96, 40], [112, 40], [92, 38]]);
  });

  it('has the six backdrops, namespaced by prefix', () => {
    expect(Object.keys(BACKDROPS).sort()).toEqual(['castillo', 'ciudad', 'espacio', 'mar', 'parque', 'teatro']);
    expect(BACKDROPS.parque.svg('a-')).toContain('id="a-a"');
    expect(BACKDROPS.parque.svg('b-')).not.toContain('a-a');
  });

  it('has the guide mascot and block icons', () => {
    expect(robiSVG()).toContain('class="robi"');
    expect(IMG.flag.startsWith('data:image/svg+xml')).toBe(true);
    expect(Object.keys(IMG)).toHaveLength(17);
  });
});
