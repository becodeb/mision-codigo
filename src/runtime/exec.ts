/**
 * Statement interpreter. Every script runs as a generator: it yields to wait, and the machine resumes
 * it on a later frame. A yielded function is a wake condition; a bare `yield` waits one frame.
 * Every loop yields once per iteration, so no script can hold a frame forever.
 */
import { blockInfo } from '../language/catalog.ts';
import type { Block } from '../language/ir.ts';
import { PHRASE } from '../language/options.ts';
import { arg, argNum, argStr } from './expr.ts';
import { bounceOffEdges, clampXY, setDir } from './geometry.ts';
import type { SpriteInstance } from './instance.ts';
import type { Machine } from './machine.ts';
import { MAX_LIST, clamp, cleanSpeech, ease, lerp, round6, toBool, toNum, toStr, type Value } from './values.ts';

export type Wake = () => boolean;
export type Step = Generator<Wake | undefined, void, undefined>;

export interface Thread {
  /** `instance id : script index`; starting a script with a live key restarts it. */
  key: string;
  inst: SpriteInstance;
  dead: boolean;
  wake: Wake | null;
  gen: Step | null;
}

/** Longest repeat count, as in the old engine. */
export const REPEAT_CAP = 500;

export function* runList(m: Machine, th: Thread, list: readonly Block[]): Step {
  for (const b of list) {
    if (th.dead) return;
    yield* runBlock(m, th, b);
  }
}

function* runBlock(m: Machine, th: Thread, b: Block): Step {
  const info = blockInfo(b.type);
  if (!info || info.kind !== 'command') return;
  for (const c of info.cats) m.stats.op(c, th.inst.spriteId);
  m.stats.blockRun(th.inst.spriteId, scriptIndex(th), b.type);
  if (b.id) m.host.highlight(th.inst.spriteId, b.id, true);
  yield* execute(m, th, b);
  if (b.id) m.host.highlight(th.inst.spriteId, b.id, false);
}

/** Position of the thread's script among its sprite's scripts. */
export const scriptIndex = (th: Thread): number => Number(th.key.slice(th.key.lastIndexOf(':') + 1));

function* waitMs(m: Machine, ms: number): Step {
  if (ms <= 0) return;
  const end = m.time.now() + ms;
  yield () => m.time.now() >= end;
}

/** Calls `fn(t)` with t from 0 to 1 over `ms`, once per frame, ending with t = 1. */
function* tween(m: Machine, ms: number, fn: (t: number) => void): Step {
  const t0 = m.time.now();
  for (;;) {
    yield;
    const t = ms <= 0 ? 1 : Math.min(1, (m.time.now() - t0) / ms);
    fn(t);
    m.dirty = true;
    if (t >= 1) return;
  }
}

function place(m: Machine, s: SpriteInstance, x: number, y: number): void {
  const [cx, cy] = clampXY(x, y);
  s.x = round6(cx);
  s.y = round6(cy);
  m.stats.sample(`${s.isClone ? 'cy' : 'y'}|${s.spriteId}`, s.y);
  m.stats.sample(`${s.isClone ? 'cx' : 'x'}|${s.spriteId}`, s.x);
  m.dirty = true;
}

function* glideTo(m: Machine, s: SpriteInstance, x: number, y: number, ms: number, bob = false): Step {
  const x0 = s.x;
  const y0 = s.y;
  const [tx, ty] = clampXY(x, y);
  yield* tween(m, ms, (t) => {
    const e = ease(t);
    s.x = lerp(x0, tx, e);
    s.y = lerp(y0, ty, e);
    if (bob) s.bob = Math.abs(Math.sin(t * Math.PI * 2)) * 6;
  });
  s.bob = 0;
}

function* sayFor(m: Machine, th: Thread, text: string, secs: number | null, kind: 'say' | 'think' = 'say'): Step {
  const s = th.inst;
  const token = {};
  s.bubble = { text, kind, token };
  m.dirty = true;
  let voiced = false;
  if (kind === 'say') {
    try {
      m.host.speak(text, { pitch: s.art.pitch, rate: s.art.rate }).then((ok) => { voiced = ok; }, () => {});
    } catch { /* a broken voice must not stop the story */ }
  }
  if (secs === null) {
    /* Wait for the voice, but never past a duration estimate: no voice means no blocking. */
    const est = 1000 + cleanSpeech(text).length * 75;
    const t0 = m.time.now();
    yield () => {
      const t = m.time.now();
      return t >= t0 + Math.min(est, 1600) && (voiced || t >= t0 + est);
    };
    yield* waitMs(m, 300);
  } else {
    yield* waitMs(m, Math.max(0, secs) * 1000);
  }
  if (s.bubble && s.bubble.token === token) {
    s.bubble = null;
    m.dirty = true;
  }
}

const msgOf = (b: Block): string => String(b.fields.M ?? b.fields.C ?? '');

function* execute(m: Machine, th: Thread, b: Block): Step {
  const s = th.inst;
  const n = (key: string): number => argNum(m, s, b, key);
  const f = b.fields;
  switch (b.type) {
    /* ---- speech ---- */
    case 'f_say': yield* sayFor(m, th, PHRASE[String(f.P)] ?? '¡Hola!', null); break;
    case 'f_text': yield* sayFor(m, th, toStr(f.T) || '...', null); break;
    case 'a_say': {
      const t = argStr(m, s, b, 'T');
      s.bubble = t ? { text: t, kind: 'say', token: {} } : null;
      if (t) { try { m.host.speak(t, { pitch: s.art.pitch, rate: s.art.rate }).catch(() => {}); } catch { /* ignore */ } }
      m.dirty = true;
      yield;
      break;
    }
    case 'a_sayfor': yield* sayFor(m, th, argStr(m, s, b, 'T'), n('S')); break;
    case 'a_thinkfor': yield* sayFor(m, th, argStr(m, s, b, 'T'), n('S'), 'think'); break;

    /* ---- picture-tier movement ---- */
    case 'f_right': setDir(s, 90); m.host.sfx('step'); yield* glideTo(m, s, s.x + 50, s.y, 380, true); break;
    case 'f_left': setDir(s, -90); m.host.sfx('step'); yield* glideTo(m, s, s.x - 50, s.y, 380, true); break;
    case 'f_up': m.host.sfx('step'); yield* glideTo(m, s, s.x, s.y + 40, 380, true); break;
    case 'f_down': m.host.sfx('step'); yield* glideTo(m, s, s.x, s.y - 40, 380, true); break;
    case 'f_jump': case 'a_jump':
      m.host.sfx('jump');
      yield* tween(m, 520, (t) => { s.jy = 4 * 70 * t * (1 - t); });
      s.jy = 0;
      break;
    case 'f_spin':
      m.host.sfx('boing');
      yield* tween(m, 650, (t) => { s.rot = 360 * ease(t); });
      s.rot = 0;
      break;
    case 'f_grow': case 'f_shrink': {
      const s0 = s.size;
      const s1 = clamp(b.type === 'f_grow' ? s0 * 1.25 : s0 / 1.25, 30, 260);
      m.host.sfx('pop');
      yield* tween(m, 300, (t) => { s.size = lerp(s0, s1, t); });
      break;
    }
    case 'f_face': setFace(m, s, f.E); yield* waitMs(m, 350); yield; break;
    case 'f_sound': m.host.sfx(String(f.S)); yield* waitMs(m, 500); break;
    case 'f_note': m.host.note(String(f.S)); yield* waitMs(m, 500); break;
    case 'f_wait': yield* waitMs(m, n('N') * 1000); break;
    case 'f_hide': s.visible = false; m.dirty = true; yield; break;
    case 'f_show': s.visible = true; m.dirty = true; yield; break;
    case 'f_random': case 'a_random': place(m, s, m.rng() * 400 - 200, m.rng() * 230 - 160); yield; break;
    case 'f_backdrop': case 'a_backdrop': m.backdrop = String(f.B ?? m.backdrop); m.dirty = true; yield; break;
    case 'f_star': m.setScore((m.score ?? 0) + 1); m.host.sfx('pop'); break;
    case 'f_send': case 'a_send': m.broadcast(msgOf(b)); yield; break;

    /* ---- text-tier motion ---- */
    case 'a_move': {
      const r = (s.dir * Math.PI) / 180;
      const k = n('N');
      place(m, s, s.x + Math.sin(r) * k, s.y + Math.cos(r) * k);
      yield;
      break;
    }
    case 'a_point': setDir(s, Number(f.D)); m.dirty = true; yield; break;
    case 'a_pointdeg': setDir(s, n('A')); m.dirty = true; yield; break;
    case 'a_turn': setDir(s, s.dir + n('A')); m.dirty = true; yield; break;
    case 'a_pointto': {
      const t = m.findInstance(String(f.T), s);
      if (t && (t.x !== s.x || t.y !== s.y)) setDir(s, (Math.atan2(t.x - s.x, t.y - s.y) * 180) / Math.PI);
      m.dirty = true;
      yield;
      break;
    }
    case 'a_changex': {
      const dx = n('N');
      place(m, s, s.x + dx, s.y);
      if (dx) s.flip = dx > 0 ? 1 : -1;
      yield;
      break;
    }
    case 'a_changey': {
      const dy = n('N');
      m.stats.sample(`changey|${s.spriteId}#${scriptIndex(th)}`, dy);
      place(m, s, s.x, s.y + dy);
      yield;
      break;
    }
    case 'a_setx': place(m, s, n('X'), s.y); yield; break;
    case 'a_sety': place(m, s, s.x, n('Y')); yield; break;
    case 'a_goto': place(m, s, n('X'), n('Y')); yield; break;
    case 'a_gotosprite': {
      const t = m.findInstance(String(f.T), s);
      if (t) place(m, s, t.x, t.y);
      yield;
      break;
    }
    case 'a_glide': {
      const tx = n('X');
      if (tx !== s.x) s.flip = tx > s.x ? 1 : -1;
      yield* glideTo(m, s, tx, n('Y'), Math.max(0, n('T')) * 1000);
      break;
    }
    case 'a_arrows': {
      const speed = n('N');
      let dx = 0;
      let dy = 0;
      if (m.keys.has('ArrowRight')) dx += speed;
      if (m.keys.has('ArrowLeft')) dx -= speed;
      if (m.keys.has('ArrowUp')) dy += speed;
      if (m.keys.has('ArrowDown')) dy -= speed;
      if (dx > 0) setDir(s, 90);
      else if (dx < 0) setDir(s, -90);
      place(m, s, s.x + dx, s.y + dy);
      yield;
      break;
    }
    case 'a_bounce': bounceOffEdges(s); place(m, s, s.x, s.y); yield; break;

    /* ---- text-tier looks and sound ---- */
    case 'a_face': setFace(m, s, f.E); yield; break;
    case 'a_changesize': s.size = clamp(s.size + n('N'), 10, 300); m.dirty = true; yield; break;
    case 'a_setsize': s.size = clamp(n('N'), 10, 300); m.dirty = true; yield; break;
    case 'a_show': s.visible = true; m.dirty = true; yield; break;
    case 'a_hide': s.visible = false; m.dirty = true; yield; break;
    case 'a_sound': m.host.sfx(String(f.S)); break;
    case 'a_note': m.host.note(String(f.S)); yield; break;

    /* ---- control ---- */
    case 'a_wait': {
      const secs = n('N');
      m.stats.sample(`wait|${s.spriteId}#${scriptIndex(th)}`, secs);
      yield* waitMs(m, secs * 1000);
      break;
    }
    case 'f_repeat': case 'a_repeat': {
      const k = Math.min(REPEAT_CAP, Math.max(0, Math.floor(n('N'))));
      for (let i = 0; i < k && !th.dead; i++) {
        yield* runList(m, th, b.body);
        yield;
      }
      break;
    }
    case 'a_forever':
      while (!th.dead) {
        yield* runList(m, th, b.body);
        yield;
      }
      break;
    case 'a_if': if (toBool(arg(m, s, b, 'C', false))) yield* runList(m, th, b.body); break;
    case 'a_ifelse': yield* runList(m, th, toBool(arg(m, s, b, 'C', false)) ? b.body : b.elseBody); break;
    case 'a_repeatuntil':
      while (!th.dead && !toBool(arg(m, s, b, 'C', false))) {
        yield* runList(m, th, b.body);
        yield;
      }
      break;
    case 'a_waituntil':
      while (!th.dead && !toBool(arg(m, s, b, 'C', false))) yield;
      break;
    case 'a_stop': m.stopAll(); break;
    case 'a_stopthis': m.kill(th); break;
    case 'a_stopothers': m.killOthers(th); break;
    case 'a_win': m.finish('win'); break;
    case 'a_lose': m.finish('lose'); break;
    case 'a_clone': m.createClone(s, f.T === undefined ? undefined : String(f.T)); yield; break;
    case 'a_delclone': m.removeClone(s); break;

    /* ---- points, variables, lists ---- */
    case 'a_setscore': m.setScore(n('N')); break;
    case 'a_addscore': m.setScore((m.score ?? 0) + n('N')); break;
    case 'a_setvar': setVariable(m, String(f.NAME), arg(m, s, b, 'V')); break;
    case 'a_changevar': setVariable(m, String(f.NAME), toNum(m.vars.get(String(f.NAME))) + n('V')); break;
    case 'a_listadd': {
      const list = m.listNamed(String(f.LIST));
      if (list.length < MAX_LIST) list.push(arg(m, s, b, 'V'));
      m.dirty = true;
      break;
    }
    case 'a_listdel': {
      const list = m.listNamed(String(f.LIST));
      const i = Math.floor(n('I'));
      if (i >= 1 && i <= list.length) list.splice(i - 1, 1);
      m.dirty = true;
      break;
    }
    case 'a_listclear': m.listNamed(String(f.LIST)).length = 0; m.dirty = true; break;
    case 'a_listset': {
      const list = m.listNamed(String(f.LIST));
      const i = Math.floor(n('I'));
      if (i >= 1 && i <= list.length) list[i - 1] = arg(m, s, b, 'V');
      m.dirty = true;
      break;
    }
    case 'a_ask': {
      let done = false;
      let reply = '';
      m.host.ask(argStr(m, s, b, 'T')).then((a) => { reply = a; done = true; }, () => { done = true; });
      yield () => done;
      if (!th.dead) m.answer = reply;
      break;
    }
    default:
      /* Hats and values in statement position do nothing. */
      break;
  }
}

/** Objects have no face, so the face block leaves them alone. */
function setFace(m: Machine, s: SpriteInstance, face: unknown): void {
  if (s.art.kind === 'character') {
    /* The face the sprite started with counts as the first one seen, so going back to it is a change. */
    if (!m.stats.sampled(`face|${s.spriteId}`)) m.stats.sample(`face|${s.spriteId}`, s.face);
    s.face = String(face ?? 'feliz');
    m.stats.sample(`face|${s.spriteId}`, s.face);
  }
  m.dirty = true;
}

function setVariable(m: Machine, name: string, value: Value): void {
  m.vars.set(name, value);
  m.stats.sample(`var|${name}`, typeof value === 'number' ? value : String(value));
  m.dirty = true;
}
