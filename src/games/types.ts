/**
 * A game is data: what the child starts with, the guide that grows it through phases, and a reference
 * solution that proves it can be built. The studio renders it and the proof test replays it.
 */
import type { BlockType } from '../language/catalog.ts';
import type { Block, ProjectProgram, Script } from '../language/ir.ts';
import type { Machine } from '../runtime/machine.ts';
import type { StatsRecorder } from '../runtime/stats.ts';
import type { Game } from '../runtime/testing.ts';
import type { ClassId, LevelId } from '../shared/levels.ts';

/** What a step check can read. Checks run often, while the project runs and after every edit. */
export interface StepContext {
  /** Sticky record of what ran across every run since the project opened. */
  stats: StatsRecorder;
  /** The project as currently built by the child. */
  program: ProjectProgram;
  /** Live state of the current run: variables, lists, score, backdrop, instances. */
  machine: Machine;
}

export interface GameStep {
  /** Unique within the game. Also stored as class data, so do not rename after a class. */
  id: string;
  title: string;
  /** The goal, in Spanish voseo. Read aloud on levels 1 and 2. */
  text: string;
  /** Hint ladder, gentlest first. The child asks for each one. Do not give the answer in `text`. */
  hints: string[];
  /** Blocks that appear in the toolbox from this step on. */
  unlock?: BlockType[];
  /** First phase only: block the animated hand drags as a demo. */
  demo?: BlockType;
  /** Selector the guide points at when the step is about the interface, not a block. */
  point?: string;
  /** Last rung of the hint ladder: scripts rendered read-only as an example, per sprite name. */
  example?: { sprite: string; scripts: Script[] }[];
  check: (ctx: StepContext) => boolean;
}

export interface GamePhase {
  title: string;
  /** One sentence on what this phase adds to the project. */
  goal: string;
  steps: GameStep[];
}

export interface GameChallenge {
  title: string;
  text: string;
}

export interface GameSolution {
  /** The finished project, using only blocks from the game's toolbox and unlocks. */
  program: ProjectProgram;
  /** Plays the finished project like a child would. Must end with every step check having passed. */
  play: (game: Game) => void | Promise<void>;
}

export interface GameDefinition {
  id: string;
  level: LevelId;
  /** Which class offers it. */
  class: ClassId;
  /** Order inside the class and level, easier first. */
  order: number;
  kind: 'story' | 'game';
  title: string;
  /** One line on the chooser card. */
  pitch: string;
  /** The logic this game teaches, shown to teachers. */
  concept: string;
  /** Art id shown on the chooser card. */
  cover: string;
  /** What the project starts with. May hold sprites and starter scripts. */
  setup: ProjectProgram;
  /** Blocks available from the start. */
  toolbox: BlockType[];
  phases: GamePhase[];
  challenges: GameChallenge[];
  solution: GameSolution;
}

export type { Block };
