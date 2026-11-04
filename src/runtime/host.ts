/** Everything the machine needs from the outside world, so it can run with no browser at all. */
import type { SpriteInstance } from './instance.ts';
import type { Value } from './values.ts';

export interface SpeakOptions {
  pitch: number;
  rate: number;
}

/** Read-only view of the stage, handed to `Host.render`. */
export interface StageView {
  readonly instances: readonly SpriteInstance[];
  readonly backdrop: string;
  /** `null` until the program touches the points. */
  readonly score: number | null;
  readonly vars: ReadonlyMap<string, Value>;
  readonly lists: ReadonlyMap<string, readonly Value[]>;
  readonly ended: 'win' | 'lose' | null;
  readonly running: boolean;
}

export interface Host {
  /** Speaks the text. Resolves true when a voice finished, false when there is no voice. */
  speak(text: string, opts: SpeakOptions): Promise<boolean>;
  cancelSpeech(): void;
  /** Named effect from the SFX table. */
  sfx(name: string): void;
  /** One of do, re, mi, fa, sol, la, si. */
  note(name: string): void;
  /** Asks the child a question and resolves with what they typed. */
  ask(question: string): Promise<string>;
  /** Called when a pending ask is abandoned because the program stopped. */
  cancelAsk(): void;
  /** Called after any frame in which the stage changed. */
  render(view: StageView): void;
  /** Called once when a program wins or loses. */
  ended(result: 'win' | 'lose'): void;
  /** A block started (`on = true`) or finished running; only blocks with an `id` report. */
  highlight(spriteId: string, blockId: string, on: boolean): void;
}

/** Host that does nothing: no voice, no sound, empty answers. */
export const nullHost: Host = {
  speak: () => Promise.resolve(false),
  cancelSpeech: () => {},
  sfx: () => {},
  note: () => {},
  ask: () => Promise.resolve(''),
  cancelAsk: () => {},
  render: () => {},
  ended: () => {},
  highlight: () => {},
};
