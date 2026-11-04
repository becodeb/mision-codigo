/**
 * Helpers for running programs headless: a host that records what happened and a driver with
 * virtual time. Game proofs (T06-T08) use the same driver to replay a solution.
 */
import type { ProjectProgram } from '../language/ir.ts';
import type { Host, SpeakOptions, StageView } from './host.ts';
import { Machine, type MachineOptions } from './machine.ts';
import { ManualTime } from './time.ts';
import { mulberry32 } from '../shared/random.ts';

export class RecordingHost implements Host {
  readonly sfxLog: string[] = [];
  readonly noteLog: string[] = [];
  readonly spoken: { text: string; opts: SpeakOptions }[] = [];
  readonly asked: string[] = [];
  readonly endLog: ('win' | 'lose')[] = [];
  renders = 0;
  speechCancels = 0;
  askCancels = 0;
  /** When true, `speak` stays pending until `finishSpeech`, like a real voice. Otherwise there is no voice. */
  voice = false;
  private voices: ((ok: boolean) => void)[] = [];
  private replies: ((text: string) => void)[] = [];
  readonly highlights: string[] = [];

  speak(text: string, opts: SpeakOptions): Promise<boolean> {
    this.spoken.push({ text, opts });
    if (!this.voice) return Promise.resolve(false);
    return new Promise((res) => this.voices.push(res));
  }

  finishSpeech(): void {
    this.voices.shift()?.(true);
  }

  cancelSpeech(): void {
    this.speechCancels++;
  }

  sfx(name: string): void {
    this.sfxLog.push(name);
  }

  note(name: string): void {
    this.noteLog.push(name);
  }

  ask(question: string): Promise<string> {
    this.asked.push(question);
    return new Promise((res) => this.replies.push(res));
  }

  /** Answers the oldest pending question. */
  reply(text: string): void {
    this.replies.shift()?.(text);
  }

  cancelAsk(): void {
    this.askCancels++;
  }

  render(_view: StageView): void {
    this.renders++;
  }

  ended(result: 'win' | 'lose'): void {
    this.endLog.push(result);
  }

  highlight(spriteId: string, blockId: string, on: boolean): void {
    this.highlights.push(`${on ? '+' : '-'}${spriteId}:${blockId}`);
  }
}

export interface GameOptions extends Partial<Omit<MachineOptions, 'time' | 'host'>> {
  frameMs?: number;
  seed?: number;
}

/** A machine wired to virtual time, a recording host and a seeded random generator. */
export class Game {
  readonly time: ManualTime;
  readonly host = new RecordingHost();
  readonly machine: Machine;

  constructor(program: ProjectProgram, opts: GameOptions = {}) {
    this.time = new ManualTime(opts.frameMs);
    this.machine = new Machine(program, { ...opts, time: this.time, host: this.host, rng: opts.rng ?? mulberry32(opts.seed ?? 1) });
    this.machine.start();
  }

  /** Runs the green flag. Returns how many scripts started. */
  flag(): number {
    return this.machine.greenFlag();
  }

  /** Advances virtual time by `ms` (whole frames). */
  run(ms: number): this {
    this.time.advance(ms);
    return this;
  }

  /** Advances until `done()` is true, at most `maxMs`. Returns whether it became true. */
  runUntil(done: () => boolean, maxMs = 60_000): boolean {
    const limit = this.time.now() + maxMs;
    while (!done() && this.time.now() < limit) this.time.step();
    return done();
  }

  press(key: string): this {
    this.machine.keyDown(key);
    return this;
  }

  release(key: string): this {
    this.machine.keyUp(key);
    return this;
  }

  /** Holds a key down for `ms`, then releases it. */
  hold(key: string, ms: number): this {
    this.machine.keyDown(key);
    this.run(ms);
    this.machine.keyUp(key);
    return this;
  }

  tap(spriteId: string): this {
    this.machine.tap(spriteId);
    return this;
  }

  /** Lets promise callbacks (ask replies, speech) run. */
  async settle(): Promise<void> {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  }

  sprite(id: string) {
    const s = this.machine.instances.find((i) => i.id === id);
    if (!s) throw new Error(`no sprite instance ${id}`);
    return s;
  }
}
