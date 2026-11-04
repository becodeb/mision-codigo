import { clamp, normalizeDir } from './values.ts';
import type { SpriteInstance } from './instance.ts';

/** Half the stage: it is 480 x 360, origin at the centre, y up. */
export const HW = 240;
export const HH = 180;

/** Keeps a sprite's feet where it can stand: inset from the sides, a little above the floor, below the ceiling. */
export function clampXY(x: number, y: number): [number, number] {
  return [clamp(x, -HW + 12, HW - 12), clamp(y, -HH + 4, HH - 40)];
}

export interface Bounds {
  /** Centre of the hit circle, x and y. */
  x: number;
  y: number;
  r: number;
  h: number;
  /** Feet height including the jump offset. */
  feet: number;
}

/** Hitbox. The jump offset moves it, so a jumping sprite can touch what is above it. */
export function bounds(s: SpriteInstance): Bounds {
  const sc = s.size / 100;
  const feet = s.y + s.jy;
  return { x: s.x, y: feet + (s.art.h * sc) / 2, r: s.art.r * sc, h: s.art.h * sc, feet };
}

export interface EdgeHits {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
  any: boolean;
}

/**
 * Which stage borders the sprite touches. A border counts as touched when the hitbox crosses it or
 * when the sprite stands at the limit `clampXY` allows. The second rule is what makes the bottom
 * reachable: the clamp keeps the feet above the floor, so the hitbox alone never crossed it.
 */
export function edgeHits(s: SpriteInstance): EdgeHits {
  const b = bounds(s);
  const left = b.x - b.r < -HW || b.x <= -HW + 12;
  const right = b.x + b.r > HW || b.x >= HW - 12;
  const bottom = b.feet <= -HH + 4;
  const top = b.feet + b.h > HH || b.feet >= HH - 40;
  return { left, right, top, bottom, any: left || right || top || bottom };
}

/** Two visible sprites touch when their hit circles overlap by more than 15%. */
export function overlaps(a: SpriteInstance, b: SpriteInstance): boolean {
  if (!a.visible || !b.visible) return false;
  const p = bounds(a);
  const q = bounds(b);
  return Math.hypot(p.x - q.x, p.y - q.y) < (p.r + q.r) * 0.85;
}

/** Sets the direction and mirrors the drawing toward the side it now faces. */
export function setDir(s: SpriteInstance, deg: number): void {
  s.dir = normalizeDir(deg);
  const sin = Math.sin((s.dir * Math.PI) / 180);
  if (sin > 1e-9) s.flip = 1;
  else if (sin < -1e-9) s.flip = -1;
}

/**
 * Bounces off every border the sprite touches while moving into it, for any heading.
 * A side wall mirrors the heading (dir -> -dir); the floor and ceiling flip it (dir -> 180 - dir).
 */
export function bounceOffEdges(s: SpriteInstance): void {
  const hits = edgeHits(s);
  const rad = (s.dir * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  let d = s.dir;
  if ((hits.left && sin < 0) || (hits.right && sin > 0)) d = -d;
  if ((hits.bottom && cos < 0) || (hits.top && cos > 0)) d = 180 - d;
  if (d !== s.dir) setDir(s, d);
}

/** Whether a stage point is on the sprite: its width at the hit radius, its full height. */
export function hitTest(s: SpriteInstance, px: number, py: number): boolean {
  if (!s.visible) return false;
  const b = bounds(s);
  return Math.abs(px - b.x) <= b.r && py >= b.feet && py <= b.feet + b.h;
}
