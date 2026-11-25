import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SHOWCASE } from '../games/showcase/index.ts';
import { stepsOf } from '../games/proof.ts';
import type { GameStep } from '../games/types.ts';
import type { SessionSnapshot, StudioSession } from './session.ts';
import { Tutorial, finishedOf, tutorialSteps } from './Tutorial.tsx';

const game = SHOWCASE[0];
const cards = stepsOf(game);
const byId = (id: string): GameStep => cards.find((c) => c.id === id)!;

/** Just what the bar reads from a session. */
function fake(step: GameStep): StudioSession {
  return {
    cardStep: step,
    tier: 'picture',
    doc: { sprites: game.setup.sprites },
    game,
    named: (t: string) => t.replace(/[{}]/g, ''),
  } as unknown as StudioSession;
}
const snap = (on: string | null, extra: Partial<SessionSnapshot> = {}): SessionSnapshot => ({ on, pick: null, celebrating: null, ...extra }) as SessionSnapshot;
const bar = (step: GameStep, s: SessionSnapshot): string => renderToStaticMarkup(createElement(Tutorial, { session: fake(step), snap: s }));

describe('the bar of an open card', () => {
  const step = byId('baile');
  const how = step.card!.how;

  it('shows the aim, a dot per step and only the step the child is on', () => {
    const html = bar(step, snap(how[1].on));
    expect(html).toContain('sc-dots');
    expect(html.match(/<li/g)).toHaveLength(how.length);
    expect(html.match(/<li class="done"/g)).toHaveLength(1);
    expect(html.match(/<li class="on"/g)).toHaveLength(1);
    const now = html.slice(html.indexOf('sc-now'));
    expect(now).toContain('how-block');
    expect(html.match(/class="sc-now/g)).toHaveLength(1);
  });

  it('puts the step to pick the sprite first, as one more dot', () => {
    const html = bar(step, snap('pick', { pick: { id: 'toby', before: how[0].on } }));
    expect(html.match(/<li/g)).toHaveLength(how.length + 1);
    expect(html).toContain('sc-now pick');
    expect(tutorialSteps(step.card!, { id: 'toby', before: how[0].on })[0].on).toBe('pick');
  });

  it('offers «Ver cómo queda» only when there is a finished program to show', () => {
    expect(bar(step, snap(how[0].on))).toContain('Ver cómo queda');
    expect(finishedOf(step)).toHaveLength(1);
    expect(bar(byId('frase'), snap('change'))).not.toContain('Ver cómo queda');
    expect(bar(byId('fondo'), snap('point'))).not.toContain('Ver cómo queda');
  });

  it('celebrates instead of showing steps', () => {
    const html = bar(step, snap(null, { celebrating: { stepId: step.id, phaseDone: false } }));
    expect(html).toContain('¡Lo lograste!');
    expect(html).not.toContain('sc-now');
    expect(html).not.toContain('Ver cómo queda');
  });
});
