/** Small builders shared by the runtime tests. */
import { onFlag, project, setVar, sprite, type Block, type ProjectProgram, type Script, type SpriteOptions } from '../language/ir.ts';
import { Game, type GameOptions } from './testing.ts';

/** One character with the given scripts, standing at the origin unless told otherwise. */
export function solo(scripts: Script[], opts: SpriteOptions & { variables?: string[]; lists?: string[]; art?: string } = {}): ProjectProgram {
  const { variables, lists, art, ...spriteOpts } = opts;
  return project('parque', [sprite('a', art ?? 'toby', scripts, { x: 0, y: 0, ...spriteOpts })], { variables, lists });
}

export function play(program: ProjectProgram, opts?: GameOptions): Game {
  const g = new Game(program, opts);
  g.flag();
  return g;
}

/** Evaluates a value block by storing it in a variable from a flag script. */
export function evaluate(expr: Block, opts: { variables?: string[]; lists?: string[]; seed?: number } = {}): unknown {
  const g = play(solo([onFlag(setVar('r', expr))], { variables: ['r', ...(opts.variables ?? [])], lists: opts.lists }), { seed: opts.seed });
  g.run(200);
  return g.machine.vars.get('r');
}
