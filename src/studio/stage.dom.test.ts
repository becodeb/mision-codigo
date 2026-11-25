// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { StageView } from '../runtime/host.ts';
import { StageRenderer } from './stage.ts';

const inst = { id: 'star', spriteId: 'star', artId: 'star', face: 'feliz', x: 0, y: 0, jy: 0, bob: 0, rot: 0, flip: 1, size: 100, visible: true, bubble: null };
const view = { backdrop: 'parque', instances: [inst], score: null, vars: [], lists: [], running: true, ended: null } as unknown as StageView;

describe('pressing a sprite on the stage', () => {
  let svg: SVGSVGElement;
  let log: string[];
  let draggable: boolean;

  beforeEach(() => {
    /* jsdom has no SVG geometry: stage units are pixels here. */
    (globalThis as Record<string, unknown>).DOMPoint = class {
      x: number;
      y: number;
      constructor(x: number, y: number) { this.x = x; this.y = y; }
      matrixTransform() { return this; }
    };
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
    svg.getScreenCTM = () => ({ inverse: () => ({}) }) as unknown as DOMMatrix;
    log = [];
    draggable = false;
    const stage = new StageRenderer(svg, {
      onTap: (id) => log.push(`tap ${id}`), canDrag: () => draggable, onPress: () => undefined, onDrag: () => undefined,
      onDragEnd: (id) => log.push(`drop ${id}`), onMiss: () => log.push('miss'), onActivity: () => undefined,
    });
    stage.render(view, { selectedId: null, idle: false, coach: { keys: null, taps: ['star', 'gone'] } });
  });

  const fire = (target: Element, type: string, x: number): void => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX: x, clientY: 0, pointerId: 1 });
    target.dispatchEvent(e);
  };
  const press = (dx: number): void => {
    const hit = svg.querySelector('.spr .hit')!;
    fire(hit, 'pointerdown', 0);
    fire(hit, 'pointermove', dx);
    fire(hit, 'pointerup', dx);
  };

  it('counts as a tap even if the pointer moved, when the sprite cannot be dragged', () => {
    press(0);
    press(30);
    expect(log).toEqual(['tap star', 'tap star']);
  });

  it('moves the sprite when it can be dragged, and still forgives a small shake', () => {
    draggable = true;
    press(8);
    press(30);
    expect(log).toEqual(['tap star', 'drop star']);
  });

  it('tells the empty stage apart', () => {
    fire(svg.querySelector('.bd')!, 'pointerdown', 0);
    expect(log).toEqual(['miss']);
  });

  it('hides the hand of a sprite that is not on the stage', () => {
    const [star, gone] = Array.from(svg.querySelectorAll<SVGGElement>('.co-at'));
    expect(star.style.display).toBe('');
    expect(gone.style.display).toBe('none');
  });
});
