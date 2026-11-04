/** Evaluation of value blocks. Values never wait, so this is plain synchronous code. */
import { blockInfo } from '../language/catalog.ts';
import type { Block } from '../language/ir.ts';
import { EDGE } from '../language/options.ts';
import type { SpriteInstance } from './instance.ts';
import type { Machine } from './machine.ts';
import { MAX_TEXT, compare, toBool, toNum, toStr, type Value } from './values.ts';

/** Value of a socket; falls back to a field of the same name (picture-tier blocks use fields). */
export function arg(m: Machine, inst: SpriteInstance, b: Block, key: string, fallback: Value = 0): Value {
  const input = b.inputs[key];
  if (input) return evalBlock(m, inst, input);
  const field = b.fields[key];
  return field !== undefined ? field : fallback;
}

export const argNum = (m: Machine, inst: SpriteInstance, b: Block, key: string): number => toNum(arg(m, inst, b, key));
export const argStr = (m: Machine, inst: SpriteInstance, b: Block, key: string): string => toStr(arg(m, inst, b, key, ''));

function listOf(m: Machine, b: Block): Value[] {
  return m.lists.get(String(b.fields.LIST ?? '')) ?? [];
}

export function evalBlock(m: Machine, inst: SpriteInstance, b: Block): Value {
  const info = blockInfo(b.type);
  if (!info || info.kind !== 'value') return 0;
  for (const c of info.cats) m.stats.op(c, inst.spriteId);
  const A = () => arg(m, inst, b, 'A');
  const B = () => arg(m, inst, b, 'B');
  switch (b.type) {
    case 'v_num': return toNum(b.fields.V);
    case 'v_text': return toStr(b.fields.V);
    case 'v_score': return m.score ?? 0;
    case 'v_touching': return m.touchingTarget(inst, String(b.fields.T ?? EDGE));
    case 'v_key': return m.keys.has(String(b.fields.K ?? ''));
    case 'v_random': return m.random(toNum(A()), toNum(B()));
    case 'v_add': return finite(toNum(A()) + toNum(B()));
    case 'v_sub': return finite(toNum(A()) - toNum(B()));
    case 'v_mul': return finite(toNum(A()) * toNum(B()));
    /* Dividing by zero gives 0 instead of Infinity or NaN, which would poison positions. */
    case 'v_div': { const d = toNum(B()); return d === 0 ? 0 : finite(toNum(A()) / d); }
    case 'v_mod': { const d = toNum(B()); return d === 0 ? 0 : finite(((toNum(A()) % d) + d) % d); }
    case 'v_eq': return compare(A(), B()) === 0;
    case 'v_lt': return compare(A(), B()) < 0;
    case 'v_gt': return compare(A(), B()) > 0;
    case 'v_and': return toBool(A()) && toBool(B());
    case 'v_or': return toBool(A()) || toBool(B());
    case 'v_not': return !toBool(A());
    case 'v_join': return (toStr(A()) + toStr(B())).slice(0, MAX_TEXT);
    case 'v_x': return inst.x;
    case 'v_y': return inst.y;
    case 'v_timer': return m.timerSeconds();
    case 'v_distance': {
      const target = m.findInstance(String(b.fields.T ?? ''), inst);
      return target ? Math.hypot(target.x - inst.x, target.y - inst.y) : 0;
    }
    case 'v_answer': return m.answer;
    case 'v_var': return m.vars.get(String(b.fields.NAME ?? '')) ?? 0;
    case 'v_listitem': {
      const i = Math.floor(toNum(arg(m, inst, b, 'I')));
      return listOf(m, b)[i - 1] ?? '';
    }
    case 'v_listlen': return listOf(m, b).length;
    case 'v_listhas': { const v = arg(m, inst, b, 'V', ''); return listOf(m, b).some((x) => compare(x, v) === 0); }
    default: return 0;
  }
}

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);
