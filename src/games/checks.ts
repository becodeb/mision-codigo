/** Helpers for step checks. A check must accept any reasonable solution, not only the reference one. */
import type { Block, BlockType, ProjectProgram, SpriteProgram } from '../language/ir.ts';
import type { StepContext } from './types.ts';

function walk(block: Block, visit: (b: Block) => void): void {
  visit(block);
  Object.values(block.inputs).forEach((b) => walk(b, visit));
  block.body.forEach((b) => walk(b, visit));
  block.elseBody.forEach((b) => walk(b, visit));
}

/** Every block in a sprite, hats and value inputs included. */
export function blocksOfSprite(sprite: SpriteProgram): Block[] {
  const out: Block[] = [];
  for (const script of sprite.scripts) {
    walk(script.hat, (b) => out.push(b));
    script.body.forEach((top) => walk(top, (b) => out.push(b)));
  }
  return out;
}

export function blocksOfProject(program: ProjectProgram): Block[] {
  return program.sprites.flatMap(blocksOfSprite);
}

/** How many blocks of a type the project has, across all sprites. */
export function countBlocks(ctx: StepContext, type: BlockType): number {
  return blocksOfProject(ctx.program).filter((b) => b.type === type).length;
}

export function hasBlock(ctx: StepContext, type: BlockType): boolean {
  return countBlocks(ctx, type) > 0;
}

/** How many sprites have at least one block of this type. */
export function spritesWith(ctx: StepContext, type: BlockType): number {
  return ctx.program.sprites.filter((s) => blocksOfSprite(s).some((b) => b.type === type)).length;
}

export function spriteCount(ctx: StepContext): number {
  return ctx.program.sprites.length;
}

/** Distinct values of a field across all blocks of a type, for example how many different notes. */
export function distinctFields(ctx: StepContext, type: BlockType, field: string): number {
  return new Set(blocksOfProject(ctx.program).filter((b) => b.type === type).map((b) => String(b.fields[field]))).size;
}
