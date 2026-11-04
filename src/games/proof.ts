/**
 * Replays a game's solution the way the guide would watch it: every check is polled on every frame,
 * and a check that passed once stays done, exactly as in the studio.
 */
import type { ProjectProgram } from '../language/ir.ts';
import { Game } from '../runtime/testing.ts';
import type { GameDefinition, GameStep, StepContext, StepUi } from './types.ts';

export function stepsOf(game: GameDefinition): GameStep[] {
  return game.phases.flatMap((p) => p.steps);
}

/** A game driver that polls the guide's checks as time passes. */
export class ProofGame extends Game {
  readonly done = new Set<string>();
  private readonly program: ProjectProgram;
  private readonly steps: GameStep[];
  /**
   * What the studio would have recorded. The reference solution is a finished project, so by the time it plays
   * its child has tapped a place: the flag starts true. A test of the untouched project passes `{ backdropChosen: false }`.
   */
  readonly ui: StepUi;

  constructor(game: GameDefinition, program: ProjectProgram, seed = 1, ui: StepUi = { backdropChosen: true }) {
    super(program, { seed });
    this.ui = ui;
    this.program = program;
    this.steps = stepsOf(game);
  }

  private get ctx(): StepContext {
    return { stats: this.machine.stats, program: this.program, machine: this.machine, ui: this.ui };
  }

  poll(): void {
    for (const step of this.steps) {
      if (!this.done.has(step.id) && step.check(this.ctx)) this.done.add(step.id);
    }
  }

  override flag(): number {
    const started = super.flag();
    this.poll();
    return started;
  }

  override run(ms: number): this {
    const end = this.time.now() + ms;
    while (this.time.now() < end) {
      this.time.step();
      this.poll();
    }
    return this;
  }

  override runUntil(done: () => boolean, maxMs = 60_000): boolean {
    const limit = this.time.now() + maxMs;
    while (!done() && this.time.now() < limit) {
      this.time.step();
      this.poll();
    }
    return done();
  }

  override tap(spriteId: string): this {
    super.tap(spriteId);
    this.poll();
    return this;
  }

  /** The studio marks `shown` when the child opens show mode. */
  show(): this {
    this.machine.setShown(true);
    this.poll();
    return this;
  }
}

export interface ProofResult {
  missing: string[];
  errors: unknown[];
}

/** Plays the solution and reports the steps that never passed and any runtime errors. */
export async function proveGame(game: GameDefinition, seed = 1): Promise<ProofResult> {
  const driver = new ProofGame(game, game.solution.program, seed);
  await game.solution.play(driver);
  driver.poll();
  const missing = stepsOf(game).filter((s) => !driver.done.has(s.id)).map((s) => s.id);
  const errors = [...driver.machine.errors];
  driver.machine.dispose();
  return { missing, errors };
}
