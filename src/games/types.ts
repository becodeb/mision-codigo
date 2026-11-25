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
  /** Sticky facts about the studio that the program cannot show. */
  ui: StepUi;
}

export interface StepUi {
  /** The child tapped a place in the strip, any place, the marked one included. Never goes back to false. */
  backdropChosen: boolean;
  /** Showcase games: the program as it is now was run (flag, tap or key) after its last change. */
  tried?: boolean;
}

/** A context for code that has no studio: nothing was tapped. */
export const NO_UI: StepUi = { backdropChosen: false };

export interface GameStep {
  /** Unique within the game. Also stored as class data, so do not rename after a class. */
  id: string;
  title: string;
  /** The goal, in Spanish voseo. Read aloud on levels 1 and 2. */
  text: string;
  /** «¿Qué es esto?»: explains the new block or idea this step introduces, before the child needs a hint. */
  explain?: string;
  /** Hint ladder, gentlest first. The child asks for each one. Do not give the answer in `text`. */
  hints: string[];
  /** Blocks that appear in the toolbox from this step on. */
  unlock?: BlockType[];
  /**
   * First phase only: what the step wants built, hat first. «Mostrame» compares it with the child's program and
   * shows only the next missing thing. Match is by block type, so field values here are examples.
   */
  demoScript?: Script | readonly Script[];
  /** Whom `demoScript` is for when it is not the selected sprite: a sprite id, an art id or an art kind. */
  demoSprite?: string;
  /** Every sprite of the project needs the scripts, not just one (two racers). */
  demoEach?: boolean;
  /** Selector the guide points at when the step is about the interface, not a block. */
  point?: string;
  /** Last rung of the hint ladder: scripts rendered read-only as an example, per sprite name. */
  example?: { sprite: string; scripts: Script[] }[];
  check: (ctx: StepContext) => boolean;
  /** Showcase games: the step is a card the child picks in any order. */
  card?: StepCard;
}

/** A card of a showcase game: one thing to change, with its own tutorial. */
export interface StepCard {
  /** Emoji drawn on the square. */
  icon: string;
  /** One or two words: what it changes. */
  label: string;
  /** `look` changes how the game looks or sounds; `code` changes what happens. */
  kind: 'look' | 'code';
  /** The programming idea behind it: a name, then a plain explanation. */
  concept: string;
  /**
   * The tutorial, one short action each, written with marks that are drawn (`studio/chips.ts`). `on` is what the hand is
   * doing during that step: a block type, or `add`, `point`, `modal`, `change`, `tune` and `try`.
   */
  how: { t: string; on: string }[];
  /** What to tap to try it, when it is not the green button: a sprite, `new` for the added one, or `stage`. */
  tap?: string;
  /** A question to explain it in their own words. */
  ask: string;
  /** The sprite the tutorial is about: picking it is the first step when the child is on another one. */
  sprite?: string;
  /** «Mostrame» for a change of a number or a menu: the hand points at that block of the sprite. */
  block?: { type: BlockType; caption: string; where?: (b: Block) => boolean };
  /** A menu left to choose once the block is in: the hand points at that field while `when` holds. */
  tune?: { type: BlockType; field: string; when: (b: Block, program: ProjectProgram, all: readonly Block[]) => boolean };
  /** Value blocks that go inside a socket, in order, once the rest is built. */
  values?: { type: BlockType; into: BlockType; input: string }[];
  /** The tutorial starts by adding a sprite, and its demo script is for that new one. */
  newSprite?: boolean;
  /** The program already has what the card asks for. Most cards also need the child to try it. */
  built: (program: ProjectProgram) => boolean;
  /** One way of doing it. Used by the tests. */
  solve: (program: ProjectProgram) => void;
}

/** Something the game needs to keep working. A missing one is offered back, never forced. */
export interface Pillar {
  id: string;
  /** What stopped working: «Nova ya no se mueve». `{id}` becomes the sprite's name. */
  broken: string;
  ok: (program: ProjectProgram) => boolean;
  /** What to put back: added to the sprite, nothing of the child's is taken away. */
  restore: { sprite: string; script: Script };
}

/** Marks a game as a showcase one: it opens ready to play, and the guide is a wall of cards. */
export interface Showcase {
  /** How to play, one line each, with an emoji. */
  play: { icon: string; text: string }[];
  /**
   * The goal in one line, written with the marks of a step (`**10**`, `{estrella}`) so it is drawn, not read. It takes the
   * program, so a number the child changed shows up changed.
   */
  goal: (program: ProjectProgram) => string;
  /** Sprites the game is made of: removing one asks first. */
  cast: string[];
  pillars: Pillar[];
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
  /** Opens ready to play and is changed through cards, in any order. */
  showcase?: Showcase;
}

export type { Block };
