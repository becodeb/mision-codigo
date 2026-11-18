/**
 * The guide's state machine, with no DOM. A game's phases and steps are flattened into one sequence;
 * a step is done the first time its check passes and then stays done, never evaluated again.
 */
import type { BlockType } from '../language/catalog.ts';
import type { GamePhase, GameDefinition, GameStep, StepContext } from '../games/types.ts';
import type { CompletedStep, GameProgress } from '../shared/api.ts';
import type { Block, ProjectProgram, Script } from '../language/ir.ts';
import { blocksOfProject } from '../games/checks.ts';
import type { Machine } from '../runtime/machine.ts';
import { StatsRecorder, type Sampled } from '../runtime/stats.ts';

export interface FlatStep {
  step: GameStep;
  phase: GamePhase;
  phaseIndex: number;
  /** Position inside the phase. */
  inPhase: number;
  /** Position in the whole game. */
  index: number;
}

export function flattenSteps(game: GameDefinition | null): FlatStep[] {
  const out: FlatStep[] = [];
  game?.phases.forEach((phase, phaseIndex) =>
    phase.steps.forEach((step, inPhase) => out.push({ step, phase, phaseIndex, inPhase, index: out.length })));
  return out;
}

export interface TrackerSaved {
  completed?: readonly CompletedStep[];
  skipped?: readonly string[];
}

export class GuideTracker {
  readonly steps: FlatStep[];
  private readonly done = new Map<string, string>();
  private skipped = new Set<string>();

  private readonly game: GameDefinition | null;
  private readonly now: () => Date;

  constructor(game: GameDefinition | null, saved: TrackerSaved = {}, now: () => Date = () => new Date()) {
    this.game = game;
    this.now = now;
    this.steps = flattenSteps(game);
    const known = new Set(this.steps.map((s) => s.step.id));
    for (const c of saved.completed ?? []) if (known.has(c.id) && !this.done.has(c.id)) this.done.set(c.id, c.at);
    for (const id of saved.skipped ?? []) if (known.has(id) && !this.done.has(id)) this.skipped.add(id);
  }

  get hasGuide(): boolean {
    return this.steps.length > 0;
  }

  isDone(id: string): boolean {
    return this.done.has(id);
  }

  isSkipped(id: string): boolean {
    return this.skipped.has(id);
  }

  /** Index of the first step the child still has to do; `steps.length` when there is none. */
  get activeIndex(): number {
    const i = this.steps.findIndex((s) => !this.done.has(s.step.id) && !this.skipped.has(s.step.id));
    return i === -1 ? this.steps.length : i;
  }

  get active(): FlatStep | null {
    return this.steps[this.activeIndex] ?? null;
  }

  /** Every phase and step has been completed or moved past. */
  get finished(): boolean {
    return this.hasGuide && this.activeIndex >= this.steps.length;
  }

  get completedCount(): number {
    return this.done.size;
  }

  skippedIds(): string[] {
    return [...this.skipped];
  }

  /** Steps done in a phase, and how many it has. */
  phaseProgress(phaseIndex: number): { done: number; total: number } {
    const inPhase = this.steps.filter((s) => s.phaseIndex === phaseIndex);
    return { done: inPhase.filter((s) => this.done.has(s.step.id)).length, total: inPhase.length };
  }

  /** A phase is over when none of its steps is still open. */
  phaseClosed(phaseIndex: number): boolean {
    return this.steps.filter((s) => s.phaseIndex === phaseIndex).every((s) => this.done.has(s.step.id) || this.skipped.has(s.step.id));
  }

  /**
   * Runs the checks of every step not done yet and returns the ones that just passed. Steps are checked in
   * order, so a child who builds ahead gets credit; a step that threw is treated as not passed.
   */
  evaluate(ctx: StepContext): FlatStep[] {
    const fresh: FlatStep[] = [];
    for (const flat of this.steps) {
      if (this.done.has(flat.step.id)) continue;
      let ok = false;
      try {
        ok = flat.step.check(ctx) === true;
      } catch {
        ok = false;
      }
      if (ok) {
        this.done.set(flat.step.id, this.now().toISOString());
        this.skipped.delete(flat.step.id);
        fresh.push(flat);
      }
    }
    return fresh;
  }

  /**
   * The first completed step whose code is gone (see `brokenSteps`), leaving out the ones in `ignore`: the child
   * already said «Seguir igual» about them.
   */
  broken(program: ProjectProgram, ctx?: StepContext | null, ignore?: ReadonlySet<string>): FlatStep | null {
    return this.brokenSteps(program, ctx).find((f) => !ignore?.has(f.step.id)) ?? null;
  }

  /**
   * Completed steps whose code is gone: none of the new blocks it taught (the ones it unlocks and shows in its
   * example) is left in the project, and the program no longer does what the step asks. The second test is the
   * step's own check, run on the code with every run assumed to have happened (and with the real runs, when
   * `ctx` is given): so a child who rebuilt it another way, with other blocks or in another order, is never told
   * that something was erased. Judging the program and not the runs keeps it quiet when a project is reopened.
   */
  brokenSteps(program: ProjectProgram, ctx?: StepContext | null): FlatStep[] {
    const present = new Set<string>(blocksOfProject(program).map((b) => b.type));
    const upTo = this.activeIndex;
    const out: FlatStep[] = [];
    for (const flat of this.steps) {
      if (flat.index >= upTo) break;
      if (!this.done.has(flat.step.id)) continue;
      const taught = taughtBlocks(flat.step);
      if (taught.length === 0 || taught.some((t) => present.has(t))) continue;
      if (stillHolds(flat.step, program, ctx)) continue;
      out.push(flat);
    }
    return out;
  }

  /** Moves past a step without completing it. Used only after every hint was shown, so nobody is stuck for good. */
  skip(id: string): boolean {
    if (this.done.has(id) || !this.steps.some((s) => s.step.id === id)) return false;
    this.skipped.add(id);
    return true;
  }

  /** The blocks on offer: the game's toolbox plus what every step up to the active one unlocks (all of it once finished). */
  unlockedBlocks(): BlockType[] {
    const set = new Set<BlockType>(this.game?.toolbox ?? []);
    const upTo = this.activeIndex;
    for (const flat of this.steps) if (flat.index <= upTo) (flat.step.unlock ?? []).forEach((t) => set.add(t));
    return [...set];
  }

  completedList(): CompletedStep[] {
    return this.steps.filter((s) => this.done.has(s.step.id)).map((s) => ({ id: s.step.id, at: this.done.get(s.step.id)! }));
  }

  progress(activeSeconds: number): GameProgress {
    return {
      currentStep: this.active?.step.id ?? null,
      completedSteps: this.completedList(),
      activeSeconds: Math.round(activeSeconds),
      finished: this.finished,
    };
  }
}

/** Stats where everything already happened: the hats ran, the blocks ran, the game was won and lost. */
class EverythingRan extends StatsRecorder {
  override won = true;
  override lost = true;
  override shown = true;
  override maxScore = 1e6;
  override scoreDrops = 1e6;
  override count(): number { return 1e6; }
  override ran(): boolean { return true; }
  override ranBy(): boolean { return true; }
  override ranHat(): boolean { return true; }
  override ranHatBy(): boolean { return true; }
  override touched(): boolean { return true; }
  override blockRuns(): number { return 1e6; }
  override sampled(): Sampled { return { count: 1e6, first: 0, last: 0, changes: 1e6, min: -1e6, max: 1e6, distinct: 64 }; }
}
const EVERYTHING_RAN = new EverythingRan();

/** Whether the program still does what the step asks, judged with the real runs or with every run assumed. */
function stillHolds(step: GameStep, program: ProjectProgram, ctx?: StepContext | null): boolean {
  const tries: StepContext[] = [
    ...(ctx ? [{ ...ctx, program }] : []),
    { stats: EVERYTHING_RAN, program, machine: ctx?.machine as Machine, ui: { backdropChosen: true } },
  ];
  return tries.some((c) => {
    try {
      return step.check(c) === true;
    } catch {
      return false;
    }
  });
}

/** Blocks a step introduces and uses in its own example: the code that proves it was done. */
export function taughtBlocks(step: GameStep): string[] {
  const unlocked = new Set<string>(step.unlock ?? []);
  if (unlocked.size === 0) return [];
  const scripts: Script[] = [
    ...(step.demoScript ? (Array.isArray(step.demoScript) ? step.demoScript : [step.demoScript as Script]) : []),
    ...(step.example ?? []).flatMap((e) => e.scripts),
  ];
  const used = new Set<string>();
  const walk = (b: Block): void => {
    used.add(b.type);
    b.body.forEach(walk);
    b.elseBody.forEach(walk);
    Object.values(b.inputs ?? {}).forEach(walk);
  };
  for (const sc of scripts) {
    walk(sc.hat);
    sc.body.forEach(walk);
  }
  return [...unlocked].filter((t) => used.has(t));
}

/** Rungs of the hint ladder for a step: each hint, then the example when there is one. */
export function hintRungs(step: GameStep): number {
  return step.hints.length + (step.example?.length ? 1 : 0);
}

/** Counts time only while the tab is visible and the child touched something in the last minute. */
export class ActiveClock {
  private seconds: number;
  private lastInput: number;

  private readonly nowMs: () => number;
  private readonly idleMs: number;

  constructor(initialSeconds: number, nowMs: () => number = () => Date.now(), idleMs = 60_000) {
    this.nowMs = nowMs;
    this.idleMs = idleMs;
    this.seconds = Math.max(0, initialSeconds);
    this.lastInput = Number.NEGATIVE_INFINITY;
  }

  input(): void {
    this.lastInput = this.nowMs();
  }

  /** Call once a second. */
  tick(visible: boolean): void {
    if (visible && this.nowMs() - this.lastInput <= this.idleMs) this.seconds += 1;
  }

  get total(): number {
    return this.seconds;
  }
}
