/**
 * Toolbox builder. Given a level, a game's blocks plus whatever the guide has unlocked, it returns a
 * Blockly toolbox definition: a flat flyout of big blocks for the picture tier, coloured categories
 * (empty ones left out) for the text tier. Plain data, so it needs no Blockly.
 */
import { BLOCKS, blocksForLevel, type BlockType } from './catalog.ts';
import { BLOCK_SPECS, type ArgSpec, type Category } from './spec.ts';
import type { LevelId } from '../shared/levels.ts';

export const CREATE_VARIABLE_KEY = 'MC_CREATE_VARIABLE';
export const CREATE_LIST_KEY = 'MC_CREATE_LIST';

export const CATEGORY_INFO: Record<Category, { label: string; colour: string }> = {
  events: { label: 'Eventos', colour: '#FFBF00' },
  motion: { label: 'Movimiento', colour: '#4C97FF' },
  looks: { label: 'Apariencia', colour: '#9966FF' },
  sound: { label: 'Sonido', colour: '#CF63CF' },
  control: { label: 'Control', colour: '#FFAB19' },
  sensing: { label: 'Sensores', colour: '#5CB1D6' },
  operators: { label: 'Operadores', colour: '#59C059' },
  points: { label: 'Puntos', colour: '#17B3A3' },
  variables: { label: 'Variables', colour: '#FF8C1A' },
  lists: { label: 'Listas', colour: '#FF661A' },
};

const CATEGORY_ORDER: Category[] = ['events', 'motion', 'looks', 'sound', 'control', 'sensing', 'operators', 'points', 'variables', 'lists'];

/** Literals come with the sockets, so they are never offered on their own. */
const LITERALS = new Set<string>(['v_num', 'v_text']);

export interface ToolboxBlock {
  kind: 'block';
  type: BlockType;
  inputs?: Record<string, { shadow: { type: string; fields: { V: number | string } } }>;
}
export type ToolboxItem = ToolboxBlock | { kind: 'sep'; gap: number } | { kind: 'button'; text: string; callbackkey: string };
export interface ToolboxCategory {
  kind: 'category';
  name: string;
  colour: string;
  categorystyle?: string;
  contents: ToolboxItem[];
  /** Which language category this is, for the editor to find it again. */
  id: Category;
}
export type ToolboxDefinition =
  | { kind: 'flyoutToolbox'; contents: ToolboxItem[] }
  | { kind: 'categoryToolbox'; contents: ToolboxCategory[] };

export interface ToolboxOptions {
  level: LevelId;
  /** Blocks on offer. Leave out for everything the level allows (the free project). */
  blocks?: readonly BlockType[];
  hasVariables?: boolean;
  hasLists?: boolean;
}

export const tierOf = (level: LevelId): 'picture' | 'text' => (level <= 2 ? 'picture' : 'text');

/** The blocks of the right tier in the language's own order, without literals or repeats. */
export function offeredBlocks(level: LevelId, blocks?: readonly BlockType[]): BlockType[] {
  const tier = tierOf(level);
  const wanted = new Set<BlockType>(blocks ?? blocksForLevel(level));
  return (Object.keys(BLOCKS) as BlockType[]).filter((t) => wanted.has(t) && BLOCKS[t].tier === tier && !LITERALS.has(t));
}

function toolboxBlock(type: BlockType): ToolboxBlock {
  const inputs: NonNullable<ToolboxBlock['inputs']> = {};
  for (const arg of BLOCK_SPECS[type].args as readonly ArgSpec[]) {
    if (arg.k === 'in' && arg.shadow) inputs[arg.name] = { shadow: { type: arg.shadow, fields: { V: arg.shadow === 'v_num' ? Number(arg.def ?? 0) : String(arg.def ?? '') } } };
  }
  return Object.keys(inputs).length ? { kind: 'block', type, inputs } : { kind: 'block', type };
}

export function buildToolbox(opts: ToolboxOptions): ToolboxDefinition {
  const types = offeredBlocks(opts.level, opts.blocks);
  if (tierOf(opts.level) === 'picture') {
    const contents: ToolboxItem[] = [];
    types.forEach((t, i) => {
      if (i) contents.push({ kind: 'sep', gap: 16 });
      contents.push(toolboxBlock(t));
    });
    return { kind: 'flyoutToolbox', contents };
  }

  const byCategory = new Map<Category, BlockType[]>();
  for (const t of types) {
    const cat = BLOCK_SPECS[t].cat;
    if (!cat) continue;
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), t]);
  }
  const out: ToolboxCategory[] = [];
  for (const id of CATEGORY_ORDER) {
    const list = byCategory.get(id);
    if (!list?.length) continue;
    const info = CATEGORY_INFO[id];
    const contents: ToolboxItem[] = [];
    if (id === 'variables') contents.push({ kind: 'button', text: 'Crear variable', callbackkey: CREATE_VARIABLE_KEY });
    if (id === 'lists') contents.push({ kind: 'button', text: 'Crear lista', callbackkey: CREATE_LIST_KEY });
    /* Blocks that name a variable or a list make no sense until one exists. */
    const usable = id === 'variables' ? opts.hasVariables : id === 'lists' ? opts.hasLists : true;
    if (usable) list.forEach((t) => contents.push(toolboxBlock(t)));
    out.push({ kind: 'category', id, name: info.label, colour: info.colour, contents });
  }
  return { kind: 'categoryToolbox', contents: out };
}

/** The block types that appear in a built toolbox, in order. */
export function toolboxTypes(toolbox: ToolboxDefinition): BlockType[] {
  const items: ToolboxItem[] = toolbox.kind === 'flyoutToolbox' ? toolbox.contents : toolbox.contents.flatMap((c) => c.contents);
  return items.filter((i): i is ToolboxBlock => i.kind === 'block').map((i) => i.type);
}
