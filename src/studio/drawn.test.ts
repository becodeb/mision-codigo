import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SHOWCASE } from '../games/showcase/index.ts';
import { controlsOf } from './controls.ts';
import { DrawnControls } from './drawn.tsx';

/** The faces drawn after the hand: «Hacé clic en» and then one drawing per character. */
function handOf(id: string): string {
  const game = SHOWCASE.find((g) => g.id === id)!;
  const who = (sid: string) => ({ art: game.setup.sprites.find((s) => s.id === sid)?.art, name: sid });
  const html = renderToStaticMarkup(createElement(DrawnControls, { controls: controlsOf(game.setup, game.showcase), who, touch: false }));
  return html.slice(html.indexOf('ct-hand'));
}
const facesOnHand = (id: string): number => (handOf(id).match(/class="ct-who"/g) ?? []).length;

describe('the faces drawn after «Hacé clic en»', () => {
  it('are four when the point is exactly four characters', () => {
    expect(facesOnHand('muestra-concierto')).toBe(4);
    expect(facesOnHand('muestra-guardian')).toBe(4);
  });

  it('go without their names when there are four, so the strip fits on a small window; with three they have them', () => {
    expect(handOf('muestra-concierto')).not.toContain('<b>');
    expect(handOf('muestra-feria')).toContain('<b>');
  });

  it('stay at three when the point is three characters, and none for a quiz', () => {
    expect(facesOnHand('muestra-feria')).toBe(3);
    expect(facesOnHand('muestra-concurso')).toBe(0);
    expect(facesOnHand('muestra-fabrica')).toBe(3);
  });
});
