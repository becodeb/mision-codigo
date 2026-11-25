/**
 * The Blockly editor of the studio: one injected workspace that shows the code of the selected sprite,
 * a toolbox that grows as the guide unlocks blocks, and a read-only viewer for hint examples.
 */
import * as Blockly from 'blockly/core';
import { registerBlocks } from '../language/blocks.ts';
import type { BlockType } from '../language/catalog.ts';
import { blocklyToIr, irToBlockly, looseStacks, type WorkspaceState } from '../language/convert.ts';
import type { Block, Script } from '../language/ir.ts';
import { blocklyThemes } from '../language/themes.ts';
import { CREATE_LIST_KEY, CREATE_VARIABLE_KEY, type ToolboxDefinition } from '../language/toolbox.ts';
import { starterCode } from './doc.ts';
import { installBlocklyTouchFixes } from './touch.ts';

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
/** Laptop screens: smaller picture blocks so more of the toolbox shows without scrolling. */
const short = (): boolean => typeof window !== 'undefined' && window.innerHeight < 820;

/** Small laptops (12 inches): both sides are tight. */
const small = (): boolean => typeof window !== 'undefined' && window.innerWidth < 1300 && window.innerHeight < 820;

/**
 * Something is being pressed or dragged in a Blockly workspace. While a finger drags a block nothing may move the
 * workspace under it: the guide reacting to a change, or a resize, would shift the editor on screen and the block
 * would land away from the finger.
 */
const gestureInProgress = (): boolean => {
  try { return Blockly.Gesture.inProgress(); } catch { return false; }
};

/**
 * The size of the blocks never changes. Pinch zoom used to: two fingers zoomed the workspace (or, mid-drag, made
 * the block jump) and children ended up in a giant or tiny workspace with no button to come back. Without zoom
 * there is nothing to come back from, and Blockly never lets the blocks scroll more than half out of view.
 * (Blockly's zoom buttons would load their icons from the internet: `pathToMedia` is not bundled.)
 */
export const ZOOM = (startScale: number) => ({ controls: false, wheel: false, pinch: false, startScale });

export class BlockEditor {
  readonly ws: Blockly.WorkspaceSvg;
  private loading = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly observer: ResizeObserver;
  private disposed = false;
  private rebuilding = false;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollFrame = 0;
  private readonly onPageScroll: (e: Event) => void;

  private readonly host: HTMLElement;
  private readonly handlers: EditorHandlers;
  readonly tier: Tier;

  constructor(host: HTMLElement, tier: Tier, toolbox: ToolboxDefinition, handlers: EditorHandlers) {
    this.host = host;
    this.tier = tier;
    this.handlers = handlers;
    registerBlocks();
    installBlocklyTouchFixes();
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
      zoom: ZOOM(picture ? (narrow() ? 0.85 : short() ? (small() ? 0.75 : 0.8) : 1) : narrow() || small() ? 0.7 : 0.8),
      move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
      grid: { spacing: 32, length: 3, colour: picture ? '#EFE6D3' : '#E4DDF0', snap: false },
    } as Blockly.BlocklyOptions);
    if (!picture) this.keepFlyoutOpen();
    this.ws.registerButtonCallback(CREATE_VARIABLE_KEY, () => handlers.onCreateVariable());
    this.ws.registerButtonCallback(CREATE_LIST_KEY, () => handlers.onCreateList());
    this.ws.addChangeListener((e) => this.onEvent(e));
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    /*
     * Blockly only notices when the document scrolls. On laptops the studio scrolls inside its own box, and Blockly
     * kept stale screen positions for the toolbox and the flyout: a block dropped near them could vanish, or stay
     * on top of them. Refresh those positions when anything around the editor scrolls.
     */
    this.onPageScroll = (e) => {
      const t = e.target;
      if (this.scrollFrame || (t instanceof Node && t !== document && !t.contains(this.host))) return;
      this.scrollFrame = requestAnimationFrame(() => {
        this.scrollFrame = 0;
        if (this.disposed) return;
        try {
          this.ws.updateInverseScreenCTM();
          this.ws.recordDragTargets();
        } catch { /* detached while the page changes */ }
      });
    };
    document.addEventListener('scroll', this.onPageScroll, { capture: true, passive: true });
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
    this.scheduleChange();
  }

  /**
   * Reports a change once the code settles and no finger is down in the editor. Pulling a block out of a script
   * changes the code mid-drag; the guide reacting to it right away grows or shrinks and pushes the editor.
   */
  private scheduleChange(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.disposed) return;
      if (gestureInProgress()) this.scheduleChange();
      else this.handlers.onChange();
    }, 150);
  }

  resize(): void {
    if (this.disposed) return;
    if (gestureInProgress()) {
      /* Resizing under a dragged block moves it away from the finger: wait until it is dropped. */
      this.resizeTimer ??= setTimeout(() => { this.resizeTimer = null; this.resize(); }, 120);
      return;
    }
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
    this.keepLeftEdgeInView();
  }

  /** Saved blocks can sit left of the origin; the flyout takes the left of the view, so scroll until none is hidden behind it. */
  private keepLeftEdgeInView(): void {
    try {
      const box = this.ws.getBlocksBoundingBox();
      if (box.left < 0 && this.ws.getTopBlocks(false).length) this.ws.scroll(-box.left * this.ws.scale + 16, this.ws.scrollY);
    } catch { /* an empty or detached workspace has nothing to show */ }
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
    const keep = this.openCategoryName();
    this.rebuilding = true;
    try { this.ws.updateToolbox(def as unknown as Blockly.utils.toolbox.ToolboxDefinition); } catch (e) { console.warn('Could not update the toolbox', e); } finally { this.rebuilding = false; }
    if (this.tier === 'text') this.reopenCategory(keep);
  }

  /**
   * Text tier: one category is always open and its flyout stays on screen. The flyout reserves its own space
   * (the workspace starts after it), clicking the open category or the workspace does not close it, and dragging
   * a block out leaves it there.
   */
  private keepFlyoutOpen(): void {
    const toolbox = this.ws.getToolbox() as Blockly.Toolbox | null;
    if (!toolbox) return;
    const fly = toolbox.getFlyout() as (Blockly.IFlyout & { autoClose: boolean }) | undefined;
    if (fly) fly.autoClose = false;
    const select = toolbox.setSelectedItem.bind(toolbox);
    const clear = toolbox.clearSelection.bind(toolbox);
    toolbox.setSelectedItem = (item) => {
      if (this.rebuilding) return select(item);
      if (!item || item === toolbox.getSelectedItem()) return undefined;
      return select(item);
    };
    toolbox.clearSelection = () => { if (this.rebuilding) clear(); };
    this.reopenCategory(null);
  }

  private openCategoryName(): string | null {
    const item = (this.ws.getToolbox() as Blockly.Toolbox | null)?.getSelectedItem() as unknown as { getName?: () => string } | null | undefined;
    return item?.getName?.() ?? null;
  }

  /** Selects the category that was open, or the first one. */
  private reopenCategory(name: string | null): void {
    const toolbox = this.ws.getToolbox() as Blockly.Toolbox | null;
    if (!toolbox) return;
    const items = toolbox.getToolboxItems().filter((i) => (i as unknown as { isSelectable(): boolean }).isSelectable());
    const item = items.find((i) => (i as unknown as { getName?: () => string }).getName?.() === name) ?? items[0];
    if (!item) return;
    this.rebuilding = true;
    try { toolbox.setSelectedItem(item as Blockly.ISelectableToolboxItem); } finally { this.rebuilding = false; }
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

  /** Scrolls the open flyout so a block in it is on screen; a block outside the flyout view cannot be picked up by the hand. */
  showInFlyout(block: Blockly.BlockSvg): boolean {
    try {
      const fly = this.ws.getFlyout();
      if (!fly) return false;
      const fw = fly.getWorkspace();
      const view = fw.getParentSvg().getBoundingClientRect();
      const inView = (): boolean => {
        const r = block.getSvgRoot().getBoundingClientRect();
        return r.height > 0 && r.top >= view.top - 1 && r.bottom <= view.bottom + 1;
      };
      if (!inView()) {
        const pos = block.getRelativeToSurfaceXY();
        fw.scroll(fw.scrollX, -(pos.y * fw.scale) + 16);
      }
      return inView();
    } catch {
      return false;
    }
  }

  /** Opens the toolbox category that holds a block so the hand can pick it up. Returns whether it had to click: an open category is left alone. */
  openCategoryOf(type: BlockType): boolean {
    const toolbox = this.ws.getToolbox() as Blockly.Toolbox | null;
    if (!toolbox) return false;
    for (const item of toolbox.getToolboxItems()) {
      const contents = (item as unknown as { getContents?: () => unknown }).getContents?.();
      const list = Array.isArray(contents) ? contents : [];
      if (list.some((c) => (c as { type?: string }).type === type)) {
        if (toolbox.getSelectedItem() === item) return false;
        toolbox.setSelectedItem(item as Blockly.ISelectableToolboxItem);
        return true;
      }
    }
    return false;
  }

  /** Opens a toolbox category by its label. Returns whether it had to click. */
  openCategoryNamed(label: string): boolean {
    const toolbox = this.ws.getToolbox() as Blockly.Toolbox | null;
    const item = toolbox?.getToolboxItems().find((i) => (i as unknown as { getName?: () => string }).getName?.() === label);
    if (!toolbox || !item || toolbox.getSelectedItem() === item) return false;
    toolbox.setSelectedItem(item as Blockly.ISelectableToolboxItem);
    return true;
  }

  /** The part of the screen where blocks show: after the toolbox and its flyout, which take their own space. */
  viewRect(): DOMRect {
    try {
      const mm = this.ws.getMetricsManager();
      const abs = mm.getAbsoluteMetrics();
      const view = mm.getViewMetrics(false);
      const svg = this.ws.getParentSvg().getBoundingClientRect();
      return new DOMRect(svg.left + abs.left, svg.top + abs.top, view.width, view.height);
    } catch {
      return this.host.getBoundingClientRect();
    }
  }

  /** The scripts on screen right now (block ids included), read without waiting for the debounced change. */
  scripts(): Script[] {
    return blocklyToIr(this.save());
  }

  /** Blocks lying in the workspace that hang from no event, for the hand to put where they belong. */
  looseStacks(): Block[][] {
    return looseStacks(this.save());
  }

  /** Scrolls to the empty space under every program, for a new one. */
  showFreeSpot(): void {
    try {
      const box = this.ws.getBlocksBoundingBox();
      const tops = this.ws.getTopBlocks(false);
      if (!tops.length) return;
      const left = Math.min(...tops.map((b) => b.getRelativeToSurfaceXY().x));
      this.ws.scroll(24 - left * this.ws.scale, 70 - box.bottom * this.ws.scale);
    } catch { /* an empty or detached workspace has nothing to scroll */ }
  }

  /** A program that grew over another one pushes it down, so no block is ever hidden under another. */
  tidy(): void {
    if (this.disposed || gestureInProgress()) return;
    const GAP = 22;
    const tops = (this.ws.getTopBlocks(false) as Blockly.BlockSvg[]).sort((a, b) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y);
    const placed: { left: number; right: number; top: number; bottom: number }[] = [];
    const undo = Blockly.Events.getRecordUndo();
    Blockly.Events.setRecordUndo(false);
    try {
      for (const b of tops) {
        const r = b.getBoundingRectangle();
        let top = r.top;
        for (const p of placed) if (r.left < p.right && r.right > p.left && top < p.bottom + GAP && top + (r.bottom - r.top) > p.top) top = p.bottom + GAP;
        if (top > r.top + 1) b.moveBy(0, top - r.top);
        placed.push({ left: r.left, right: r.right, top, bottom: top + (r.bottom - r.top) });
        placed.sort((x, y) => x.top - y.top);
      }
    } catch { /* a block being disposed is left where it is */ } finally {
      Blockly.Events.setRecordUndo(undo);
    }
  }

  /** A block is being dragged, or one of its menus or numbers is open. */
  get busy(): boolean {
    return gestureInProgress() || Blockly.DropDownDiv.isVisible() || Blockly.WidgetDiv.isVisible();
  }

  /** The part of a block a child taps to change it: its number, its menu or its text. */
  editableOf(block: Blockly.BlockSvg): Element {
    for (const name of ['N', 'P', 'S', 'T']) {
      const root = block.getField(name)?.getSvgRoot();
      if (root) return root;
    }
    const socket = block.getChildren(true).find((c) => c.isShadow());
    return socket?.getSvgRoot() ?? block.getSvgRoot();
  }

  blockById(id: string | undefined): Blockly.BlockSvg | null {
    return id ? (this.ws.getBlockById(id) as Blockly.BlockSvg | null) : null;
  }

  /**
   * Scrolls the workspace, as little as it takes, so a block is on screen for a hand about to point at it.
   * Returns a function that puts the view back, or `null` when nothing moved.
   */
  reveal(block: Blockly.BlockSvg, below = 16): (() => void) | null {
    try {
      const r = block.getSvgRoot().getBoundingClientRect();
      const v = this.viewRect();
      const margin = 16;
      const fit = (lo: number, hi: number, vLo: number, vHi: number, after: number): number => {
        if (hi - lo > vHi - vLo - margin - after) return vLo + margin - lo;
        if (lo < vLo + margin) return vLo + margin - lo;
        if (hi > vHi - after) return vHi - after - hi;
        return 0;
      };
      const dx = fit(r.left, r.right, v.left, v.right, margin);
      let dy = fit(r.top, r.bottom, v.top, v.bottom, below);
      /* A block taller than the view: what matters is its end, where the next one goes. */
      if (below > margin && r.bottom - r.top > v.height - margin - below) dy = v.bottom - below - r.bottom;
      if (!dx && !dy) return null;
      const { scrollX, scrollY } = this.ws;
      this.ws.scroll(scrollX + dx, scrollY + dy);
      return () => {
        if (!this.disposed) this.ws.scroll(scrollX, scrollY);
      };
    } catch {
      return null; /* a detached workspace has nothing to scroll */
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
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
    document.removeEventListener('scroll', this.onPageScroll, { capture: true });
    this.observer.disconnect();
    try { this.ws.dispose(); } catch { /* already gone */ }
    this.host.innerHTML = '';
  }
}

/** A small read-only workspace showing example scripts. Returns a function that removes it. */
/** `scale` makes the drawing smaller than usual, for places where the whole program has to fit (the finished program of a card). */
export function mountExample(host: HTMLElement, tier: Tier, scripts: readonly Script[], scale?: number): () => void {
  registerBlocks();
  installBlocklyTouchFixes();
  const themes = blocklyThemes();
  const picture = tier === 'picture';
  const ws = Blockly.inject(host, {
    readOnly: true,
    renderer: 'zelos',
    theme: picture ? themes.picture : themes.text,
    sounds: false,
    zoom: ZOOM((picture ? 0.7 : 0.62) * (scale ?? 1)),
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
  /* «Así queda»: the whole program, as large as its box lets it be. */
  const fit = (): void => {
    if (scale === undefined || !host.clientWidth || !host.clientHeight) return;
    const box = ws.getBlocksBoundingBox();
    const size = Math.max(0.4, Math.min((host.clientWidth - 40) / (box.right - box.left), (host.clientHeight - 40) / (box.bottom - box.top), 1.1));
    if (!Number.isFinite(size)) return;
    ws.setScale(size);
    ws.scroll(16 - box.left * size, 16 - box.top * size);
  };
  const observer = new ResizeObserver(() => { try { Blockly.svgResize(ws); fit(); } catch { /* detached */ } });
  observer.observe(host);
  return () => {
    observer.disconnect();
    try { ws.dispose(); } catch { /* already gone */ }
    host.innerHTML = '';
  };
}
