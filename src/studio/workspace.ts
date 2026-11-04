/**
 * The Blockly editor of the studio: one injected workspace that shows the code of the selected sprite,
 * a toolbox that grows as the guide unlocks blocks, and a read-only viewer for hint examples.
 */
import * as Blockly from 'blockly/core';
import { registerBlocks } from '../language/blocks.ts';
import type { BlockType } from '../language/catalog.ts';
import { irToBlockly, type WorkspaceState } from '../language/convert.ts';
import type { Script } from '../language/ir.ts';
import { blocklyThemes } from '../language/themes.ts';
import { CREATE_LIST_KEY, CREATE_VARIABLE_KEY, type ToolboxDefinition } from '../language/toolbox.ts';
import { starterCode } from './doc.ts';

export type Tier = 'picture' | 'text';

export interface EditorHandlers {
  /** Blocks were added, moved, changed or deleted (debounced). */
  onChange(): void;
  /** A script was clicked in the workspace: run it. `blockId` is the hat block. */
  onRunScript(blockId: string): void;
  onCreateVariable(): void;
  onCreateList(): void;
}

const narrow = (): boolean => typeof window !== 'undefined' && window.innerWidth < 600;

export class BlockEditor {
  readonly ws: Blockly.WorkspaceSvg;
  private loading = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly observer: ResizeObserver;
  private disposed = false;

  private readonly host: HTMLElement;
  private readonly handlers: EditorHandlers;
  readonly tier: Tier;

  constructor(host: HTMLElement, tier: Tier, toolbox: ToolboxDefinition, handlers: EditorHandlers) {
    this.host = host;
    this.tier = tier;
    this.handlers = handlers;
    registerBlocks();
    const themes = blocklyThemes();
    const picture = tier === 'picture';
    this.ws = Blockly.inject(host, {
      toolbox: toolbox as unknown as Blockly.utils.toolbox.ToolboxDefinition,
      renderer: 'zelos',
      theme: picture ? themes.picture : themes.text,
      trashcan: false,
      sounds: false,
      comments: false,
      collapse: false,
      disable: false,
      zoom: { controls: false, wheel: false, pinch: true, startScale: picture ? (narrow() ? 0.85 : 1) : narrow() ? 0.7 : 0.8 },
      move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
      grid: { spacing: 32, length: 3, colour: picture ? '#EFE6D3' : '#E4DDF0', snap: false },
    } as Blockly.BlocklyOptions);
    this.ws.registerButtonCallback(CREATE_VARIABLE_KEY, () => handlers.onCreateVariable());
    this.ws.registerButtonCallback(CREATE_LIST_KEY, () => handlers.onCreateList());
    this.ws.addChangeListener((e) => this.onEvent(e));
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
  }

  private onEvent(e: Blockly.Events.Abstract): void {
    if (this.loading || this.disposed) return;
    if (e.type === Blockly.Events.CLICK) {
      const id = (e as Blockly.Events.Click).blockId;
      const block = id ? this.ws.getBlockById(id) : null;
      if (block && !block.getParent() && !block.previousConnection) this.handlers.onRunScript(block.id);
      return;
    }
    if (e.isUiEvent) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.disposed) this.handlers.onChange();
    }, 150);
  }

  resize(): void {
    if (this.disposed) return;
    try { Blockly.svgResize(this.ws); } catch { /* the host may be detached while the page changes */ }
  }

  /** Puts a sprite's code on screen. `null` starts it with a green-flag hat. */
  load(state: WorkspaceState | null): void {
    this.flushPending();
    this.loading = true;
    Blockly.Events.disable();
    try {
      this.ws.clear();
      Blockly.serialization.workspaces.load((state ?? starterCode(this.tier)) as unknown as { [key: string]: unknown }, this.ws);
    } catch (e) {
      console.warn('Could not load the sprite code', e);
    } finally {
      Blockly.Events.enable();
      this.loading = false;
    }
    this.ws.clearUndo();
    this.resize();
  }

  /** Clears the workspace while no sprite is selected. */
  clear(): void {
    this.loading = true;
    Blockly.Events.disable();
    try { this.ws.clear(); } finally {
      Blockly.Events.enable();
      this.loading = false;
    }
  }

  save(): WorkspaceState {
    return Blockly.serialization.workspaces.save(this.ws) as unknown as WorkspaceState;
  }

  /** Runs a debounced change now, so the caller reads the latest code. */
  flushPending(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.handlers.onChange();
    }
  }

  setToolbox(def: ToolboxDefinition): void {
    try { this.ws.updateToolbox(def as unknown as Blockly.utils.toolbox.ToolboxDefinition); } catch (e) { console.warn('Could not update the toolbox', e); }
  }

  /** Types of the blocks in the workspace, for deciding which flyout blocks still deserve the glow. */
  usedTypes(): Set<string> {
    return new Set(this.ws.getAllBlocks(false).map((b) => b.type));
  }

  /** Picture tier: makes the flyout blocks of these types glow until the child uses them. */
  glow(types: ReadonlySet<string>): void {
    const fly = this.ws.getFlyout();
    if (!fly) return;
    for (const b of fly.getWorkspace().getTopBlocks(false)) b.getSvgRoot()?.classList.toggle('mc-glow', types.has(b.type));
  }

  /** Block in the open flyout, for the hand demo. */
  flyoutBlock(type: BlockType): Blockly.BlockSvg | undefined {
    const fly = this.ws.getFlyout();
    return fly?.getWorkspace().getTopBlocks(false).find((b) => b.type === type) as Blockly.BlockSvg | undefined;
  }

  /** Opens the toolbox category that holds a block, so the hand demo can pick it up. Text tier only. */
  openCategoryOf(type: BlockType): void {
    const toolbox = this.ws.getToolbox() as Blockly.Toolbox | null;
    if (!toolbox) return;
    for (const item of toolbox.getToolboxItems()) {
      const contents = (item as unknown as { getContents?: () => unknown }).getContents?.();
      const list = Array.isArray(contents) ? contents : [];
      if (list.some((c) => (c as { type?: string }).type === type)) {
        toolbox.setSelectedItem(item as Blockly.ISelectableToolboxItem);
        return;
      }
    }
  }

  highlight(blockId: string, on: boolean): void {
    this.ws.getBlockById(blockId)?.getSvgRoot()?.classList.toggle('mc-running', on);
  }

  clearHighlights(): void {
    this.host.querySelectorAll('.mc-running').forEach((el) => el.classList.remove('mc-running'));
  }

  /** The first hat block, to hang a demo block under. */
  topBlocks(): Blockly.BlockSvg[] {
    return this.ws.getTopBlocks(true) as Blockly.BlockSvg[];
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.observer.disconnect();
    try { this.ws.dispose(); } catch { /* already gone */ }
    this.host.innerHTML = '';
  }
}

/** A small read-only workspace showing example scripts. Returns a function that removes it. */
export function mountExample(host: HTMLElement, tier: Tier, scripts: readonly Script[]): () => void {
  registerBlocks();
  const themes = blocklyThemes();
  const picture = tier === 'picture';
  const ws = Blockly.inject(host, {
    readOnly: true,
    renderer: 'zelos',
    theme: picture ? themes.picture : themes.text,
    sounds: false,
    zoom: { controls: false, wheel: false, pinch: true, startScale: picture ? 0.7 : 0.62 },
    move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
  } as Blockly.BlocklyOptions);
  Blockly.Events.disable();
  try {
    Blockly.serialization.workspaces.load(irToBlockly(scripts, { x: 16, y: 16 }) as unknown as { [key: string]: unknown }, ws);
  } catch (e) {
    console.warn('Could not show the example', e);
  } finally {
    Blockly.Events.enable();
  }
  const observer = new ResizeObserver(() => { try { Blockly.svgResize(ws); } catch { /* detached */ } });
  observer.observe(host);
  return () => {
    observer.disconnect();
    try { ws.dispose(); } catch { /* already gone */ }
    host.innerHTML = '';
  };
}
