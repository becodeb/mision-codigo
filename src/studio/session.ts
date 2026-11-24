/**
 * The studio's controller. It owns the project document, the guide tracker, the headless machine, the
 * stage renderer and the block editor, and tells React what changed through a snapshot. React only
 * draws it and forwards clicks; nothing in the project's behaviour lives in a component.
 */
import { ART } from '../art/index.ts';
import { audioHost, hush, playSfx, setSoundEnabled, speak, unlockAudio } from '../audio/index.ts';
import type { GameDefinition, GameStep, StepContext } from '../games/types.ts';
import { setProjectContext } from '../language/blocks.ts';
import type { BlockType } from '../language/catalog.ts';
import { BLOCKS } from '../language/catalog.ts';
import type { ProjectProgram, Script } from '../language/ir.ts';
import { buildToolbox, tierOf } from '../language/toolbox.ts';
import { Machine, type Host, type StageView, type TimeSource } from '../runtime/index.ts';
import type { GameProgress } from '../shared/api.ts';
import type { LevelId } from '../shared/levels.ts';
import { plain } from './rich.tsx';
import { ActiveClock, GuideTracker, hintRungs, type FlatStep } from './guide.ts';
import { flattenScripts, irToBlockly } from '../language/convert.ts';
import { addSpriteDoc, newDoc, parseDoc, programOf, scriptsOf, usesKeys, type ProjectDoc, type SpriteDoc } from './doc.ts';
import { cancelDemo, pointAt, runDemo } from './demo.ts';
import { planDemo, type DemoPlan, type SpriteView } from './demoPlan.ts';
import { StageRenderer } from './stage.ts';
import { BlockEditor } from './workspace.ts';
import { confetti } from './confetti.ts';

export interface SessionOptions {
  game: GameDefinition | null;
  level: LevelId;
  initial: { project: unknown; progress: GameProgress } | null;
  onSave: (project: unknown, progress: GameProgress) => void;
  /** Tests inject a clock and a frame scheduler; the browser uses its own. */
  time?: TimeSource;
  now?: () => Date;
}

export interface SessionSnapshot {
  rev: number;
  running: boolean;
  ended: 'win' | 'lose' | null;
  ask: { question: string } | null;
  talking: boolean;
  notice: string | null;
  /** Step the guide shows. Follows the active step unless the child went back to read. */
  viewIndex: number;
  /** A step was just completed: the guide shows it as done for a moment before moving on. */
  celebrating: { stepId: string; phaseDone: boolean } | null;
  needsKeys: boolean;
  /** The finish panel (challenges and next game) is on. */
  finished: boolean;
  /**
   * A step already done whose code the child deleted, so the current one may not work. Goes away by itself as
   * soon as the program does what that step asks again, in any way, or when the child taps «Seguir igual».
   */
  broken: { index: number; title: string } | null;
  /** Showcase games: the card whose tutorial is open; `null` shows the wall of cards. */
  card: string | null;
  /** The open card is built, and only trying it is missing. */
  almost: boolean;
  /**
   * Showcase games: an event block the game runs on was left empty, so nothing happens. Said after pressing
   * «Empezar», and only then: a child who took something out or changed the logic on purpose is told nothing.
   */
  health: HealthIssue[];
  /** Something just removed or reset that can still be undone. */
  undo: string | null;
}

export interface HealthIssue {
  id: string;
  text: string;
}

const realTime: TimeSource = {
  now: () => performance.now(),
  requestFrame: (cb) => {
    const id = requestAnimationFrame(() => cb());
    return () => cancelAnimationFrame(id);
  },
};

export const GUIDE_KEYS = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' '] as const;
const ARROW_KEYS: readonly string[] = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
const SAVE_DELAY = 1000;
/**
 * A held arrow fires its «al presionar tecla» scripts again on our own clock. The keyboard's auto-repeat waits half
 * a second before the first repeat and a touch button sends no repeat at all, so Nova would nudge once and stall.
 */
const REPEAT_DELAY = 140;
const REPEAT_EVERY = 60;

export class StudioSession {
  readonly game: GameDefinition | null;
  readonly level: LevelId;
  readonly tier: 'picture' | 'text';
  doc: ProjectDoc;
  tracker: GuideTracker;
  readonly clock: ActiveClock;
  machine: Machine | null = null;
  editor: BlockEditor | null = null;

  private renderer: StageRenderer | null = null;
  private root: HTMLElement | null = null;
  private listeners = new Set<() => void>();
  private snap: SessionSnapshot;
  private rev = 0;
  private running = false;
  private ended: 'win' | 'lose' | null = null;
  private ask: { question: string; resolve: (answer: string) => void } | null = null;
  private talking = false;
  private sayToken = 0;
  private notice: string | null = null;
  private viewStepId: string | null = null;
  private celebrating: SessionSnapshot['celebrating'] = null;
  private celebrateTimer: ReturnType<typeof setTimeout> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirtySave = false;
  private needsCheck = true;
  private broken: { index: number; title: string } | null = null;
  /** Broken steps the child chose to leave as they are («Seguir igual»). Only for this visit: never saved. */
  private brokenDismissed = new Set<string>();
  /** The project as it was the last time it was whole: when a step was completed, or when it opened fine. */
  private lastGood: Pick<ProjectDoc, 'sprites' | 'variables' | 'lists' | 'selected'> | null = null;
  private pendingProgram = false;
  private lastOffered = new Set<string>();
  private glowTypes = new Set<string>();
  private intervals: ReturnType<typeof setInterval>[] = [];
  private repeaters = new Map<string, { delay: ReturnType<typeof setTimeout>; every: ReturnType<typeof setInterval> | null }>();
  private offs: (() => void)[] = [];
  private mounted = false;
  private lastSecondsSaved = 0;
  private onFinishedOnce = false;

  /* Showcase games. */
  private cardId: string | null = null;
  /** The program as it is now was run after its last change. */
  private tried = false;
  private healthAsked = false;
  private healthDismissed = new Set<string>();
  /** Last state of each removed sprite, so bringing it back brings the child's blocks too. */
  private trash = new Map<string, SpriteDoc>();
  private undoable: { label: string; run: () => void } | null = null;
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly opts: SessionOptions;

  constructor(opts: SessionOptions) {
    this.opts = opts;
    this.game = opts.game;
    this.level = opts.level;
    this.tier = tierOf(opts.level);
    const restored = opts.initial ? parseDoc(opts.initial.project, opts.game) : null;
    this.doc = restored ?? newDoc(opts.game);
    this.program = programOf(this.doc);
    this.tracker = new GuideTracker(
      opts.game,
      { completed: opts.initial?.progress.completedSteps, skipped: restored?.ui.skipped },
      opts.now,
    );
    this.clock = new ActiveClock(opts.initial?.progress.activeSeconds ?? 0);
    this.onFinishedOnce = this.tracker.finished;
    if (!this.tracker.broken(this.program)) this.keepGood();
    this.snap = this.buildSnapshot();
  }

  private keepGood(): void {
    const { sprites, variables, lists, selected } = this.doc;
    this.lastGood = JSON.parse(JSON.stringify({ sprites, variables, lists, selected })) as NonNullable<typeof this.lastGood>;
  }

  /** «Volver a como estaba»: puts back the project as it was when the last step was completed. */
  restoreGood(): void {
    if (!this.lastGood) return;
    this.editor?.flushPending();
    this.machine?.stopAll();
    const good = JSON.parse(JSON.stringify(this.lastGood)) as NonNullable<typeof this.lastGood>;
    this.doc.sprites = good.sprites;
    this.doc.variables = good.variables;
    this.doc.lists = good.lists;
    this.doc.selected = good.sprites.some((s) => s.id === this.doc.selected) ? this.doc.selected : good.selected;
    this.loadSelectedIntoEditor();
    this.applyProgram();
    this.broken = null;
    this.markChanged();
    this.checkBroken();
  }

  /** «Seguir igual»: the child keeps the program as it is. The warning comes back only if that step breaks again later. */
  dismissBroken(): void {
    const flat = this.broken ? this.tracker.steps[this.broken.index] : null;
    if (!flat) return;
    this.brokenDismissed.add(flat.step.id);
    this.checkBroken();
  }

  get canRestore(): boolean {
    return this.lastGood !== null;
  }

  /* ---------- subscription ---------- */

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): SessionSnapshot => this.snap;

  private buildSnapshot(): SessionSnapshot {
    const active = this.tracker.activeIndex;
    const viewIdx = this.viewStepId ? this.tracker.steps.findIndex((s) => s.step.id === this.viewStepId) : -1;
    return {
      rev: ++this.rev,
      running: this.running,
      ended: this.ended,
      ask: this.ask ? { question: this.ask.question } : null,
      talking: this.talking,
      notice: this.notice,
      viewIndex: viewIdx >= 0 ? viewIdx : active,
      celebrating: this.celebrating,
      needsKeys: this.machine ? usesKeys(this.program) : false,
      finished: this.tracker.finished,
      broken: this.broken,
      card: this.cardId,
      almost: !!this.cardStep?.card?.built(this.program) && !this.tried && !this.tracker.isDone(this.cardId!),
      health: this.healthAsked ? this.deadIssues().filter((h) => !this.healthDismissed.has(h.id)) : [],
      undo: this.undoable?.label ?? null,
    };
  }

  private emit(): void {
    this.snap = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  /* ---------- project ---------- */

  program: ProjectProgram;

  get selectedSprite(): SpriteDoc | null {
    return this.doc.sprites.find((s) => s.id === this.doc.selected) ?? null;
  }

  /** Objects are offered in the sprite picker on text-tier levels and in any game that includes them. */
  get offersObjects(): boolean {
    if (this.tier === 'text') return true;
    const g = this.game;
    if (!g) return false;
    const isObject = (art: string): boolean => (ART as Record<string, { kind: string } | undefined>)[art]?.kind === 'object';
    return [...g.setup.sprites, ...g.solution.program.sprites].some((s) => isObject(s.art));
  }

  /* ---------- lifecycle ---------- */

  /** Starts the machine and the timers. `stage` and `editor` are the DOM nodes React rendered. */
  mount(parts: { root: HTMLElement; stage: SVGSVGElement; editor: HTMLElement }): void {
    if (this.mounted) return;
    this.mounted = true;
    this.root = parts.root;
    setSoundEnabled(this.doc.ui.sound);
    setProjectContext({
      sprites: () => this.doc.sprites.map((s) => ({ id: s.id, name: s.name })),
      currentSpriteId: () => this.doc.selected,
      variables: () => this.doc.variables,
      lists: () => this.doc.lists,
    });
    this.renderer = new StageRenderer(parts.stage, {
      onActivity: () => { this.clock.input(); unlockAudio(); },
      onPress: (id) => this.pressInstance(id),
      onTap: (id) => this.tapInstance(id),
      canDrag: (id) => this.canDrag(id),
      onDrag: (id, x, y) => this.dragInstance(id, x, y),
      onDragEnd: (id) => this.dragEnd(id),
    });
    this.machine = new Machine(this.program, { time: this.opts.time ?? realTime, host: this.makeHost() });
    this.machine.start();
    this.editor = new BlockEditor(parts.editor, this.tier, this.currentToolbox(), {
      onChange: () => this.codeChanged(),
      onRunScript: (id) => this.runScript(id),
      onCreateVariable: () => this.requestCreate('variable'),
      onCreateList: () => this.requestCreate('list'),
    });
    this.lastOffered = new Set(this.offeredNow());
    this.loadSelectedIntoEditor();
    this.renderer.setBackdrop(this.doc.backdrop);
    this.machine.host.render(this.machine);
    this.machine.dirty = true;

    const input = (): void => this.clock.input();
    for (const type of ['pointerdown', 'keydown', 'touchstart', 'wheel']) {
      window.addEventListener(type, input, { capture: true, passive: true });
      this.offs.push(() => window.removeEventListener(type, input, { capture: true }));
    }
    const keydown = (e: KeyboardEvent): void => this.keyDown(e);
    const keyup = (e: KeyboardEvent): void => this.releaseKey(e.key);
    const blur = (): void => { this.releaseAllKeys(); this.machine?.clearKeys(); };
    const hidden = (): void => { if (document.visibilityState === 'hidden') this.flushSave(); };
    const failure = (e: ErrorEvent | PromiseRejectionEvent): void => this.fail('reason' in e ? e.reason : e.error);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    window.addEventListener('pagehide', hidden);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('error', failure);
    window.addEventListener('unhandledrejection', failure);
    this.offs.push(
      () => window.removeEventListener('keydown', keydown),
      () => window.removeEventListener('keyup', keyup),
      () => window.removeEventListener('blur', blur),
      () => window.removeEventListener('pagehide', hidden),
      () => document.removeEventListener('visibilitychange', hidden),
      () => window.removeEventListener('error', failure),
      () => window.removeEventListener('unhandledrejection', failure),
    );
    this.intervals.push(setInterval(() => this.checkGuide(), 300));
    this.intervals.push(setInterval(() => this.secondTick(), 1000));
    this.speakStepIfSpoken();
    this.emit();
  }

  /** Saves what is pending and releases the machine, the workspace and every listener. */
  unmount(): void {
    if (!this.mounted) return;
    this.mounted = false;
    try { this.editor?.flushPending(); } catch { /* the workspace may be half gone */ }
    this.flushSave();
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.releaseAllKeys();
    this.offs.forEach((off) => off());
    this.offs = [];
    if (this.celebrateTimer) clearTimeout(this.celebrateTimer);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    if (this.undoTimer) clearTimeout(this.undoTimer);
    if (this.root) cancelDemo(this.root);
    this.ask?.resolve('');
    this.ask = null;
    try { this.machine?.dispose(); } catch { /* ignore */ }
    this.machine = null;
    this.editor?.dispose();
    this.editor = null;
    this.renderer?.dispose();
    this.renderer = null;
    setProjectContext(null);
    hush();
    this.root = null;
  }

  /* ---------- the host the machine talks to ---------- */

  private makeHost(): Partial<Host> {
    const guard = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A): void => {
      try { fn(...a); } catch (e) { this.fail(e); }
    };
    return {
      speak: (text, o) => audioHost.speak(text, o).catch(() => false),
      cancelSpeech: guard(() => audioHost.cancelSpeech()),
      sfx: guard((name: string) => audioHost.sfx(name)),
      note: guard((name: string) => audioHost.note(name)),
      ask: (question) => new Promise<string>((resolve) => {
        this.ask?.resolve('');
        this.ask = { question, resolve };
        this.emit();
      }),
      cancelAsk: guard(() => {
        if (!this.ask) return;
        this.ask.resolve('');
        this.ask = null;
        this.emit();
      }),
      render: guard((view: StageView) => {
        this.renderer?.render(view, { selectedId: this.doc.selected, idle: !view.running });
        if (view.running !== this.running || view.ended !== this.ended) {
          /* Scripts cut short (the game ended, «Parar») never turn their block off: clear what is left lit. */
          if (!view.running || view.ended) this.editor?.clearHighlights();
          this.running = view.running;
          this.ended = view.ended;
          this.emit();
        }
      }),
      ended: guard((result: 'win' | 'lose') => {
        this.ended = result;
        playSfx(result === 'win' ? 'win' : 'bip');
        if (result === 'win') confetti();
        this.needsCheck = true;
        this.emit();
      }),
      highlight: guard((spriteId: string, blockId: string, on: boolean) => {
        /* On the whole screen nobody sees the blocks: lighting them up only costs time on a slow laptop. */
        if (spriteId === this.doc.selected && !this.fullScreen) this.editor?.highlight(blockId, on);
      }),
    };
  }

  /** A failure in the stage, a script or a callback must not blank the page: log it and tell the child, kindly. */
  fail(error: unknown): void {
    console.error('Studio error:', error);
    this.notice = 'Algo salió raro, pero podés seguir. Si pasa de nuevo, tocá «Parar» y probá otra vez.';
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = null; this.emit(); }, 7000);
    this.emit();
  }

  dismissNotice(): void {
    this.notice = null;
    this.emit();
  }

  /* ---------- running ---------- */

  flag(): void {
    const m = this.machine;
    if (!m) return;
    unlockAudio();
    this.editor?.flushPending();
    this.editor?.clearHighlights();
    if (this.ask) this.answerAsk('');
    m.program = this.program;
    this.pendingProgram = false;
    m.greenFlag();
    this.tried = true;
    this.askHealth();
    this.ended = null;
    this.needsCheck = true;
    this.emit();
  }

  stop(): void {
    const m = this.machine;
    if (!m) return;
    this.editor?.flushPending();
    m.stopAll();
    m.load(this.program);
    this.pendingProgram = false;
    this.editor?.clearHighlights();
    this.ended = null;
    this.running = false;
    this.needsCheck = true;
    this.emit();
  }

  /** Clicking a hat in the workspace runs that script alone. */
  private runScript(blockId: string): void {
    const m = this.machine;
    const sprite = this.selectedSprite;
    if (!m || !sprite) return;
    this.editor?.flushPending();
    if (this.pendingProgram && m.threadCount === 0) this.applyProgram();
    const inst = m.instances.find((i) => i.id === sprite.id);
    const hat = this.program.sprites.find((s) => s.id === sprite.id)?.scripts.find((s) => s.hat.id === blockId)?.hat;
    if (!inst || !hat) return;
    const kind = (BLOCKS as Record<string, { hat?: string }>)[hat.type]?.hat;
    if (!kind) return;
    m.running = true;
    m.trigger(kind as Parameters<Machine['trigger']>[0], (h) => h.id === blockId, inst);
    this.needsCheck = true;
    this.emit();
  }

  answerAsk(answer: string): void {
    const a = this.ask;
    if (!a) return;
    this.ask = null;
    a.resolve(answer);
    this.emit();
  }

  /** The stage covers the whole screen. */
  fullScreen = false;

  setShown(shown: boolean): void {
    this.machine?.setShown(shown);
    if (shown) this.needsCheck = true;
  }

  /** The program changed (code, sprites, backdrop, variables). A quiet machine restarts from the new start; a busy one waits for the next flag. */
  private applyProgram(): void {
    this.program = programOf(this.doc);
    this.tried = false;
    /* What broke is said when the child plays, not while they build. */
    this.healthAsked = false;
    const m = this.machine;
    if (!m) return;
    if (m.threadCount === 0) {
      m.stopAll();
      m.load(this.program);
      this.pendingProgram = false;
      this.ended = null;
    } else {
      m.program = this.program;
      this.pendingProgram = true;
    }
    this.needsCheck = true;
  }

  /* ---------- keyboard and pointer ---------- */

  private keyDown(e: KeyboardEvent): void {
    const m = this.machine;
    if (!m || !(GUIDE_KEYS as readonly string[]).includes(e.key)) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.closest?.('.blocklyWidgetDiv, .blocklyDropDownDiv'))) return;
    if (this.ask) return;
    e.preventDefault();
    this.editor?.flushPending();
    if (ARROW_KEYS.includes(e.key)) {
      /* The browser's own repeats are ignored: the held key repeats on our clock. */
      if (!e.repeat) this.holdKey(e.key);
      return;
    }
    m.keyDown(e.key, e.repeat);
    this.noteTried();
  }

  /** Touch buttons feed the same key events. */
  pressKey(key: string, down: boolean): void {
    const m = this.machine;
    if (!m) return;
    if (down) {
      this.clock.input();
      unlockAudio();
      if (ARROW_KEYS.includes(key)) this.holdKey(key);
      else {
        m.keyDown(key);
        this.noteTried();
      }
    } else this.releaseKey(key);
  }

  /** An arrow went down: fire it now and keep firing while it stays down. */
  private holdKey(key: string): void {
    const m = this.machine;
    if (!m || this.repeaters.has(key)) return;
    m.keyDown(key);
    this.noteTried();
    const entry: { delay: ReturnType<typeof setTimeout>; every: ReturnType<typeof setInterval> | null } = {
      delay: setTimeout(() => {
        entry.every = setInterval(() => this.machine?.keyDown(key, true), REPEAT_EVERY);
      }, REPEAT_DELAY),
      every: null,
    };
    this.repeaters.set(key, entry);
  }

  private releaseKey(key: string): void {
    const entry = this.repeaters.get(key);
    if (entry) {
      clearTimeout(entry.delay);
      if (entry.every) clearInterval(entry.every);
      this.repeaters.delete(key);
    }
    this.machine?.keyUp(key);
  }

  private releaseAllKeys(): void {
    for (const key of [...this.repeaters.keys()]) this.releaseKey(key);
  }

  private canDrag(id: string): boolean {
    const m = this.machine;
    return !!m && m.threadCount === 0 && !this.ask && this.doc.sprites.some((s) => s.id === id);
  }

  private pressInstance(id: string): void {
    const m = this.machine;
    if (m && m.threadCount === 0 && this.doc.sprites.some((s) => s.id === id)) this.selectSprite(id);
  }

  private tapInstance(id: string): void {
    const m = this.machine;
    if (!m) return;
    this.editor?.flushPending();
    if (this.pendingProgram && m.threadCount === 0) this.applyProgram();
    if (m.tap(id)) this.noteTried();
    this.needsCheck = true;
  }

  private dragInstance(id: string, x: number, y: number): void {
    this.machine?.moveInstance(id, x, y);
  }

  private dragEnd(id: string): void {
    const inst = this.machine?.instances.find((i) => i.id === id);
    const sprite = this.doc.sprites.find((s) => s.id === id);
    if (!inst || !sprite) return;
    sprite.x = inst.x;
    sprite.y = inst.y;
    this.program = programOf(this.doc);
    if (this.machine) this.machine.program = this.program;
    this.markChanged();
  }

  /* ---------- sprites, backdrop, variables ---------- */

  private currentToolbox(): ReturnType<typeof buildToolbox> {
    return buildToolbox({
      level: this.level,
      blocks: this.game ? this.tracker.unlockedBlocks() : undefined,
      hasVariables: this.doc.variables.length > 0,
      hasLists: this.doc.lists.length > 0,
    });
  }

  private offeredNow(): BlockType[] {
    return this.game ? this.tracker.unlockedBlocks() : [];
  }

  /** Pushes the toolbox to the editor and, on the picture tier, makes newly unlocked blocks glow. */
  refreshToolbox(): void {
    const editor = this.editor;
    if (!editor) return;
    const now = new Set<string>(this.offeredNow());
    const fresh = [...now].filter((t) => !this.lastOffered.has(t));
    editor.setToolbox(this.currentToolbox());
    this.lastOffered = now;
    fresh.forEach((t) => this.glowTypes.add(t));
    if (this.tier === 'picture') setTimeout(() => this.refreshGlow(), 60);
  }

  private refreshGlow(): void {
    const editor = this.editor;
    if (!editor || this.tier !== 'picture') return;
    const used = editor.usedTypes();
    for (const sp of this.doc.sprites) if (sp.id !== this.doc.selected) JSON.stringify(sp.code ?? {}).match(/"type":"(\w+)"/g)?.forEach((m) => used.add(m.slice(8, -1)));
    /* Blocks of a step that is already done (or skipped) stop glowing even if the child solved it with others. */
    const open = new Set<string>(this.tracker.steps.filter((s) => !this.tracker.isDone(s.step.id) && !this.tracker.isSkipped(s.step.id)).flatMap((s) => s.step.unlock ?? []));
    this.glowTypes = new Set([...this.glowTypes].filter((t) => !used.has(t) && open.has(t)));
    editor.glow(this.glowTypes);
  }

  private loadSelectedIntoEditor(): void {
    const sp = this.selectedSprite;
    if (!this.editor) return;
    if (sp) {
      this.editor.load(sp.code);
      if (!sp.code) sp.code = this.editor.save();
    } else this.editor.clear();
    this.refreshGlow();
  }

  /** Copies the workspace into the selected sprite's document entry. */
  private captureCode(): void {
    const sp = this.selectedSprite;
    if (sp && this.editor) sp.code = this.editor.save();
  }

  private codeChanged(): void {
    this.captureCode();
    this.applyProgram();
    this.markChanged();
    this.refreshGlow();
  }

  selectSprite(id: string): void {
    if (this.doc.selected === id || !this.doc.sprites.some((s) => s.id === id)) return;
    this.editor?.flushPending();
    this.captureCode();
    this.doc.selected = id;
    this.loadSelectedIntoEditor();
    this.machine && (this.machine.dirty = true);
    this.markChanged();
  }

  addSprite(art: string): void {
    this.editor?.flushPending();
    this.captureCode();
    this.machine?.stopAll();
    addSpriteDoc(this.doc, art, this.tier);
    this.loadSelectedIntoEditor();
    this.applyProgram();
    const sound = (ART as Record<string, { sound: string } | undefined>)[art]?.sound;
    if (sound) playSfx(sound);
    this.markChanged();
  }

  removeSprite(id: string): void {
    this.editor?.flushPending();
    this.captureCode();
    this.machine?.stopAll();
    const index = this.doc.sprites.findIndex((s) => s.id === id);
    if (index < 0) return;
    const gone = JSON.parse(JSON.stringify(this.doc.sprites[index])) as SpriteDoc;
    if (this.showcase) {
      this.trash.set(id, gone);
      this.offerUndo(`Sacaste a ${gone.name}.`, () => this.putBack(gone, index));
    }
    this.doc.sprites = this.doc.sprites.filter((s) => s.id !== id);
    if (this.doc.selected === id) this.doc.selected = this.doc.sprites[this.doc.sprites.length - 1]?.id ?? null;
    this.loadSelectedIntoEditor();
    this.applyProgram();
    this.markChanged();
  }

  renameSprite(id: string, name: string): void {
    const sp = this.doc.sprites.find((s) => s.id === id);
    if (!sp) return;
    sp.name = name.trim().slice(0, 16) || (ART as Record<string, { name: string }>)[sp.art]?.name || sp.art;
    this.program = programOf(this.doc);
    this.markChanged();
  }

  setBackdrop(id: string): void {
    this.doc.backdrop = id;
    this.doc.ui.backdropChosen = true;
    playSfx('pop');
    this.applyProgram();
    this.renderer?.setBackdrop(id);
    this.markChanged();
  }

  setSound(on: boolean): void {
    this.doc.ui.sound = on;
    setSoundEnabled(on);
    if (!on) hush();
    this.markChanged();
  }

  /** Name rules shared by variables and lists. Returns an error message in Spanish, or `null` when the name is fine. */
  validateName(kind: 'variable' | 'list', raw: string): string | null {
    const name = raw.trim();
    if (!name) return 'Escribí un nombre.';
    if (name.length > 16) return 'El nombre puede tener hasta 16 letras.';
    const taken = (kind === 'variable' ? this.doc.variables : this.doc.lists).some((n) => n.toLowerCase() === name.toLowerCase());
    return taken ? 'Ya hay una con ese nombre.' : null;
  }

  createName(kind: 'variable' | 'list', raw: string): string | null {
    const error = this.validateName(kind, raw);
    if (error) return error;
    const name = raw.trim();
    (kind === 'variable' ? this.doc.variables : this.doc.lists).push(name);
    this.applyProgram();
    this.refreshToolbox();
    this.markChanged();
    return null;
  }

  /** The editor asked for a new variable or list: React shows the modal. */
  onCreateRequest: ((kind: 'variable' | 'list') => void) | null = null;

  private requestCreate(kind: 'variable' | 'list'): void {
    this.onCreateRequest?.(kind);
  }

  /* ---------- the guide ---------- */

  get viewedStep(): FlatStep | null {
    const s = this.getSnapshot();
    return this.tracker.steps[s.viewIndex] ?? null;
  }

  hintsShown(stepId: string): number {
    return this.doc.ui.hints[stepId] ?? 0;
  }

  /** Reveals the next rung of the hint ladder for the step on screen. */
  revealHint(): void {
    const flat = this.viewedStep;
    if (!flat) return;
    const id = flat.step.id;
    const shown = this.hintsShown(id);
    if (shown >= hintRungs(flat.step)) return;
    this.doc.ui.hints[id] = shown + 1;
    playSfx('pop');
    this.markChanged();
  }

  /** Reading another step. `null` goes back to the step in progress. */
  viewStep(index: number | null): void {
    this.viewStepId = index === null ? null : (this.tracker.steps[index]?.step.id ?? null);
    if (this.viewStepId === this.tracker.active?.step.id) this.viewStepId = null;
    this.celebrating = null;
    this.emit();
    this.speakStepIfSpoken();
  }

  skipStep(): void {
    const flat = this.viewedStep;
    if (!flat) return;
    if (!this.tracker.skip(flat.step.id)) return;
    this.viewStepId = null;
    this.doc.ui.skipped = this.tracker.skippedIds();
    this.refreshToolbox();
    this.afterProgressChange();
    this.markChanged();
    this.speakStepIfSpoken();
  }

  /** The guide reads each step on its own on levels 1 and 2. Levels 3 to 5 read only when asked. */
  get spoken(): boolean {
    return this.level <= 2;
  }

  speakStepIfSpoken(): void {
    if (!this.spoken || this.celebrating) return;
    if (this.showcase) {
      if (this.cardStep) void this.say(plain(this.named(this.cardStep.text)));
      return;
    }
    const flat = this.viewedStep;
    if (flat) void this.say(plain(flat.step.text));
  }

  /** Reads text aloud as Robi, even when the sound switch is off: the child asked for it. */
  async say(text: string, force = false): Promise<void> {
    /* A newer line cuts this one off, and the older call must not turn the mouth or the sound switch back. */
    const mine = ++this.sayToken;
    const was = this.doc.ui.sound;
    if (force) setSoundEnabled(true);
    this.talking = true;
    this.emit();
    try { await speak(text, { pitch: 1.12, cancel: true }); } catch { /* no voice */ }
    if (mine !== this.sayToken) {
      if (force) setSoundEnabled(this.doc.ui.sound);
      return;
    }
    if (force) setSoundEnabled(was);
    this.talking = false;
    this.emit();
  }

  /** Reads the step on screen. Available on every level. */
  listen(): void {
    if (this.showcase) {
      const step = this.cardStep;
      if (step?.card) void this.say(plain(this.named([step.text, ...step.card.how].join(' '))), true);
      return;
    }
    const flat = this.viewedStep;
    if (flat) void this.say(plain(flat.step.text), true);
  }

  /** Reads one revealed hint of the step on screen. Available on every level. */
  listenHint(index: number): void {
    const flat = this.viewedStep;
    const hint = flat?.step.hints[index];
    if (hint) void this.say(plain(hint), true);
  }

  /** Pressing «Mostrame» or «¿Dónde?» counts as help, so a step with no hints can be moved past after it. */
  private noteHelp(): void {
    const flat = this.viewedStep;
    if (flat && hintRungs(flat.step) === 0 && this.hintsShown(flat.step.id) === 0) {
      this.doc.ui.hints[flat.step.id] = 1;
      this.markChanged();
    }
  }

  /** The sprites as the hand sees them: the selected one straight from the workspace, so a block dropped a moment ago counts. */
  private demoSprites(): SpriteView[] {
    const art = ART as Record<string, { kind: string } | undefined>;
    return this.doc.sprites.map((s) => ({
      id: s.id,
      name: s.name,
      art: s.art,
      kind: art[s.art]?.kind ?? '',
      scripts: s.id === this.doc.selected && this.editor ? this.editor.scripts() : scriptsOf(s),
      loose: s.id === this.doc.selected && this.editor ? this.editor.looseStacks() : [],
    }));
  }

  /** «Mostrame»: shows the next missing part of what the step asks for, and never edits the project. */
  async demo(step: GameStep): Promise<void> {
    this.noteHelp();
    if (!this.root || !step.demoScript) return;
    this.editor?.flushPending();
    const scripts = Array.isArray(step.demoScript) ? step.demoScript : [step.demoScript as Script];
    let plan: DemoPlan;
    try {
      plan = planDemo({ scripts, sprite: step.demoSprite, each: step.demoEach }, this.demoSprites(), this.doc.selected);
    } catch (e) {
      console.warn('The hand could not plan this step', e);
      return;
    }
    await runDemo(this.depsForDemo(), plan);
  }

  async point(selector: string): Promise<void> {
    this.noteHelp();
    if (this.root) await pointAt(this.depsForDemo(), selector);
  }

  private depsForDemo() {
    return { root: this.root!, editor: this.editor, sfx: (n: string) => playSfx(n), say: (t: string) => { if (this.spoken) void this.say(t); } };
  }

  get stepContext(): StepContext | null {
    return this.machine ? { stats: this.machine.stats, program: this.program, machine: this.machine, ui: { backdropChosen: this.doc.ui.backdropChosen, tried: this.tried } } : null;
  }

  private checkGuide(): void {
    const m = this.machine;
    if (!m || !this.tracker.hasGuide) return;
    if (!this.needsCheck && !m.running) return;
    const edited = this.needsCheck;
    this.needsCheck = false;
    const ctx = this.stepContext;
    if (!ctx) return;
    let fresh: FlatStep[] = [];
    try { fresh = this.tracker.evaluate(ctx); } catch (e) { this.fail(e); }
    if (fresh.length) this.stepsCompleted(fresh);
    if (edited || fresh.length) this.checkBroken();
  }

  /**
   * Recomputes the «borraste algo» warning from the program as it is now, on every edit and every check. It is
   * never stored: fixing the program in any way that passes the step, or reopening the project, clears it.
   */
  private checkBroken(): void {
    let all: FlatStep[] = [];
    try { all = this.tracker.brokenSteps(this.program, this.stepContext); } catch { all = []; }
    /* A dismissed step that got fixed is forgotten, so breaking it again warns again. */
    const ids = new Set(all.map((f) => f.step.id));
    for (const id of [...this.brokenDismissed]) if (!ids.has(id)) this.brokenDismissed.delete(id);
    const flat = all.find((f) => !this.brokenDismissed.has(f.step.id)) ?? null;
    const next = flat ? { index: flat.index, title: flat.step.title } : null;
    if (next?.index === this.broken?.index) return;
    this.broken = next;
    this.emit();
  }

  /** «Deshacer»: undoes the last change in the block editor. */
  undo(): void {
    try { this.editor?.ws.undo(false); } catch { /* nothing to undo */ }
  }

  private stepsCompleted(fresh: FlatStep[]): void {
    this.captureCode();
    if (this.showcase) return this.cardsCompleted(fresh);
    if (!this.tracker.broken(this.program, this.stepContext)) this.keepGood();
    const last = fresh[fresh.length - 1];
    const phaseDone = fresh.some((f) => this.tracker.phaseClosed(f.phaseIndex));
    const finishedNow = this.tracker.finished && !this.onFinishedOnce;
    this.onFinishedOnce = this.tracker.finished;
    this.viewStepId = last.step.id;
    this.celebrating = { stepId: last.step.id, phaseDone };
    playSfx('win');
    if (phaseDone || finishedNow) confetti();
    this.refreshToolbox();
    this.afterProgressChange();
    this.markChanged();
    if (this.celebrateTimer) clearTimeout(this.celebrateTimer);
    this.celebrateTimer = setTimeout(() => {
      this.celebrating = null;
      this.viewStepId = null;
      this.emit();
      this.speakStepIfSpoken();
    }, phaseDone ? 2400 : 1500);
  }

  /* ---------- showcase games: cards, safety net ---------- */

  get showcase() {
    return this.game?.showcase ?? null;
  }

  /** The step whose tutorial is open. */
  get cardStep(): GameStep | null {
    return this.cardId ? (this.tracker.steps.find((s) => s.step.id === this.cardId)?.step ?? null) : null;
  }

  /** Puts the current names of the sprites in a text: a child who turned Toby into Lumi reads «Lumi». */
  named(text: string): string {
    return text.replace(/\{(\w+)\}/g, (_, id: string) => (this.doc.sprites.find((s) => s.id === id) ?? this.game?.setup.sprites.find((s) => s.id === id))?.name ?? id);
  }

  openCard(id: string | null): void {
    if (this.root) cancelDemo(this.root);
    if (this.celebrateTimer) clearTimeout(this.celebrateTimer);
    this.celebrating = null;
    this.cardId = id;
    const card = this.cardStep?.card;
    const target = card?.newSprite ? this.newSpriteId() : card?.sprite;
    if (target) this.selectSprite(target);
    playSfx('pop');
    hush();
    this.emit();
    this.speakStepIfSpoken();
  }

  /** A sprite the child added, the selected one first. */
  private newSpriteId(): string | null {
    const mine = this.doc.sprites.filter((s) => !this.game?.setup.sprites.some((b) => b.id === s.id));
    return (mine.find((s) => s.id === this.doc.selected) ?? mine[mine.length - 1])?.id ?? null;
  }

  /** «Mostrame» of a card: the hand brings the next block, or points at the block or button to change. */
  async demoCard(): Promise<void> {
    const step = this.cardStep;
    const card = step?.card;
    if (!this.root || !step || !card) return;
    this.editor?.flushPending();
    const deps = this.depsForDemo();
    if (card.sprite && !this.doc.sprites.some((s) => s.id === card.sprite)) {
      this.notice = this.named(`Falta {${card.sprite}}. Tocá «Arreglar mi juego» para traerlo de vuelta.`);
      this.emit();
      return pointAt(deps, 'repair');
    }
    let target = card.sprite ?? null;
    if (card.newSprite) {
      target = this.newSpriteId();
      if (!target) return pointAt(deps, 'add-sprite', 'Primero agregá a alguien con este botón.');
    }
    if (target) this.selectSprite(target);
    if (card.block) {
      const want = card.block;
      const found = flattenScripts(this.editor?.scripts() ?? []).find((b) => b.type === want.type && (!want.where || want.where(b)))
        ?? flattenScripts(this.editor?.scripts() ?? []).find((b) => b.type === want.type);
      const block = this.editor?.blockById(found?.id);
      if (block && this.editor) {
        this.editor.reveal(block);
        return pointAt(deps, this.editor.editableOf(block), want.caption);
      }
      this.editor?.openCategoryOf(want.type);
      const fresh = this.editor?.flyoutBlock(want.type);
      if (fresh && this.editor) this.editor.showInFlyout(fresh);
      return pointAt(deps, fresh ? fresh.getSvgRoot() : 'toolbox', 'Ese bloque ya no está. Traé este y ponelo en tu programa.');
    }
    if (step.demoScript && target) {
      const scripts = Array.isArray(step.demoScript) ? step.demoScript : [step.demoScript as Script];
      try {
        return await runDemo(deps, planDemo({ scripts, sprite: target }, this.demoSprites(), this.doc.selected));
      } catch (e) {
        console.warn('The hand could not plan this card', e);
      }
    }
    if (step.point) return pointAt(deps, step.point);
  }

  private cardsCompleted(fresh: FlatStep[]): void {
    const open = fresh.find((f) => f.step.id === this.cardId);
    const shown = open ?? fresh[fresh.length - 1];
    this.celebrating = { stepId: shown.step.id, phaseDone: this.tracker.finished };
    playSfx('win');
    confetti();
    this.markChanged();
    if (this.celebrateTimer) clearTimeout(this.celebrateTimer);
    this.celebrateTimer = setTimeout(() => {
      this.celebrating = null;
      if (open && this.cardId === open.step.id) this.cardId = null;
      this.emit();
    }, 2200);
  }

  /** A key or a tap ran the program as it is now (a busy machine keeps the old one until the next flag). */
  private noteTried(): void {
    if (this.pendingProgram || this.tried || !this.machine?.threadCount) return;
    this.tried = true;
    this.needsCheck = true;
  }

  /** Changes a sprite's drawing and keeps its blocks, place and size. */
  changeArt(id: string, art: string): void {
    const sp = this.doc.sprites.find((s) => s.id === id);
    const table = ART as Record<string, { name: string; sound: string } | undefined>;
    if (!sp || !table[art] || sp.art === art) return;
    this.editor?.flushPending();
    this.captureCode();
    this.machine?.stopAll();
    /* A name the child wrote stays; the one that came with the drawing changes with it. */
    const original = this.game?.setup.sprites.find((s) => s.id === id)?.name;
    if (sp.name === table[sp.art]?.name || sp.name === original) {
      const name = table[art]!.name;
      sp.name = name;
      for (let k = 2; this.doc.sprites.some((s) => s !== sp && s.name === sp.name); k++) sp.name = `${name} ${k}`;
    }
    sp.art = art;
    this.loadSelectedIntoEditor();
    this.applyProgram();
    playSfx(table[art]!.sound);
    this.markChanged();
  }

  /** Whether removing this sprite leaves the game without one of its own. */
  isCast(id: string): boolean {
    return !!this.showcase?.cast.includes(id);
  }

  /** Scripts of a sprite that stand for an original one: same event and, for a key, same key. */
  private twins(spriteId: string, hat: Script['hat']): Script[] {
    const sprite = this.program.sprites.find((s) => s.id === spriteId);
    return (sprite?.scripts ?? []).filter((sc) => sc.hat.type === hat.type && (hat.type !== 'a_key' || sc.hat.fields.K === hat.fields.K));
  }

  /** Event blocks left with nothing under them, when that stops the game. Code that was changed or removed is not here. */
  deadIssues(): HealthIssue[] {
    const sc = this.showcase;
    if (!sc) return [];
    if (!this.program.sprites.some((s) => s.scripts.some((x) => x.body.length > 0))) {
      return [{ id: 'nothing', text: 'Ningún bloque está conectado, así que no pasa nada' }];
    }
    const out: HealthIssue[] = [];
    for (const p of sc.pillars) {
      if (p.ok(this.program)) continue;
      const same = this.twins(p.restore.sprite, p.restore.script.hat);
      if (!same.length || same.some((x) => x.body.length > 0)) continue;
      const what = /_flag$/.test(p.restore.script.hat.type) ? 'El bloque de empezar' : 'Un bloque de evento';
      out.push({ id: `empty:${p.id}`, text: this.named(`${what} de {${p.restore.sprite}} quedó vacío`) });
    }
    for (const id of [...this.healthDismissed]) if (!out.some((h) => h.id === id)) this.healthDismissed.delete(id);
    return out;
  }

  /** Puts the original blocks back under the event blocks that were left empty. Nothing else changes. */
  refillEmpty(): void {
    const sc = this.showcase;
    if (!sc) return;
    const issues = this.deadIssues();
    if (issues.some((h) => h.id === 'nothing')) {
      for (const id of sc.cast) this.resetCode(id, true);
      return;
    }
    this.editor?.flushPending();
    this.captureCode();
    this.machine?.stopAll();
    for (const p of sc.pillars) {
      if (!issues.some((h) => h.id === `empty:${p.id}`)) continue;
      const sp = this.doc.sprites.find((s) => s.id === p.restore.sprite);
      const hat = p.restore.script.hat;
      const top = sp?.code?.blocks?.blocks?.find((b) => b.type === hat.type && !b.next && (hat.type !== 'a_key' || b.fields?.K === hat.fields.K));
      const chain = irToBlockly([p.restore.script]).blocks?.blocks?.[0]?.next;
      if (!sp?.code || !top || !chain) continue;
      sp.code = JSON.parse(JSON.stringify(sp.code)) as typeof sp.code;
      const mine = sp.code.blocks!.blocks!.find((b) => b.id === top.id && b.type === top.type)!;
      mine.next = chain;
      this.doc.selected = sp.id;
    }
    this.loadSelectedIntoEditor();
    this.applyProgram();
    playSfx('magia');
    this.markChanged();
  }

  /** «Reiniciar código» of one sprite: its blocks as the game came. It can be undone. */
  resetCode(id: string, quiet = false): void {
    const sp = this.doc.sprites.find((s) => s.id === id);
    const original = newDoc(this.game).sprites.find((s) => s.id === id);
    if (!sp || !original) return;
    this.editor?.flushPending();
    this.captureCode();
    this.machine?.stopAll();
    const before = JSON.parse(JSON.stringify(sp.code)) as SpriteDoc['code'];
    for (const v of this.game?.setup.variables ?? []) if (!this.doc.variables.includes(v)) this.doc.variables.push(v);
    sp.code = original.code;
    if (!quiet) this.doc.selected = id;
    this.loadSelectedIntoEditor();
    this.applyProgram();
    this.markChanged();
    if (quiet) return;
    playSfx('pop');
    this.offerUndo(`Reiniciaste el código de ${sp.name}.`, () => {
      const now = this.doc.sprites.find((s) => s.id === id);
      if (!now) return;
      this.machine?.stopAll();
      now.code = before;
      this.doc.selected = id;
      this.loadSelectedIntoEditor();
      this.applyProgram();
      this.markChanged();
    });
  }

  /** Everything the game came with and is not working now, for whoever asks with «Arreglar mi juego». */
  healthIssues(): HealthIssue[] {
    const sc = this.showcase;
    if (!sc) return [];
    const missing = sc.cast.filter((id) => !this.doc.sprites.some((s) => s.id === id)).map((id) => ({ id: `cast:${id}`, text: this.named(`Falta {${id}}`) }));
    const broken = sc.pillars
      .filter((p) => !p.ok(this.program) && !missing.some((m) => m.id === `cast:${p.restore.sprite}`))
      .map((p) => ({ id: p.id, text: this.named(p.broken) }));
    return [...missing, ...broken];
  }

  private askHealth(): void {
    if (this.showcase) this.healthAsked = true;
  }

  dismissHealth(): void {
    for (const h of this.deadIssues()) this.healthDismissed.add(h.id);
    this.emit();
  }

  /** Puts back what is missing. It only adds: the child's own blocks and sprites stay as they are. */
  repair(): void {
    const sc = this.showcase;
    if (!sc) return;
    this.editor?.flushPending();
    this.captureCode();
    this.machine?.stopAll();
    const fresh = newDoc(this.game);
    let last: string | null = null;
    for (const id of sc.cast) {
      if (this.doc.sprites.some((s) => s.id === id)) continue;
      const back = this.trash.get(id) ?? fresh.sprites.find((s) => s.id === id);
      if (back) this.doc.sprites.push(JSON.parse(JSON.stringify(back)) as SpriteDoc);
      last = id;
    }
    for (const p of sc.pillars) {
      if (p.ok(programOf(this.doc))) continue;
      const sp = this.doc.sprites.find((s) => s.id === p.restore.sprite);
      if (!sp) continue;
      for (const v of this.game?.setup.variables ?? []) if (!this.doc.variables.includes(v)) this.doc.variables.push(v);
      const tops = sp.code?.blocks?.blocks ?? [];
      const y = tops.length ? Math.max(...tops.map((b) => b.y ?? 0)) + 220 : 36;
      const added = irToBlockly([p.restore.script], { x: 30, y }).blocks?.blocks ?? [];
      sp.code = { ...sp.code, blocks: { languageVersion: 0, blocks: [...tops, ...added] } };
      last = sp.id;
    }
    this.healthDismissed.clear();
    this.undoable = null;
    if (last) this.doc.selected = last;
    this.loadSelectedIntoEditor();
    this.applyProgram();
    playSfx('magia');
    this.notice = '¡Listo! Tu juego volvió a funcionar, con tus cambios.';
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = null; this.emit(); }, 5000);
    this.markChanged();
  }

  /** Back to the game as it came. The cards stay done, and it can be undone. */
  resetGame(): void {
    this.editor?.flushPending();
    this.captureCode();
    const before = JSON.parse(JSON.stringify(this.doc)) as ProjectDoc;
    this.useDoc(newDoc(this.game));
    this.offerUndo('Volviste al juego original.', () => this.useDoc(before));
  }

  private useDoc(doc: ProjectDoc): void {
    this.machine?.stopAll();
    this.doc = { ...doc, ui: { ...this.doc.ui } };
    this.healthDismissed.clear();
    this.loadSelectedIntoEditor();
    this.applyProgram();
    this.refreshToolbox();
    this.renderer?.setBackdrop(this.doc.backdrop);
    this.markChanged();
  }

  private putBack(sprite: SpriteDoc, index: number): void {
    if (this.doc.sprites.some((s) => s.id === sprite.id)) return;
    this.editor?.flushPending();
    this.captureCode();
    this.machine?.stopAll();
    this.doc.sprites.splice(index, 0, sprite);
    this.doc.selected = sprite.id;
    this.loadSelectedIntoEditor();
    this.applyProgram();
    this.markChanged();
  }

  private offerUndo(label: string, run: () => void): void {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoable = { label, run };
    this.undoTimer = setTimeout(() => { this.undoable = null; this.emit(); }, 9_000);
    this.emit();
  }

  runUndo(): void {
    const u = this.undoable;
    if (!u) return;
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoable = null;
    u.run();
    this.emit();
  }

  private afterProgressChange(): void {
    this.onFinishedOnce = this.onFinishedOnce || this.tracker.finished;
  }

  /** «Terminé»: closes the challenges and gives the project a last save. */
  markDone(): void {
    this.doc.ui.doneClicked = true;
    confetti();
    playSfx('win');
    this.markChanged();
  }

  /* ---------- saving ---------- */

  private markChanged(): void {
    this.needsCheck = true;
    this.dirtySave = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), SAVE_DELAY);
    this.emit();
  }

  progress(): GameProgress {
    return this.tracker.progress(this.clock.total);
  }

  /** The document as plain data, safe to hand to the shell. */
  serialize(): ProjectDoc {
    this.captureCode();
    this.doc.ui.skipped = this.tracker.skippedIds();
    return JSON.parse(JSON.stringify(this.doc)) as ProjectDoc;
  }

  flushSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirtySave) return;
    this.dirtySave = false;
    this.lastSecondsSaved = this.clock.total;
    try {
      this.opts.onSave(this.serialize(), this.progress());
    } catch (e) {
      console.error('Saving failed', e);
    }
  }

  private secondTick(): void {
    this.clock.tick(document.visibilityState === 'visible');
    if (this.clock.total - this.lastSecondsSaved >= 30 && this.tracker.hasGuide) {
      this.dirtySave = true;
      this.flushSave();
    }
  }
}
