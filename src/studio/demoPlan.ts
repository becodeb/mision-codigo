/**
 * What the hand shows on «Mostrame», decided with no DOM. A step declares the program it wants (`demoScript`);
 * this walks it depth first against what the child has built and returns the next missing piece, and only that:
 * the sprite to pick, the event block to bring, a block to add, a loose block of the child's to put where it
 * belongs, or how to try the result. Trying (flag, tap, key) comes only as the last gesture of the piece that
 * completes the program, or alone when nothing is missing. The animation lives in demo.ts and never edits the
 * project.
 */
import { KEYS } from '../language/options.ts';
import type { Block, Script } from '../language/ir.ts';
import { BLOCK_SPECS, hasBody } from '../language/spec.ts';

export type SlotKind = 'next' | 'do' | 'else';

/** A connection on a block of the workspace: under it, or inside its «do» / «si no» mouth. */
export interface Slot {
  /** Id of the workspace block that owns the connection. */
  parent: string | undefined;
  kind: SlotKind;
  /** Type of that block, for the words. */
  parentType?: string;
}

export interface SpriteView {
  id: string;
  name: string;
  art: string;
  /** `character`, `object`... from the art catalogue. */
  kind: string;
  scripts: readonly Script[];
  /** Stacks that hang from no event block, each a list of blocks from its top. */
  loose?: readonly (readonly Block[])[];
}

export interface DemoGoal {
  /** The scripts the step wants built, hat first. Several when it asks for more than one event. */
  scripts: readonly Script[];
  /** Whom the step is about: a sprite id, an art id or an art kind. Omitted means the selected one. */
  sprite?: string;
  /** Every sprite in the project needs the scripts (two racers), not only one. */
  each?: boolean;
}

/** How to try the program once this piece is in. */
export interface Completes {
  hat: Block;
  spriteId: string;
}

export type DemoPlan =
  | { kind: 'add-sprite'; reason: 'none' | 'missing' }
  | { kind: 'select-sprite'; spriteId: string; name: string }
  /** The event block is not there (or its program cannot take the next block): bring a new one. */
  | { kind: 'hat'; hat: Block; reason: 'missing' | 'blocked'; completes: Completes | null }
  /** Bring a block from the toolbox to the slot. */
  | { kind: 'block'; block: Block; slot: Slot; completes: Completes | null }
  /** The child already has that block, loose or in the wrong place: drag it to the slot. */
  | { kind: 'move'; block: Block; slot: Slot; completes: Completes | null }
  /** Everything wanted is built: show how to try it. */
  | { kind: 'try'; hat: Block; spriteId: string };

type Piece = Extract<DemoPlan, { kind: 'hat' | 'block' | 'move' }>;

/* ---------- matching a wanted script against a built one ---------- */

const isTerminal = (type: string): boolean => {
  const shape = (BLOCK_SPECS as Record<string, { shape: string } | undefined>)[type]?.shape;
  return shape === 'cap' || shape === 'ccap';
};

const bodyOf = (type: string): boolean => (BLOCK_SPECS as Record<string, unknown>)[type] !== undefined && hasBody(type as Parameters<typeof hasBody>[0]);

function typesIn(list: readonly Block[], into = new Set<string>()): Set<string> {
  for (const b of list) {
    into.add(b.type);
    typesIn(b.body, into);
    typesIn(b.elseBody, into);
  }
  return into;
}

/** A built block stands for a wanted one when it has the same type; a C-shaped one also has to be empty or hold some of the wanted insides. */
function compatible(want: Block, built: Block): boolean {
  if (want.type !== built.type) return false;
  if (!bodyOf(want.type)) return true;
  const builtInside = [...built.body, ...built.elseBody];
  if (!builtInside.length) return true;
  const wanted = typesIn([...want.body, ...want.elseBody]);
  if (!wanted.size) return true;
  for (const t of typesIn(builtInside)) if (wanted.has(t)) return true;
  return false;
}

interface Missing {
  block: Block;
  slot: Slot;
  /** The block cannot be placed there: the stack ends in a block with nothing below it, or the block ends the stack and others would follow. */
  blocked: boolean;
}

interface Fit {
  missing: Missing | null;
  /** How many wanted blocks are already built, nested ones included. */
  matched: number;
  /** Ids of the built blocks that count as wanted ones. */
  claimed: string[];
}

function fit(want: readonly Block[], built: readonly Block[], container: Slot): Fit {
  const used = new Set<number>();
  const matchOf: number[] = [];
  let last = -1;
  for (const w of want) {
    let at = -1;
    for (let j = last + 1; j < built.length && at < 0; j++) if (!used.has(j) && compatible(w, built[j])) at = j;
    for (let j = 0; j < built.length && at < 0; j++) if (!used.has(j) && compatible(w, built[j])) at = j;
    matchOf.push(at);
    if (at >= 0) {
      used.add(at);
      last = at;
    }
  }

  let matched = matchOf.filter((m) => m >= 0).length;
  const claimed: string[] = [];
  let missing: Missing | null = null;
  for (let i = 0; i < want.length; i++) {
    const w = want[i];
    if (matchOf[i] < 0) {
      if (!missing) missing = missingAt(want, built, matchOf, i, container);
      continue;
    }
    const b = built[matchOf[i]];
    if (b.id) claimed.push(b.id);
    if (!bodyOf(w.type)) continue;
    const inner = fit(w.body, b.body, { parent: b.id, kind: 'do', parentType: b.type });
    const other = w.elseBody.length || b.elseBody.length ? fit(w.elseBody, b.elseBody, { parent: b.id, kind: 'else', parentType: b.type }) : { missing: null, matched: 0, claimed: [] };
    matched += inner.matched + other.matched;
    claimed.push(...inner.claimed, ...other.claimed);
    if (!missing) missing = inner.missing ?? other.missing;
  }
  return { missing, matched, claimed };
}

/** Where the wanted block `i` goes: after the built block of the wanted one before it, or else right before the one after it, or else at the bottom. */
function missingAt(want: readonly Block[], built: readonly Block[], matchOf: readonly number[], i: number, container: Slot): Missing {
  const block = want[i];
  let after = -1;
  for (let j = i - 1; j >= 0 && after < 0; j--) if (matchOf[j] >= 0) after = matchOf[j];
  const under = (b: Block): Slot => ({ parent: b.id, kind: 'next', parentType: b.type });
  let slot: Slot;
  let atEnd: boolean;
  if (after >= 0) {
    slot = under(built[after]);
    atEnd = after === built.length - 1;
  } else {
    let before = -1;
    for (let j = i + 1; j < want.length && before < 0; j++) if (matchOf[j] >= 0) before = matchOf[j];
    if (before >= 0) {
      slot = before > 0 ? under(built[before - 1]) : container;
      atEnd = false;
    } else if (built.length) {
      slot = under(built[built.length - 1]);
      atEnd = true;
    } else {
      slot = container;
      atEnd = true;
    }
  }
  const owner = slot.kind === 'next' ? built.find((b) => b.id === slot.parent) : undefined;
  const blocked = (!!owner && isTerminal(owner.type)) || (isTerminal(block.type) && !atEnd);
  return { block, slot, blocked };
}

/** Event hats that are told apart by their menu: a key script is for one key. */
function sameEvent(want: Block, hat: Block): boolean {
  if (want.type === 'a_key') return String(want.fields.K ?? '') === String(hat.fields.K ?? '');
  return true;
}

const sizeOf = (list: readonly Block[]): number => list.reduce((n, b) => n + 1 + sizeOf(b.body) + sizeOf(b.elseBody), 0);

interface Reuse {
  block: Block;
  covered: number;
  foreign: number;
}

/**
 * The child's own block to drag to the slot instead of bringing a new one. Candidates are the top of a loose
 * stack, the last block of a list anywhere in a loose stack, and an unclaimed container in the last place of a
 * program (it is somewhere nothing asks for it). Each is scored: `covered` is how many blocks of the wanted
 * block's insides it already holds, `foreign` how many it holds that are not wanted (plus blocks that would come
 * along beneath it). Empty or covering something means reuse: the child's extra ideas are theirs and stay. A
 * candidate that holds only foreign blocks is the child's other idea, so it is left alone.
 */
function reuse(want: Block, sprite: SpriteView, claimed: ReadonlySet<string>): Block | null {
  const found: Reuse[] = [];
  const consider = (b: Block, tail: number): void => {
    if (!b.id || b.type !== want.type || claimed.has(b.id)) return;
    const inside = [...b.body, ...b.elseBody];
    const covered = fit(want.body, b.body, { parent: b.id, kind: 'do' }).matched + (want.elseBody.length || b.elseBody.length ? fit(want.elseBody, b.elseBody, { parent: b.id, kind: 'else' }).matched : 0);
    const foreign = sizeOf(inside) - covered + tail;
    if (covered > 0 || foreign === 0) found.push({ block: b, covered, foreign });
  };
  const lasts = (list: readonly Block[], inLoose: boolean): void => {
    list.forEach((b, i) => {
      lasts(b.body, inLoose);
      lasts(b.elseBody, inLoose);
      if (i === list.length - 1 && (inLoose || bodyOf(b.type))) consider(b, 0);
    });
  };
  for (const stack of sprite.loose ?? []) {
    if (stack.length) consider(stack[0], stack.length - 1);
    lasts(stack, true);
  }
  for (const sc of sprite.scripts) lasts(sc.body, false);
  found.sort((x, y) => y.covered - x.covered || x.foreign - y.foreign);
  return found[0]?.block ?? null;
}

/** Plans one wanted script against a sprite. `null` means it is all there; `claimed` collects the built blocks that count. */
function planScript(want: Script, sprite: SpriteView, claimed: Set<string>): Piece | null {
  const sameType = sprite.scripts.filter((s) => s.hat.type === want.hat.type);
  let candidates = sameType.filter((s) => sameEvent(want.hat, s.hat));
  /* A key hat dropped and not set yet counts as the one being built. */
  if (!candidates.length) candidates = sameType.filter((s) => s.body.length === 0 && want.hat.type === 'a_key');
  if (!candidates.length) return { kind: 'hat', hat: want.hat, reason: 'missing', completes: null };

  const fits = candidates.map((s, order) => ({ s, order, ...fit(want.body, s.body, { parent: s.hat.id, kind: 'next', parentType: s.hat.type }) }));
  const done = fits.find((f) => !f.missing);
  if (done) {
    if (done.s.hat.id) claimed.add(done.s.hat.id);
    done.claimed.forEach((c) => claimed.add(c));
    return null;
  }
  const usable = fits.filter((f) => !f.missing!.blocked);
  if (!usable.length) return { kind: 'hat', hat: want.hat, reason: 'blocked', completes: null };
  usable.sort((a, b) => b.matched - a.matched || a.order - b.order);
  const best = usable[0];
  if (best.s.hat.id) claimed.add(best.s.hat.id);
  best.claimed.forEach((c) => claimed.add(c));
  const { block, slot } = best.missing!;
  const mine = reuse(block, sprite, claimed);
  return mine ? { kind: 'move', block: mine, slot, completes: null } : { kind: 'block', block, slot, completes: null };
}

function planSprite(goal: DemoGoal, sprite: SpriteView): Piece | null {
  const claimed = new Set<string>();
  /* Claim what the complete scripts already use before looking for blocks to move, so none of them is taken apart. */
  for (const want of goal.scripts) planScript(want, sprite, claimed);
  for (const want of goal.scripts) {
    const plan = planScript(want, sprite, claimed);
    if (plan) return plan;
  }
  return null;
}

/** Whether a sprite is the one a step names: by id, by art or by art kind. */
export const spriteMatches = (ref: string) => (s: { id: string; art: string; kind: string }): boolean => s.id === ref || s.art === ref || s.kind === ref;

function planCore(goal: DemoGoal, sprites: readonly SpriteView[], selectedId: string | null): DemoPlan {
  if (!sprites.length) return { kind: 'add-sprite', reason: 'none' };
  if (!goal.scripts.length) return { kind: 'add-sprite', reason: 'none' };
  const pool = goal.sprite ? sprites.filter(spriteMatches(goal.sprite)) : [...sprites];
  if (!pool.length) return { kind: 'add-sprite', reason: 'missing' };

  const selected = sprites.find((s) => s.id === selectedId);
  /* The selected sprite goes first, so nothing changes under the child's hands when they already are in the right place. */
  const order = selected && pool.includes(selected) ? [selected, ...pool.filter((s) => s !== selected)] : pool;
  /* A step about a kind of sprite is done by whichever of them is selected; the hand only hops when the selected one is not that kind. */
  const owners = goal.each ? order : goal.sprite ? (selected && pool.includes(selected) ? [selected] : order) : [selected ?? sprites[0]];

  for (const owner of owners) {
    const plan = planSprite(goal, owner);
    if (!plan) continue;
    return owner.id === selectedId ? plan : { kind: 'select-sprite', spriteId: owner.id, name: owner.name };
  }
  const who = owners.find((s) => s.id === selectedId) ?? owners[0];
  if (who.id !== selectedId) return { kind: 'select-sprite', spriteId: who.id, name: who.name };
  return { kind: 'try', hat: goal.scripts[0].hat, spriteId: who.id };
}

/* ---------- doing what a plan shows, on plain data ---------- */

let simId = 0;

type Editable = { scripts: Script[]; loose?: Block[][] };

/** Removes a loose or nested block and returns it, with the blocks that hang below it when it tops a loose stack (they come along). */
function takeBlock(sprite: Editable, id: string | undefined): { block: Block; tail: Block[] } | null {
  if (!id) return null;
  for (const stack of sprite.loose ?? []) {
    const i = stack.findIndex((b) => b.id === id);
    if (i === 0) {
      const [block, ...tail] = stack.splice(0);
      return { block, tail };
    }
    if (i > 0) return { block: stack.splice(i, 1)[0], tail: [] };
  }
  const visit = (list: Block[]): Block | null => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return list.splice(i, 1)[0];
      const inner = visit(list[i].body) ?? visit(list[i].elseBody);
      if (inner) return inner;
    }
    return null;
  };
  for (const sc of sprite.scripts) {
    const found = visit(sc.body);
    if (found) return { block: found, tail: [] };
  }
  return null;
}

/** Puts a plan's block where it says, on a sprite's data. The tests use it to play the child; planDemo uses it to see whether a piece completes the program. */
export function applyPlan(sprite: Editable, plan: DemoPlan): void {
  if (plan.kind === 'hat') {
    sprite.scripts.push({ hat: { ...structuredClone(plan.hat), id: `sim${++simId}`, body: [], elseBody: [] }, body: [] });
    return;
  }
  if (plan.kind !== 'block' && plan.kind !== 'move') return;
  let piece: Block;
  let tail: Block[] = [];
  if (plan.kind === 'move') {
    const taken = takeBlock(sprite, plan.block.id);
    if (!taken) throw new Error(`the plan moves a block that is not there: ${String(plan.block.id)}`);
    piece = taken.block;
    tail = taken.tail;
  } else {
    /* What the toolbox hands over is the block alone: the child fills in its mouth and menus. */
    piece = { ...structuredClone(plan.block), id: `sim${++simId}`, body: [], elseBody: [] };
  }
  const { parent, kind } = plan.slot;
  for (const sc of sprite.scripts) {
    if (sc.hat.id === parent) {
      sc.body.unshift(piece, ...tail);
      return;
    }
    const visit = (list: Block[]): boolean => {
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.id === parent) {
          if (kind === 'next') list.splice(i + 1, 0, piece, ...tail);
          else (kind === 'do' ? b.body : b.elseBody).unshift(piece, ...tail);
          return true;
        }
        if (visit(b.body) || visit(b.elseBody)) return true;
      }
      return false;
    };
    if (visit(sc.body)) return;
  }
  throw new Error(`the plan points at a block that is not there: ${String(parent)}`);
}

/** The next thing to show, given the program as it is now. A piece that finishes the program also says how to try it. */
export function planDemo(goal: DemoGoal, sprites: readonly SpriteView[], selectedId: string | null): DemoPlan {
  const plan = planCore(goal, sprites, selectedId);
  if (plan.kind !== 'hat' && plan.kind !== 'block' && plan.kind !== 'move') return plan;
  const after = structuredClone(sprites) as unknown as (SpriteView & Editable)[];
  const mine = after.find((s) => s.id === selectedId);
  if (!mine) return plan;
  try {
    applyPlan(mine, plan);
  } catch {
    return plan;
  }
  const next = planCore(goal, after, selectedId);
  return next.kind === 'try' ? { ...plan, completes: { hat: next.hat, spriteId: next.spriteId } } : plan;
}

/* ---------- words ---------- */

const keyLabel = (key: unknown): string => KEYS.find(([, v]) => v === key)?.[0] ?? String(key ?? '');

/** What a block says on itself, or `null` when it is only pictures. */
export function blockLabel(type: string): string | null {
  if (type === 'a_flag' || type === 'f_flag') return 'la bandera';
  const msg = (BLOCK_SPECS as Record<string, { msg: string } | undefined>)[type]?.msg;
  const text = (msg ?? '').replace(/%\d+/g, '').replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim();
  return text || null;
}

function where(slot: Slot): string {
  const label = slot.parentType ? blockLabel(slot.parentType) : null;
  if (!label) return slot.kind === 'next' ? 'abajo del bloque de arriba' : 'adentro del bloque';
  if (slot.parentType === 'a_flag' || slot.parentType === 'f_flag') return 'debajo de la bandera';
  return slot.kind === 'next' ? `debajo de «${label}»` : `adentro de «${label}»`;
}

export function describePlan(plan: DemoPlan): string {
  switch (plan.kind) {
    case 'add-sprite':
      return plan.reason === 'none' ? 'Primero agregá un personaje con el botón del más.' : 'Primero sumá el personaje que falta con el botón del más.';
    case 'select-sprite':
      return `Primero elegí a ${plan.name}.`;
    case 'hat': {
      const key = plan.hat.type === 'a_key' ? `Elegí la tecla ${keyLabel(plan.hat.fields.K)}. ` : '';
      const apart = plan.reason === 'blocked' ? 'Este va en un programa aparte. ' : '';
      return `${apart}${key}Ahora poné algo abajo.`;
    }
    case 'block': {
      const label = blockLabel(plan.block.type);
      return label ? `Pegá «${label}» ${where(plan.slot)}.` : 'Así se pega el que sigue.';
    }
    case 'move': {
      const label = blockLabel(plan.block.type);
      return label ? `Conectá este «${label}» ${where(plan.slot)}.` : 'Conectá este bloque donde va.';
    }
    case 'try':
      return tryTarget(plan.hat, plan.spriteId).caption;
  }
}

export interface TryTarget {
  /** `flag` presses the green flag, `sprite` taps the sprite on the stage, `keys` the touch arrows when there are, `stage` the stage. */
  target: 'flag' | 'sprite' | 'keys' | 'stage';
  caption: string;
}

/** How to try a script, by the event that starts it. */
export function tryTarget(hat: Block, spriteId: string): TryTarget & { spriteId: string } {
  switch (hat.type) {
    case 'f_click':
    case 'a_click':
      return { target: 'sprite', caption: 'Tocá al personaje en el escenario.', spriteId };
    case 'a_key':
      return { target: 'keys', caption: `Apretá la tecla ${keyLabel(hat.fields.K)}.`, spriteId };
    case 'f_recv':
    case 'a_recv':
      return { target: 'flag', caption: 'Empieza cuando llega el mensaje. Tocá el botón verde.', spriteId };
    case 'a_touching':
      return { target: 'stage', caption: 'Acercá los personajes hasta que se toquen.', spriteId };
    case 'a_points':
      return { target: 'stage', caption: 'Jugá y sumá puntos hasta llegar.', spriteId };
    default:
      return { target: 'flag', caption: 'Tocá el botón verde y mirá.', spriteId };
  }
}
