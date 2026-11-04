/** Scratch-style value semantics and small numeric helpers. */

export type Value = number | string | boolean;

/** Longest text a block may build with `join`, so a loop that doubles a string cannot exhaust memory. */
export const MAX_TEXT = 1000;
/** Longest list a program may build. */
export const MAX_LIST = 1000;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Degrees in (-180, 180]. */
export function normalizeDir(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

export function toNum(v: Value | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean' || v === undefined) return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function toStr(v: Value | undefined): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v === undefined) return '';
  return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(10)));
}

export function toBool(v: Value | undefined): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (v === undefined) return false;
  const s = v.trim().toLowerCase();
  return s !== '' && s !== '0' && s !== 'false';
}

export function isNumeric(v: Value): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'boolean') return false;
  return v.trim() !== '' && Number.isFinite(Number(v));
}

/** Negative, zero or positive. Numeric when both sides are numeric, otherwise case-insensitive text. */
export function compare(a: Value, b: Value): number {
  if (isNumeric(a) && isNumeric(b)) return Math.sign(toNum(a) - toNum(b));
  const x = toStr(a).toLowerCase();
  const y = toStr(b).toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Speech engines read emoji aloud; strip them before speaking or estimating duration. */
export const cleanSpeech = (t: string): string => String(t).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').trim();
