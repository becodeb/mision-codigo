/**
 * What a child can do in a game, read from the program itself: which keys it listens to, which characters they
 * move and which ones react to a click. Pure, so the legend and the coach stay true after the child edits the game.
 */
import type { Block, ProjectProgram, Script } from '../language/ir.ts';

/** Arrow keys in the order they are drawn: up, left, down, right. */
export const ARROWS = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'] as const;
export type ArrowKey = (typeof ARROWS)[number];

export interface Tap {
  /** Sprite id (a clone answers to its original's id). */
  id: string;
  /** Clicking it is the point of the game: it scores, wins or sends something. */
  main: boolean;
}

export interface Controls {
  /** The arrow keys the program uses, in drawing order. */
  arrows: ArrowKey[];
  space: boolean;
  /** Sprites the arrows move (or react to). */
  movers: string[];
  /** Sprites that react to the space bar. */
  spacers: string[];
  taps: Tap[];
  /** The clicks are answers to choose from: none is pointed at by name. */
  answers: boolean;
  /** What the space bar does, when the program says it plainly. */
  spaceDoes: 'jump' | 'shoot' | null;
  /** Keys (`event.key`) that only work once the game runs: «mover con flechas» and «¿tecla…?» sit inside the flag's scripts. */
  late: string[];
}

/** A click that scores, wins, sends a message or counts coins is what the game is about; the rest is play. */
const MAIN_BLOCKS = new Set<string>(['f_star', 'a_addscore', 'a_win', 'f_send', 'a_send', 'a_changevar']);
const CLICK_HATS = new Set<string>(['f_click', 'a_click']);

const walk = (b: Block, fn: (b: Block) => void): void => {
  fn(b);
  Object.values(b.inputs).forEach((i) => walk(i, fn));
  b.body.forEach((x) => walk(x, fn));
  b.elseBody.forEach((x) => walk(x, fn));
};

const blocksOfScript = (sc: Script): Block[] => {
  const all: Block[] = [];
  walk(sc.hat, (b) => all.push(b));
  sc.body.forEach((b) => walk(b, (x) => all.push(x)));
  return all;
};

export const spriteIdOf = (instanceId: string): string => instanceId.split('#')[0];

/** What a game says about its clicks: see `Showcase`. */
export interface ControlHints {
  tapAll?: true;
  hands?: readonly string[];
}

export function controlsOf(program: ProjectProgram, { tapAll, hands }: ControlHints = {}): Controls {
  const hatKeys = new Set<string>();
  const used = new Set<string>();
  const movers = new Set<string>();
  const spacers = new Set<string>();
  const clicks = new Map<string, boolean>();
  let spaceDoes: Controls['spaceDoes'] = null;
  for (const sp of program.sprites) {
    for (const sc of sp.scripts) {
      if (sc.body.length === 0) continue;
      const blocks = blocksOfScript(sc);
      for (const b of blocks) {
        const key = String(b.fields.K ?? '');
        if (b.type === 'a_arrows') {
          ARROWS.forEach((k) => used.add(k));
          movers.add(sp.id);
        } else if (b.type === 'a_key' || b.type === 'v_key') {
          if (b.type === 'a_key') hatKeys.add(key);
          if ((ARROWS as readonly string[]).includes(key)) {
            used.add(key);
            movers.add(sp.id);
          } else if (key === ' ') {
            used.add(key);
            spacers.add(sp.id);
            if (blocks.some((x) => x.type === 'a_jump')) spaceDoes = 'jump';
            else if (blocks.some((x) => x.type === 'a_clone')) spaceDoes = 'shoot';
          }
        }
      }
      if (CLICK_HATS.has(sc.hat.type)) clicks.set(sp.id, (clicks.get(sp.id) ?? false) || blocks.some((b) => MAIN_BLOCKS.has(b.type)));
    }
  }
  const keys = used.size > 0;
  const anyMain = [...clicks.values()].some(Boolean);
  return {
    arrows: ARROWS.filter((k) => used.has(k)),
    space: used.has(' '),
    movers: [...movers],
    spacers: [...spacers],
    taps: [...clicks].map(([id, main]) => ({ id, main: hands ? hands.includes(id) : tapAll === true || (keys ? main : anyMain ? main : true) })),
    answers: tapAll === true,
    spaceDoes,
    late: [...used].filter((k) => !hatKeys.has(k)),
  };
}

/** Whether the program has anything a child can do at all. */
export const hasControls = (c: Controls): boolean => c.arrows.length > 0 || c.space || c.taps.length > 0;
