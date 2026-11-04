/** Every block in the catalog must be implemented by the runtime and record its stats categories. */
import { describe, expect, it } from 'vitest';
import { BLOCKS, type BlockType } from '../language/catalog.ts';
import { block, onFlag, project, setVar, sprite } from '../language/ir.ts';
import { Game } from './testing.ts';

const types = Object.keys(BLOCKS) as BlockType[];
const HATS = new Set(['flag', 'click', 'key', 'recv', 'touching', 'clone', 'points']);

describe('catalog and runtime agree', () => {
  it('every command runs with default fields and records its categories', () => {
    for (const type of types.filter((t) => BLOCKS[t].kind === 'command')) {
      const g = new Game(project('parque', [sprite('s', 'toby', [onFlag(block(type))], { x: 0, y: 0 })]));
      g.flag();
      g.run(3000);
      expect(g.machine.errors, type).toEqual([]);
      for (const cat of BLOCKS[type].cats) expect(g.machine.stats.ranBy('s', cat), `${type} -> ${cat}`).toBe(true);
    }
  });

  it('every value evaluates with empty sockets and records its categories', () => {
    for (const type of types.filter((t) => BLOCKS[t].kind === 'value')) {
      const g = new Game(project('parque', [sprite('s', 'toby', [onFlag(setVar('r', block(type)))], { x: 0, y: 0 })], { variables: ['r'] }));
      g.flag();
      g.run(200);
      expect(g.machine.errors, type).toEqual([]);
      expect(['number', 'string', 'boolean'], type).toContain(typeof g.machine.vars.get('r'));
      for (const cat of BLOCKS[type].cats) expect(g.machine.stats.ranBy('s', cat), `${type} -> ${cat}`).toBe(true);
    }
  });

  it('every hat kind is one the machine knows', () => {
    for (const type of types.filter((t) => BLOCKS[t].kind === 'hat')) expect(HATS.has((BLOCKS[type] as { hat: string }).hat), type).toBe(true);
  });

  it('every hat can start a script', () => {
    const triggers: Record<string, (g: Game) => void> = {
      flag: (g) => { g.flag(); },
      click: (g) => { g.tap('s'); },
      key: (g) => { g.machine.keyDown(''); },
      recv: (g) => { g.machine.broadcast(''); },
      touching: (g) => { g.flag(); },
      points: (g) => { g.flag(); },
      clone: (g) => { g.machine.createClone(g.sprite('s')); },
    };
    for (const type of types.filter((t) => BLOCKS[t].kind === 'hat')) {
      const g = new Game(project('parque', [sprite('s', 'toby', [{ hat: block(type, { fields: { T: 'EDGE', N: 0 } }), body: [block('a_win')] }], { x: 228, y: 0 })]));
      triggers[(BLOCKS[type] as { hat: string }).hat](g);
      g.run(200);
      expect(g.machine.stats.ranHatBy('s', (BLOCKS[type] as { hat: string }).hat), type).toBe(true);
    }
  });
});
