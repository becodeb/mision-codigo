import { describe, expect, it } from 'vitest';
import { SHOWCASE } from '../games/showcase/index.ts';
import { stepsOf } from '../games/proof.ts';
import { blocklyToIr, irToBlockly } from '../language/convert.ts';
import type { ProjectProgram } from '../language/ir.ts';
import { newDoc, parseDoc, programOf } from './doc.ts';
import { recapOf } from './recap.ts';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const throughEditor = (p: ProjectProgram): ProjectProgram => ({ ...clone(p), sprites: p.sprites.map((s) => ({ ...clone(s), scripts: blocklyToIr(irToBlockly(s.scripts)) })) });

describe.each(SHOWCASE.map((g) => [g.id, g] as const))('%s', (_id, game) => {
  it('claims no change on the untouched game', () => {
    const sum = recapOf(game, throughEditor(game.setup), []);
    expect(sum.changed).toEqual([]);
    expect(sum.own).toBeNull();
    expect(sum.questions).toHaveLength(3);
    expect(sum.ideas.length).toBeGreaterThanOrEqual(3);
  });

  it('shows a program the child changed, for every card that edits one', () => {
    for (const step of stepsOf(game)) {
      if (step.id === 'fondo' || step.id === 'personaje') continue;
      const p = clone(game.setup);
      step.card!.solve(p);
      const sum = recapOf(game, throughEditor(p), [step]);
      expect(sum.own, step.id).not.toBeNull();
      expect(sum.changed.map((c) => c.label)).toEqual([step.card!.label]);
      expect(sum.questions[0]).toBe(step.card!.ask);
    }
  });

  it('opens as it was saved, with the same programs whatever the layout', () => {
    const doc = newDoc(game);
    expect(doc.sprites.find((s) => s.id === doc.selected)?.art).toBe(game.cover);
    const again = parseDoc(clone(doc), game)!;
    expect(programOf(again)).toEqual(programOf(doc));
    programOf(doc).sprites.forEach((s, i) => expect(s.scripts).toHaveLength(game.setup.sprites[i].scripts.length));
  });
});
