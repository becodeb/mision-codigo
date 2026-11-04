/**
 * Intermediate representation of programs. Blockly state converts to this to run, and this converts
 * to Blockly state so games can declare starters and solutions as data. Builders live in build.ts
 * and are re-exported here.
 */
import type { BlockType } from './catalog.ts';

export type FieldValue = string | number;

export interface Block {
  type: BlockType;
  /** Optional stable id, used by the editor to highlight the running block. */
  id?: string;
  /** Dropdowns, literals and names. */
  fields: Record<string, FieldValue>;
  /** Value sockets. Literals are blocks too (`v_num`, `v_text`). */
  inputs: Record<string, Block>;
  /** Statements of a C-shaped block (repeat, forever, if, ...). */
  body: Block[];
  /** Statements of the `else` branch (`a_ifelse` only). */
  elseBody: Block[];
}

/** A hat block and the statements under it. */
export interface Script {
  hat: Block;
  body: Block[];
}

export interface SpriteProgram {
  id: string;
  /** Character or object id from `src/art`. */
  art: string;
  name: string;
  x: number;
  y: number;
  size?: number;
  /** Degrees clockwise from up. Default 90 (facing right). */
  dir?: number;
  /** -1 mirrors the art horizontally. */
  flip?: 1 | -1;
  visible?: boolean;
  scripts: Script[];
}

export interface ProjectProgram {
  backdrop: string;
  sprites: SpriteProgram[];
  /** Project-wide variable names, all start at 0. */
  variables: string[];
  /** Project-wide list names, all start empty. */
  lists: string[];
}

export * from './build.ts';
