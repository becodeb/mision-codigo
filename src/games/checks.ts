/** Helpers for step checks. A check must accept any reasonable solution, not only the reference one. */
import { ART, BACKDROPS, type ArtId } from '../art/index.ts';
import { blockInfo, type BlockType } from '../language/catalog.ts';
import type { Block, ProjectProgram, Script, SpriteProgram } from '../language/ir.ts';
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

/* ---------- helpers for the picture-tier games (levels 1 and 2) ---------- */

/** A statement list and everything nested inside it, in order. */
export function blocksInList(list: readonly Block[]): Block[] {
  const out: Block[] = [];
  list.forEach((b) => walk(b, (x) => out.push(x)));
  return out;
}

export function blocksOfType(ctx: StepContext, type: BlockType): Block[] {
  return blocksOfProject(ctx.program).filter((b) => b.type === type);
}

/** What a fresh backdrop block shows before the child picks anything: the first place of the list. */
const NEW_BLOCK_BACKDROP = Object.keys(BACKDROPS)[0];

/**
 * Whether a backdrop block was really chosen by the child. A new block comes with the first place already picked,
 * so that one never counts (even a child who wants it must pick another), and neither does the project's own place.
 */
export const chosenBackdrop = (ctx: StepContext, block: Block): boolean =>
  block.fields.B !== ctx.program.backdrop && block.fields.B !== NEW_BLOCK_BACKDROP;

/** How many blocks of any of these types the project has. */
export function countAny(ctx: StepContext, types: readonly BlockType[]): number {
  return blocksOfProject(ctx.program).filter((b) => types.includes(b.type)).length;
}

/** The scripts of a sprite that start with this hat. */
export function scriptsOfHat(sprite: SpriteProgram, hat: BlockType): Script[] {
  return sprite.scripts.filter((sc) => sc.hat.type === hat);
}

export const isCharacter = (s: SpriteProgram): boolean => ART[s.art as ArtId]?.kind === 'character';
export const isObject = (s: SpriteProgram): boolean => ART[s.art as ArtId]?.kind === 'object';

/** How many sprites ran a block of this stats category (`say`, `move`, `note`, ...). */
export function spritesRan(ctx: StepContext, category: string): number {
  return ctx.program.sprites.filter((s) => ctx.stats.ranBy(s.id, category)).length;
}

/** How many sprites started a script with this hat (a picture-tier hat block type). */
export function spritesRanHat(ctx: StepContext, hat: BlockType): number {
  const kind = blockInfo(hat)?.hat;
  return kind ? ctx.program.sprites.filter((s) => ctx.stats.ranHatBy(s.id, kind)).length : 0;
}

/** Sprites with at least `min` blocks of these types; with `category`, only those the stats saw running it. */
export function spritesWithBlocks(ctx: StepContext, types: readonly BlockType[], min = 1, category?: string): SpriteProgram[] {
  return ctx.program.sprites.filter(
    (s) => blocksOfSprite(s).filter((b) => types.includes(b.type)).length >= min && (!category || ctx.stats.ranBy(s.id, category)),
  );
}

export interface HatQuery {
  hat: BlockType;
  /** Block types that count. */
  types: readonly BlockType[];
  /** At least this many of them in one script (default 1). */
  min?: number;
  /** At least this many different types among them (default 1). */
  kinds?: number;
}

/** Sprites with a script under `hat` that holds what the query asks, whose hat has already run. */
export function spritesWithHat(ctx: StepContext, q: HatQuery): SpriteProgram[] {
  const kind = blockInfo(q.hat)?.hat;
  return ctx.program.sprites.filter((s) => {
    if (!kind || !ctx.stats.ranHatBy(s.id, kind)) return false;
    return scriptsOfHat(s, q.hat).some((sc) => {
      const found = blocksInList(sc.body).filter((b) => q.types.includes(b.type));
      return found.length >= (q.min ?? 1) && new Set(found.map((b) => b.type)).size >= (q.kinds ?? 1);
    });
  });
}

function sequenceIn(list: readonly Block[], first: readonly BlockType[], then: readonly BlockType[]): boolean {
  const holds = (b: Block, types: readonly BlockType[]) => blocksInList([b]).some((x) => types.includes(x.type));
  const i = list.findIndex((b) => holds(b, first));
  if (i >= 0 && list.slice(i + 1).some((b) => holds(b, then))) return true;
  return list.some((b) => sequenceIn(b.body, first, then) || sequenceIn(b.elseBody, first, then));
}

/** Sprites with a script where a block of `first` comes before one of `then`, in the same list. */
export function sequenceSprites(ctx: StepContext, first: readonly BlockType[], then: readonly BlockType[]): SpriteProgram[] {
  return ctx.program.sprites.filter((s) => s.scripts.some((sc) => sequenceIn(sc.body, first, then)));
}

export function hasSequence(ctx: StepContext, first: readonly BlockType[], then: readonly BlockType[]): boolean {
  return sequenceSprites(ctx, first, then).length > 0;
}

/** Most different kinds of command (say, face, sound, ...) that follow a block of `first` in one script. */
export function kindsAfter(ctx: StepContext, first: readonly BlockType[]): number {
  let best = 0;
  const scan = (list: readonly Block[]): void => {
    const i = list.findIndex((b) => first.includes(b.type));
    if (i >= 0) {
      const kinds = new Set<string>();
      for (const b of blocksInList(list.slice(i + 1))) {
        const info = blockInfo(b.type);
        if (info?.kind === 'command' && b.type !== 'f_repeat') kinds.add(info.cats[0]);
      }
      best = Math.max(best, kinds.size);
    }
    list.forEach((b) => scan(b.body));
  };
  ctx.program.sprites.forEach((s) => s.scripts.forEach((sc) => scan(sc.body)));
  return best;
}

/** How many times blocks of these types run in a sprite, counting each «repetir» as many times as it repeats. */
export function runsOf(sprite: SpriteProgram, types: readonly BlockType[]): number {
  const count = (list: readonly Block[]): number =>
    list.reduce((n, b) => {
      const times = b.type === 'f_repeat' ? Math.min(500, Math.max(0, Math.floor(Number(b.fields.N ?? 0)))) : 1;
      return n + (types.includes(b.type) ? 1 : 0) + count(b.body) * times;
    }, 0);
  return sprite.scripts.reduce((n, sc) => n + count(sc.body), 0);
}

/* ---------- helpers for the text-tier games (levels 3 and 4) ---------- */

/** A script and the sprite that owns it. */
export interface ScriptRef {
  sprite: SpriteProgram;
  script: Script;
}

/** Scripts that start with this hat, optionally narrowed by its fields (key, message, points, target). */
export function refsOfHat(ctx: StepContext, hat: BlockType, where?: (hat: Block) => boolean): ScriptRef[] {
  return ctx.program.sprites.flatMap((sprite) =>
    sprite.scripts.filter((script) => script.hat.type === hat && (!where || where(script.hat))).map((script) => ({ sprite, script })),
  );
}

/** Every block in a script's body, nested ones included. */
export const refBlocks = (ref: ScriptRef): Block[] => blocksInList(ref.script.body);

export const refHas = (ref: ScriptRef, types: readonly BlockType[]): boolean => refBlocks(ref).some((b) => types.includes(b.type));

/** A number held by a block: a field (hat, dropdown) or a literal in a socket. NaN when it is neither. */
export function numField(block: Block, key: string): number {
  const field = block.fields[key];
  if (field !== undefined) return Number(field);
  const input = block.inputs[key];
  return input && input.type === 'v_num' ? Number(input.fields.V) : NaN;
}

/** Blocks nested inside any block of type `container` found in the list, for example inside a «por siempre». */
export function nestedIn(list: readonly Block[], container: BlockType): Block[] {
  return blocksInList(list)
    .filter((b) => b.type === container)
    .flatMap((b) => [...blocksInList(b.body), ...blocksInList(b.elseBody)]);
}

/** Blocks that put a sprite somewhere else or push it along. */
export const PLACES: readonly BlockType[] = ['a_random', 'a_goto', 'a_glide', 'a_changex', 'a_changey', 'a_move', 'a_gotosprite'];
/** Blocks that make a sprite visibly react. */
export const REACTIONS: readonly BlockType[] = ['a_say', 'a_sayfor', 'a_thinkfor', 'a_sound', 'a_note', 'a_face', 'a_jump', 'a_changesize', 'a_setsize'];

/** Whether a script of `from` sends a message that some script satisfying `then` receives. */
export function messageReaches(ctx: StepContext, from: readonly ScriptRef[], then: (receiver: ScriptRef) => boolean = () => true): boolean {
  return from.some((f) =>
    refBlocks(f)
      .filter((b) => b.type === 'a_send')
      .some((send) => refsOfHat(ctx, 'a_recv', (h) => h.fields.M === send.fields.M).some(then)),
  );
}

/** Sprites that hide at the start and show up later from a message or a points threshold that already fired. */
export function appearLater(ctx: StepContext): SpriteProgram[] {
  return ctx.program.sprites.filter((s) => {
    const own = (hat: BlockType) => s.scripts.filter((sc) => sc.hat.type === hat).map((script) => ({ sprite: s, script }));
    const hides = own('a_flag').some((r) => refHas(r, ['a_hide']));
    const shows = [...own('a_recv'), ...own('a_points')].some((r) => refHas(r, ['a_show']));
    return hides && shows && (ctx.stats.ranHatBy(s.id, 'recv') || ctx.stats.ranHatBy(s.id, 'points'));
  });
}

/** Sprites with a «por siempre» that moves and bounces, started by the flag or a message, and that already ran it. */
export function patrolSprites(ctx: StepContext): SpriteProgram[] {
  const starts: BlockType[] = ['a_flag', 'a_recv', 'a_points'];
  return ctx.program.sprites.filter((s) =>
    s.scripts.some((script) => {
      if (!starts.includes(script.hat.type)) return false;
      const inside = nestedIn(script.body, 'a_forever').map((b) => b.type);
      return inside.includes('a_move') && inside.includes('a_bounce');
    }) && ctx.stats.ranBy(s.id, 'forever'),
  );
}

/** Ids of the sprites that end the game when touched: «al tocar … perder», or «si tocando … perder». */
export function lethalTargets(ctx: StepContext): Set<string> {
  const out = new Set<string>();
  for (const ref of refsOfHat(ctx, 'a_touching')) if (refHas(ref, ['a_lose'])) out.add(String(ref.script.hat.fields.T));
  for (const s of ctx.program.sprites) {
    for (const sc of s.scripts) {
      for (const b of blocksInList(sc.body)) {
        if (b.type !== 'a_if' || b.inputs.C?.type !== 'v_touching') continue;
        if (blocksInList(b.body).some((x) => x.type === 'a_lose')) out.add(String(b.inputs.C.fields.T));
      }
    }
  }
  return out;
}
