/**
 * One finger at a time for the block editor. Blockly 11 mixes up pointers: a second finger that lands before a
 * drag starts turns the gesture into a «multi-touch» one, whose moves read whichever finger moved (the block jumps
 * between fingers) or pinch-zoom the workspace; and it never listens to `pointercancel`, so a finger the browser
 * takes away leaves the drag hanging and the editor deaf to every later touch.
 *
 * The gate decides, event by event, what Blockly may see. The first touch or pen pointer that lands on a block
 * editor is the active one; every other pointer is hidden from Blockly while it is down. If the active finger has
 * been resting for a while without dragging anything (a palm on the screen), a new finger takes over: the old
 * gesture is cancelled and the resting finger stays hidden until it lifts. Pure logic, no DOM: `touch.ts` wires
 * it to the window.
 */

export interface GateDecision {
  /** Hide this event from Blockly (and from the rest of the page). */
  swallow: boolean;
  /** Cancel Blockly's gesture in progress before this event goes on. */
  cancelGesture: boolean;
}

const PASS: GateDecision = { swallow: false, cancelGesture: false };
const SWALLOW: GateDecision = { swallow: true, cancelGesture: false };

/** A finger that has stayed down this long without dragging anything is resting (a palm, a hand on the screen). */
export const RESTING_MS = 600;

export class PointerGate {
  private active: number | null = null;
  private activeSince = 0;
  /** Fingers that were overruled: hidden until they lift, even after the active one is gone. */
  private readonly muted = new Set<number>();

  get activePointer(): number | null {
    return this.active;
  }

  /**
   * A pointer went down. `onEditor`: it is a touch or pen pointer that landed on a block editor.
   * `dragging`: Blockly is moving something (a block, the workspace, the flyout) for the active pointer.
   * `now`: a clock in milliseconds.
   */
  down(id: number, onEditor: boolean, dragging: boolean, now: number): GateDecision {
    this.muted.delete(id);
    if (this.active === null || this.active === id) {
      if (onEditor) this.start(id, now);
      return PASS;
    }
    if (dragging || now - this.activeSince < RESTING_MS) {
      /* The first finger is dragging, or is about to: the new one is a stray touch. */
      this.muted.add(id);
      return SWALLOW;
    }
    /* The active finger has only been resting: the new one wins, and the old one is ignored until it lifts. */
    this.muted.add(this.active);
    this.active = null;
    if (onEditor) this.start(id, now);
    return { swallow: false, cancelGesture: true };
  }

  private start(id: number, now: number): void {
    this.active = id;
    this.activeSince = now;
  }

  move(id: number): GateDecision {
    return this.hidden(id) ? SWALLOW : PASS;
  }

  up(id: number): GateDecision {
    const swallow = this.hidden(id);
    this.muted.delete(id);
    if (id === this.active) this.active = null;
    return swallow ? SWALLOW : PASS;
  }

  /** The browser took a pointer away. When it was the active one, the gesture it drove has to be ended by hand. */
  cancel(id: number): GateDecision {
    const swallow = this.hidden(id);
    this.muted.delete(id);
    if (id === this.active) {
      this.active = null;
      return { swallow: false, cancelGesture: true };
    }
    return swallow ? SWALLOW : PASS;
  }

  /** Forget every pointer, for example when the window loses focus. */
  reset(): void {
    this.active = null;
    this.muted.clear();
  }

  private hidden(id: number): boolean {
    return this.muted.has(id) || (this.active !== null && id !== this.active);
  }
}
