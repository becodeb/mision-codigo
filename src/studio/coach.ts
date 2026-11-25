/**
 * The coach decides when the stage tells a child what to press or click. It only keeps state and timers: what is shown
 * and when, never how it is drawn (the stage renderer and the studio do that). It is headless so every transition can
 * be tested with fake timers.
 *
 * While a game plays, a hint shows the right control until the child uses it, and comes back after a quiet while. A wrong
 * attempt (clicking where only keys work, pressing keys where only clicks work, playing before «Empezar») gets a bubble.
 */
import { ARROWS, spriteIdOf, type Controls } from './controls.ts';

/** Quiet time before a hint comes back while the game plays. */
export const IDLE_MS = 8000;
/** How long the answer to a wrong attempt stays. */
export const BUBBLE_MS = 2800;
/** Wrong clicks in a row in a click game before the hand comes back. */
const MISSES = 2;

export type BubbleKind = 'keys' | 'tap' | 'flag';

export interface CoachView {
  /** The game is on: from «Empezar» until «Parar», a program change that reloads, or the end. */
  playing: boolean;
  /** The keys hint is showing. */
  keys: boolean;
  /** The hand on the characters to click is showing. */
  tap: boolean;
  /** `n` changes with every bubble so the screen restarts its animation. */
  bubble: { kind: BubbleKind; n: number } | null;
  /** The green button should pulse: the child tried the keys before pressing it. */
  flag: boolean;
}

export interface CoachHost {
  controls(): Controls;
  /** A modal, the entry screen, a question or a tutorial that is not running: the coach keeps quiet. */
  hidden(): boolean;
  /** The view changed: draw again. */
  changed(): void;
  /** Says it aloud (the younger levels). Never called when the game starts. */
  say(kind: BubbleKind, why: 'miss' | 'idle'): void;
}

const hasKeys = (c: Controls): boolean => c.arrows.length > 0 || c.space;
const hasMainTap = (c: Controls): boolean => c.taps.some((t) => t.main);
const isArrow = (key: string): boolean => (ARROWS as readonly string[]).includes(key);

type Timer = ReturnType<typeof setTimeout>;

export class Coach {
  private on = false;
  private over = false;
  private keys = false;
  private tap = false;
  private bubble: CoachView['bubble'] = null;
  private seq = 0;
  private misses = 0;
  private idle: Timer | null = null;
  private bubbleTimer: Timer | null = null;
  private readonly host: CoachHost;

  constructor(host: CoachHost) {
    this.host = host;
  }

  get playing(): boolean {
    return this.on;
  }

  view(): CoachView {
    const quiet = this.host.hidden();
    return {
      playing: this.on,
      keys: this.on && this.keys && !quiet,
      tap: this.on && this.tap && !quiet,
      bubble: quiet ? null : this.bubble,
      flag: !quiet && this.bubble?.kind === 'flag',
    };
  }

  /** «Empezar»: shows what the game needs, to be used for the first time. */
  start(): void {
    this.clear();
    const c = this.host.controls();
    this.on = true;
    this.over = false;
    this.keys = hasKeys(c);
    this.tap = hasMainTap(c);
    this.armIdle();
    this.host.changed();
  }

  /** «Parar», or the program changed and the game reloaded. */
  stop(): void {
    const was = this.on || this.over || this.bubble !== null;
    this.clear();
    this.on = false;
    this.over = false;
    if (was) this.host.changed();
  }

  /** The game ended (win or lose). */
  end(): void {
    this.clear();
    this.on = false;
    this.over = true;
    this.host.changed();
  }

  /** The view may differ now (a modal opened, the tutorial started running). */
  refresh(): void {
    this.host.changed();
  }

  dispose(): void {
    this.clear();
    this.on = false;
  }

  /** A key went down (arrow, space). */
  key(key: string): void {
    if (this.host.hidden()) return;
    const c = this.host.controls();
    const space = key === ' ';
    if (!this.on) {
      /* Before «Empezar»: the game listens to this key only once it runs. */
      if (!this.over && c.late.includes(key)) this.show('flag');
      return;
    }
    if ((isArrow(key) && (c.arrows as readonly string[]).includes(key)) || (space && c.space)) {
      this.misses = 0;
      if (this.keys) {
        this.keys = false;
        this.host.changed();
      }
      this.armIdle();
    } else if ((isArrow(key) || space) && !hasKeys(c) && c.taps.length > 0) {
      /* A click game: the keys do nothing. */
      this.tap = true;
      this.show('tap');
    }
  }

  /** A sprite was clicked. Returns whether the program answers to it (a click on such a sprite is never wrong). */
  click(instanceId: string): boolean {
    const t = this.host.controls().taps.find((x) => x.id === spriteIdOf(instanceId));
    if (!t) return false;
    this.misses = 0;
    if (this.on && !this.host.hidden()) {
      if (t.main && this.tap) {
        this.tap = false;
        this.host.changed();
      }
      this.armIdle();
    }
    return true;
  }

  /** A press that did nothing: a sprite with no click script, a drag that is not allowed, the empty stage. */
  miss(instanceId: string | null): void {
    if (!this.on || this.host.hidden()) return;
    const c = this.host.controls();
    if (instanceId && c.taps.some((t) => t.id === spriteIdOf(instanceId))) return;
    if (hasKeys(c) && !hasMainTap(c)) {
      this.keys = true;
      this.show('keys');
    } else if (hasMainTap(c) && ++this.misses >= MISSES && !this.tap) {
      this.tap = true;
      this.host.changed();
    }
  }

  private show(kind: BubbleKind): void {
    this.bubble = { kind, n: ++this.seq };
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      this.bubbleTimer = null;
      this.bubble = null;
      this.host.changed();
    }, BUBBLE_MS);
    this.host.changed();
    this.host.say(kind, 'miss');
  }

  /** The hints come back after a quiet while, unless something covers the stage. */
  private armIdle(): void {
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => {
      this.idle = null;
      if (!this.on) return;
      if (this.host.hidden()) return this.armIdle();
      const c = this.host.controls();
      this.keys = hasKeys(c);
      this.tap = hasMainTap(c);
      if (!this.keys && !this.tap) return;
      this.host.changed();
      this.host.say(this.keys ? 'keys' : 'tap', 'idle');
    }, IDLE_MS);
  }

  private clear(): void {
    if (this.idle) clearTimeout(this.idle);
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.idle = this.bubbleTimer = null;
    this.keys = this.tap = false;
    this.bubble = null;
    this.misses = 0;
  }
}
