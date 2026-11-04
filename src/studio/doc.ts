/**
 * The project document the studio saves: backdrop, sprites with their position, size and Blockly state,
 * variables, lists and UI state. It is versioned and opaque to the workshop shell. Opening it again
 * restores the project exactly; without one, the project is built from the game's `setup`.
 */
import { ART } from '../art/index.ts';
import type { GameDefinition } from '../games/types.ts';
import { blocklyToIr, irToBlockly, type WorkspaceState } from '../language/convert.ts';
import type { Block, ProjectProgram, Script, SpriteProgram } from '../language/ir.ts';

export const DOC_VERSION = 1;

export interface SpriteDoc {
  id: string;
  art: string;
  name: string;
  x: number;
  y: number;
  size: number;
  dir: number;
  flip: 1 | -1;
  visible: boolean;
  /** Blockly workspace state; `null` until the sprite has been opened once. */
  code: WorkspaceState | null;
}

export interface UiState {
  sound: boolean;
  /** Steps the child moved past without completing them. */
  skipped: string[];
  /** Hint rungs revealed per step id. */
  hints: Record<string, number>;
  /** Counter for the next sprite id. */
  nextId: number;
  /** Whether the child already pressed «Terminé». */
  doneClicked: boolean;
}

export interface ProjectDoc {
  version: typeof DOC_VERSION;
  gameId: string | null;
  backdrop: string;
  sprites: SpriteDoc[];
  variables: string[];
  lists: string[];
  selected: string | null;
  ui: UiState;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export const defaultUi = (): UiState => ({ sound: true, skipped: [], hints: {}, nextId: 1, doneClicked: false });

export function starterCode(tier: 'picture' | 'text'): WorkspaceState {
  return { blocks: { languageVersion: 0, blocks: [{ type: tier === 'picture' ? 'f_flag' : 'a_flag', x: 30, y: 36 }] } };
}

/** A fresh project: the game's setup, with its scripts turned into Blockly state. */
export function newDoc(game: GameDefinition | null): ProjectDoc {
  const setup = game?.setup;
  const sprites: SpriteDoc[] = (setup?.sprites ?? []).map((sp) => ({
    id: sp.id, art: sp.art, name: sp.name, x: sp.x, y: sp.y, size: sp.size ?? 100, dir: sp.dir ?? 90, flip: sp.flip ?? 1, visible: sp.visible ?? true,
    code: sp.scripts.length ? irToBlockly(sp.scripts) : null,
  }));
  return {
    version: DOC_VERSION,
    gameId: game?.id ?? null,
    backdrop: setup?.backdrop || 'parque',
    sprites,
    variables: [...(setup?.variables ?? [])],
    lists: [...(setup?.lists ?? [])],
    selected: sprites[0]?.id ?? null,
    ui: defaultUi(),
  };
}

function parseSprite(raw: unknown): SpriteDoc | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.art !== 'string') return null;
  return {
    id: raw.id,
    art: raw.art,
    name: typeof raw.name === 'string' ? raw.name : (ART as Record<string, { name: string }>)[raw.art]?.name ?? raw.art,
    x: num(raw.x, 0), y: num(raw.y, -110), size: num(raw.size, 100), dir: num(raw.dir, 90),
    flip: raw.flip === -1 ? -1 : 1,
    visible: raw.visible !== false,
    code: isObj(raw.code) ? (raw.code as WorkspaceState) : null,
  };
}

/** Reads a saved document. Returns `null` when it is not one of ours, so the caller starts from the setup. */
export function parseDoc(raw: unknown, game: GameDefinition | null): ProjectDoc | null {
  if (!isObj(raw) || raw.version !== DOC_VERSION || !Array.isArray(raw.sprites)) return null;
  if ((raw.gameId ?? null) !== (game?.id ?? null)) return null;
  const sprites = raw.sprites.map(parseSprite).filter((s): s is SpriteDoc => s !== null);
  const ui = isObj(raw.ui) ? raw.ui : {};
  const hints: Record<string, number> = {};
  if (isObj(ui.hints)) for (const [k, v] of Object.entries(ui.hints)) hints[k] = num(v, 0);
  const selected = typeof raw.selected === 'string' && sprites.some((s) => s.id === raw.selected) ? raw.selected : (sprites[0]?.id ?? null);
  return {
    version: DOC_VERSION,
    gameId: game?.id ?? null,
    backdrop: typeof raw.backdrop === 'string' ? raw.backdrop : 'parque',
    sprites,
    variables: strs(raw.variables),
    lists: strs(raw.lists),
    selected,
    ui: { sound: ui.sound !== false, skipped: strs(ui.skipped), hints, nextId: Math.max(1, num(ui.nextId, 1)), doneClicked: ui.doneClicked === true },
  };
}

/** The scripts of every sprite are rebuilt only when their Blockly state object changes. */
const irCache = new WeakMap<object, Script[]>();

export function scriptsOf(sprite: SpriteDoc): Script[] {
  if (!sprite.code) return [];
  const hit = irCache.get(sprite.code);
  if (hit) return hit;
  const scripts = blocklyToIr(sprite.code);
  irCache.set(sprite.code, scripts);
  return scripts;
}

export function programOf(doc: ProjectDoc): ProjectProgram {
  const sprites: SpriteProgram[] = doc.sprites.map((s) => ({
    id: s.id, art: s.art, name: s.name, x: s.x, y: s.y, size: s.size, dir: s.dir, flip: s.flip, visible: s.visible, scripts: scriptsOf(s),
  }));
  return { backdrop: doc.backdrop, sprites, variables: [...doc.variables], lists: [...doc.lists] };
}

/** Where a new sprite lands, so friends do not pile up on top of each other. */
const SLOTS: readonly [number, number][] = [[-120, -110], [120, -110], [0, -110], [-170, -40], [170, -40], [0, 0]];

export function addSpriteDoc(doc: ProjectDoc, art: string, tier: 'picture' | 'text'): SpriteDoc {
  const base = (ART as Record<string, { name: string; kind: string }>)[art]?.name ?? art;
  let name = base;
  for (let k = 2; doc.sprites.some((s) => s.name === name); k++) name = `${base} ${k}`;
  let id = `s${doc.ui.nextId++}`;
  while (doc.sprites.some((s) => s.id === id)) id = `s${doc.ui.nextId++}`;
  const [x, y] = SLOTS[doc.sprites.length % SLOTS.length];
  const sprite: SpriteDoc = { id, art, name, x, y, size: 100, dir: 90, flip: x > 0 ? -1 : 1, visible: true, code: starterCode(tier) };
  doc.sprites.push(sprite);
  doc.selected = id;
  return sprite;
}

/** Whether the project reads the keyboard, so touch screens need on-screen arrows. */
export function usesKeys(program: ProjectProgram): boolean {
  const keyTypes = new Set<string>(['a_key', 'a_arrows', 'v_key']);
  const visit = (b: Block): boolean =>
    keyTypes.has(b.type) || Object.values(b.inputs).some(visit) || b.body.some(visit) || b.elseBody.some(visit);
  return program.sprites.some((sp) => sp.scripts.some((sc) => visit(sc.hat) || sc.body.some(visit)));
}
