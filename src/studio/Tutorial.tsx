/**
 * The bar of an open card: the way back, which card it is, what the child will see when it is done (the aim) and the one
 * step they are on, whole, with a dot for each step. «Ver cómo queda» shows the finished program. The hand shows the rest.
 */
import { useEffect, useMemo, useState } from 'react';
import type { GameStep, StepCard } from '../games/types.ts';
import { pickHow } from './chips.ts';
import { Blocks, type Scripts } from './Example.tsx';
import { How, SpriteFace } from './How.tsx';
import { Modal } from './Modal.tsx';
import type { SessionSnapshot, StudioSession } from './session.ts';

export interface TutorialStep { t: string; on: string }

/** The steps of a card as the child lives them: on another sprite, going to the right one is a step of its own, right before the one that needs it. */
export function tutorialSteps(card: StepCard, pick: { id: string; before: string } | null): TutorialStep[] {
  const steps: TutorialStep[] = [...card.how];
  if (pick) steps.splice(Math.max(0, steps.findIndex((h) => h.on === pick.before)), 0, { t: pickHow(pick.id), on: 'pick' });
  return steps;
}

/** What «Ver cómo queda» draws: one program per sprite, or the whole demo for the sprite the card is about. `null` when the card has nothing to show. */
export function finishedOf(step: GameStep): { sprite: string | null; scripts: Scripts }[] | null {
  if (step.example?.length) return step.example.map((e) => ({ sprite: e.sprite, scripts: e.scripts }));
  const demo = step.demoScript;
  if (!demo || !step.card) return null;
  const scripts = Array.isArray(demo) ? [...demo] : [demo as Scripts[number]];
  return scripts.length ? [{ sprite: step.card.newSprite ? null : (step.card.sprite ?? null), scripts }] : null;
}

function Finished({ session, step, onClose }: { session: StudioSession; step: GameStep; onClose: () => void }) {
  const parts = useMemo(() => finishedOf(step) ?? [], [step]);
  return (
    <Modal title="Así queda" className="sc-finished" onClose={onClose}>
      {step.card?.aim && <p className="sc-fin-aim"><How session={session} text={step.card.aim} /></p>}
      <div className={`sc-fin-parts${parts.length > 1 ? ' many' : ''}`}>
        {parts.map((p, i) => (
          <figure key={i}>
            {p.sprite ? <figcaption className="how-spr"><SpriteFace session={session} id={p.sprite} /><span className="nm">{session.named(`{${p.sprite}}`)}</span></figcaption> : parts.length > 1 || step.card?.newSprite ? <figcaption>Tu personaje nuevo</figcaption> : null}
            <Blocks session={session} scripts={p.scripts} />
          </figure>
        ))}
      </div>
      <div className="mc-modal-actions"><button type="button" className="mc-mbtn primary" onClick={onClose}>Listo</button></div>
    </Modal>
  );
}

interface TutorialProps { session: StudioSession; snap: SessionSnapshot }

export function Tutorial({ session, snap }: TutorialProps) {
  const step = session.cardStep;
  const [open, setOpen] = useState(false);
  /* Another card, or this one done: the finished program is not on screen any more. */
  useEffect(() => setOpen(false), [step?.id]);
  if (!step?.card) return null;
  const card = step.card;
  const celebrate = snap.celebrating?.stepId === step.id;
  const steps = tutorialSteps(card, snap.pick);
  const at = Math.max(0, steps.findIndex((h) => h.on === snap.on));
  const shows = !!finishedOf(step);
  return (
    <>
    <section className={`sc-wall sc-tutorial${celebrate ? ' all' : ''}`} data-point="guide" aria-live="polite">
      <button type="button" className="sc-round" aria-label="Volver" onClick={() => session.openCard(null)}><span aria-hidden="true">←</span></button>
      <button type="button" className={`sc-card ${card.kind} on${celebrate ? ' done fresh' : ''}`} aria-label={`Escuchar: ${step.title}`} onClick={() => session.listen()}>
        <span className="ic" aria-hidden="true">{card.icon}</span>
        <span className="lb">{card.label}</span>
        {celebrate && <span className="ok" aria-hidden="true">✓</span>}
      </button>
      {celebrate ? (
        <p className="sc-yes">¡Lo lograste!</p>
      ) : (
        <div className="sc-lines">
          <div className="sc-aimrow">
            <ol className="sc-dots" aria-label={`Paso ${at + 1} de ${steps.length}`}>
              {steps.map((_, i) => <li key={i} className={i < at ? 'done' : i === at ? 'on' : ''} aria-current={i === at ? 'step' : undefined} />)}
            </ol>
            {card.aim && <p className="sc-aim"><How session={session} text={card.aim} /></p>}
          </div>
          <p className={`sc-now${steps[at].on === 'pick' ? ' pick' : ''}`}><How session={session} text={steps[at].t} /></p>
        </div>
      )}
      {shows && !celebrate && <button type="button" className="sc-seeit" onClick={() => setOpen(true)}><span aria-hidden="true">👀</span> Ver cómo queda</button>}
    </section>
    {open && <Finished session={session} step={step} onClose={() => setOpen(false)} />}
    </>
  );
}
