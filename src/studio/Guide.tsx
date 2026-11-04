import { useEffect, useRef, useState } from 'react';
import { ICON, robiSVG } from '../art/index.ts';
import type { GameDefinition } from '../games/types.ts';
import { hintRungs } from './guide.ts';
import { mountExample } from './workspace.ts';
import type { SessionSnapshot, StudioSession } from './session.ts';

const Icon = ({ html }: { html: string }) => <span className="mc-icon" dangerouslySetInnerHTML={{ __html: html }} />;

/** Read-only Blockly workspaces showing the example scripts of a step, one tab per sprite. */
function Example({ session, scripts }: { session: StudioSession; scripts: NonNullable<GameDefinition['phases'][number]['steps'][number]['example']> }) {
  const [tab, setTab] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const current = scripts[Math.min(tab, scripts.length - 1)];
  useEffect(() => {
    if (!host.current) return;
    try {
      return mountExample(host.current, session.tier, current.scripts);
    } catch (e) {
      console.warn('Example failed', e);
      return undefined;
    }
  }, [session, current]);
  return (
    <div className="mc-example">
      <p className="mc-example-lead">Un ejemplo. No hace falta copiarlo igual: cambialo para que sea tu juego.</p>
      {scripts.length > 1 && (
        <div className="mc-tabs" role="tablist">
          {scripts.map((s, i) => (
            <button key={s.sprite} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
              {session.doc.sprites.find((d) => d.id === s.sprite || d.name === s.sprite)?.name ?? s.sprite}
            </button>
          ))}
        </div>
      )}
      <div className="mc-example-ws" ref={host} data-point="example" />
    </div>
  );
}

interface GuideProps {
  session: StudioSession;
  snap: SessionSnapshot;
  next: { title: string; open: () => void } | null;
  onFinish: () => void;
}

export function Guide({ session, snap, next, onFinish }: GuideProps) {
  const { tracker, game } = session;
  if (!game) return null;
  const robi = (
    <div className={`mc-robi${snap.talking ? ' talking' : ''}${snap.celebrating ? ' celebrate' : ''}`} dangerouslySetInnerHTML={{ __html: robiSVG() }} />
  );

  if (tracker.finished && snap.viewIndex >= tracker.steps.length && !snap.celebrating) {
    return (
      <section className="mc-guide mc-finished" data-point="guide" aria-live="polite">
        {robi}
        <div className="mc-gbody">
          <h3>¡Completaste todas las fases!</h3>
          <p>Tu proyecto es tuyo. Elegí una idea, inventá la tuya o seguí mejorando lo que armaste.</p>
          <ul className="mc-challenges">
            {game.challenges.map((c) => (
              <li key={c.title}>
                <strong>{c.title}</strong>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mc-gactions">
          <button type="button" className="mc-gbtn primary" onClick={onFinish}>
            <Icon html={ICON.check} /> Terminé
          </button>
          {next && (
            <button type="button" className="mc-gbtn" onClick={next.open}>
              Probar: {next.title} <Icon html={ICON.next} />
            </button>
          )}
          <button type="button" className="mc-gbtn" onClick={() => session.viewStep(tracker.steps.length - 1)}>
            Repasar los pasos
          </button>
        </div>
      </section>
    );
  }

  const flat = tracker.steps[snap.viewIndex] ?? tracker.steps[tracker.steps.length - 1];
  if (!flat) return null;
  const { step, phase } = flat;
  const done = tracker.isDone(step.id);
  const active = tracker.activeIndex;
  const phaseCount = game.phases.length;
  const prog = tracker.phaseProgress(flat.phaseIndex);
  const shown = session.hintsShown(step.id);
  const rungs = hintRungs(step);
  const hasExample = !!step.example?.length;
  const hintsRevealed = step.hints.slice(0, Math.min(shown, step.hints.length));
  const exampleShown = hasExample && shown > step.hints.length;
  const viewingOther = snap.viewIndex !== active && !snap.celebrating;
  const celebrate = !!snap.celebrating;

  return (
    <section className={`mc-guide${done ? ' done' : ''}${celebrate ? ' celebrate' : ''}`} data-point="guide" aria-live="polite">
      {robi}
      <div className="mc-gbody">
        <div className="mc-ghead">
          <span className="mc-phase">
            Fase {flat.phaseIndex + 1} de {phaseCount}: {phase.title}
          </span>
          <span className="mc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done} aria-label="Pasos de esta fase">
            <i style={{ width: `${(prog.done / Math.max(1, prog.total)) * 100}%` }} />
          </span>
          <span className="mc-count">
            {prog.done} de {prog.total}
          </span>
          <span className="mc-dots">
            {tracker.steps.map((s) => (
              <button
                key={s.step.id}
                type="button"
                disabled={s.index > active}
                className={`${tracker.isDone(s.step.id) ? 'done' : tracker.isSkipped(s.step.id) ? 'skipped' : ''}${s.index === snap.viewIndex ? ' cur' : ''}${s.inPhase === 0 && s.index > 0 ? ' gap' : ''}`}
                aria-label={`Paso ${s.inPhase + 1} de la fase ${s.phaseIndex + 1}: ${s.step.title}`}
                onClick={() => session.viewStep(s.index)}
              />
            ))}
          </span>
        </div>
        {celebrate && snap.celebrating?.phaseDone && <p className="mc-phase-done">¡Terminaste la fase! {game.phases[flat.phaseIndex + 1] ? `Sigue: ${game.phases[flat.phaseIndex + 1].goal}` : ''}</p>}
        <h3>{step.title}</h3>
        <p className="mc-steptext">{step.text}</p>
        {hintsRevealed.length > 0 && (
          <ol className="mc-hints">
            {hintsRevealed.map((h, i) => (
              <li key={i}>
                <b>Pista {i + 1}.</b> {h}{' '}
                <button type="button" className="mc-listen" aria-label={`Escuchar la pista ${i + 1}`} title="Escuchar" onClick={() => session.listenHint(i)}>
                  <Icon html={ICON.sound} />
                </button>
              </li>
            ))}
          </ol>
        )}
        {exampleShown && <Example session={session} scripts={step.example!} />}
      </div>
      <div className="mc-gactions">
        <button type="button" className="mc-gbtn" onClick={() => session.listen()}>
          <Icon html={ICON.sound} /> {session.spoken ? 'Escuchar de nuevo' : 'Escuchar'}
        </button>
        {step.demo && !done && (
          <button type="button" className="mc-gbtn primary" onClick={() => void session.demo(step.demo!)}>
            <Icon html={ICON.eye} /> Mostrame
          </button>
        )}
        {step.point && !done && (
          <button type="button" className="mc-gbtn primary" onClick={() => void session.point(step.point!)}>
            <Icon html={ICON.eye} /> ¿Dónde?
          </button>
        )}
        {!done && shown < rungs && (
          <button type="button" className="mc-gbtn" onClick={() => session.revealHint()}>
            {shown === 0 ? 'Necesito una pista' : shown === rungs - 1 && hasExample ? 'Ver un ejemplo' : 'Otra pista'}
          </button>
        )}
        {!done && shown >= Math.max(rungs, 1) && flat.index === active && (
          <button type="button" className="mc-gbtn" onClick={() => session.skipStep()}>
            Seguir sin este paso <Icon html={ICON.next} />
          </button>
        )}
        {viewingOther && (
          <button type="button" className="mc-gbtn primary" onClick={() => session.viewStep(null)}>
            {tracker.finished ? 'Volver a las ideas' : 'Volver a mi paso'} <Icon html={ICON.next} />
          </button>
        )}
      </div>
    </section>
  );
}
