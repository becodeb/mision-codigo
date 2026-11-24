/**
 * Las pantallas de los juegos de la muestra: la entrada, la pared de tarjetas con sus tutoriales, el aviso de lo que
 * dejó de andar y el resumen de cómo está programado. Todo lo que deciden está en la sesión; acá solo se dibuja.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ART, ICON, type ArtId } from '../art/index.ts';
import type { GameDefinition, GameStep } from '../games/types.ts';
import { programOf } from './doc.ts';
import { Modal } from './Modal.tsx';
import { recapOf } from './recap.ts';
import { chipLabel, isBlockType, parseHow } from './chips.ts';
import { blockImage } from '../language/blocks.ts';
import type { BlockType } from '../language/catalog.ts';
import { BLOCK_SPECS } from '../language/spec.ts';
import { blocklyThemes } from '../language/themes.ts';
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
  onExit: () => void;
  onRecap: () => void;
}

export function CardWall(props: WallProps) {
  return props.snap.card ? <Tutorial {...props} /> : <Wall {...props} />;
}

/** One row: the way out, the cards, and how many are done. */
function Wall({ session, snap, onExit, onRecap }: WallProps) {
  const { tracker } = session;
  const steps = tracker.steps.map((s) => s.step);
  const done = steps.filter((s) => tracker.isDone(s.id)).length;
  const fresh = snap.celebrating?.stepId;
  const group = (kind: 'look' | 'code', label: string) => {
    const list = steps.filter((s) => s.card!.kind === kind);
    return (
      <div className={`sc-cards ${kind}`} role="group" aria-label={label} style={{ flexGrow: list.length }}>
        {list.map((s) => {
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
    );
  };
  return (
    <section className={`sc-wall${done === steps.length ? ' all' : ''}`} data-point="guide" aria-live="polite">
      <button type="button" className="sc-round" aria-label="Volver al inicio" data-point="exit" onClick={onExit}><Icon html={ICON.home} /></button>
      {group('look', 'Cambiá cómo es')}
      {group('code', 'Programá qué pasa')}
      <button type="button" className="sc-sum" aria-label={`${done} de ${steps.length} hechos. Ver cómo lo programé`} title="Cómo lo programé" onClick={onRecap}>
        <strong>{done}<i>/{steps.length}</i></strong>
        <span className="sc-bar"><i style={{ width: `${(done / steps.length) * 100}%` }} /></span>
      </button>
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

/** One step drawn: words, buttons, blocks as they look in the toolbox, and sprites with their face. */
function How({ session, text }: { session: StudioSession; text: string }) {
  return (
    <>
      {parseHow(text).map((p, i) => {
        if (p.kind === 'text') return <span key={i}>{p.value}</span>;
        if (p.kind === 'button') return <span key={i} className={`how-btn${p.value === '▶' ? ' go' : ''}`}>{p.value}</span>;
        if (p.kind === 'sprite') {
          const art = session.doc.sprites.find((s) => s.id === p.value)?.art ?? session.game?.setup.sprites.find((s) => s.id === p.value)?.art;
          return <span key={i} className="how-spr">{art && <svg viewBox="-60 -134 120 140" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[art as ArtId]?.svg() ?? '' }} />}{session.named(`{${p.value}}`)}</span>;
        }
        if (!isBlockType(p.value)) return null;
        const type = p.value as BlockType;
        const spec = BLOCK_SPECS[type];
        const img = session.tier === 'picture' ? blockImage(type) : null;
        const styles = (session.tier === 'picture' ? blocklyThemes().picture : blocklyThemes().text).blockStyles as Record<string, { colourPrimary: string } | undefined>;
        return (
          <span key={i} className={`how-block${spec.shape === 'hat' ? ' hat' : ''}${spec.shape === 'value' ? ' value' : ''}`} style={{ background: styles[spec.style]?.colourPrimary }}>
            {img ? <img src={img} alt={chipLabel(type)} /> : chipLabel(type)}
          </span>
        );
      })}
    </>
  );
}

/** The same row: the way back, which card it is, and its steps. The hand shows the rest by itself. */
function Tutorial({ session, snap }: WallProps) {
  const step = session.cardStep;
  if (!step?.card) return null;
  const card = step.card;
  const celebrate = snap.celebrating?.stepId === step.id;
  const at = Math.max(0, card.how.findIndex((h) => h.on === snap.on));
  return (
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
        <ol className="sc-steps">
          {card.how.map((h, i) => (
            <li key={i} className={i < at ? 'done' : i === at ? 'on' : ''} aria-current={i === at ? 'step' : undefined}><How session={session} text={h.t} /></li>
          ))}
        </ol>
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
