/**
 * Blockly workspace state <-> IR, for every block type. Works on the plain serialization JSON
 * (`Blockly.serialization.workspaces`), so it needs no workspace and runs in any environment.
 */
import { blockInfo, type BlockType } from './catalog.ts';
import type { Block, FieldValue, Script } from './ir.ts';
import { BLOCK_SPECS, hasBody, isHat, type ArgSpec } from './spec.ts';

export interface BlockState {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockState; shadow?: BlockState }>;
  next?: { block?: BlockState; shadow?: BlockState };
}

export interface WorkspaceState {
  blocks?: { languageVersion?: number; blocks?: BlockState[] };
  variables?: unknown;
}

const isKnown = (type: string): type is BlockType => Object.prototype.hasOwnProperty.call(BLOCK_SPECS, type) && blockInfo(type) !== undefined;

/* ---------- IR -> Blockly ---------- */

const isLiteral = (b: Block): boolean => b.type === 'v_num' || b.type === 'v_text';

function fieldState(arg: ArgSpec, value: FieldValue): unknown {
  if (arg.k === 'dd' || arg.k === 'text') return String(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function defaultShadow(arg: Extract<ArgSpec, { k: 'in' }>): BlockState | undefined {
  if (!arg.shadow) return undefined;
  return { type: arg.shadow, fields: { V: arg.shadow === 'v_num' ? Number(arg.def ?? 0) : String(arg.def ?? '') } };
}

function chainState(list: readonly Block[]): BlockState | undefined {
  let next: BlockState | undefined;
  for (let i = list.length - 1; i >= 0; i--) {
    const st = blockState(list[i]);
    if (next) st.next = { block: next };
    next = st;
  }
  return next;
}

function blockState(b: Block): BlockState {
  if (!isKnown(b.type)) throw new Error(`Unknown block type: ${b.type}`);
  const spec = BLOCK_SPECS[b.type];
  const st: BlockState = { type: b.type };
  if (b.id) st.id = b.id;
  const fields: Record<string, unknown> = {};
  const inputs: NonNullable<BlockState['inputs']> = {};
  for (const arg of spec.args) {
    if (arg.k === 'dd' || arg.k === 'num' || arg.k === 'text' || arg.k === 'tap') {
      const v = b.fields[arg.name];
      if (v !== undefined) fields[arg.name] = fieldState(arg, v);
      else if (b.type === 'a_clone' && arg.name === 'T') fields.T = 'myself';
    } else if (arg.k === 'in') {
      const given = b.inputs[arg.name];
      const shadow = defaultShadow(arg);
      if (given && isLiteral(given)) inputs[arg.name] = { shadow: blockState(given) };
      else if (given) inputs[arg.name] = shadow ? { block: blockState(given), shadow } : { block: blockState(given) };
      else if (shadow) inputs[arg.name] = { shadow };
    }
  }
  if (Object.keys(fields).length) st.fields = fields;
  if (hasBody(b.type)) {
    const body = chainState(b.body);
    if (body) inputs.DO = { block: body };
    if (spec.elseBody) {
      const other = chainState(b.elseBody);
      if (other) inputs.ELSE = { block: other };
    }
  }
  if (Object.keys(inputs).length) st.inputs = inputs;
  return st;
}

/** Rough height of a script as drawn, so stacked scripts do not overlap before the first cleanup. */
function heightOf(list: readonly Block[]): number {
  let h = 0;
  for (const b of list) h += 52 + (hasBody(b.type) ? 28 + heightOf(b.body) + heightOf(b.elseBody) : 0);
  return h;
}

/** Scripts as a Blockly workspace state, stacked in a column from the top left. */
export function irToBlockly(scripts: readonly Script[], origin: { x: number; y: number } = { x: 30, y: 36 }): WorkspaceState {
  const blocks: BlockState[] = [];
  let y = origin.y;
  for (const script of scripts) {
    const top = blockState(script.hat);
    const body = chainState(script.body);
    if (body) top.next = { block: body };
    top.x = origin.x;
    top.y = y;
    blocks.push(top);
    y += 70 + heightOf(script.body) + 24;
  }
  return { blocks: { languageVersion: 0, blocks } };
}

/* ---------- Blockly -> IR ---------- */

function irBlock(st: BlockState): Block {
  const type = st.type as BlockType;
  const spec = BLOCK_SPECS[type];
  const fields: Record<string, FieldValue> = {};
  const inputs: Record<string, Block> = {};
  for (const arg of spec.args) {
    if (arg.k === 'dd' || arg.k === 'num' || arg.k === 'text' || arg.k === 'tap') {
      const raw = st.fields?.[arg.name];
      if (type === 'a_clone' && arg.name === 'T') {
        if (raw !== undefined && raw !== 'myself') fields.T = String(raw);
        continue;
      }
      if (raw !== undefined && raw !== null) fields[arg.name] = arg.k === 'num' || arg.k === 'tap' ? Number(raw) : String(raw);
      else if (arg.k === 'num' || arg.k === 'tap') fields[arg.name] = arg.def;
      else if (arg.k === 'text') fields[arg.name] = arg.def;
    } else if (arg.k === 'in') {
      const slot = st.inputs?.[arg.name];
      const inner = slot?.block ?? slot?.shadow;
      if (inner && isKnown(inner.type)) inputs[arg.name] = irBlock(inner);
    }
  }
  const out: Block = { type, fields, inputs, body: [], elseBody: [] };
  if (st.id) out.id = st.id;
  if (hasBody(type)) {
    out.body = irChain(st.inputs?.DO?.block);
    if (spec.elseBody) out.elseBody = irChain(st.inputs?.ELSE?.block);
  }
  return out;
}

function irChain(first: BlockState | undefined): Block[] {
  const out: Block[] = [];
  for (let cur = first; cur; cur = cur.next?.block ?? cur.next?.shadow) {
    if (isKnown(cur.type) && BLOCK_SPECS[cur.type].shape !== 'value' && !isHat(cur.type)) out.push(irBlock(cur));
  }
  return out;
}

/** The scripts of a workspace state: every hat block and the statements under it. Loose blocks are not scripts. */
export function blocklyToIr(state: WorkspaceState | null | undefined): Script[] {
  const scripts: Script[] = [];
  for (const top of state?.blocks?.blocks ?? []) {
    if (!isKnown(top.type) || !isHat(top.type)) continue;
    scripts.push({ hat: irBlock(top), body: irChain(top.next?.block ?? top.next?.shadow) });
  }
  return scripts;
}

/** Stacks that hang from no hat, each a list of blocks from its top. Loose value blocks are left out. */
export function looseStacks(state: WorkspaceState | null | undefined): Block[][] {
  const out: Block[][] = [];
  for (const top of state?.blocks?.blocks ?? []) {
    if (!isKnown(top.type) || isHat(top.type) || BLOCK_SPECS[top.type].shape === 'value') continue;
    out.push(irChain(top));
  }
  return out;
}

/** Every block of a script list, hats and value inputs included, for counting and tests. */
export function flattenScripts(scripts: readonly Script[]): Block[] {
  const out: Block[] = [];
  const walk = (b: Block): void => {
    out.push(b);
    Object.values(b.inputs).forEach(walk);
    b.body.forEach(walk);
    b.elseBody.forEach(walk);
  };
  for (const s of scripts) {
    walk(s.hat);
    s.body.forEach(walk);
  }
  return out;
}
