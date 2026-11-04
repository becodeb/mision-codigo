import { describe, expect, it } from 'vitest';
import { cleanSpeech, compare, isNumeric, normalizeDir, toBool, toNum, toStr } from './values.ts';

describe('compare', () => {
  it('is numeric when both sides are numeric', () => {
    expect(compare(10, 9)).toBe(1);
    expect(compare('10', '9')).toBe(1);
    expect(compare('10', 9)).toBe(1);
    expect(compare('1.0', 1)).toBe(0);
    expect(compare(' 5 ', 5)).toBe(0);
  });

  it('is case-insensitive text otherwise', () => {
    expect(compare('Hola', 'hola')).toBe(0);
    expect(compare('a', 'B')).toBe(-1);
    expect(compare('10', 'abc')).toBe(-1);
    expect(compare('abc', '10')).toBe(1);
  });

  it('treats empty and blank text as text, not zero', () => {
    expect(compare('', 0)).not.toBe(0);
    expect(isNumeric('  ')).toBe(false);
  });

  it('compares booleans as text', () => {
    expect(compare(true, 'TRUE')).toBe(0);
    expect(compare(true, 1)).not.toBe(0);
  });
});

describe('conversions', () => {
  it('toNum never returns NaN or Infinity', () => {
    expect(toNum('abc')).toBe(0);
    expect(toNum(Infinity)).toBe(0);
    expect(toNum('12')).toBe(12);
    expect(toNum(true)).toBe(1);
    expect(toNum(undefined)).toBe(0);
  });

  it('toStr hides float noise', () => {
    expect(toStr(0.1 + 0.2)).toBe('0.3');
    expect(toStr(3)).toBe('3');
    expect(toStr(true)).toBe('true');
  });

  it('toBool follows Scratch', () => {
    expect([toBool(''), toBool('0'), toBool('false'), toBool(0), toBool('hola'), toBool(2), toBool(' FALSE ')]).toEqual([false, false, false, false, true, true, false]);
  });

  it('normalizeDir stays in (-180, 180]', () => {
    expect([normalizeDir(270), normalizeDir(-190), normalizeDir(180), normalizeDir(-180), normalizeDir(720), normalizeDir(0)]).toEqual([-90, 170, 180, 180, 0, 0]);
  });

  it('cleanSpeech strips emoji', () => {
    expect(cleanSpeech('👋 ¡Hola!')).toBe('¡Hola!');
    expect(cleanSpeech('❤️ ¡Te quiero!')).toBe('¡Te quiero!');
  });
});
