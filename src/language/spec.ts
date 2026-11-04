/**
 * Shape of every block as plain data: the Blockly definitions (blocks.ts), the toolbox builder and the
 * IR converters are all driven from this one table, so a block cannot exist in one and not another.
 * No Blockly import here: the converters and the tests read it in any environment.
 */
import type { BlockType } from './catalog.ts';
import {
  DIRS, ENVELOPES, FACES_PICTURE, FACES_TEXT, KEYS, MSGS, NOTES, PHRASES, SOUNDS_PICTURE, SOUNDS_TEXT, type Option,
} from './options.ts';

/** Dropdowns whose options come from the project being edited. */
export type DynSource = 'sprites' | 'targets' | 'cloneOf' | 'vars' | 'lists';
/** Dropdowns drawn from the backdrop catalog: thumbnails for the picture tier, names for the text tier. */
export type CatalogSource = 'backdropImages' | 'backdropNames';

export type ArgSpec =
  | { k: 'image'; img: string; w: number; alt: string }
  | { k: 'dd'; name: string; options: readonly Option[] | DynSource | CatalogSource }
  | { k: 'num'; name: string; def: number }
  | { k: 'text'; name: string; def: string }
  | { k: 'tap'; name: string; def: number; min: number; max: number }
  /** A value socket. `shadow` is the literal block that sits in it until something is dropped there. */
  | { k: 'in'; name: string; shadow: 'v_num' | 'v_text' | null; def?: number | string; check?: 'Boolean' };

export type Shape = 'hat' | 'stack' | 'cap' | 'c' | 'ccap' | 'value';

export type Category = 'events' | 'motion' | 'looks' | 'sound' | 'control' | 'sensing' | 'operators' | 'points' | 'variables' | 'lists';

export interface BlockSpec {
  /** Blockly block style (colour) name, defined in themes.ts. */
  style: string;
  /** Text with `%1`, `%2`... pointing into `args`. */
  msg: string;
  args: readonly ArgSpec[];
  /** `c` and `ccap` hold statements in `DO`; `a_ifelse` also holds `ELSE`. */
  shape: Shape;
  /** Value blocks only: the type a socket can check for. `null` fits anywhere. */
  out?: 'Boolean' | 'Number' | 'String' | null;
  elseBody?: boolean;
  /** Text tier only: where the toolbox files it. */
  cat?: Category;
}

const img = (name: string, w = 40, alt = name): ArgSpec => ({ k: 'image', img: name, w, alt });
const dd = (name: string, options: readonly Option[] | DynSource | CatalogSource): ArgSpec => ({ k: 'dd', name, options });
const num = (name: string, def: number): ArgSpec => ({ k: 'num', name, def });
const txt = (name: string, def: string): ArgSpec => ({ k: 'text', name, def });
const tap = (name: string, def: number, min: number, max: number): ArgSpec => ({ k: 'tap', name, def, min, max });
const nin = (name: string, def: number): ArgSpec => ({ k: 'in', name, shadow: 'v_num', def });
const tin = (name: string, def: string): ArgSpec => ({ k: 'in', name, shadow: 'v_text', def });
const bin = (name: string): ArgSpec => ({ k: 'in', name, shadow: null, check: 'Boolean' });

const s = (style: string, shape: Shape, msg: string, args: ArgSpec[], extra: Partial<BlockSpec> = {}): BlockSpec => ({ style, shape, msg, args, ...extra });
/** Text tier command in a toolbox category. */
const t = (cat: Category, style: string, shape: Shape, msg: string, args: ArgSpec[] = [], extra: Partial<BlockSpec> = {}): BlockSpec =>
  s(style, shape, msg, args, { cat, ...extra });
const val = (cat: Category, style: string, msg: string, args: ArgSpec[] = [], out: BlockSpec['out'] = null): BlockSpec =>
  t(cat, style, 'value', msg, args, { out });

export const BLOCK_SPECS: Record<BlockType, BlockSpec> = {
  /* ---------- picture tier ---------- */
  f_flag: s('f_event', 'hat', '%1', [img('flag', 44, 'bandera verde')]),
  f_click: s('f_event', 'hat', '%1', [img('tap', 40, 'al tocarme')]),
  f_recv: s('f_msg', 'hat', '%1 %2', [img('recv', 40, 'al recibir'), dd('C', ENVELOPES.map(([, v]) => [{ red: '🟥', blue: '🟦', yellow: '🟨' }[v] ?? v, v] as const))]),
  f_say: s('f_look', 'stack', '%1 %2', [img('say', 40, 'decir'), dd('P', PHRASES)]),
  f_text: s('f_look', 'stack', '%1 %2', [img('write', 40, 'escribir'), txt('T', 'Hola')]),
  f_right: s('f_move', 'stack', '%1', [img('right', 42, 'derecha')]),
  f_left: s('f_move', 'stack', '%1', [img('left', 42, 'izquierda')]),
  f_up: s('f_move', 'stack', '%1', [img('up', 42, 'arriba')]),
  f_down: s('f_move', 'stack', '%1', [img('down', 42, 'abajo')]),
  f_jump: s('f_move', 'stack', '%1', [img('jump', 42, 'saltar')]),
  f_spin: s('f_move', 'stack', '%1', [img('spin', 42, 'girar')]),
  f_face: s('f_look', 'stack', '%1 %2', [img('face', 38, 'cara'), dd('E', FACES_PICTURE)]),
  f_grow: s('f_look', 'stack', '%1', [img('grow', 40, 'agrandar')]),
  f_shrink: s('f_look', 'stack', '%1', [img('shrink', 40, 'achicar')]),
  f_sound: s('f_sound', 'stack', '%1 %2', [img('speaker', 38, 'sonido'), dd('S', SOUNDS_PICTURE)]),
  f_backdrop: s('f_look', 'stack', '%1 %2', [img('backdrop', 38, 'cambiar de lugar'), dd('B', 'backdropImages')]),
  f_star: s('f_score', 'stack', '%1', [img('star', 40, 'una estrella')]),
  f_wait: s('f_ctrl', 'stack', '%1 %2', [img('clock', 38, 'esperar'), tap('N', 1, 1, 5)]),
  f_repeat: s('f_ctrl', 'c', '%1 %2', [img('loop', 38, 'repetir'), tap('N', 2, 2, 9)]),
  f_hide: s('f_look', 'stack', '%1', [img('hide', 40, 'esconderse')]),
  f_show: s('f_look', 'stack', '%1', [img('show', 40, 'aparecer')]),
  f_note: s('f_sound', 'stack', '%1 %2', [img('note', 38, 'nota'), dd('S', NOTES)]),
  f_random: s('f_move', 'stack', '%1', [img('random', 40, 'aparecer en cualquier lugar')]),
  f_send: s('f_msg', 'stack', '%1 %2', [img('send', 40, 'enviar'), dd('C', ENVELOPES.map(([, v]) => [{ red: '🟥', blue: '🟦', yellow: '🟨' }[v] ?? v, v] as const))]),

  /* ---------- text tier: events ---------- */
  a_flag: t('events', 'a_events', 'hat', 'al presionar %1', [img('flagS', 24, 'bandera')]),
  a_click: t('events', 'a_events', 'hat', 'al hacer clic en este personaje'),
  a_key: t('events', 'a_events', 'hat', 'al presionar tecla %1', [dd('K', KEYS)]),
  a_recv: t('events', 'a_events', 'hat', 'al recibir %1', [dd('M', MSGS)]),
  a_points: t('events', 'a_events', 'hat', 'cuando los puntos lleguen a %1', [num('N', 5)]),
  a_touching: t('events', 'a_events', 'hat', 'cuando toque a %1', [dd('T', 'targets')]),
  a_clonestart: t('events', 'a_events', 'hat', 'cuando empiece como clon'),
  a_send: t('events', 'a_events', 'stack', 'enviar %1', [dd('M', MSGS)]),

  /* ---------- text tier: motion ---------- */
  a_move: t('motion', 'a_motion', 'stack', 'mover %1 pasos', [nin('N', 10)]),
  a_point: t('motion', 'a_motion', 'stack', 'apuntar hacia %1', [dd('D', DIRS)]),
  a_pointdeg: t('motion', 'a_motion', 'stack', 'apuntar en dirección %1', [nin('A', 90)]),
  a_turn: t('motion', 'a_motion', 'stack', 'girar %1 grados', [nin('A', 15)]),
  a_pointto: t('motion', 'a_motion', 'stack', 'apuntar hacia %1', [dd('T', 'sprites')]),
  a_changex: t('motion', 'a_motion', 'stack', 'cambiar x en %1', [nin('N', 10)]),
  a_changey: t('motion', 'a_motion', 'stack', 'cambiar y en %1', [nin('N', 10)]),
  a_setx: t('motion', 'a_motion', 'stack', 'fijar x a %1', [nin('X', 0)]),
  a_sety: t('motion', 'a_motion', 'stack', 'fijar y a %1', [nin('Y', -110)]),
  a_goto: t('motion', 'a_motion', 'stack', 'ir a x: %1 y: %2', [nin('X', 0), nin('Y', -110)]),
  a_gotosprite: t('motion', 'a_motion', 'stack', 'ir a %1', [dd('T', 'sprites')]),
  a_random: t('motion', 'a_motion', 'stack', 'ir a posición aleatoria'),
  a_glide: t('motion', 'a_motion', 'stack', 'deslizar en %1 segs a x: %2 y: %3', [nin('T', 1), nin('X', 0), nin('Y', -110)]),
  a_jump: t('motion', 'a_motion', 'stack', 'saltar'),
  a_arrows: t('motion', 'a_motion', 'stack', 'mover con las flechas, velocidad %1', [nin('N', 4)]),
  a_bounce: t('motion', 'a_motion', 'stack', 'rebotar si toca un borde'),

  /* ---------- text tier: looks and sound ---------- */
  a_say: t('looks', 'a_looks', 'stack', 'decir %1', [tin('T', '¡Hola!')]),
  a_sayfor: t('looks', 'a_looks', 'stack', 'decir %1 por %2 segundos', [tin('T', '¡Hola!'), nin('S', 2)]),
  a_thinkfor: t('looks', 'a_looks', 'stack', 'pensar %1 por %2 segundos', [tin('T', 'Mmm...'), nin('S', 2)]),
  a_face: t('looks', 'a_looks', 'stack', 'poner cara %1', [dd('E', FACES_TEXT)]),
  a_changesize: t('looks', 'a_looks', 'stack', 'cambiar tamaño en %1', [nin('N', 10)]),
  a_setsize: t('looks', 'a_looks', 'stack', 'fijar tamaño al %1 %%', [nin('N', 100)]),
  a_show: t('looks', 'a_looks', 'stack', 'mostrar'),
  a_hide: t('looks', 'a_looks', 'stack', 'esconder'),
  a_backdrop: t('looks', 'a_looks', 'stack', 'cambiar escenario a %1', [dd('B', 'backdropNames')]),
  a_sound: t('sound', 'a_sound', 'stack', 'tocar sonido %1', [dd('S', SOUNDS_TEXT)]),
  a_note: t('sound', 'a_sound', 'stack', 'tocar nota %1', [dd('S', NOTES)]),

  /* ---------- text tier: control ---------- */
  a_wait: t('control', 'a_control', 'stack', 'esperar %1 segundos', [nin('N', 1)]),
  a_repeat: t('control', 'a_control', 'c', 'repetir %1 veces', [nin('N', 10)]),
  a_forever: t('control', 'a_control', 'ccap', 'por siempre'),
  a_if: t('control', 'a_control', 'c', 'si %1 entonces', [bin('C')]),
  a_ifelse: t('control', 'a_control', 'c', 'si %1 entonces', [bin('C')], { elseBody: true }),
  a_repeatuntil: t('control', 'a_control', 'c', 'repetir hasta que %1', [bin('C')]),
  a_waituntil: t('control', 'a_control', 'stack', 'esperar hasta que %1', [bin('C')]),
  a_stop: t('control', 'a_control', 'cap', 'detener todo'),
  a_stopthis: t('control', 'a_control', 'cap', 'detener este programa'),
  a_stopothers: t('control', 'a_control', 'stack', 'detener mis otros programas'),
  a_win: t('control', 'a_control', 'stack', '¡ganar!'),
  a_lose: t('control', 'a_control', 'stack', '¡perder!'),
  a_clone: t('control', 'a_control', 'stack', 'crear un clon de %1', [dd('T', 'cloneOf')]),
  a_delclone: t('control', 'a_control', 'cap', 'borrar este clon'),

  /* ---------- text tier: points, variables, lists ---------- */
  a_setscore: t('points', 'a_points', 'stack', 'fijar puntos a %1', [nin('N', 0)]),
  a_addscore: t('points', 'a_points', 'stack', 'sumar %1 a puntos', [nin('N', 1)]),
  a_setvar: t('variables', 'a_vars', 'stack', 'fijar %1 a %2', [dd('NAME', 'vars'), tin('V', '0')]),
  a_changevar: t('variables', 'a_vars', 'stack', 'sumar a %1 el valor %2', [dd('NAME', 'vars'), nin('V', 1)]),
  a_listadd: t('lists', 'a_lists', 'stack', 'agregar %1 a %2', [tin('V', 'cosa'), dd('LIST', 'lists')]),
  a_listdel: t('lists', 'a_lists', 'stack', 'borrar el elemento %1 de %2', [nin('I', 1), dd('LIST', 'lists')]),
  a_listclear: t('lists', 'a_lists', 'stack', 'borrar todo de %1', [dd('LIST', 'lists')]),
  a_listset: t('lists', 'a_lists', 'stack', 'reemplazar el elemento %1 de %2 por %3', [nin('I', 1), dd('LIST', 'lists'), tin('V', 'cosa')]),
  a_ask: t('sensing', 'a_sensing', 'stack', 'preguntar %1 y esperar', [tin('T', '¿Cómo te llamás?')]),

  /* ---------- text tier: values ---------- */
  v_num: s('a_ops', 'value', '%1', [num('V', 0)], { out: 'Number' }),
  v_text: s('a_ops', 'value', '%1', [txt('V', '')], { out: 'String' }),
  v_score: val('points', 'a_points', 'puntos', [], 'Number'),
  v_touching: val('sensing', 'a_sensing', '¿tocando %1?', [dd('T', 'targets')], 'Boolean'),
  v_key: val('sensing', 'a_sensing', '¿tecla %1 presionada?', [dd('K', KEYS)], 'Boolean'),
  v_x: val('sensing', 'a_sensing', 'posición x', [], 'Number'),
  v_y: val('sensing', 'a_sensing', 'posición y', [], 'Number'),
  v_timer: val('sensing', 'a_sensing', 'cronómetro', [], 'Number'),
  v_distance: val('sensing', 'a_sensing', 'distancia a %1', [dd('T', 'sprites')], 'Number'),
  v_answer: val('sensing', 'a_sensing', 'respuesta', []),
  v_random: val('operators', 'a_ops', 'número al azar entre %1 y %2', [nin('A', 1), nin('B', 10)], 'Number'),
  v_add: val('operators', 'a_ops', '%1 + %2', [nin('A', 0), nin('B', 0)], 'Number'),
  v_sub: val('operators', 'a_ops', '%1 − %2', [nin('A', 0), nin('B', 0)], 'Number'),
  v_mul: val('operators', 'a_ops', '%1 × %2', [nin('A', 0), nin('B', 0)], 'Number'),
  v_div: val('operators', 'a_ops', '%1 ÷ %2', [nin('A', 0), nin('B', 1)], 'Number'),
  v_mod: val('operators', 'a_ops', 'resto de %1 ÷ %2', [nin('A', 0), nin('B', 2)], 'Number'),
  v_eq: val('operators', 'a_ops', '%1 = %2', [tin('A', ''), tin('B', '0')], 'Boolean'),
  v_lt: val('operators', 'a_ops', '%1 < %2', [nin('A', 0), nin('B', 10)], 'Boolean'),
  v_gt: val('operators', 'a_ops', '%1 > %2', [nin('A', 0), nin('B', 10)], 'Boolean'),
  v_and: val('operators', 'a_ops', '%1 y %2', [bin('A'), bin('B')], 'Boolean'),
  v_or: val('operators', 'a_ops', '%1 o %2', [bin('A'), bin('B')], 'Boolean'),
  v_not: val('operators', 'a_ops', 'no %1', [bin('A')], 'Boolean'),
  v_join: val('operators', 'a_ops', 'unir %1 con %2', [tin('A', 'hola '), tin('B', 'mundo')], 'String'),
  v_var: val('variables', 'a_vars', '%1', [dd('NAME', 'vars')]),
  v_listitem: val('lists', 'a_lists', 'elemento %1 de %2', [nin('I', 1), dd('LIST', 'lists')]),
  v_listlen: val('lists', 'a_lists', 'largo de %1', [dd('LIST', 'lists')], 'Number'),
  v_listhas: val('lists', 'a_lists', '%1 contiene %2', [dd('LIST', 'lists'), tin('V', 'cosa')], 'Boolean'),
};

/** Where each field of a block lives in the IR. Everything that is not an input is a field. */
export function fieldNames(type: BlockType): string[] {
  return BLOCK_SPECS[type].args.filter((a) => a.k === 'dd' || a.k === 'num' || a.k === 'text' || a.k === 'tap').map((a) => (a as { name: string }).name);
}

export function inputNames(type: BlockType): string[] {
  return BLOCK_SPECS[type].args.filter((a) => a.k === 'in').map((a) => (a as { name: string }).name);
}

/** Blocks that start a script: no previous connection. */
export const isHat = (type: BlockType): boolean => BLOCK_SPECS[type].shape === 'hat';
export const hasBody = (type: BlockType): boolean => ['c', 'ccap'].includes(BLOCK_SPECS[type].shape);
