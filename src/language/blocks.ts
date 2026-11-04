/**
 * Blockly definitions for every block of the language, built from the table in spec.ts.
 * Picture-tier blocks are big image blocks; text-tier blocks are Scratch-like with value sockets.
 * Dropdowns of sprites, variables and lists read the project being edited through `setProjectContext`.
 */
import * as Blockly from 'blockly/core';
import * as Es from 'blockly/msg/es';
import { BACKDROPS, IMG, svgURI } from '../art/index.ts';
import { playSfx } from '../audio/sfx.ts';
import { BLOCK_IMG } from './icons.ts';
import { EDGE, type Option } from './options.ts';
import { BLOCK_SPECS, type ArgSpec, type BlockSpec, type DynSource } from './spec.ts';
import type { BlockType } from './catalog.ts';

/* ---------- what the editor tells the blocks about the project ---------- */

export interface ProjectContext {
  sprites(): { id: string; name: string }[];
  /** The sprite whose code is on screen; it is left out of "touching" and "go to" lists. */
  currentSpriteId(): string | null;
  variables(): string[];
  lists(): string[];
}

const EMPTY_CONTEXT: ProjectContext = { sprites: () => [], currentSpriteId: () => null, variables: () => [], lists: () => [] };
let context: ProjectContext = EMPTY_CONTEXT;

export function setProjectContext(next: ProjectContext | null): void {
  context = next ?? EMPTY_CONTEXT;
}

function othersOptions(): Option[] {
  const me = context.currentSpriteId();
  return context.sprites().filter((s) => s.id !== me).map((s) => [s.name, s.id] as const);
}

/** Options of a dynamic dropdown. Never empty: Blockly refuses a dropdown with no choices. */
export function dynamicOptions(source: DynSource): Option[] {
  switch (source) {
    case 'sprites': {
      const list = othersOptions();
      return list.length ? list : [['(no hay otro personaje)', '']];
    }
    case 'targets': return [...othersOptions(), ['el borde', EDGE]];
    case 'cloneOf': return [['yo mismo', 'myself'], ...othersOptions()];
    case 'vars': {
      const list = context.variables().map((n) => [n, n] as const);
      return list.length ? list : [['(sin variables)', '']];
    }
    case 'lists': {
      const list = context.lists().map((n) => [n, n] as const);
      return list.length ? list : [['(sin listas)', '']];
    }
  }
}

/* ---------- custom fields ---------- */

/** A dropdown that reads its choices from the project and keeps a value that is no longer offered (a deleted sprite). */
class FieldDynamic extends Blockly.FieldDropdown {
  private readonly source: DynSource;

  constructor(source: DynSource) {
    super(() => dynamicOptions(source) as unknown as [string, string][]);
    this.source = source;
  }

  static fromJson(options: Blockly.FieldConfig): FieldDynamic {
    return new FieldDynamic((options as unknown as { source: DynSource }).source);
  }

  protected override doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' ? newValue : null;
  }

  override getOptions(useCache?: boolean): [string, string][] {
    const opts = super.getOptions(useCache) as [string, string][];
    const v = this.getValue();
    if (typeof v === 'string' && !opts.some((o) => o[1] === v)) return [...opts, [v === '' ? '?' : `(${v})`, v]];
    return opts;
  }

  /** Kept for debugging: which list this field draws from. */
  get dynamicSource(): DynSource {
    return this.source;
  }
}

/** A number the child changes by tapping it: each tap adds one and wraps back to the minimum. */
class FieldTapNumber extends Blockly.Field<number> {
  private readonly min: number;
  private readonly max: number;

  constructor(value: number, min: number, max: number) {
    super(Blockly.Field.SKIP_SETUP);
    this.min = Number.isFinite(min) ? min : 1;
    this.max = Number.isFinite(max) ? max : 9;
    this.SERIALIZABLE = true;
    this.CURSOR = 'pointer';
    this.setValue(value ?? this.min);
  }

  static fromJson(options: Blockly.FieldConfig): FieldTapNumber {
    const o = options as unknown as { value?: number; min?: number; max?: number };
    return new FieldTapNumber(o.value ?? 1, o.min ?? 1, o.max ?? 9);
  }

  protected override initView(): void {
    super.initView();
    this.getSvgRoot()?.classList.add('tapnum');
  }

  /** Programs may use a count above the tap range; only the lower bound is enforced. */
  protected override doClassValidation_(newValue?: unknown): number | null {
    const n = Math.round(Number(newValue));
    return Number.isFinite(n) ? Math.max(this.min, n) : null;
  }

  protected override showEditor_(): void {
    let n = Number(this.getValue()) + 1;
    if (n > this.max) n = this.min;
    this.setValue(n);
    try { playSfx('tick'); } catch { /* sound is optional */ }
  }
}

/* ---------- JSON definitions ---------- */

const IMAGES: Record<string, string> = { ...IMG, ...BLOCK_IMG };

function backdropImageOptions(): unknown[] {
  return Object.entries(BACKDROPS).map(([id, def]) => [
    { src: svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360">${def.svg(`bt${id}-`)}</svg>`), width: 60, height: 45, alt: def.name }, id,
  ]);
}

function argJson(arg: ArgSpec): Record<string, unknown> {
  switch (arg.k) {
    case 'image': return { type: 'field_image', src: IMAGES[arg.img] ?? IMAGES.flag, width: arg.w, height: arg.w, alt: arg.alt };
    case 'num': return { type: 'field_number', name: arg.name, value: arg.def };
    case 'text': return { type: 'field_input', name: arg.name, text: arg.def };
    case 'tap': return { type: 'field_tapnum', name: arg.name, value: arg.def, min: arg.min, max: arg.max };
    case 'in': return { type: 'input_value', name: arg.name, ...(arg.check ? { check: arg.check } : {}) };
    case 'dd':
      if (typeof arg.options === 'string') {
        if (arg.options === 'backdropImages') return { type: 'field_dropdown', name: arg.name, options: backdropImageOptions() };
        if (arg.options === 'backdropNames') return { type: 'field_dropdown', name: arg.name, options: Object.entries(BACKDROPS).map(([id, def]) => [def.name, id]) };
        return { type: 'field_dynamic', name: arg.name, source: arg.options };
      }
      return { type: 'field_dropdown', name: arg.name, options: arg.options.map(([label, value]) => [label, value]) };
  }
}

export function blockJson(type: BlockType, spec: BlockSpec): Record<string, unknown> {
  const json: Record<string, unknown> = { type, message0: spec.msg, style: spec.style, inputsInline: true };
  if (spec.args.length) json.args0 = spec.args.map(argJson);
  switch (spec.shape) {
    case 'hat': json.nextStatement = null; break;
    case 'stack': case 'c': json.previousStatement = null; json.nextStatement = null; break;
    case 'cap': case 'ccap': json.previousStatement = null; break;
    case 'value': json.output = spec.out ?? null; break;
  }
  if (spec.shape === 'c' || spec.shape === 'ccap') {
    json.message1 = '%1';
    json.args1 = [{ type: 'input_statement', name: 'DO' }];
    if (spec.elseBody) {
      json.message2 = 'si no';
      json.message3 = '%1';
      json.args3 = [{ type: 'input_statement', name: 'ELSE' }];
    }
  }
  return json;
}

let registered = false;

/** Defines the Spanish messages, the custom fields and every block. Safe to call more than once. */
export function registerBlocks(): void {
  if (registered) return;
  registered = true;
  Blockly.setLocale(Es as unknown as Record<string, string>);
  Blockly.fieldRegistry.register('field_tapnum', FieldTapNumber);
  Blockly.fieldRegistry.register('field_dynamic', FieldDynamic);
  Blockly.defineBlocksWithJsonArray((Object.keys(BLOCK_SPECS) as BlockType[]).map((type) => blockJson(type, BLOCK_SPECS[type])));
}

export { Blockly };
