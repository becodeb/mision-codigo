/**
 * What the hand shows on «Mostrame», decided with no DOM. A step declares the program it wants (`demoScript`);
 * this compares it with what the child has built and returns the next missing thing, and only that:
 * the sprite to pick, the event block to bring, the next block to add, or how to try the result.
 * The animation lives in demo.ts and never edits the project.
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
}

export interface SpriteView {
  id: string;
  name: string;
  art: string;
  /** `character`, `object`... from the art catalogue. */
  kind: string;
  scripts: readonly Script[];
}

export interface DemoGoal {
  /** The scripts the step wants built, hat first. Several when it asks for more than one event. */
  scripts: readonly Script[];
  /** Whom the step is about: a sprite id, an art id or an art kind. Omitted means the selected one. */
  sprite?: string;
  /** Every sprite in the project needs the scripts (two racers), not only one. */
  each?: boolean;
}

export type DemoPlan =
  | { kind: 'add-sprite'; reason: 'none' | 'missing' }
  | { kind: 'select-sprite'; spriteId: string; name: string }
  /** The event block is not there (or its program cannot take the next block): bring a new one. */
  | { kind: 'hat'; hat: Block; reason: 'missing' | 'blocked' }
  | { kind: 'block'; block: Block; slot: Slot }
  /** Everything wanted is built: show how to try it. */
  | { kind: 'try'; hat: Block; spriteId: string };

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
  let missing: Missing | null = null;
  for (let i = 0; i < want.length; i++) {
    const w = want[i];
    if (matchOf[i] < 0) {
      if (!missing) missing = missingAt(want, built, matchOf, i, container);
      continue;
    }
    const b = built[matchOf[i]];
    if (!bodyOf(w.type)) continue;
    const inner = fit(w.body, b.body, { parent: b.id, kind: 'do' });
    const other = w.elseBody.length || b.elseBody.length ? fit(w.elseBody, b.elseBody, { parent: b.id, kind: 'else' }) : { missing: null, matched: 0 };
    matched += inner.matched + other.matched;
    if (!missing) missing = inner.missing ?? other.missing;
  }
  return { missing, matched };
}

/** Where the wanted block `i` goes: after the built block of the wanted one before it, or else right before the one after it, or else at the bottom. */
function missingAt(want: readonly Block[], built: readonly Block[], matchOf: readonly number[], i: number, container: Slot): Missing {
  const block = want[i];
  let after = -1;
  for (let j = i - 1; j >= 0 && after < 0; j--) if (matchOf[j] >= 0) after = matchOf[j];
  let slot: Slot;
  let atEnd: boolean;
  if (after >= 0) {
    slot = { parent: built[after].id, kind: 'next' };
    atEnd = after === built.length - 1;
  } else {
    let before = -1;
    for (let j = i + 1; j < want.length && before < 0; j++) if (matchOf[j] >= 0) before = matchOf[j];
    if (before >= 0) {
      slot = before > 0 ? { parent: built[before - 1].id, kind: 'next' } : container;
      atEnd = false;
    } else if (built.length) {
      slot = { parent: built[built.length - 1].id, kind: 'next' };
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

/** Plans one wanted script against the built ones. `null` means it is all there. */
function planScript(want: Script, built: readonly Script[]): DemoPlan | null {
  const sameType = built.filter((s) => s.hat.type === want.hat.type);
  let candidates = sameType.filter((s) => sameEvent(want.hat, s.hat));
  /* A key hat dropped and not set yet counts as the one being built. */
  if (!candidates.length) candidates = sameType.filter((s) => s.body.length === 0 && want.hat.type === 'a_key');
  if (!candidates.length) return { kind: 'hat', hat: want.hat, reason: 'missing' };

  const fits = candidates.map((s, order) => ({ s, order, ...fit(want.body, s.body, { parent: s.hat.id, kind: 'next' }) }));
  if (fits.some((f) => !f.missing)) return null;
  const usable = fits.filter((f) => !f.missing!.blocked);
  if (!usable.length) return { kind: 'hat', hat: want.hat, reason: 'blocked' };
  usable.sort((a, b) => b.matched - a.matched || a.order - b.order);
  const best = usable[0];
  return { kind: 'block', block: best.missing!.block, slot: best.missing!.slot };
}

function planSprite(goal: DemoGoal, sprite: SpriteView): DemoPlan | null {
  for (const want of goal.scripts) {
    const plan = planScript(want, sprite.scripts);
    if (plan) return plan;
  }
  return null;
}

/** Whether a sprite is the one a step names: by id, by art or by art kind. */
export const spriteMatches = (ref: string) => (s: { id: string; art: string; kind: string }): boolean => s.id === ref || s.art === ref || s.kind === ref;

/** The next thing to show, given the program as it is now. */
export function planDemo(goal: DemoGoal, sprites: readonly SpriteView[], selectedId: string | null): DemoPlan {
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

/* ---------- words ---------- */

const keyLabel = (key: unknown): string => KEYS.find(([, v]) => v === key)?.[0] ?? String(key ?? '');

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
    case 'block':
      return 'Así se pega el que sigue.';
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
