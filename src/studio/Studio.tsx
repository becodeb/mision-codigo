import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ART, BACKDROPS, ICON, artThumb, robiSVG, type ArtId } from '../art/index.ts';
import type { GameProgress } from '../shared/api.ts';
import { teamName } from '../shared/levels.ts';
import type { StudioProps } from './contract.ts';
import { StudioErrorBoundary } from './ErrorBoundary.tsx';
import { Guide } from './Guide.tsx';
import { Modal } from './Modal.tsx';
import { StudioSession } from './session.ts';
import './studio.css';

const Icon = ({ html }: { html: string }) => <span className="mc-icon" dangerouslySetInnerHTML={{ __html: html }} />;

const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches === true);

/** The studio: stage, block editor, guide and everything the child needs to build a game. */
export function Studio(props: StudioProps) {
  /* If a render error ever happens, «Seguir» reopens the studio from the last save instead of a blank page. */
  const [attempt, setAttempt] = useState(0);
  const latest = useRef<{ project: unknown; progress: GameProgress } | null>(props.initial);
  const live = useRef(props);
  live.current = props;
  const onSave = useCallback((project: unknown, progress: GameProgress) => {
    latest.current = { project, progress };
    live.current.onSave(project, progress);
  }, []);
  return (
    <StudioErrorBoundary onContinue={() => setAttempt((n) => n + 1)} onExit={props.onExit}>
      <StudioView key={attempt} {...props} initial={attempt === 0 ? props.initial : latest.current} onSave={onSave} />
    </StudioErrorBoundary>
  );
}

type Dialog = null | 'sprites' | 'variable' | 'list' | 'finish';

function StudioView({ game, level, initial, onSave, onExit, next }: StudioProps) {
  const session = useMemo(() => new StudioSession({ game, level, initial, onSave }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const root = useRef<HTMLDivElement>(null);
  const stageSvg = useRef<SVGSVGElement>(null);
  const editorHost = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [show, setShow] = useState(false);
  const touch = useMemo(isTouchDevice, []);

  useEffect(() => {
    session.onCreateRequest = (kind) => setDialog(kind);
    session.mount({ root: root.current!, stage: stageSvg.current!, editor: editorHost.current! });
    return () => session.unmount();
  }, [session]);

  /* Escape closes show mode. */
  useEffect(() => {
    if (!show) return;
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') closeShow(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const openShow = (): void => {
    setShow(true);
    session.setShown(true);
    setTimeout(() => session.flag(), 300);
  };
  const closeShow = (): void => {
    setShow(false);
    session.stop();
  };

  const doc = session.doc;
  const selected = session.selectedSprite;
  const title = game ? game.title : 'Proyecto libre';
  const picture = session.tier === 'picture';

  return (
    <div ref={root} className={`mc-studio tier-${session.tier}${show ? ' show' : ''}${snap.running ? ' running' : ''}`} data-level={level}>
      <header className="mc-topbar">
        <button type="button" className="mc-ibtn" aria-label="Volver al inicio" data-point="exit" onClick={onExit}>
          <Icon html={ICON.home} />
        </button>
        <div className="mc-title">
          <span className="mc-eyebrow">{teamName(level)}</span>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          className="mc-ibtn"
          aria-pressed={doc.ui.sound}
          aria-label={doc.ui.sound ? 'Voces y sonidos activados' : 'Voces y sonidos apagados'}
          data-point="sound"
          onClick={() => session.setSound(!doc.ui.sound)}
        >
          <Icon html={doc.ui.sound ? ICON.sound : ICON.mute} />
        </button>
      </header>

      {game ? <Guide session={session} snap={snap} next={next} onFinish={() => { session.markDone(); setDialog('finish'); }} /> : <FreePrompt />}

      <div className="mc-main">
        <div className="mc-code" data-point="workspace">
          <div className="mc-code-head">
            <span className="mc-who">
              {selected ? (
                <>
                  <svg viewBox="-60 -134 120 140" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[selected.art as ArtId]?.svg() ?? '' }} />
                  <span>Bloques de {selected.name}</span>
                </>
              ) : (
                <>
                  <Icon html={ICON.code} />
                  <span>Tu programa</span>
                </>
              )}
            </span>
            <span className="mc-hint">{picture ? 'Arrastrá bloques desde la izquierda' : 'Elegí una categoría y arrastrá bloques'}</span>
          </div>
          <div className="mc-blockly" ref={editorHost} data-point="toolbox" />
          {!selected && (
            <div className="mc-code-empty">
              <div>
                <p>Primero agregá un personaje para darle bloques.</p>
                <button type="button" className="mc-cta" onClick={() => setDialog('sprites')}>Elegir personaje</button>
              </div>
            </div>
          )}
          <SpritePanel session={session} onAdd={() => setDialog('sprites')} snapRev={snap.rev} />
        </div>

        <aside className="mc-side">
          <div className="mc-runbar">
            <button type="button" className="mc-flag" data-point="flag" aria-label="Empezar" onClick={() => session.flag()}>
              <Icon html={ICON.flagw} />
              <span>Empezar</span>
            </button>
            <button type="button" className="mc-stop" data-point="stop" aria-label="Parar todo" onClick={() => session.stop()}>
              <Icon html={ICON.stop} />
            </button>
            <button type="button" className="mc-showbtn" data-point="show" aria-label="Mostrar en pantalla grande" onClick={openShow}>
              <Icon html={ICON.full} />
              <span>Mostrar</span>
            </button>
          </div>

          <StageBox
            stageRef={stageSvg}
            snap={snap}
            session={session}
            touch={touch}
            showBar={
              show ? (
                <div className="mc-show-bar">
                  <h2>{title}</h2>
                  <button type="button" className="mc-flag" aria-label="Empezar" onClick={() => session.flag()}>
                    <Icon html={ICON.flagw} />
                    <span>Empezar</span>
                  </button>
                  <button type="button" className="mc-stop" aria-label="Parar todo" onClick={() => session.stop()}>
                    <Icon html={ICON.stop} />
                  </button>
                  <button type="button" className="mc-ibtn" aria-label="Cerrar pantalla grande" onClick={closeShow}>
                    <Icon html={ICON.close} />
                  </button>
                </div>
              ) : null
            }
          />
          {!picture && selected && (
            <span className="mc-coords">{selected.name} · x: {Math.round(selected.x)} · y: {Math.round(selected.y)}</span>
          )}

          <div className="mc-panel mc-places" data-point="backdrops">
            <div className="mc-panel-head"><h4>Lugar</h4></div>
            <div className="mc-bd-strip">
              {Object.entries(BACKDROPS).map(([id, def]) => (
                <button
                  key={id}
                  type="button"
                  className={`mc-bd${doc.backdrop === id ? ' sel' : ''}`}
                  aria-label={`Lugar: ${def.name}`}
                  aria-pressed={doc.backdrop === id}
                  onClick={() => session.setBackdrop(id)}
                >
                  <svg viewBox="0 0 480 360" aria-hidden="true" dangerouslySetInnerHTML={{ __html: def.svg(`t${id}-`) }} />
                  <span>{def.name}</span>
                </button>
              ))}
            </div>
          </div>

        </aside>
      </div>

      {snap.notice && (
        <div className="mc-notice" role="status">
          <span>{snap.notice}</span>
          <button type="button" onClick={() => session.dismissNotice()}>Entendido</button>
        </div>
      )}

      {dialog === 'sprites' && (
        <Modal title="Elegí un personaje" className="mc-wide" onClose={() => setDialog(null)}>
          <p className="mc-lead">Después lo podés arrastrar en el escenario para ubicarlo.</p>
          <SpritePicker session={session} onPick={(art) => { session.addSprite(art); setDialog(null); }} />
          <div className="mc-modal-actions"><button type="button" className="mc-mbtn" onClick={() => setDialog(null)}>Cancelar</button></div>
        </Modal>
      )}
      {(dialog === 'variable' || dialog === 'list') && <NameDialog session={session} kind={dialog} onClose={() => setDialog(null)} />}
      {dialog === 'finish' && (
        <Modal title="¡Lo lograste!" className="mc-final" onClose={() => setDialog(null)}>
          <div className="mc-robi big" dangerouslySetInnerHTML={{ __html: robiSVG() }} />
          <p className="mc-lead">Armaste tu propio juego. Podés seguir mejorándolo, probar otro o volver al inicio.</p>
          <div className="mc-modal-actions">
            {next && <button type="button" className="mc-mbtn primary" onClick={next.open}>Probar: {next.title}</button>}
            <button type="button" className={`mc-mbtn${next ? '' : ' primary'}`} onClick={() => setDialog(null)}>Seguir creando</button>
            <button type="button" className="mc-mbtn" onClick={onExit}>Volver al inicio</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FreePrompt() {
  return (
    <section className="mc-guide mc-free" data-point="guide">
      <div className="mc-robi" dangerouslySetInnerHTML={{ __html: robiSVG() }} />
      <div className="mc-gbody">
        <h3>Proyecto libre</h3>
        <p className="mc-steptext">Acá no hay pasos ni respuestas correctas. Inventá una historia, un juego o un baile con todos los bloques.</p>
      </div>
    </section>
  );
}

function StageBox(props: {
  stageRef: React.RefObject<SVGSVGElement | null>;
  snap: ReturnType<StudioSession['getSnapshot']>;
  session: StudioSession;
  touch: boolean;
  showBar: ReactNode;
}) {
  const { snap, session, touch } = props;
  const [answer, setAnswer] = useState('');
  useEffect(() => { if (snap.ask) setAnswer(''); }, [snap.ask?.question]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mc-stage-slot">
      {props.showBar}
      <div className="mc-stage-box" data-point="stage">
        <svg ref={props.stageRef} className="mc-stage" viewBox="0 0 480 360" role="img" aria-label="Escenario" />
        {snap.ended && (
          <div className={`mc-ended ${snap.ended}`} role="alert">
            <h3>{snap.ended === 'win' ? '¡Ganaste!' : 'Perdiste'}</h3>
            <p>{snap.ended === 'win' ? 'Lo lograste. ¿Querés jugar otra vez?' : 'No pasa nada. Probá de nuevo.'}</p>
            <button type="button" className="mc-mbtn primary" onClick={() => session.flag()}>Jugar de nuevo</button>
          </div>
        )}
        {snap.ask && (
          <form className="mc-ask" onSubmit={(e) => { e.preventDefault(); session.answerAsk(answer); }}>
            <label htmlFor="mc-ask-input">{snap.ask.question}</label>
            <input id="mc-ask-input" autoFocus autoComplete="off" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <button type="submit" className="mc-mbtn primary">Listo</button>
          </form>
        )}
        {touch && snap.needsKeys && !snap.ask && <TouchPad session={session} />}
      </div>
    </div>
  );
}

function TouchPad({ session }: { session: StudioSession }) {
  const btn = (key: string, label: string, text: string, cls: string) => (
    <button
      type="button"
      className={`mc-key ${cls}`}
      aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); session.pressKey(key, true); }}
      onPointerUp={() => session.pressKey(key, false)}
      onPointerCancel={() => session.pressKey(key, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {text}
    </button>
  );
  return (
    <div className="mc-touchpad" data-point="keys">
      <div className="mc-arrows">
        {btn('ArrowUp', 'Flecha arriba', '▲', 'up')}
        {btn('ArrowLeft', 'Flecha izquierda', '◀', 'left')}
        {btn('ArrowDown', 'Flecha abajo', '▼', 'down')}
        {btn('ArrowRight', 'Flecha derecha', '▶', 'right')}
      </div>
      {btn(' ', 'Barra espaciadora', 'Espacio', 'space')}
    </div>
  );
}

function SpritePanel({ session, onAdd }: { session: StudioSession; onAdd: () => void; snapRev: number }) {
  const doc = session.doc;
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  const selected = session.selectedSprite;
  return (
    <div className="mc-panel mc-tray" data-point="sprites">
      <div className="mc-panel-head">
        <h4>Personajes</h4>
        {selected && (
          <label className="mc-name-row">
            Nombre
            <input maxLength={16} autoComplete="off" value={selected.name} onChange={(e) => session.renameSprite(selected.id, e.target.value)} />
          </label>
        )}
      </div>
      <div className="mc-sprites">
        {doc.sprites.map((s) => (
          <div
            key={s.id}
            data-sprite={s.id}
            className={`mc-sp-card${s.id === doc.selected ? ' sel' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`Elegir a ${s.name}`}
            onClick={() => session.selectSprite(s.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); session.selectSprite(s.id); } }}
          >
            <svg viewBox="-60 -134 120 140" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[s.art as ArtId]?.svg() ?? '' }} />
            <span className="nm">{s.name}</span>
            <button
              type="button"
              className={`mc-sp-del${armed === s.id ? ' armed' : ''}`}
              aria-label={`Quitar a ${s.name}`}
              onClick={(e) => {
                e.stopPropagation();
                if (armed === s.id) { setArmed(null); session.removeSprite(s.id); } else setArmed(s.id);
              }}
            >
              {armed === s.id ? '¿Quitar?' : '×'}
            </button>
          </div>
        ))}
        <button type="button" className="mc-sp-add" data-point="add-sprite" aria-label="Agregar personaje" onClick={onAdd}>
          <Icon html={ICON.plus} />
          <span>Agregar</span>
        </button>
      </div>
    </div>
  );
}

function SpritePicker({ session, onPick }: { session: StudioSession; onPick: (art: string) => void }) {
  const ids = Object.keys(ART) as ArtId[];
  const characters = ids.filter((id) => ART[id].kind === 'character');
  const objects = session.offersObjects ? ids.filter((id) => ART[id].kind === 'object') : [];
  const group = (title: string | null, list: ArtId[]) => (
    <>
      {title && <h4 className="mc-pick-title">{title}</h4>}
      <div className="mc-pick-grid">
        {list.map((id) => (
          <button key={id} type="button" className="mc-pick" onClick={() => onPick(id)}>
            <svg viewBox="-60 -134 120 140" aria-hidden="true" dangerouslySetInnerHTML={{ __html: artThumb(id).replace(/^<svg[^>]*>|<\/svg>$/g, '') }} />
            {ART[id].name}
          </button>
        ))}
      </div>
    </>
  );
  return (
    <div className="mc-pick-body">
      {group(objects.length ? 'Personajes' : null, characters)}
      {objects.length > 0 && group('Objetos', objects)}
    </div>
  );
}

function NameDialog({ session, kind, onClose }: { session: StudioSession; kind: 'variable' | 'list'; onClose: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const noun = kind === 'variable' ? 'variable' : 'lista';
  const submit = (): void => {
    const problem = session.createName(kind, name);
    if (problem) setError(problem);
    else onClose();
  };
  return (
    <Modal title={kind === 'variable' ? 'Crear variable' : 'Crear lista'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mc-name-form">
        <p className="mc-lead">
          {kind === 'variable' ? 'Una variable guarda un valor que puede cambiar, como las vidas.' : 'Una lista guarda muchas cosas en orden, como los nombres de los jugadores.'}
        </p>
        <label>
          Nombre de la {noun}
          <input value={name} maxLength={16} autoComplete="off" onChange={(e) => { setName(e.target.value); setError(null); }} />
        </label>
        {error && <p className="mc-error" role="alert">{error}</p>}
        <div className="mc-modal-actions">
          <button type="button" className="mc-mbtn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="mc-mbtn primary">Crear</button>
        </div>
      </form>
    </Modal>
  );
}
