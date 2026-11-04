import { describe, expect, it } from 'vitest';
import type { GameDefinition } from '../games/types.ts';
import * as b from '../language/ir.ts';
import { blocklyToIr } from '../language/convert.ts';
import { Game } from '../runtime/testing.ts';
import { ActiveClock, GuideTracker, flattenSteps, hintRungs } from './guide.ts';
import { DOC_VERSION, addSpriteDoc, newDoc, parseDoc, programOf, usesKeys } from './doc.ts';

const game: GameDefinition = {
  id: 'g',
  level: 3,
  class: 1,
  order: 1,
  kind: 'game',
  title: 'G',
  pitch: '',
  concept: '',
  cover: 'toby',
  setup: b.project('parque', [b.sprite('a', 'toby', [b.onFlag(b.move(10))], { x: -50 }), b.sprite('s', 'star', [], { x: 50 })], { variables: ['v'], lists: ['l'] }),
  toolbox: ['a_flag', 'a_move'],
  phases: [
    {
      title: 'Uno',
      goal: 'g1',
      steps: [
        { id: 's1', title: '1', text: 'x', hints: ['h1', 'h2'], unlock: ['a_say'], check: (ctx) => ctx.stats.ran('say') },
        { id: 's2', title: '2', text: 'x', hints: [], example: [{ sprite: 'a', scripts: [b.onFlag(b.say('hola'))] }], unlock: ['a_wait'], check: (ctx) => ctx.stats.ran('wait') },
      ],
    },
    { title: 'Dos', goal: 'g2', steps: [{ id: 's3', title: '3', text: 'x', hints: [], check: (ctx) => ctx.machine.score === 2 }] },
  ],
  challenges: [],
  solution: { program: b.project('parque', []), play: () => {} },
};

const at = (iso: string) => () => new Date(iso);

describe('guide tracker', () => {
  it('flattens phases into one sequence with positions', () => {
    const flat = flattenSteps(game);
    expect(flat.map((s) => [s.step.id, s.phaseIndex, s.inPhase, s.index])).toEqual([['s1', 0, 0, 0], ['s2', 0, 1, 1], ['s3', 1, 0, 2]]);
  });

  it('completes a step when its check passes, stamps it, and never evaluates it again', () => {
    let calls = 0;
    const counted: GameDefinition = { ...game, phases: [{ ...game.phases[0], steps: [{ ...game.phases[0].steps[0], check: (ctx) => { calls++; return ctx.stats.ran('say'); } }, game.phases[0].steps[1]] }, game.phases[1]] };
    const tracker = new GuideTracker(counted, {}, at('2026-11-04T16:00:00.000Z'));
    const g = new Game(b.project('parque', [b.sprite('a', 'toby', [b.onFlag(b.say('hola'))])]));
    const ctx = { stats: g.machine.stats, program: g.machine.program, machine: g.machine, ui: { backdropChosen: false } };
    expect(tracker.evaluate(ctx)).toEqual([]);
    g.flag();
    g.run(1500);
    const fresh = tracker.evaluate(ctx);
    expect(fresh.map((f) => f.step.id)).toEqual(['s1']);
    const seen = calls;
    tracker.evaluate(ctx);
    expect(calls).toBe(seen);
    expect(tracker.completedList()).toEqual([{ id: 's1', at: '2026-11-04T16:00:00.000Z' }]);
    expect(tracker.active?.step.id).toBe('s2');
    g.machine.dispose();
  });

  it('gives credit for steps built ahead and treats a throwing check as not passed', () => {
    const odd: GameDefinition = { ...game, phases: [{ ...game.phases[0], steps: [{ ...game.phases[0].steps[0], check: () => { throw new Error('bad check'); } }, { ...game.phases[0].steps[1], check: () => true }] }, game.phases[1]] };
    const tracker = new GuideTracker(odd);
    const g = new Game(b.project('parque', []));
    const fresh = tracker.evaluate({ stats: g.machine.stats, program: g.machine.program, machine: g.machine, ui: { backdropChosen: false } });
    expect(fresh.map((f) => f.step.id)).toEqual(['s2']);
    expect(tracker.active?.step.id).toBe('s1');
    g.machine.dispose();
  });

  it('restores progress and resumes on the first step still open', () => {
    const tracker = new GuideTracker(game, { completed: [{ id: 's1', at: 'T1' }, { id: 'unknown', at: 'T2' }] });
    expect(tracker.completedList()).toEqual([{ id: 's1', at: 'T1' }]);
    expect(tracker.active?.step.id).toBe('s2');
    expect(tracker.progress(41.6)).toEqual({ currentStep: 's2', completedSteps: [{ id: 's1', at: 'T1' }], activeSeconds: 42, finished: false });
  });

  it('unlocks blocks up to the active step and everything once finished', () => {
    const tracker = new GuideTracker(game);
    expect(tracker.unlockedBlocks().sort()).toEqual(['a_flag', 'a_move', 'a_say']);
    const done = new GuideTracker(game, { completed: [{ id: 's1', at: 't' }, { id: 's2', at: 't' }, { id: 's3', at: 't' }] });
    expect(done.finished).toBe(true);
    expect(done.progress(0)).toMatchObject({ currentStep: null, finished: true });
    expect(done.unlockedBlocks().sort()).toEqual(['a_flag', 'a_move', 'a_say', 'a_wait']);
  });

  it('lets a step be skipped without completing it, and finishes when none is left', () => {
    const tracker = new GuideTracker(game, { completed: [{ id: 's1', at: 't' }, { id: 's3', at: 't' }] });
    expect(tracker.skip('s2')).toBe(true);
    expect(tracker.finished).toBe(true);
    expect(tracker.completedList().map((c) => c.id)).toEqual(['s1', 's3']);
    expect(tracker.skippedIds()).toEqual(['s2']);
    expect(tracker.skip('s1')).toBe(false);
    const again = new GuideTracker(game, { completed: tracker.completedList(), skipped: tracker.skippedIds() });
    expect(again.finished).toBe(true);
  });

  it('reports phase progress and closure', () => {
    const tracker = new GuideTracker(game, { completed: [{ id: 's1', at: 't' }] });
    expect(tracker.phaseProgress(0)).toEqual({ done: 1, total: 2 });
    expect(tracker.phaseClosed(0)).toBe(false);
    tracker.skip('s2');
    expect(tracker.phaseClosed(0)).toBe(true);
  });

  it('has no guide for the free project', () => {
    const tracker = new GuideTracker(null);
    expect(tracker.hasGuide).toBe(false);
    expect(tracker.finished).toBe(false);
    expect(tracker.progress(5)).toEqual({ currentStep: null, completedSteps: [], activeSeconds: 5, finished: false });
  });

  it('counts the hint ladder: each hint, then the example', () => {
    expect(hintRungs(game.phases[0].steps[0])).toBe(2);
    expect(hintRungs(game.phases[0].steps[1])).toBe(1);
    expect(hintRungs(game.phases[1].steps[0])).toBe(0);
  });
});

describe('active time', () => {
  it('counts only visible seconds with input in the last minute', () => {
    let now = 0;
    const clock = new ActiveClock(10, () => now);
    clock.tick(true);
    expect(clock.total).toBe(10);
    now = 1000;
    clock.input();
    clock.tick(true);
    clock.tick(false);
    expect(clock.total).toBe(11);
    now = 61_000;
    clock.tick(true);
    expect(clock.total).toBe(12);
    now = 61_001;
    clock.tick(true);
    expect(clock.total).toBe(12);
  });
});

describe('project document', () => {
  it('builds from the game setup, turning scripts into Blockly state', () => {
    const doc = newDoc(game);
    expect(doc.version).toBe(DOC_VERSION);
    expect(doc.sprites.map((s) => [s.id, s.x])).toEqual([['a', -50], ['s', 50]]);
    expect(doc.variables).toEqual(['v']);
    expect(doc.lists).toEqual(['l']);
    expect(doc.selected).toBe('a');
    expect(blocklyToIr(doc.sprites[0].code)[0].body[0].type).toBe('a_move');
    expect(doc.sprites[1].code).toBeNull();
  });

  it('starts the free project empty', () => {
    const doc = newDoc(null);
    expect(doc).toMatchObject({ gameId: null, backdrop: 'parque', sprites: [], selected: null });
  });

  it('survives JSON and restores exactly, including sprite positions', () => {
    const doc = newDoc(game);
    doc.sprites[0].x = 77;
    doc.ui.hints.s1 = 2;
    doc.ui.sound = false;
    const back = parseDoc(JSON.parse(JSON.stringify(doc)), game)!;
    expect(back).toEqual(doc);
    expect(programOf(back).sprites[0]).toMatchObject({ id: 'a', x: 77, scripts: [{ hat: { type: 'a_flag' } }] });
  });

  it('refuses a document that is not ours, or belongs to another game', () => {
    expect(parseDoc(null, game)).toBeNull();
    expect(parseDoc({ version: 99, sprites: [] }, game)).toBeNull();
    expect(parseDoc(JSON.parse(JSON.stringify(newDoc(game))), null)).toBeNull();
    expect(parseDoc({ version: 1, gameId: 'g', sprites: 'x' }, game)).toBeNull();
  });

  it('repairs missing pieces of an old document instead of throwing', () => {
    const doc = parseDoc({ version: 1, gameId: 'g', sprites: [{ id: 'z', art: 'michi' }, { nope: 1 }] }, game)!;
    expect(doc.sprites).toHaveLength(1);
    expect(doc.sprites[0]).toMatchObject({ name: 'Michi', size: 100, visible: true, code: null });
    expect(doc.selected).toBe('z');
    expect(doc.ui.nextId).toBe(1);
  });

  it('keeps the tapped-a-place flag, and infers it for older projects that already changed place', () => {
    const doc = newDoc(game);
    expect(doc.ui.backdropChosen).toBe(false);
    doc.ui.backdropChosen = true;
    expect(parseDoc(JSON.parse(JSON.stringify(doc)), game)!.ui.backdropChosen).toBe(true);
    const untouched = JSON.parse(JSON.stringify(newDoc(game)));
    delete untouched.ui.backdropChosen;
    expect(parseDoc(untouched, game)!.ui.backdropChosen).toBe(false);
    const moved = { ...untouched, backdrop: 'mar' };
    expect(parseDoc(moved, game)!.ui.backdropChosen).toBe(true);
  });

  it('adds sprites with fresh ids, unique names and a starter hat', () => {
    const doc = newDoc(game);
    const one = addSpriteDoc(doc, 'toby', 'text');
    const two = addSpriteDoc(doc, 'toby', 'picture');
    expect(one.name).toBe('Toby');
    expect(two.name).toBe('Toby 2');
    expect(new Set(doc.sprites.map((s) => s.id)).size).toBe(doc.sprites.length);
    expect(blocklyToIr(one.code)[0].hat.type).toBe('a_flag');
    expect(blocklyToIr(two.code)[0].hat.type).toBe('f_flag');
    expect(doc.selected).toBe(two.id);
  });

  it('detects projects that read the keyboard', () => {
    expect(usesKeys(b.project('parque', [b.sprite('a', 'toby', [b.onFlag(b.move(1))])]))).toBe(false);
    expect(usesKeys(b.project('parque', [b.sprite('a', 'toby', [b.onKey('ArrowUp', b.jump())])]))).toBe(true);
    expect(usesKeys(b.project('parque', [b.sprite('a', 'toby', [b.onFlag(b.forever(b.ifThen(b.keyPressed(' '), b.jump())))])]))).toBe(true);
    expect(usesKeys(b.project('parque', [b.sprite('a', 'toby', [b.onFlag(b.moveWithArrows(3))])]))).toBe(true);
  });
});
