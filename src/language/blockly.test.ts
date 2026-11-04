import * as Blockly from 'blockly/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { BLOCKS, blocksForLevel, type BlockType } from './catalog.ts';
import { registerBlocks, setProjectContext } from './blocks.ts';
import { blocklyToIr, flattenScripts, irToBlockly, type WorkspaceState } from './convert.ts';
import * as ir from './ir.ts';
import { BLOCK_SPECS, fieldNames, inputNames } from './spec.ts';
import { everyBlockProgram, scriptsCover, stripIds } from './testing.ts';
import { buildToolbox, CREATE_LIST_KEY, CREATE_VARIABLE_KEY, offeredBlocks, toolboxTypes } from './toolbox.ts';

const ALL_TYPES = Object.keys(BLOCKS) as BlockType[];

beforeAll(() => {
  registerBlocks();
  setProjectContext({
    sprites: () => [{ id: 'a', name: 'Toby' }, { id: 'b', name: 'Michi' }],
    currentSpriteId: () => 'a',
    variables: () => ['vidas'],
    lists: () => ['cosas'],
  });
});

describe('block definitions', () => {
  it('has a spec for every block type of the catalog, and no extra', () => {
    expect(Object.keys(BLOCK_SPECS).sort()).toEqual([...ALL_TYPES].sort());
  });

  it('defines every block type in Blockly and can create it headless', () => {
    const ws = new Blockly.Workspace();
    for (const type of ALL_TYPES) {
      expect(Blockly.Blocks[type], type).toBeDefined();
      const block = ws.newBlock(type);
      expect(block.type).toBe(type);
    }
    ws.dispose();
  });

  it('gives hats no previous connection and values an output', () => {
    const ws = new Blockly.Workspace();
    for (const type of ALL_TYPES) {
      const block = ws.newBlock(type);
      const info = BLOCKS[type];
      if (info.kind === 'hat') expect(block.previousConnection, type).toBeNull();
      else if (info.kind === 'value') expect(block.outputConnection, type).not.toBeNull();
      else expect(block.previousConnection, type).not.toBeNull();
    }
    ws.dispose();
  });

  it('exposes every spec field and input on the Blockly block', () => {
    const ws = new Blockly.Workspace();
    for (const type of ALL_TYPES) {
      const block = ws.newBlock(type);
      for (const f of fieldNames(type)) expect(block.getField(f), `${type}.${f}`).not.toBeNull();
      for (const i of inputNames(type)) expect(block.getInput(i), `${type}.${i}`).not.toBeNull();
    }
    ws.dispose();
  });

  it('reads the sprite dropdowns from the project and keeps a value that is no longer offered', () => {
    const ws = new Blockly.Workspace();
    const touching = ws.newBlock('v_touching');
    const options = (touching.getField('T') as Blockly.FieldDropdown).getOptions(false).map((o) => o[1]);
    expect(options).toEqual(['b', 'EDGE']);
    touching.setFieldValue('gone', 'T');
    expect(touching.getFieldValue('T')).toBe('gone');
    ws.dispose();
  });
});

describe('Blockly <-> IR', () => {
  it('uses every block type in the round-trip program', () => {
    const used = new Set(flattenScripts(everyBlockProgram()).map((x) => x.type));
    expect([...used].sort()).toEqual([...ALL_TYPES].sort());
  });

  it('converts IR to state and back without losing anything', () => {
    const program = everyBlockProgram();
    const back = blocklyToIr(irToBlockly(program));
    expect(scriptsCover(program, back)).toEqual([]);
  });

  it('survives a headless workspace: load, save, convert', () => {
    const program = everyBlockProgram();
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(irToBlockly(program), ws);
    const total = flattenScripts(program).length;
    /* Default shadows only add blocks, never remove them. */
    expect(ws.getAllBlocks(false).length).toBeGreaterThanOrEqual(total);
    const saved = Blockly.serialization.workspaces.save(ws) as WorkspaceState;
    const back = blocklyToIr(saved);
    expect(scriptsCover(program, back)).toEqual([]);
    /* A second pass changes nothing. */
    expect(blocklyToIr(irToBlockly(back)).map((s) => stripIds(s.hat))).toEqual(back.map((s) => stripIds(s.hat)));
    ws.dispose();
  });

  it('keeps block ids so the editor can highlight the running block', () => {
    const program = [ir.onFlag({ ...ir.say('hola'), id: 'abc' })];
    const back = blocklyToIr(irToBlockly(program));
    expect(back[0].body[0].id).toBe('abc');
  });

  it('ignores loose blocks that are not under a hat and unknown block types', () => {
    const state: WorkspaceState = { blocks: { blocks: [{ type: 'a_move', x: 0, y: 0 }, { type: 'nope' }, { type: 'a_flag', next: { block: { type: 'nope', next: { block: { type: 'a_jump' } } } } }] } };
    const scripts = blocklyToIr(state);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].body.map((x) => x.type)).toEqual(['a_jump']);
  });

  it('lets a block placed in a socket replace the default shadow', () => {
    const move = { type: 'a_move', inputs: { N: { block: { type: 'v_x' }, shadow: { type: 'v_num', fields: { V: 10 } } } } };
    const state: WorkspaceState = { blocks: { blocks: [{ type: 'a_flag', next: { block: move } }] } };
    expect(blocklyToIr(state)[0].body[0].inputs.N.type).toBe('v_x');
  });
});

describe('toolbox', () => {
  it('is a flat flyout of big blocks for the picture tier', () => {
    const tb = buildToolbox({ level: 1 });
    expect(tb.kind).toBe('flyoutToolbox');
    expect(toolboxTypes(tb).every((t) => BLOCKS[t].tier === 'picture')).toBe(true);
    expect(toolboxTypes(tb)).toEqual(offeredBlocks(1));
  });

  it('offers only the game blocks plus unlocks, in the language order', () => {
    const tb = buildToolbox({ level: 2, blocks: ['f_say', 'f_flag', 'f_jump', 'a_move'] });
    expect(toolboxTypes(tb)).toEqual(['f_flag', 'f_say', 'f_jump']);
  });

  it('uses coloured categories for the text tier and leaves the empty ones out', () => {
    const tb = buildToolbox({ level: 3, blocks: ['a_flag', 'a_move', 'a_say'] });
    expect(tb.kind).toBe('categoryToolbox');
    if (tb.kind !== 'categoryToolbox') return;
    expect(tb.contents.map((c) => c.name)).toEqual(['Eventos', 'Movimiento', 'Apariencia']);
    expect(tb.contents.every((c) => /^#[0-9A-F]{6}$/i.test(c.colour))).toBe(true);
  });

  it('puts shadow literals in the sockets of the text blocks', () => {
    const tb = buildToolbox({ level: 3, blocks: ['a_move'] });
    if (tb.kind !== 'categoryToolbox') throw new Error('expected categories');
    const move = tb.contents[0].contents[0];
    expect(move).toMatchObject({ kind: 'block', type: 'a_move', inputs: { N: { shadow: { type: 'v_num', fields: { V: 10 } } } } });
  });

  it('adds Crear variable and Crear lista only where blocks need them, and shows the blocks once one exists', () => {
    const none = buildToolbox({ level: 5, blocks: ['a_setvar', 'v_var', 'a_listadd'] });
    if (none.kind !== 'categoryToolbox') throw new Error('expected categories');
    const vars = none.contents.find((c) => c.id === 'variables')!;
    expect(vars.contents).toEqual([{ kind: 'button', text: 'Crear variable', callbackkey: CREATE_VARIABLE_KEY }]);
    expect(none.contents.find((c) => c.id === 'lists')!.contents).toEqual([{ kind: 'button', text: 'Crear lista', callbackkey: CREATE_LIST_KEY }]);
    const some = buildToolbox({ level: 5, blocks: ['a_setvar', 'v_var', 'a_listadd'], hasVariables: true });
    if (some.kind !== 'categoryToolbox') throw new Error('expected categories');
    expect(some.contents.find((c) => c.id === 'variables')!.contents.map((i) => i.kind)).toEqual(['button', 'block', 'block']);
    const absent = buildToolbox({ level: 5, blocks: ['a_move'] });
    if (absent.kind !== 'categoryToolbox') throw new Error('expected categories');
    expect(absent.contents.map((c) => c.id)).toEqual(['motion']);
  });

  it('never offers a literal on its own and matches the free project of each level', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const types = toolboxTypes(buildToolbox({ level, hasVariables: true, hasLists: true }));
      expect(types).not.toContain('v_num');
      expect(types).not.toContain('v_text');
      expect(new Set(types)).toEqual(new Set(blocksForLevel(level).filter((t) => t !== 'v_num' && t !== 'v_text')));
    }
  });
});
