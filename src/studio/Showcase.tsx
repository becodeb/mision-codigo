/**
 * Las pantallas de los juegos de la muestra: la entrada, la pared de tarjetas con sus tutoriales, el aviso de lo que
 * dejó de andar y el resumen de cómo está programado. Todo lo que deciden está en la sesión; acá solo se dibuja.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ART, ICON, type ArtId } from '../art/index.ts';
import type { GameDefinition, GameStep } from '../games/types.ts';
import { programOf } from './doc.ts';
import { Modal } from './Modal.tsx';
import { recapOf } from './recap.ts';
import { Rich } from './rich.tsx';
import type { SessionSnapshot, StudioSession } from './session.ts';
import { mountExample } from './workspace.ts';

type Scripts = NonNullable<GameStep['example']>[number]['scripts'];

const Icon = ({ html }: { html: string }) => <span className="mc-icon" dangerouslySetInnerHTML={{ __html: html }} />;

/** «Juego de Juan»: the author's name on screen, or the plain title when nobody is signed in. */
export const signedTitle = (title: string, author: string | undefined, mine: boolean): string => (author && mine ? `${title}, la versión de ${author}` : title);

/* ---------- entrada ---------- */

interface IntroProps {
  game: GameDefinition;
  author?: string;
  mine: boolean;
  onPlay: () => void;
  onExit: () => void;
}

export function Intro({ game, author, mine, onPlay, onExit }: IntroProps) {
  const play = useRef<HTMLButtonElement>(null);
  useEffect(() => play.current?.focus({ preventScroll: true }), []);
  return (
    <div className="sc-intro" role="dialog" aria-modal="true" aria-label={game.title}>
      <div className="sc-intro-card">
        {author && <p className="sc-hello">¡Hola, {author}!</p>}
        <svg className="sc-cover" viewBox={ART[game.cover as ArtId].kind === 'object' ? '-40 -64 80 72' : '-64 -138 128 146'} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[game.cover as ArtId].svg() }} />
        <h1>{signedTitle(game.title, author, mine)}</h1>
        <ul className="sc-how">
          {game.showcase!.play.map((p) => (
            <li key={p.text}><span aria-hidden="true">{p.icon}</span>{p.text}</li>
          ))}
        </ul>
        <button ref={play} type="button" className="sc-play" onClick={onPlay}><Icon html={ICON.flagw} /> ¡Jugar!</button>
        {author && <button type="button" className="sc-notme" onClick={onExit}>No soy {author}</button>}
      </div>
    </div>
  );
}

/* ---------- tarjetas y tutorial ---------- */

interface WallProps {
  session: StudioSession;
  snap: SessionSnapshot;
  title: string;
  onExit: () => void;
  onRecap: () => void;
}

/** The one bar on top: the way out, whatever the screen is about, and the sound. */
function Bar({ session, onExit, children }: { session: StudioSession; onExit: () => void; children: ReactNode }) {
  const on = session.doc.ui.sound;
  return (
    <header className="sc-bar-top">
      <button type="button" className="mc-ibtn" aria-label="Volver al inicio" data-point="exit" onClick={onExit}><Icon html={ICON.home} /></button>
      {children}
      <button type="button" className="mc-ibtn" aria-pressed={on} aria-label={on ? 'Voces y sonidos activados' : 'Voces y sonidos apagados'} data-point="sound" onClick={() => session.setSound(!on)}>
        <Icon html={on ? ICON.sound : ICON.mute} />
      </button>
    </header>
  );
}

export function CardWall(props: WallProps) {
  return props.snap.card ? <Tutorial {...props} /> : <Wall {...props} />;
}

function Wall({ session, snap, title, onExit, onRecap }: WallProps) {
  const { tracker } = session;
  const steps = tracker.steps.map((s) => s.step);
  const done = steps.filter((s) => tracker.isDone(s.id));
  const fresh = snap.celebrating?.stepId;
  const all = done.length === steps.length;
  const group = (kind: 'look' | 'code', label: string) => (
    <div className={`sc-group ${kind}`} role="group" aria-label={label} style={{ flexGrow: steps.filter((s) => s.card!.kind === kind).length }}>
      <span className="sc-group-label">{label}</span>
      <div className="sc-cards">
        {steps.filter((s) => s.card!.kind === kind).map((s) => {
          const ok = tracker.isDone(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`sc-card${ok ? ' done' : ''}${fresh === s.id ? ' fresh' : ''}`}
              disabled={ok}
              aria-label={ok ? `${s.card!.label}, hecho` : s.card!.label}
              onClick={() => session.openCard(s.id)}
            >
              <span className="ic" aria-hidden="true">{s.card!.icon}</span>
              <span className="lb">{s.card!.label}</span>
              {ok && <span className="ok" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <section className={`sc-wall${all ? ' all' : ''}`} data-point="guide" aria-live="polite">
      <Bar session={session} onExit={onExit}>
        <div className="sc-wall-text">
          <h2>{title}</h2>
          <p>{all ? '¡Hiciste todo! Este juego es tuyo.' : done.length === 0 ? '¿Qué le querés cambiar? Tocá un cuadrado, o cambiá lo que quieras por tu cuenta.' : '¿Qué más le querés cambiar?'}</p>
        </div>
        <div className="sc-count" role="img" aria-label={`${done.length} de ${steps.length} cambios hechos`}>
          <strong>{done.length}</strong> de {steps.length}
          <span className="sc-bar"><i style={{ width: `${(done.length / steps.length) * 100}%` }} /></span>
        </div>
        {done.length > 0 && <button type="button" className="mc-gbtn" onClick={onRecap}>📋 Cómo lo programé</button>}
      </Bar>
      <div className="sc-groups">
        {group('look', 'Cambiá cómo es')}
        {group('code', 'Programá qué pasa')}
      </div>
    </section>
  );
}

function Blocks({ session, scripts }: { session: StudioSession; scripts: Scripts }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    try {
      return mountExample(host.current, session.tier, scripts);
    } catch (e) {
      console.warn('Example failed', e);
      return undefined;
    }
  }, [session, scripts]);
  return <div className="mc-example-ws" ref={host} data-point="example" />;
}

const examples = new WeakMap<GameStep, { sprite: string; scripts: Scripts }[]>();
/** The scripts to look at in a card: its own example, or what the hand builds. */
function examplesOf(step: GameStep): { sprite: string; scripts: Scripts }[] {
  let list = examples.get(step);
  if (!list) {
    const demo = step.demoScript && !step.card!.block ? (Array.isArray(step.demoScript) ? [...step.demoScript] : [step.demoScript as Scripts[number]]) : [];
    list = step.example ?? (demo.length ? [{ sprite: step.card!.sprite ?? 'Nuevo', scripts: demo }] : []);
    examples.set(step, list);
  }
  return list;
}

function Tutorial({ session, snap, onExit }: WallProps) {
  const step = session.cardStep;
  const [example, setExample] = useState(false);
  const [tab, setTab] = useState(0);
  useEffect(() => { setExample(false); setTab(0); }, [step?.id]);
  if (!step?.card) return null;
  const card = step.card;
  const celebrate = snap.celebrating?.stepId === step.id;
  const scripts = examplesOf(step);
  const current = scripts[Math.min(tab, scripts.length - 1)];
  return (
    <section className={`sc-wall sc-tutorial${celebrate ? ' all' : ''}`} data-point="guide" aria-live="polite">
      <Bar session={session} onExit={onExit}>
        <button type="button" className="mc-gbtn" onClick={() => session.openCard(null)}>← Volver</button>
        <h3 className="sc-title"><span aria-hidden="true">{card.icon}</span> {step.title}</h3>
        <button type="button" className="mc-gbtn" onClick={() => session.undo()} title="Deshace el último cambio en los bloques">↶ Deshacer</button>
        <button type="button" className="mc-gbtn" onClick={() => session.listen()}><Icon html={ICON.sound} /> Escuchar</button>
        {scripts.length > 0 && <button type="button" className="mc-gbtn" aria-pressed={example} onClick={() => setExample((v) => !v)}>Ejemplo</button>}
        <button type="button" className="mc-gbtn primary" disabled={celebrate} onClick={() => void session.demoCard()}><Icon html={ICON.eye} /> Mostrame</button>
      </Bar>
      <div className="sc-tut-body">
        <p className="sc-tut-text">
          <Rich text={session.named(step.text)} /> <span className="sc-idea">{card.concept}</span>
        </p>
        {celebrate ? (
          <p className="sc-yes">¡Lo lograste! Este cambio es tuyo.</p>
        ) : snap.almost ? (
          <p className="sc-almost" role="status">¡Muy bien! Ahora <b>probalo</b>: tocá Empezar{session.tier === 'picture' ? ' o al personaje' : ''}.</p>
        ) : (
          <ol className="sc-steps">
            {card.how.map((h, i) => (
              <li key={i}><Rich text={session.named(h)} /></li>
            ))}
          </ol>
        )}
      </div>
      {example && current && (
        <div className="sc-example">
          <div className="mc-tabs" role="tablist">
            {scripts.map((x, i) => (
              <button key={x.sprite} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
                {session.named(`{${x.sprite}}`)}
              </button>
            ))}
            <button type="button" className="sc-close" aria-label="Cerrar el ejemplo" onClick={() => setExample(false)}>×</button>
          </div>
          <Blocks session={session} scripts={current.scripts} />
        </div>
      )}
    </section>
  );
}

/* ---------- que no se rompa ---------- */

export function HealthBar({ session, snap }: { session: StudioSession; snap: SessionSnapshot }) {
  if (!snap.health.length && !snap.undo) return null;
  return (
    <div className="sc-toasts">
      {snap.health.length > 0 && (
        <div className="sc-toast" role="status">
          <span>🔧 {snap.health.slice(0, 2).map((h) => h.text).join('. ')}.</span>
          <button type="button" className="primary" onClick={() => session.refillEmpty()}>Completarlo</button>
          <button type="button" onClick={() => session.dismissHealth()}>Dejalo así</button>
        </div>
      )}
      {snap.undo && (
        <div className="sc-toast" role="status">
          <span>{snap.undo}</span>
          <button type="button" className="primary" onClick={() => session.runUndo()}>↶ Deshacer</button>
        </div>
      )}
    </div>
  );
}

export function RepairDialog({ session, onClose }: { session: StudioSession; onClose: () => void }) {
  const issues = session.healthIssues();
  const [sure, setSure] = useState(false);
  return (
    <Modal title="Arreglar mi juego" onClose={onClose}>
      {issues.length === 0 ? (
        <p className="mc-lead">✅ Tu juego tiene todo lo que necesita para andar.</p>
      ) : (
        <>
          <p className="mc-lead">Esto dejó de andar. Lo puedo agregar de nuevo <b>sin borrar nada tuyo</b>:</p>
          <ul className="sc-issues">{issues.map((h) => <li key={h.id}>{h.text}</li>)}</ul>
        </>
      )}
      <div className="mc-modal-actions">
        {issues.length > 0 && <button type="button" className="mc-mbtn primary" onClick={() => { session.repair(); onClose(); }}>Arreglarlo</button>}
        <button type="button" className={`mc-mbtn${issues.length ? '' : ' primary'}`} onClick={onClose}>{issues.length ? 'Ahora no' : 'Listo'}</button>
      </div>
      <p className="sc-reset">
        {sure ? (
          <>Se van tus cambios (los cuadrados hechos se quedan). <button type="button" onClick={() => { session.resetGame(); onClose(); }}>Sí, empezar de nuevo</button></>
        ) : (
          <button type="button" onClick={() => setSure(true)}>Volver al juego original</button>
        )}
      </p>
    </Modal>
  );
}

export function RemoveDialog({ session, id, onSwap, onClose }: { session: StudioSession; id: string; onSwap: () => void; onClose: () => void }) {
  const name = session.doc.sprites.find((s) => s.id === id)?.name ?? '';
  return (
    <Modal title={`¿Sacar a ${name}?`} onClose={onClose}>
      <p className="mc-lead">{name} es parte del juego: si lo sacás, algo puede dejar de andar. También podés <b>cambiarle el dibujo</b> y que siga haciendo lo mismo.</p>
      <div className="mc-modal-actions">
        <button type="button" className="mc-mbtn primary" onClick={onSwap}>🎭 Cambiarle el dibujo</button>
        <button type="button" className="mc-mbtn" onClick={() => { session.removeSprite(id); onClose(); }}>Sacarlo igual</button>
        <button type="button" className="mc-mbtn" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

/* ---------- cómo lo programé ---------- */

const wrapped = new WeakMap<object, Scripts>();
/** The same list for the same script, so the viewer is not mounted again on every draw. */
function ownScripts(script: Scripts[number]): Scripts {
  const hit = wrapped.get(script);
  if (hit) return hit;
  const list: Scripts = [script];
  wrapped.set(script, list);
  return list;
}

export function RecapDialog({ session, author, onClose }: { session: StudioSession; author?: string; onClose: () => void }) {
  const game = session.game!;
  const sum = useMemo(() => {
    session.editor?.flushPending();
    const done = session.tracker.steps.map((s) => s.step).filter((s) => session.tracker.isDone(s.id));
    return recapOf(game, programOf(session.doc), done);
  }, [session, game]);
  return (
    <Modal title={author ? `Cómo lo programé, por ${author}` : 'Cómo lo programé'} className="sc-recap" onClose={onClose}>
      <div className="sc-nums">
        <div><strong>{sum.changed.length}</strong> {sum.changed.length === 1 ? 'cambio' : 'cambios'}</div>
        <div><strong>{sum.blocks}</strong> bloques en el juego</div>
        <div><strong>{sum.scripts}</strong> programas</div>
      </div>
      <div className="sc-recap-cols">
        <div>
          <h4>Lo que cambié</h4>
          {sum.changed.length === 0 ? <p>Todavía nada. ¡Elegí un cuadrado!</p> : (
            <ul className="sc-list">{sum.changed.map((c) => <li key={c.label}><span aria-hidden="true">{c.icon}</span><div><b>{c.label}</b><br />{c.concept}</div></li>)}</ul>
          )}
        </div>
        <div>
          <h4>Ideas de programación que usa el juego</h4>
          <ul className="sc-list">{sum.ideas.map((i) => <li key={i.name}><span aria-hidden="true">{i.icon}</span><div><b>{i.name}.</b> {i.text}</div></li>)}</ul>
        </div>
      </div>
      {sum.own && (
        <div>
          <h4>Un programa mío, en {sum.own.name}</h4>
          <Blocks session={session} scripts={ownScripts(sum.own.script)} />
        </div>
      )}
      <div className="sc-ask">
        <h4>¿Sabés explicarlo?</h4>
        <ul>{sum.questions.map((q) => <li key={q}>{q}</li>)}</ul>
      </div>
      <div className="mc-modal-actions"><button type="button" className="mc-mbtn primary" onClick={onClose}>Volver al juego</button></div>
    </Modal>
  );
}
