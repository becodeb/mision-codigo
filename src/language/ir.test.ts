import { describe, expect, it } from 'vitest';
import { BLOCKS, blockInfo, blocksForLevel, type BlockType } from './catalog.ts';
import { add, fFlag, fRepeat, fRight, fSay, forever, ifElse, ifThen, num, onFlag, onPoints, onReceive, project, say, sprite, text, touching, eq, sayFor } from './ir.ts';

describe('builders', () => {
  it('make complete blocks', () => {
    expect(fSay('HOLA')).toEqual({ type: 'f_say', fields: { P: 'HOLA' }, inputs: {}, body: [], elseBody: [] });
    expect(num(3)).toEqual({ type: 'v_num', fields: { V: 3 }, inputs: {}, body: [], elseBody: [] });
  });

  it('declare a script as data: hat and body', () => {
    const s = onFlag(say('Hola'), forever(sayFor('otra vez', 2)));
    expect(s.hat.type).toBe('a_flag');
    expect(s.body.map((b) => b.type)).toEqual(['a_say', 'a_forever']);
    expect(s.body[1].body[0].type).toBe('a_sayfor');
  });

  it('turn numbers and strings into literal sockets', () => {
    const say1 = say('Hola');
    expect(say1.inputs.T).toMatchObject({ type: 'v_text', fields: { V: 'Hola' } });
    const sum = add(1, add(2, '3'));
    expect(sum.inputs.A).toMatchObject({ type: 'v_num' });
    expect(sum.inputs.B.inputs.B).toMatchObject({ type: 'v_text', fields: { V: '3' } });
    expect(text('x').type).toBe('v_text');
  });

  it('keep statements in body and else branch apart', () => {
    const b = ifElse(eq(1, 1), [say('si')], [say('no'), say('nunca')]);
    expect(b.body).toHaveLength(1);
    expect(b.elseBody).toHaveLength(2);
    expect(b.inputs.C.type).toBe('v_eq');
    expect(ifThen(touching('x'), say('a')).body).toHaveLength(1);
  });

  it('picture blocks keep their values in fields', () => {
    const s = fFlag(fRepeat(3, fRight()));
    expect(s.hat.type).toBe('f_flag');
    expect(s.body[0]).toMatchObject({ type: 'f_repeat', fields: { N: 3 } });
  });

  it('hats take their parameters as fields', () => {
    expect(onPoints(5).hat.fields.N).toBe(5);
    expect(onReceive('p2').hat.fields.M).toBe('p2');
  });

  it('projects and sprites get sensible defaults', () => {
    const p = project('mar', [sprite('a', 'pulpi')]);
    expect(p).toMatchObject({ backdrop: 'mar', variables: [], lists: [] });
    expect(p.sprites[0]).toMatchObject({ id: 'a', name: 'a', art: 'pulpi', x: 0, y: -110, scripts: [] });
  });
});

describe('catalog', () => {
  const types = Object.keys(BLOCKS) as BlockType[];

  it('every hat names its kind and nothing else does', () => {
    for (const t of types) {
      const info = BLOCKS[t] as { kind: string; hat?: string };
      expect(info.hat !== undefined, t).toBe(info.kind === 'hat');
    }
  });

  it('picture blocks start with f_, text blocks with a_ or v_', () => {
    for (const t of types) expect(t.startsWith(BLOCKS[t].tier === 'picture' ? 'f_' : /^(a|v)_/.test(t) ? t.slice(0, 2) : 'x'), t).toBe(true);
  });

  it('looks up types safely', () => {
    expect(blockInfo('a_move')?.tier).toBe('text');
    expect(blockInfo('nope')).toBeUndefined();
  });

  const has = (level: 1 | 2 | 3 | 4 | 5, type: BlockType) => blocksForLevel(level).includes(type);

  it('level 1 and 2 offer only picture blocks, level 2 adds timing, repeat and messages', () => {
    expect(blocksForLevel(1).every((t) => BLOCKS[t].tier === 'picture')).toBe(true);
    expect(has(1, 'f_flag') && has(1, 'f_say') && has(1, 'f_star') && has(1, 'f_backdrop')).toBe(true);
    expect(has(1, 'f_wait') || has(1, 'f_repeat')).toBe(false);
    expect(has(2, 'f_wait') && has(2, 'f_repeat') && has(2, 'f_send') && has(2, 'f_recv') && has(2, 'f_note')).toBe(true);
  });

  it('level 3: keyboard, coordinates, messages, points trigger, win; no conditionals', () => {
    for (const t of ['a_flag', 'a_click', 'a_key', 'a_recv', 'a_send', 'a_points', 'a_move', 'a_goto', 'a_glide', 'a_wait', 'a_repeat', 'a_win', 'a_setscore', 'a_addscore', 'v_num', 'v_text'] as const) {
      expect(has(3, t), t).toBe(true);
    }
    for (const t of ['a_forever', 'a_if', 'a_lose', 'a_touching', 'v_score', 'v_touching', 'v_key', 'a_stopothers'] as const) expect(has(3, t), t).toBe(false);
    expect(blocksForLevel(3).every((t) => BLOCKS[t].tier === 'text')).toBe(true);
  });

  it('level 4 adds loops, rules, touching and reading points', () => {
    for (const t of ['a_touching', 'a_arrows', 'a_bounce', 'a_gotosprite', 'a_forever', 'a_if', 'a_stop', 'a_stopothers', 'a_lose', 'v_score', 'v_touching', 'v_key'] as const) {
      expect(has(4, t), t).toBe(true);
    }
    for (const t of ['a_ifelse', 'a_setvar', 'a_clone', 'v_random', 'a_ask'] as const) expect(has(4, t), t).toBe(false);
  });

  it('level 5 offers every text block', () => {
    const text = types.filter((t) => BLOCKS[t].tier === 'text');
    expect(blocksForLevel(5).sort()).toEqual(text.sort());
  });
});
