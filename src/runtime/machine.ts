/**
 * The headless block machine: sprite instances, one thread per running script, the event bus,
 * input state and project-wide state. It touches no browser API; time, sound, speech and drawing
 * come in through `TimeSource` and `Host`.
 */
import { ART } from '../art/index.ts';
import { blockInfo, type HatKind } from '../language/catalog.ts';
import type { Block, ProjectProgram, SpriteProgram } from '../language/ir.ts';
import { EDGE } from '../language/options.ts';
import { runList, type Thread } from './exec.ts';
import { arg } from './expr.ts';
import { bounds, clampXY, edgeHits, hitTest, overlaps } from './geometry.ts';
import { nullHost, type Host, type StageView } from './host.ts';
import type { ArtMetrics, ArtTable, SpriteInstance } from './instance.ts';
import { StatsRecorder } from './stats.ts';
import type { TimeSource } from './time.ts';
import { toNum, type Value } from './values.ts';

/** Most clones alive at once. */
export const CLONE_CAP = 30;

const FALLBACK_ART: ArtMetrics = { kind: 'character', h: 90, r: 38, pitch: 1, rate: 1 };

/** Fills the gaps of a partial host with the null host. Works for class instances, whose methods are not own properties. */
function resolveHost(partial: Partial<Host> = {}): Host {
  const host = { ...nullHost } as Record<keyof Host, unknown>;
  for (const key of Object.keys(nullHost) as (keyof Host)[]) {
    const fn = partial[key];
    if (typeof fn === 'function') host[key] = (fn as (...args: unknown[]) => unknown).bind(partial);
  }
  return host as unknown as Host;
}

export interface MachineOptions {
  time: TimeSource;
  host?: Partial<Host>;
  /** Random numbers in [0, 1). Defaults to `Math.random`; tests pass a seeded generator. */
  rng?: () => number;
  /** Sizes and voices per art id. Defaults to the art catalog. */
  art?: ArtTable;
}

export interface Snapshot {
  score: number | null;
  vars: Record<string, Value>;
  lists: Record<string, Value[]>;
  backdrop: string;
  ended: 'win' | 'lose' | null;
  running: boolean;
  shown: boolean;
  sprites: { id: string; spriteId: string; x: number; y: number; dir: number; size: number; visible: boolean; face: string; says: string | null }[];
}

export class Machine implements StageView {
  readonly time: TimeSource;
  readonly host: Host;
  readonly rng: () => number;
  readonly stats = new StatsRecorder();
  /** Exceptions thrown by scripts (a bug in the machine, never in a child's program). */
  readonly errors: unknown[] = [];

  program: ProjectProgram = { backdrop: '', sprites: [], variables: [], lists: [] };
  instances: SpriteInstance[] = [];
  vars = new Map<string, Value>();
  lists = new Map<string, Value[]>();
  keys = new Set<string>();
  score: number | null = null;
  backdrop = '';
  answer = '';
  ended: 'win' | 'lose' | null = null;
  /** True from the green flag until a stop, a win or a lose. */
  running = false;
  /** Set when state changed since the last render. */
  dirty = false;

  private readonly art: ArtTable;
  private threads: Thread[] = [];
  private byKey = new Map<string, Thread>();
  private touchState = new Map<string, boolean>();
  private pointsFired = new Set<string>();
  private cloneSeq = 0;
  private timerStart = 0;
  private cancelLoop: (() => void) | null = null;
  private looping = false;

  constructor(program: ProjectProgram, opts: MachineOptions) {
    this.time = opts.time;
    this.host = resolveHost(opts.host);
    this.rng = opts.rng ?? Math.random;
    this.art = opts.art ?? ART;
    this.load(program);
  }

  /* ---------- lifecycle ---------- */

  /** Replaces the program and puts everything back at its starting state. */
  load(program: ProjectProgram): void {
    this.program = program;
    this.stopAll();
    this.reset();
  }

  private reset(): void {
    this.instances = this.program.sprites.map((sp) => this.createInstance(sp));
    this.vars = new Map(this.program.variables.map((name) => [name, 0]));
    this.lists = new Map(this.program.lists.map((name) => [name, []]));
    this.score = null;
    this.backdrop = this.program.backdrop;
    this.answer = '';
    this.ended = null;
    this.touchState.clear();
    this.pointsFired.clear();
    this.cloneSeq = 0;
    this.timerStart = this.time.now();
    this.dirty = true;
  }

  private createInstance(sp: SpriteProgram): SpriteInstance {
    return {
      id: sp.id, spriteId: sp.id, name: sp.name, artId: sp.art, art: this.art[sp.art] ?? FALLBACK_ART, isClone: false, scripts: sp.scripts,
      x: sp.x, y: sp.y, dir: sp.dir ?? 90, flip: sp.flip ?? 1, size: sp.size ?? 100, face: 'feliz', visible: sp.visible ?? true,
      bubble: null, jy: 0, bob: 0, rot: 0,
    };
  }

  /** Begins running one frame per call of the time source's frame scheduler. */
  start(): void {
    if (this.looping) return;
    this.looping = true;
    const tick = () => {
      this.frame();
      if (this.looping) this.cancelLoop = this.time.requestFrame(tick);
    };
    this.cancelLoop = this.time.requestFrame(tick);
  }

  /** Stops the frame loop and every script. */
  dispose(): void {
    this.looping = false;
    this.cancelLoop?.();
    this.cancelLoop = null;
    this.stopAll();
  }

  /** The green flag: restart from the starting state and run every flag script. Returns how many started. */
  greenFlag(): number {
    this.stopAll();
    this.reset();
    this.running = true;
    this.hoistFlagSetups();
    return this.trigger('flag');
  }

  /**
   * Every flag script starts in the same frame, in the order they were made. A script that waits for a
   * variable («esperar hasta que vidas < 1») placed before the one that sets it would read 0 and fire at
   * once. So the leading «fijar» blocks that hold a typed-in value (a number or a text, not a calculation)
   * are applied before any script runs. The scripts still run them afterwards, to the same effect.
   */
  private hoistFlagSetups(): void {
    for (const inst of this.instances) {
      for (const sc of inst.scripts) {
        if (blockInfo(sc.hat.type)?.hat !== 'flag') continue;
        for (const b of sc.body) {
          if (b.type !== 'a_setvar' && b.type !== 'a_setscore') break;
          const key = b.type === 'a_setvar' ? 'V' : 'N';
          const input = b.inputs[key];
          if (input && input.type !== 'v_num' && input.type !== 'v_text') break;
          if (b.type === 'a_setvar') this.vars.set(String(b.fields.NAME), arg(this, inst, b, key));
          else this.setScore(toNum(arg(this, inst, b, key)));
        }
      }
    }
    this.dirty = true;
  }

  /** Stops every script, deletes clones, clears speech and animation offsets. Keeps the current state. */
  stopAll(): void {
    for (const th of this.threads) th.dead = true;
    this.threads = [];
    this.byKey.clear();
    this.instances = this.instances.filter((i) => !i.isClone);
    for (const i of this.instances) {
      i.bubble = null;
      i.jy = 0;
      i.bob = 0;
      i.rot = 0;
    }
    this.running = false;
    this.host.cancelSpeech();
    this.host.cancelAsk();
    this.dirty = true;
  }

  /** Win or lose: stops everything, freezes input until the next green flag. */
  finish(result: 'win' | 'lose'): void {
    if (this.ended) return;
    this.stopAll();
    this.ended = result;
    if (result === 'win') this.stats.won = true;
    else this.stats.lost = true;
    this.host.ended(result);
  }

  setShown(shown: boolean): void {
    this.stats.shown = shown;
  }

  /* ---------- frames ---------- */

  /** One frame: poll edge-triggered hats, then give every ready script a turn. */
  frame(): void {
    if (this.running) this.pollHats();
    for (const th of this.threads.slice()) {
      if (th.dead) continue;
      if (th.wake && !th.wake()) continue;
      th.wake = null;
      try {
        const r = th.gen!.next();
        if (r.done) this.kill(th);
        else th.wake = r.value ?? null;
      } catch (e) {
        this.errors.push(e);
        this.kill(th);
      }
      this.dirty = true;
    }
    this.threads = this.threads.filter((t) => !t.dead);
    if (this.dirty) {
      this.dirty = false;
      this.host.render(this);
    }
  }

  private pollHats(): void {
    for (const inst of this.instances.slice()) {
      inst.scripts.forEach((sc, i) => {
        const kind = blockInfo(sc.hat.type)?.hat;
        const key = `${inst.id}:${i}`;
        if (kind === 'touching') {
          const now = this.touchingTarget(inst, String(sc.hat.fields.T ?? ''));
          const before = this.touchState.get(key) ?? false;
          this.touchState.set(key, now);
          if (now && !before) this.startThread(inst, i);
        } else if (kind === 'points') {
          if (!this.pointsFired.has(key) && (this.score ?? 0) >= toNum(sc.hat.fields.N)) {
            this.pointsFired.add(key);
            this.startThread(inst, i);
          }
        }
      });
    }
  }

  /* ---------- threads and events ---------- */

  /** Starts every script whose hat is `kind` (and passes `match`); `only` limits it to one instance. */
  trigger(kind: HatKind, match?: (hat: Block) => boolean, only?: SpriteInstance): number {
    if (this.ended) return 0;
    let n = 0;
    for (const inst of this.instances.slice()) {
      if (only && inst !== only) continue;
      inst.scripts.forEach((sc, i) => {
        if (blockInfo(sc.hat.type)?.hat !== kind || (match && !match(sc.hat))) return;
        this.startThread(inst, i);
        n++;
      });
    }
    return n;
  }

  /** Starting a script that is already running restarts it from the top. */
  private startThread(inst: SpriteInstance, index: number): void {
    const script = inst.scripts[index];
    const key = `${inst.id}:${index}`;
    const old = this.byKey.get(key);
    if (old) this.kill(old);
    const th: Thread = { key, inst, dead: false, wake: null, gen: null };
    th.gen = runList(this, th, script.body);
    this.threads.push(th);
    this.byKey.set(key, th);
    const kind = blockInfo(script.hat.type)?.hat ?? 'flag';
    this.stats.hat(kind, inst.spriteId);
  }

  kill(th: Thread): void {
    th.dead = true;
    if (this.byKey.get(th.key) === th) this.byKey.delete(th.key);
  }

  /** Stops every other script of the same sprite instance. */
  killOthers(keep: Thread): void {
    for (const th of this.threads) if (th.inst === keep.inst && th !== keep) this.kill(th);
  }

  get threadCount(): number {
    return this.threads.filter((t) => !t.dead).length;
  }

  broadcast(message: string): number {
    return this.trigger('recv', (h) => String(h.fields.M ?? h.fields.C ?? '') === message);
  }

  /* ---------- input ---------- */

  /** Taps a sprite, as "when I am tapped". Returns how many scripts started. */
  tap(instanceId: string): number {
    const inst = this.instances.find((i) => i.id === instanceId);
    const n = inst ? this.trigger('click', undefined, inst) : 0;
    if (n) this.running = true;
    return n;
  }

  /** Taps the stage at a point (stage coordinates, y up). Returns the id of the sprite hit, topmost first. */
  tapAt(x: number, y: number): string | null {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const inst = this.instances[i];
      if (hitTest(inst, x, y)) {
        this.tap(inst.id);
        return inst.id;
      }
    }
    return null;
  }

  /** A key went down. `repeat` re-fires "when key pressed" for a held key. */
  keyDown(key: string, repeat = false): void {
    const first = !this.keys.has(key);
    this.keys.add(key);
    if (first || repeat) {
      /* Input that starts a script also wakes the edge-triggered hats, as the green flag does. */
      if (this.trigger('key', (h) => String(h.fields.K ?? '') === key)) this.running = true;
    }
  }

  keyUp(key: string): void {
    this.keys.delete(key);
  }

  clearKeys(): void {
    this.keys.clear();
  }

  /** Drags a sprite to a place (the editor does this while stopped). */
  moveInstance(instanceId: string, x: number, y: number): void {
    const inst = this.instances.find((i) => i.id === instanceId);
    if (!inst) return;
    [inst.x, inst.y] = clampXY(x, y);
    this.dirty = true;
  }

  /* ---------- clones ---------- */

  /** Clones `of` (a sprite id) or the caller itself. Does nothing at the cap. */
  createClone(caller: SpriteInstance, of?: string): SpriteInstance | null {
    if (this.instances.filter((i) => i.isClone).length >= CLONE_CAP) return null;
    const src = of && of !== 'myself' ? (this.findInstance(of, caller) ?? caller) : caller;
    const clone: SpriteInstance = { ...src, id: `${src.spriteId}#${++this.cloneSeq}`, isClone: true, bubble: null };
    this.instances.push(clone);
    this.trigger('clone', undefined, clone);
    this.dirty = true;
    return clone;
  }

  /** Deletes a clone and its scripts. Originals cannot be deleted. */
  removeClone(inst: SpriteInstance): void {
    if (!inst.isClone) return;
    for (const th of this.threads) if (th.inst === inst) this.kill(th);
    this.instances = this.instances.filter((i) => i !== inst);
    this.dirty = true;
  }

  /* ---------- queries ---------- */

  /** The original of a sprite id if it exists, else any clone of it. `from` is skipped. */
  findInstance(spriteId: string, from?: SpriteInstance): SpriteInstance | undefined {
    return (
      this.instances.find((i) => i.spriteId === spriteId && !i.isClone && i !== from) ??
      this.instances.find((i) => i.spriteId === spriteId && i !== from)
    );
  }

  touchingTarget(inst: SpriteInstance, target: string): boolean {
    if (target === EDGE) return edgeHits(inst).any;
    return this.instances.some((o) => o !== inst && o.spriteId === target && overlaps(inst, o));
  }

  /** Seconds since the green flag. */
  timerSeconds(): number {
    return (this.time.now() - this.timerStart) / 1000;
  }

  /** Random number as Scratch does: whole numbers when both ends are whole, otherwise a fraction. */
  random(a: number, b: number): number {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (Number.isInteger(lo) && Number.isInteger(hi)) return lo + Math.floor(this.rng() * (hi - lo + 1));
    return lo + this.rng() * (hi - lo);
  }

  setScore(value: number): void {
    this.score = value;
    if (value > this.stats.maxScore) this.stats.maxScore = value;
    this.dirty = true;
  }

  listNamed(name: string): Value[] {
    let list = this.lists.get(name);
    if (!list) {
      list = [];
      this.lists.set(name, list);
    }
    return list;
  }

  /** Hitbox of an instance, for hosts that draw debug outlines or do their own hit-testing. */
  hitbox(instanceId: string) {
    const inst = this.instances.find((i) => i.id === instanceId);
    return inst ? bounds(inst) : null;
  }

  /** Plain data copy of the state, for guide checks, tests and saving a run. */
  snapshot(): Snapshot {
    return {
      score: this.score,
      vars: Object.fromEntries(this.vars),
      lists: Object.fromEntries([...this.lists].map(([k, v]) => [k, [...v]])),
      backdrop: this.backdrop,
      ended: this.ended,
      running: this.running,
      shown: this.stats.shown,
      sprites: this.instances.map((i) => ({
        id: i.id, spriteId: i.spriteId, x: i.x, y: i.y, dir: i.dir, size: i.size, visible: i.visible, face: i.face, says: i.bubble ? i.bubble.text : null,
      })),
    };
  }
}
