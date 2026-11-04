import { describe, expect, it } from 'vitest';
import {
  addScore, changeVar, fClick, fFlag, fNote, fRepeat, fRight, fSay, fSpin, forever, goToRandom, moveWithArrows, onClick, onFlag, onKey, onTouching,
  sayFor, setVar, wait,
  type Block, type Script,
} from '../language/ir.ts';
import { describePlan, planDemo, tryTarget, type DemoGoal, type DemoPlan, type SpriteView } from './demoPlan.ts';

/** Gives every block of a script an id, like the workspace does, so plans can point at them. */
function withIds(scripts: Script[], prefix = 'b'): Script[] {
  let n = 0;
  const mark = (b: Block): Block => {
    b.id = `${prefix}${++n}`;
    b.body.forEach(mark);
    b.elseBody.forEach(mark);
    return b;
  };
  return scripts.map((s) => ({ hat: mark(s.hat), body: s.body.map(mark) }));
}

const sprite = (id: string, scripts: Script[], over: Partial<SpriteView> = {}): SpriteView => ({
  id, name: id.toUpperCase(), art: 'pulpi', kind: 'character', scripts: withIds(scripts, id + '.'), ...over,
});

const goal = (scripts: Script | Script[], extra: Partial<DemoGoal> = {}): DemoGoal => ({ scripts: Array.isArray(scripts) ? scripts : [scripts], ...extra });

const plan = (g: DemoGoal, sprites: SpriteView[], selected: string | null = sprites[0]?.id ?? null): DemoPlan => planDemo(g, sprites, selected);

describe('planDemo: the event block is missing', () => {
  it('brings the right hat when the sprite only has the flag', () => {
    const p = plan(goal(onClick(addScore(1))), [sprite('p', [onFlag()])]);
    expect(p).toMatchObject({ kind: 'hat', reason: 'missing', hat: { type: 'a_click' } });
  });

  it('brings the hat when the work area is empty', () => {
    const p = plan(goal(onClick(addScore(1))), [sprite('p', [])]);
    expect(p).toMatchObject({ kind: 'hat', hat: { type: 'a_click' } });
  });

  it('never targets the flag for a tap step, even if the flag has the wanted block', () => {
    const p = plan(goal(onClick(sayFor('hola', 1))), [sprite('p', [onFlag(sayFor('hola', 1))])]);
    expect(p.kind).toBe('hat');
  });

  it('says in words that something goes below', () => {
    const p = plan(goal(onClick(addScore(1))), [sprite('p', [])]);
    expect(describePlan(p)).toContain('Ahora poné algo abajo');
  });
});

describe('planDemo: the event block is there', () => {
  it('drops the next block under the childs own event, not under the flag', () => {
    const s = sprite('p', [onFlag(setVar('x', 1)), onClick()]);
    const p = plan(goal(onClick(sayFor('hola', 1))), [s]);
    expect(p).toMatchObject({ kind: 'block', block: { type: 'a_sayfor' }, slot: { parent: s.scripts[1].hat.id, kind: 'next' } });
  });

  it('continues from the first part: the second block goes under the first', () => {
    const s = sprite('p', [onClick(sayFor('hola', 1))]);
    const p = plan(goal(onClick(sayFor('hola', 1), addScore(1))), [s]);
    expect(p).toMatchObject({ kind: 'block', block: { type: 'a_addscore' }, slot: { parent: s.scripts[0].body[0].id, kind: 'next' } });
  });

  it('matches by block type, not by field values', () => {
    const p = plan(goal(onClick(addScore(1))), [sprite('p', [onClick(addScore(5))])]);
    expect(p.kind).toBe('try');
  });

  it('with several hats of the type, uses the one that is closest to done', () => {
    const near = onClick(sayFor('a', 1));
    const far = onClick();
    const s = sprite('p', [far, near]);
    const p = plan(goal(onClick(sayFor('a', 1), addScore(1))), [s]);
    expect(p).toMatchObject({ kind: 'block', slot: { parent: s.scripts[1].body[0].id } });
  });

  it('puts a missing block before one that has to come after it', () => {
    const s = sprite('p', [fFlag(fRepeat(5, fRight()))]);
    const p = plan(goal(fFlag(fSay('JUGAR'), fRepeat(5, fRight()))), [s]);
    expect(p).toMatchObject({ kind: 'block', block: { type: 'f_say' }, slot: { parent: s.scripts[0].hat.id, kind: 'next' } });
  });

  it('puts a missing block between the ones that surround it', () => {
    const s = sprite('p', [fClick(fNote('do'), fNote('mi'), fNote('sol'))]);
    const p = plan(goal(fClick(fNote('do'), fSpin(), fNote('mi'))), [s]);
    expect(p).toMatchObject({ kind: 'block', block: { type: 'f_spin' }, slot: { parent: s.scripts[0].body[0].id } });
  });

  it('counts repeated blocks: three arrows need three', () => {
    const s = sprite('p', [fFlag(fRight(), fRight())]);
    const p = plan(goal(fFlag(fRight(), fRight(), fRight())), [s]);
    expect(p).toMatchObject({ kind: 'block', block: { type: 'f_right' }, slot: { parent: s.scripts[0].body[1].id } });
  });

  it('fills the inside of a C block the child already has', () => {
    const s = sprite('p', [onFlag(forever())]);
    const p = plan(goal(onFlag(forever(moveWithArrows(5)))), [s]);
    expect(p).toMatchObject({ kind: 'block', block: { type: 'a_arrows' }, slot: { parent: s.scripts[0].body[0].id, kind: 'do' } });
  });

  it('adds the C block first and its insides on the next press', () => {
    const empty = sprite('p', [onFlag()]);
    expect(plan(goal(onFlag(forever(moveWithArrows(5)))), [empty])).toMatchObject({ kind: 'block', block: { type: 'a_forever' } });
  });

  it('does not pour a clock into the loop that moves the hero', () => {
    const s = sprite('p', [onFlag(setVar('t', 30), forever(moveWithArrows(5)))]);
    const p = plan(goal(onFlag(forever(wait(1), changeVar('t', -1)))), [s]);
    /* The only flag program ends in «por siempre»: nothing can go below it, so the clock gets its own program. */
    expect(p).toMatchObject({ kind: 'hat', reason: 'blocked', hat: { type: 'a_flag' } });
  });

  it('after the second program exists, builds the clock in it', () => {
    const s = sprite('p', [onFlag(setVar('t', 30), forever(moveWithArrows(5))), onFlag()]);
    const p = plan(goal(onFlag(forever(wait(1), changeVar('t', -1)))), [s]);
    expect(p).toMatchObject({ kind: 'block', block: { type: 'a_forever' }, slot: { parent: s.scripts[1].hat.id, kind: 'next' } });
  });

  it('puts a block that ends a program before the loop only when nothing would be left after it', () => {
    const s = sprite('p', [onFlag(setVar('t', 1))]);
    expect(plan(goal(onFlag(setVar('t', 1), forever(wait(1)))), [s])).toMatchObject({ kind: 'block', block: { type: 'a_forever' }, slot: { parent: s.scripts[0].body[0].id } });
    const t = sprite('p', [onFlag(forever(wait(1)))]);
    expect(plan(goal(onFlag(setVar('t', 1), forever(wait(1)))), [t])).toMatchObject({ kind: 'block', block: { type: 'a_setvar' }, slot: { parent: t.scripts[0].hat.id } });
  });

  it('tells keys apart: the left arrow is not the right arrow', () => {
    const s = sprite('p', [onKey('ArrowRight', addScore(1))]);
    expect(plan(goal(onKey('ArrowLeft', addScore(1))), [s])).toMatchObject({ kind: 'hat', hat: { type: 'a_key' } });
    expect(plan(goal(onKey('ArrowRight', addScore(1))), [s]).kind).toBe('try');
  });

  it('uses a key hat that was just dropped and not set yet', () => {
    const s = sprite('p', [onKey('ArrowRight', addScore(1)), onKey('ArrowRight')]);
    expect(plan(goal(onKey('ArrowLeft', addScore(1))), [s])).toMatchObject({ kind: 'block', slot: { parent: s.scripts[1].hat.id } });
  });

  it('asks for the second of two events once the first is done', () => {
    const g = goal([onKey('ArrowUp', addScore(1)), onKey('ArrowDown', addScore(1))]);
    const s = sprite('p', [onKey('ArrowUp', addScore(1))]);
    expect(plan(g, [s])).toMatchObject({ kind: 'hat', hat: { type: 'a_key', fields: { K: 'ArrowDown' } } });
  });

  it('does not crash on a goal with no blocks under the hat', () => {
    expect(plan(goal(onClick()), [sprite('p', [onClick()])]).kind).toBe('try');
  });
});

describe('planDemo: everything is built', () => {
  const full = (g: Script, built: Script) => plan(goal(g), [sprite('p', [built])]);

  it('flag: points at the flag', () => {
    const p = full(onFlag(addScore(1)), onFlag(addScore(1)));
    expect(p).toMatchObject({ kind: 'try', spriteId: 'p' });
    expect(tryTarget((p as Extract<DemoPlan, { kind: 'try' }>).hat, 'p').target).toBe('flag');
  });

  it('tap: points at the sprite on the stage', () => {
    const p = full(onClick(addScore(1)), onClick(addScore(1))) as Extract<DemoPlan, { kind: 'try' }>;
    expect(tryTarget(p.hat, p.spriteId)).toMatchObject({ target: 'sprite', caption: expect.stringContaining('personaje') });
  });

  it('key: names the key', () => {
    const p = full(onKey('ArrowLeft', addScore(1)), onKey('ArrowLeft', addScore(1))) as Extract<DemoPlan, { kind: 'try' }>;
    expect(tryTarget(p.hat, p.spriteId)).toMatchObject({ target: 'keys', caption: 'Apretá la tecla flecha izquierda.' });
    expect(tryTarget({ ...p.hat, fields: { K: ' ' } }, 'p').caption).toContain('espacio');
  });

  it('touching: asks for the two to meet', () => {
    const p = full(onTouching('x', addScore(1)), onTouching('x', addScore(1))) as Extract<DemoPlan, { kind: 'try' }>;
    expect(tryTarget(p.hat, p.spriteId).target).toBe('stage');
  });
});

describe('planDemo: sprites', () => {
  it('no sprites: points at the add button', () => {
    expect(plan(goal(onFlag(addScore(1))), [], null)).toEqual({ kind: 'add-sprite', reason: 'none' });
  });

  it('the step is for a sprite that is not in the project: points at the add button', () => {
    const p = plan(goal(onFlag(addScore(1)), { sprite: 'estrella' }), [sprite('nova', [onFlag()], { art: 'nova' })]);
    expect(p).toEqual({ kind: 'add-sprite', reason: 'missing' });
  });

  it('the step is for another sprite than the selected one: points at it in the tray first', () => {
    const p = plan(goal(onFlag(addScore(1)), { sprite: 'chispa' }), [sprite('michi', [onFlag()]), sprite('chispa', [onFlag()])], 'michi');
    expect(p).toEqual({ kind: 'select-sprite', spriteId: 'chispa', name: 'CHISPA' });
  });

  it('finds the sprite by id, by art or by kind', () => {
    const sprites = [sprite('s1', [onFlag()], { art: 'apple', kind: 'object' }), sprite('s2', [onFlag()], { art: 'michi', kind: 'character' })];
    expect(plan(goal(onFlag(addScore(1)), { sprite: 'character' }), sprites, 's1')).toMatchObject({ kind: 'select-sprite', spriteId: 's2' });
    expect(plan(goal(onFlag(addScore(1)), { sprite: 'apple' }), sprites, 's2')).toMatchObject({ kind: 'select-sprite', spriteId: 's1' });
    expect(plan(goal(onFlag(addScore(1)), { sprite: 's2' }), sprites, 's2')).toMatchObject({ kind: 'block' });
  });

  it('with the right sprite selected it goes straight to the work', () => {
    const p = plan(goal(onFlag(addScore(1)), { sprite: 'chispa' }), [sprite('michi', [onFlag()]), sprite('chispa', [onFlag()])], 'chispa');
    expect(p.kind).toBe('block');
  });

  it('no sprite selected but some in the project: picks the one the step is about', () => {
    expect(plan(goal(onFlag(addScore(1))), [sprite('a', [onFlag()])], null)).toMatchObject({ kind: 'select-sprite', spriteId: 'a' });
  });

  it('each: finishes the selected sprite, then points at the next one that is not done', () => {
    const g = goal(fFlag(fRepeat(5, fRight())), { each: true });
    const one = sprite('a', [fFlag(fRepeat(5, fRight()))]);
    const two = sprite('b', [fFlag()]);
    expect(plan(g, [one, two], 'a')).toMatchObject({ kind: 'select-sprite', spriteId: 'b' });
    expect(plan(g, [one, two], 'b')).toMatchObject({ kind: 'block', block: { type: 'f_repeat' } });
    const both = [one, sprite('b', [fFlag(fRepeat(5, fRight()))])];
    expect(plan(g, both, 'b')).toMatchObject({ kind: 'try', spriteId: 'b' });
  });

  it('is a pure function of its input', () => {
    const s = [sprite('p', [onClick(sayFor('a', 1))])];
    const g = goal(onClick(sayFor('a', 1), addScore(1)));
    const before = JSON.stringify(s);
    expect(plan(g, s)).toEqual(plan(g, s));
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('describePlan', () => {
  it('has a short caption for every kind of plan', () => {
    const hat = onClick().hat;
    const plans: DemoPlan[] = [
      { kind: 'add-sprite', reason: 'none' },
      { kind: 'add-sprite', reason: 'missing' },
      { kind: 'select-sprite', spriteId: 'a', name: 'Pulpi' },
      { kind: 'hat', hat, reason: 'missing' },
      { kind: 'hat', hat, reason: 'blocked' },
      { kind: 'block', block: goToRandom(), slot: { parent: 'x', kind: 'next' } },
      { kind: 'try', hat, spriteId: 'a' },
    ];
    for (const p of plans) expect(describePlan(p).length, p.kind).toBeGreaterThan(5);
    expect(describePlan(plans[2])).toBe('Primero elegí a Pulpi.');
  });
});

