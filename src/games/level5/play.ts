/**
 * Helpers for the level 5 solutions: they play like a child, with real key presses and real taps,
 * and read the stage through the sprite instances.
 */
import type { SpriteInstance } from '../../runtime/instance.ts';
import type { Game } from '../../runtime/testing.ts';

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const;

function setKey(game: Game, key: string, down: boolean): void {
  const has = game.machine.keys.has(key);
  if (down && !has) game.press(key);
  else if (!down && has) game.release(key);
}

export function releaseArrows(game: Game): void {
  for (const key of ARROWS) setKey(game, key, false);
}

/** Holds the arrows toward a point for this frame. Returns true when already there (`null` ignores an axis). */
export function steer(game: Game, who: string, x: number | null, y: number | null, dead = 6): boolean {
  const me = game.sprite(who);
  const dx = x === null ? 0 : x - me.x;
  const dy = y === null ? 0 : y - me.y;
  setKey(game, 'ArrowRight', dx > dead);
  setKey(game, 'ArrowLeft', dx < -dead);
  setKey(game, 'ArrowUp', dy > dead);
  setKey(game, 'ArrowDown', dy < -dead);
  return Math.abs(dx) <= dead && Math.abs(dy) <= dead;
}

/** Walks a sprite to a spot with the arrow keys. Returns whether it arrived in time. */
export function walkTo(game: Game, who: string, x: number | null, y: number | null, maxMs = 6000, dead = 6): boolean {
  const arrived = game.runUntil(() => steer(game, who, x, y, dead), maxMs);
  releaseArrows(game);
  return arrived;
}

/** The clones of a sprite that are on the stage right now. */
export const clonesOf = (game: Game, spriteId: string): SpriteInstance[] =>
  game.machine.instances.filter((i) => i.spriteId === spriteId && i.isClone && i.visible);

export const varNow = (game: Game, name: string): number => Number(game.machine.vars.get(name) ?? 0);
