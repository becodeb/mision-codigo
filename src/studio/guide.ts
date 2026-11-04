/**
 * The guide's state machine, with no DOM. A game's phases and steps are flattened into one sequence;
 * a step is done the first time its check passes and then stays done, never evaluated again.
 */
import type { BlockType } from '../language/catalog.ts';
import type { GamePhase, GameDefinition, GameStep, StepContext } from '../games/types.ts';
import type { CompletedStep, GameProgress } from '../shared/api.ts';

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
