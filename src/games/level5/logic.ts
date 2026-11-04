/**
 * Reading helpers for the level 5 guides. A check looks at the shape of the child's blocks and at the
 * live run, and never at the name of a variable or a sprite, so any reasonable solution passes.
 */
import type { BlockType } from '../../language/catalog.ts';
import type { Block, Script, SpriteProgram } from '../../language/ir.ts';
import { blocksInList, blocksOfSprite } from '../checks.ts';
import type { StepContext } from '../types.ts';

export const LOOPS: readonly BlockType[] = ['a_forever', 'a_repeat', 'a_repeatuntil'];
export const COMPARES: readonly BlockType[] = ['v_eq', 'v_lt', 'v_gt'];
export const SAYS: readonly BlockType[] = ['a_say', 'a_sayfor', 'a_thinkfor'];
export const BRANCHES: readonly BlockType[] = ['a_if', 'a_ifelse'];
/** Blocks that wait for a condition before going on. */
export const GUARDS: readonly BlockType[] = ['a_if', 'a_ifelse', 'a_waituntil', 'a_repeatuntil'];

export interface Placed {
  sprite: SpriteProgram;
  block: Block;
}

export interface PlacedScript {
  sprite: SpriteProgram;
  script: Script;
}

/** Every block of the project with the sprite that owns it. */
export function placed(ctx: StepContext): Placed[] {
  return ctx.program.sprites.flatMap((sprite) => blocksOfSprite(sprite).map((block) => ({ sprite, block })));
}

/** Scripts of the project, optionally only those that start with one of these hats. */
export function scriptsOf(ctx: StepContext, hats?: readonly BlockType[]): PlacedScript[] {
  return ctx.program.sprites.flatMap((sprite) =>
    sprite.scripts.filter((sc) => !hats || hats.includes(sc.hat.type)).map((script) => ({ sprite, script })),
  );
}

/** Every block inside `block`: statements, else branch and value sockets. The block itself is left out. */
export const inside = (block: Block): Block[] => blocksInList([...Object.values(block.inputs), ...block.body, ...block.elseBody]);

/** Whether any block of these types sits in the list or anywhere nested under it. */
export const holds = (list: readonly Block[], types: readonly BlockType[]): boolean => blocksInList(list).some((b) => types.includes(b.type));

/** Every block of a script, hat included. */
export const blocksOfScript = (sc: Script): Block[] => blocksInList([sc.hat, ...sc.body]);

/** Blocks of the `outer` types whose insides hold a block of every group in `groups`. */
export function holdingAll(ctx: StepContext, outer: readonly BlockType[], ...groups: (readonly BlockType[])[]): Placed[] {
  return placed(ctx).filter(({ block }) => outer.includes(block.type) && groups.every((g) => inside(block).some((x) => g.includes(x.type))));
}

type Wanted = readonly BlockType[] | ((b: Block) => boolean);
const hasWanted = (list: readonly Block[], wanted: Wanted): boolean =>
  blocksInList(list).some((b) => (typeof wanted === 'function' ? wanted(b) : wanted.includes(b.type)));

/**
 * «Si» and «si… sino» blocks whose condition holds a block of `cond` and whose chosen part holds
 * `branch` (block types, or a predicate).
 */
export function conditionals(ctx: StepContext, cond: readonly BlockType[], branch: Wanted, part: 'then' | 'else' | 'any' = 'any'): Placed[] {
  return placed(ctx).filter(({ block: b }) => {
    if (!BRANCHES.includes(b.type) || !b.inputs.C || (cond.length > 0 && !holds([b.inputs.C], cond))) return false;
    return hasWanted(part === 'then' ? b.body : part === 'else' ? b.elseBody : [...b.body, ...b.elseBody], branch);
  });
}

/* ---------- numbers and variables ---------- */

export function literal(b: Block | undefined): number | undefined {
  return b?.type === 'v_num' ? Number(b.fields.V) : undefined;
}

export const nameOf = (b: Block): string => String(b.fields.NAME ?? '');

/** Whether the block makes a variable smaller: «cambiar por -1», or a change that subtracts. */
export function lowers(b: Block): boolean {
  if (b.type === 'a_setvar') {
    const v = b.inputs.V;
    return v?.type === 'v_sub' && holds([v], ['v_var']);
  }
  if (b.type !== 'a_changevar') return false;
  const v = b.inputs.V;
  const n = literal(v);
  if (n !== undefined) return n < 0;
  return !!v && (v.type === 'v_sub' || inside(v).some((x) => x.type === 'v_num' && Number(x.fields.V) < 0));
}

/** Whether the block makes a variable bigger. */
export function raises(b: Block): boolean {
  if (b.type === 'a_setvar') {
    const v = b.inputs.V;
    return v?.type === 'v_add' && holds([v], ['v_var']);
  }
  if (b.type !== 'a_changevar') return false;
  const v = b.inputs.V;
  const n = literal(v);
  return n !== undefined ? n > 0 : !!v && !lowers(b);
}

/** The variable names a project declares, in the order the child created them. */
export const declared = (ctx: StepContext): string[] => ctx.program.variables;

/** Variables a green-flag script sets to a plain number, with that number. */
export function setAtStart(ctx: StepContext): { name: string; value: number }[] {
  return scriptsOf(ctx, ['a_flag']).flatMap(({ script }) =>
    blocksInList(script.body)
      .filter((b) => b.type === 'a_setvar' && literal(b.inputs.V) !== undefined && declared(ctx).includes(nameOf(b)))
      .map((b) => ({ name: nameOf(b), value: literal(b.inputs.V) as number })),
  );
}

/** The number a variable starts at: set by the green flag when possible, else by any plain «poner en». */
export function startOf(ctx: StepContext, name: string): number | undefined {
  const atStart = setAtStart(ctx).find((s) => s.name === name);
  if (atStart) return atStart.value;
  for (const { block } of placed(ctx)) {
    if (block.type === 'a_setvar' && nameOf(block) === name) {
      const n = literal(block.inputs.V);
      if (n !== undefined) return n;
    }
  }
  return undefined;
}

export const valueOf = (ctx: StepContext, name: string): number => Number(ctx.machine.vars.get(name) ?? 0);

/** Variables that lower somewhere in the project. */
export function loweredNames(ctx: StepContext): string[] {
  return [...new Set(placed(ctx).filter(({ block }) => lowers(block)).map(({ block }) => nameOf(block)))].filter((n) => declared(ctx).includes(n));
}

/** Variables with a starting number that now hold less than that, in the current run. */
export function belowStart(ctx: StepContext): string[] {
  return declared(ctx).filter((n) => {
    const start = startOf(ctx, n);
    return start !== undefined && valueOf(ctx, n) < start;
  });
}

/** Names of the variables a list of blocks reads. */
export const readNames = (list: readonly Block[]): string[] => blocksInList(list).filter((b) => b.type === 'v_var').map(nameOf);

/* ---------- order inside a script ---------- */

/**
 * Whether, in some statement list, a block that satisfies `first` comes before a block of the `then`
 * types. Both may be nested inside C-shaped blocks, as long as they share a list.
 */
export function comesBefore(ctx: StepContext, first: (b: Block) => boolean, then: readonly BlockType[]): boolean {
  const scan = (list: readonly Block[]): boolean => {
    const i = list.findIndex((b) => blocksInList([b]).some(first));
    if (i >= 0 && list.slice(i + 1).some((b) => holds([b], then))) return true;
    return list.some((b) => scan(b.body) || scan(b.elseBody));
  };
  return ctx.program.sprites.some((s) => s.scripts.some((sc) => scan(sc.body)));
}

/* ---------- the live run ---------- */

export const spritesOfArt = (ctx: StepContext, art: string): SpriteProgram[] => ctx.program.sprites.filter((s) => s.art === art);

/** Clones alive right now. */
export const liveClones = (ctx: StepContext): number => ctx.machine.instances.filter((i) => i.isClone).length;

/** Sprites that have started at least one clone script. */
export const cloningSprites = (ctx: StepContext): SpriteProgram[] => ctx.program.sprites.filter((s) => ctx.stats.ranHatBy(s.id, 'clone'));
