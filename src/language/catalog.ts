/**
 * Every block type of the language with its tier, minimum level and the stats categories its
 * execution records. The runtime reads this table; Blockly definitions (T02) are built from it.
 */

export type Tier = 'picture' | 'text';
export type Level = 1 | 2 | 3 | 4 | 5;
export type BlockKind = 'hat' | 'command' | 'value';
export type HatKind = 'flag' | 'click' | 'key' | 'recv' | 'touching' | 'clone' | 'points';

export interface BlockInfo {
  tier: Tier;
  /** Lowest level whose toolbox may offer the block. */
  level: Level;
  kind: BlockKind;
  /** Set on hats only. */
  hat?: HatKind;
  /** Stats categories recorded each time the block runs (or is evaluated, for values). */
  cats: readonly string[];
}

const pic = (level: Level, kind: BlockKind, ...cats: string[]): BlockInfo => ({ tier: 'picture', level, kind, cats });
const txt = (level: Level, kind: BlockKind, ...cats: string[]): BlockInfo => ({ tier: 'text', level, kind, cats });
const picHat = (level: Level, hat: HatKind): BlockInfo => ({ tier: 'picture', level, kind: 'hat', hat, cats: [] });
const txtHat = (level: Level, hat: HatKind): BlockInfo => ({ tier: 'text', level, kind: 'hat', hat, cats: [] });

export const BLOCKS = {
  /* picture tier */
  f_flag: picHat(1, 'flag'),
  f_click: picHat(1, 'click'),
  f_recv: picHat(2, 'recv'),
  f_say: pic(1, 'command', 'say'),
  f_text: pic(1, 'command', 'say'),
  f_right: pic(1, 'command', 'move'),
  f_left: pic(1, 'command', 'move'),
  f_up: pic(1, 'command', 'move'),
  f_down: pic(1, 'command', 'move'),
  f_jump: pic(1, 'command', 'move'),
  f_spin: pic(1, 'command', 'spin'),
  f_face: pic(1, 'command', 'face'),
  f_grow: pic(1, 'command', 'size'),
  f_shrink: pic(1, 'command', 'size'),
  f_sound: pic(1, 'command', 'sound'),
  f_backdrop: pic(1, 'command', 'backdrop'),
  f_star: pic(1, 'command', 'score', 'star'),
  f_wait: pic(2, 'command', 'wait'),
  f_repeat: pic(2, 'command', 'repeat'),
  f_hide: pic(2, 'command', 'look'),
  f_show: pic(2, 'command', 'look'),
  f_note: pic(2, 'command', 'note'),
  f_random: pic(2, 'command', 'move'),
  f_send: pic(2, 'command', 'broadcast'),

  /* text tier, level 3 */
  a_flag: txtHat(3, 'flag'),
  a_click: txtHat(3, 'click'),
  a_key: txtHat(3, 'key'),
  a_recv: txtHat(3, 'recv'),
  a_points: txtHat(3, 'points'),
  a_send: txt(3, 'command', 'broadcast'),
  a_move: txt(3, 'command', 'move'),
  a_point: txt(3, 'command', 'move'),
  a_changex: txt(3, 'command', 'move'),
  a_changey: txt(3, 'command', 'move'),
  a_goto: txt(3, 'command', 'move'),
  a_glide: txt(3, 'command', 'move'),
  a_random: txt(3, 'command', 'move'),
  a_jump: txt(3, 'command', 'move'),
  a_say: txt(3, 'command', 'say'),
  a_sayfor: txt(3, 'command', 'say'),
  a_thinkfor: txt(3, 'command', 'say'),
  a_face: txt(3, 'command', 'face'),
  a_changesize: txt(3, 'command', 'size'),
  a_setsize: txt(3, 'command', 'size'),
  a_show: txt(3, 'command', 'look'),
  a_hide: txt(3, 'command', 'look'),
  a_backdrop: txt(3, 'command', 'backdrop'),
  a_sound: txt(3, 'command', 'sound'),
  a_note: txt(3, 'command', 'note'),
  a_wait: txt(3, 'command', 'wait'),
  a_repeat: txt(3, 'command', 'repeat'),
  a_win: txt(3, 'command', 'win'),
  a_setscore: txt(3, 'command', 'score'),
  a_addscore: txt(3, 'command', 'score'),
  v_num: txt(3, 'value'),
  v_text: txt(3, 'value'),

  /* text tier, level 4 */
  a_touching: txtHat(4, 'touching'),
  a_arrows: txt(4, 'command', 'move', 'arrows'),
  a_bounce: txt(4, 'command', 'move'),
  a_gotosprite: txt(4, 'command', 'move'),
  a_forever: txt(4, 'command', 'forever'),
  a_if: txt(4, 'command', 'if'),
  a_stop: txt(4, 'command', 'stop'),
  a_stopothers: txt(4, 'command', 'stopothers'),
  a_lose: txt(4, 'command', 'lose'),
  v_score: txt(4, 'value', 'readscore'),
  v_touching: txt(4, 'value', 'touching'),
  v_key: txt(4, 'value', 'key'),

  /* text tier, level 5 */
  a_clonestart: txtHat(5, 'clone'),
  a_turn: txt(5, 'command', 'move'),
  a_pointdeg: txt(5, 'command', 'move'),
  a_pointto: txt(5, 'command', 'move'),
  a_setx: txt(5, 'command', 'move'),
  a_sety: txt(5, 'command', 'move'),
  a_ifelse: txt(5, 'command', 'ifelse'),
  a_repeatuntil: txt(5, 'command', 'repeatuntil'),
  a_waituntil: txt(5, 'command', 'waituntil'),
  a_stopthis: txt(5, 'command', 'stopthis'),
  a_clone: txt(5, 'command', 'clone'),
  a_delclone: txt(5, 'command', 'delclone'),
  a_setvar: txt(5, 'command', 'var'),
  a_changevar: txt(5, 'command', 'var'),
  a_listadd: txt(5, 'command', 'list'),
  a_listdel: txt(5, 'command', 'list'),
  a_listclear: txt(5, 'command', 'list'),
  a_listset: txt(5, 'command', 'list'),
  a_ask: txt(5, 'command', 'ask'),
  v_var: txt(5, 'value', 'readvar'),
  v_listitem: txt(5, 'value', 'readlist'),
  v_listlen: txt(5, 'value', 'readlist'),
  v_listhas: txt(5, 'value', 'readlist'),
  v_random: txt(5, 'value', 'random'),
  v_add: txt(5, 'value', 'math'),
  v_sub: txt(5, 'value', 'math'),
  v_mul: txt(5, 'value', 'math'),
  v_div: txt(5, 'value', 'math'),
  v_mod: txt(5, 'value', 'math'),
  v_eq: txt(5, 'value', 'compare'),
  v_lt: txt(5, 'value', 'compare'),
  v_gt: txt(5, 'value', 'compare'),
  v_and: txt(5, 'value', 'logic'),
  v_or: txt(5, 'value', 'logic'),
  v_not: txt(5, 'value', 'logic'),
  v_join: txt(5, 'value', 'join'),
  v_x: txt(5, 'value', 'position'),
  v_y: txt(5, 'value', 'position'),
  v_timer: txt(5, 'value', 'timer'),
  v_distance: txt(5, 'value', 'distance'),
  v_answer: txt(5, 'value', 'answer'),
} as const satisfies Record<string, BlockInfo>;

export type BlockType = keyof typeof BLOCKS;

export function blockInfo(type: string): BlockInfo | undefined {
  return (BLOCKS as Record<string, BlockInfo>)[type];
}

/** Block types a given level may use (picture blocks for levels 1-2, text blocks for 3-5). */
export function blocksForLevel(level: Level): BlockType[] {
  const tier: Tier = level <= 2 ? 'picture' : 'text';
  return (Object.keys(BLOCKS) as BlockType[]).filter((t) => BLOCKS[t].tier === tier && BLOCKS[t].level <= level);
}
