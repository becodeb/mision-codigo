/** Concise builders so games declare code as data: `fFlag(fSay('HOLA'), fRight())`. */
import type { BlockType } from './catalog.ts';
import type { Block, FieldValue, ProjectProgram, Script, SpriteProgram } from './ir.ts';

export interface BlockParts {
  fields?: Record<string, FieldValue>;
  inputs?: Record<string, Block>;
  body?: Block[];
  elseBody?: Block[];
}

export function block(type: BlockType, parts: BlockParts = {}): Block {
  return { type, fields: parts.fields ?? {}, inputs: parts.inputs ?? {}, body: parts.body ?? [], elseBody: parts.elseBody ?? [] };
}

export const num = (value: number): Block => block('v_num', { fields: { V: value } });
export const text = (value: string): Block => block('v_text', { fields: { V: value } });

/** A value socket: numbers and strings become literal blocks. */
export type Arg = number | string | Block;
const val = (a: Arg): Block => (typeof a === 'number' ? num(a) : typeof a === 'string' ? text(a) : a);

const cmd = (type: BlockType, fields: Record<string, FieldValue> = {}, inputs: Record<string, Arg> = {}, body: Block[] = [], elseBody: Block[] = []): Block =>
  block(type, { fields, inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, val(v)])), body, elseBody });

export const script = (hat: Block, body: Block[]): Script => ({ hat, body });

/* ---------- picture tier ---------- */

export const fFlag = (...body: Block[]): Script => script(block('f_flag'), body);
export const fClick = (...body: Block[]): Script => script(block('f_click'), body);
export const fRecv = (color: string, ...body: Block[]): Script => script(block('f_recv', { fields: { C: color } }), body);
export const fSay = (phrase: string): Block => cmd('f_say', { P: phrase });
export const fText = (t: string): Block => cmd('f_text', { T: t });
export const fRight = (): Block => cmd('f_right');
export const fLeft = (): Block => cmd('f_left');
export const fUp = (): Block => cmd('f_up');
export const fDown = (): Block => cmd('f_down');
export const fJump = (): Block => cmd('f_jump');
export const fSpin = (): Block => cmd('f_spin');
export const fFace = (face: string): Block => cmd('f_face', { E: face });
export const fGrow = (): Block => cmd('f_grow');
export const fShrink = (): Block => cmd('f_shrink');
export const fSound = (sound: string): Block => cmd('f_sound', { S: sound });
export const fWait = (seconds: number): Block => cmd('f_wait', { N: seconds });
export const fRepeat = (times: number, ...body: Block[]): Block => cmd('f_repeat', { N: times }, {}, body);
export const fHide = (): Block => cmd('f_hide');
export const fShow = (): Block => cmd('f_show');
export const fNote = (note: string): Block => cmd('f_note', { S: note });
export const fRandom = (): Block => cmd('f_random');
export const fBackdrop = (backdrop: string): Block => cmd('f_backdrop', { B: backdrop });
export const fStar = (): Block => cmd('f_star');
export const fSend = (color: string): Block => cmd('f_send', { C: color });

/* ---------- text tier: hats ---------- */

export const onFlag = (...body: Block[]): Script => script(block('a_flag'), body);
export const onClick = (...body: Block[]): Script => script(block('a_click'), body);
export const onKey = (key: string, ...body: Block[]): Script => script(block('a_key', { fields: { K: key } }), body);
export const onReceive = (message: string, ...body: Block[]): Script => script(block('a_recv', { fields: { M: message } }), body);
export const onPoints = (points: number, ...body: Block[]): Script => script(block('a_points', { fields: { N: points } }), body);
export const onTouching = (target: string, ...body: Block[]): Script => script(block('a_touching', { fields: { T: target } }), body);
export const onCloneStart = (...body: Block[]): Script => script(block('a_clonestart'), body);

/* ---------- text tier: commands ---------- */

export const send = (message: string): Block => cmd('a_send', { M: message });
export const move = (steps: Arg): Block => cmd('a_move', {}, { N: steps });
export const point = (dir: string): Block => cmd('a_point', { D: dir });
export const pointDeg = (angle: Arg): Block => cmd('a_pointdeg', {}, { A: angle });
export const turn = (angle: Arg): Block => cmd('a_turn', {}, { A: angle });
export const pointTowards = (sprite: string): Block => cmd('a_pointto', { T: sprite });
export const changeX = (dx: Arg): Block => cmd('a_changex', {}, { N: dx });
export const changeY = (dy: Arg): Block => cmd('a_changey', {}, { N: dy });
export const setX = (x: Arg): Block => cmd('a_setx', {}, { X: x });
export const setY = (y: Arg): Block => cmd('a_sety', {}, { Y: y });
export const goTo = (x: Arg, y: Arg): Block => cmd('a_goto', {}, { X: x, Y: y });
export const goToSprite = (sprite: string): Block => cmd('a_gotosprite', { T: sprite });
export const goToRandom = (): Block => cmd('a_random');
export const glide = (seconds: Arg, x: Arg, y: Arg): Block => cmd('a_glide', {}, { T: seconds, X: x, Y: y });
export const jump = (): Block => cmd('a_jump');
export const bounce = (): Block => cmd('a_bounce');
export const moveWithArrows = (speed: Arg): Block => cmd('a_arrows', {}, { N: speed });
export const say = (t: Arg): Block => cmd('a_say', {}, { T: t });
export const sayFor = (t: Arg, seconds: Arg): Block => cmd('a_sayfor', {}, { T: t, S: seconds });
export const thinkFor = (t: Arg, seconds: Arg): Block => cmd('a_thinkfor', {}, { T: t, S: seconds });
export const face = (id: string): Block => cmd('a_face', { E: id });
export const changeSize = (delta: Arg): Block => cmd('a_changesize', {}, { N: delta });
export const setSize = (percent: Arg): Block => cmd('a_setsize', {}, { N: percent });
export const show = (): Block => cmd('a_show');
export const hide = (): Block => cmd('a_hide');
export const backdrop = (id: string): Block => cmd('a_backdrop', { B: id });
export const sound = (id: string): Block => cmd('a_sound', { S: id });
export const note = (n: string): Block => cmd('a_note', { S: n });
export const wait = (seconds: Arg): Block => cmd('a_wait', {}, { N: seconds });
export const repeat = (times: Arg, ...body: Block[]): Block => cmd('a_repeat', {}, { N: times }, body);
export const forever = (...body: Block[]): Block => cmd('a_forever', {}, {}, body);
export const ifThen = (cond: Block, ...body: Block[]): Block => cmd('a_if', {}, { C: cond }, body);
export const ifElse = (cond: Block, then: Block[], otherwise: Block[]): Block => cmd('a_ifelse', {}, { C: cond }, then, otherwise);
export const repeatUntil = (cond: Block, ...body: Block[]): Block => cmd('a_repeatuntil', {}, { C: cond }, body);
export const waitUntil = (cond: Block): Block => cmd('a_waituntil', {}, { C: cond });
export const stopAll = (): Block => cmd('a_stop');
export const stopThis = (): Block => cmd('a_stopthis');
export const stopOthers = (): Block => cmd('a_stopothers');
export const win = (): Block => cmd('a_win');
export const lose = (): Block => cmd('a_lose');
export const setScore = (n: Arg): Block => cmd('a_setscore', {}, { N: n });
export const addScore = (n: Arg): Block => cmd('a_addscore', {}, { N: n });
/** `of` is a sprite id; omitted means "myself". */
export const createClone = (of?: string): Block => cmd('a_clone', of ? { T: of } : {});
export const deleteClone = (): Block => cmd('a_delclone');
export const setVar = (name: string, v: Arg): Block => cmd('a_setvar', { NAME: name }, { V: v });
export const changeVar = (name: string, delta: Arg): Block => cmd('a_changevar', { NAME: name }, { V: delta });
export const listAdd = (list: string, v: Arg): Block => cmd('a_listadd', { LIST: list }, { V: v });
export const listDelete = (list: string, index: Arg): Block => cmd('a_listdel', { LIST: list }, { I: index });
export const listClear = (list: string): Block => cmd('a_listclear', { LIST: list });
export const listSet = (list: string, index: Arg, v: Arg): Block => cmd('a_listset', { LIST: list }, { I: index, V: v });
export const ask = (question: Arg): Block => cmd('a_ask', {}, { T: question });

/* ---------- text tier: values ---------- */

export const score = (): Block => cmd('v_score');
export const touching = (target: string): Block => cmd('v_touching', { T: target });
export const keyPressed = (key: string): Block => cmd('v_key', { K: key });
export const randomBetween = (a: Arg, b: Arg): Block => cmd('v_random', {}, { A: a, B: b });
export const add = (a: Arg, b: Arg): Block => cmd('v_add', {}, { A: a, B: b });
export const sub = (a: Arg, b: Arg): Block => cmd('v_sub', {}, { A: a, B: b });
export const mul = (a: Arg, b: Arg): Block => cmd('v_mul', {}, { A: a, B: b });
export const div = (a: Arg, b: Arg): Block => cmd('v_div', {}, { A: a, B: b });
export const mod = (a: Arg, b: Arg): Block => cmd('v_mod', {}, { A: a, B: b });
export const eq = (a: Arg, b: Arg): Block => cmd('v_eq', {}, { A: a, B: b });
export const lt = (a: Arg, b: Arg): Block => cmd('v_lt', {}, { A: a, B: b });
export const gt = (a: Arg, b: Arg): Block => cmd('v_gt', {}, { A: a, B: b });
export const and = (a: Arg, b: Arg): Block => cmd('v_and', {}, { A: a, B: b });
export const or = (a: Arg, b: Arg): Block => cmd('v_or', {}, { A: a, B: b });
export const not = (a: Arg): Block => cmd('v_not', {}, { A: a });
export const join = (a: Arg, b: Arg): Block => cmd('v_join', {}, { A: a, B: b });
export const posX = (): Block => cmd('v_x');
export const posY = (): Block => cmd('v_y');
export const timer = (): Block => cmd('v_timer');
export const distanceTo = (sprite: string): Block => cmd('v_distance', { T: sprite });
export const answer = (): Block => cmd('v_answer');
export const variable = (name: string): Block => cmd('v_var', { NAME: name });
export const listItem = (list: string, index: Arg): Block => cmd('v_listitem', { LIST: list }, { I: index });
export const listLength = (list: string): Block => cmd('v_listlen', { LIST: list });
export const listHas = (list: string, v: Arg): Block => cmd('v_listhas', { LIST: list }, { V: v });

/* ---------- sprites and projects ---------- */

export type SpriteOptions = Partial<Pick<SpriteProgram, 'x' | 'y' | 'size' | 'dir' | 'flip' | 'visible' | 'name'>>;

export function sprite(id: string, art: string, scripts: Script[] = [], opts: SpriteOptions = {}): SpriteProgram {
  return { id, art, name: opts.name ?? id, x: opts.x ?? 0, y: opts.y ?? -110, size: opts.size, dir: opts.dir, flip: opts.flip, visible: opts.visible, scripts };
}

export function project(backdropId: string, sprites: SpriteProgram[], opts: { variables?: string[]; lists?: string[] } = {}): ProjectProgram {
  return { backdrop: backdropId, sprites, variables: opts.variables ?? [], lists: opts.lists ?? [] };
}
