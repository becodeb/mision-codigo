/**
 * Every game's code must be something a child can see in the block editor: it converts to Blockly state,
 * loads into a headless workspace with no missing block, and converts back unchanged. The suites below
 * are generated from the catalog, so they pass vacuously while it is empty and grow with it.
 */
import * as Blockly from 'blockly/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerBlocks, setProjectContext } from '../language/blocks.ts';
import { blocklyToIr, flattenScripts, irToBlockly, type WorkspaceState } from '../language/convert.ts';
import type { Script } from '../language/ir.ts';
import { scriptsCover } from '../language/testing.ts';
import { GAMES } from './catalog.ts';
import { stepsOf } from './proof.ts';
import type { GameDefinition } from './types.ts';

beforeAll(() => registerBlocks());

interface Code {
  label: string;
  scripts: Script[];
  game: GameDefinition;
}

function codeOf(game: GameDefinition): Code[] {
  const out: Code[] = [];
  for (const sp of game.setup.sprites) out.push({ label: `setup/${sp.id}`, scripts: sp.scripts, game });
  for (const sp of game.solution.program.sprites) out.push({ label: `solution/${sp.id}`, scripts: sp.scripts, game });
  for (const step of stepsOf(game)) for (const ex of step.example ?? []) out.push({ label: `example/${step.id}/${ex.sprite}`, scripts: ex.scripts, game });
  return out;
}

function checkRoundTrip(code: Code): void {
  setProjectContext({
    sprites: () => code.game.solution.program.sprites.map((s) => ({ id: s.id, name: s.name })),
    currentSpriteId: () => null,
    variables: () => code.game.solution.program.variables,
    lists: () => code.game.solution.program.lists,
  });
  const state = irToBlockly(code.scripts);
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state, ws);
    expect(ws.getAllBlocks(false).length).toBeGreaterThanOrEqual(flattenScripts(code.scripts).length);
    const back = blocklyToIr(Blockly.serialization.workspaces.save(ws) as WorkspaceState);
    expect(scriptsCover(code.scripts, back)).toEqual([]);
  } finally {
    ws.dispose();
    setProjectContext(null);
  }
}

describe('game code in the block editor', () => {
  it('runs over the whole catalog', () => {
    expect(Array.isArray(GAMES)).toBe(true);
  });

  describe.each(GAMES.map((g) => [g.id, g] as const))('%s', (_id, game) => {
    it('has the same code in the editor as in the runtime, for setup, solution and examples', () => {
      for (const code of codeOf(game)) {
        expect(() => checkRoundTrip(code), code.label).not.toThrow();
      }
    });
  });
});
