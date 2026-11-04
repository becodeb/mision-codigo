/**
 * A player for the level 4 proofs. It reads positions through the sprite instances like a child reads the
 * screen, presses the arrow keys, and looks half a second ahead so it does not walk into a patrolling
 * hazard. It never touches the machine's state, only its keys.
 */
import { HH, HW, bounds } from '../../runtime/geometry.ts';
import type { SpriteInstance } from '../../runtime/instance.ts';
import type { Game } from '../../runtime/testing.ts';

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const;
const X_LIMIT = HW - 12;
const Y_MIN = -HH + 4;
const Y_MAX = HH - 40;

interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PilotOptions {
  /** Sprite id of the hero. */
  hero: string;
  /** Pixels the hero moves per frame while an arrow is down (a script step is two frames, so half its speed). */
  speed: number;
  /** Sprite ids to stay away from while they are visible. */
  hazards: string[];
  /** Frames to look ahead. */
  horizon?: number;
}

export class Pilot {
  private readonly history = new Map<string, { x: number; y: number }[]>();
  private readonly horizon: number;
  private readonly game: Game;
  private readonly opts: PilotOptions;

  constructor(game: Game, opts: PilotOptions) {
    this.game = game;
    this.opts = opts;
    this.horizon = opts.horizon ?? 26;
  }

  /** Decides this frame's arrows to get the hero's centre to (tx, ty), a point in centre coordinates. */
  steer(tx: number, ty: number): void {
    const hero = this.game.sprite(this.opts.hero);
    const hb = bounds(hero);
    const hazards = this.opts.hazards.map((id) => this.game.sprite(id)).filter((h) => h.visible);
    const movers = hazards.map((h) => this.track(h));
    // Hazards that are not visible are forgotten so a reappearing one does not get a stale velocity.
    for (const id of this.opts.hazards) if (!this.game.sprite(id).visible) this.history.delete(id);

    let best: { kx: number; ky: number; score: number; hit: number } | null = null;
    for (const kx of [-1, 0, 1]) {
      for (const ky of [-1, 0, 1]) {
        const { end, hit } = this.simulate(hero, hb.r, kx, ky, movers, hazards);
        const dist = Math.hypot(end.x - tx, end.y - ty);
        const score = dist + (kx === 0 && ky === 0 ? 4 : 0);
        const better = !best || (hit === Infinity && best.hit === Infinity ? score < best.score : hit > best.hit || (hit === best.hit && score < best.score));
        if (better) best = { kx, ky, score, hit };
      }
    }
    this.press(best?.kx ?? 0, best?.ky ?? 0);
  }

  release(): void {
    this.press(0, 0);
  }

  /** Position and average velocity over the last few frames: scripts move a sprite in jumps, not smoothly. */
  private track(h: SpriteInstance): Mover {
    const past = this.history.get(h.id) ?? [];
    past.push({ x: h.x, y: h.y });
    if (past.length > 7) past.shift();
    this.history.set(h.id, past);
    const first = past[0];
    const n = past.length - 1;
    return { x: h.x, y: h.y, vx: n > 0 ? (h.x - first.x) / n : 0, vy: n > 0 ? (h.y - first.y) / n : 0 };
  }

  private simulate(hero: SpriteInstance, heroR: number, kx: number, ky: number, movers: Mover[], hazards: SpriteInstance[]): { end: { x: number; y: number }; hit: number } {
    const cy = bounds(hero).y - hero.y;
    let x = hero.x;
    let y = hero.y;
    const sim = movers.map((m) => ({ ...m }));
    let hit = Infinity;
    for (let f = 1; f <= this.horizon; f++) {
      x = Math.min(X_LIMIT, Math.max(-X_LIMIT, x + kx * this.opts.speed));
      y = Math.min(Y_MAX, Math.max(Y_MIN, y + ky * this.opts.speed));
      sim.forEach((m, i) => {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x > X_LIMIT || m.x < -X_LIMIT) {
          m.x = Math.min(X_LIMIT, Math.max(-X_LIMIT, m.x));
          m.vx = -m.vx;
        }
        if (m.y > Y_MAX || m.y < Y_MIN) {
          m.y = Math.min(Y_MAX, Math.max(Y_MIN, m.y));
          m.vy = -m.vy;
        }
        const hb = bounds(hazards[i]);
        const reach = (heroR + hb.r) * 0.85 * 1.15;
        if (hit === Infinity && Math.hypot(x - m.x, y + cy - (m.y + (hb.y - hazards[i].y))) < reach) hit = f;
      });
    }
    return { end: { x, y: y + cy }, hit };
  }

  private press(kx: number, ky: number): void {
    const want: Record<(typeof ARROWS)[number], boolean> = { ArrowLeft: kx < 0, ArrowRight: kx > 0, ArrowDown: ky < 0, ArrowUp: ky > 0 };
    for (const key of ARROWS) {
      if (want[key]) this.game.machine.keyDown(key);
      else this.game.machine.keyUp(key);
    }
  }
}

/** Centre of a sprite instance, the point a child aims at. */
export function centerOf(s: SpriteInstance): { x: number; y: number } {
  const b = bounds(s);
  return { x: b.x, y: b.y };
}

/** Whether two instances overlap the way the runtime counts a touch. */
export function touchingNow(a: SpriteInstance, b: SpriteInstance): boolean {
  const p = bounds(a);
  const q = bounds(b);
  return a.visible && b.visible && Math.hypot(p.x - q.x, p.y - q.y) < (p.r + q.r) * 0.85;
}
