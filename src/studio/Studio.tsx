import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ART, BACKDROPS, ICON, artThumb, robiSVG, type ArtId } from '../art/index.ts';
import type { GameProgress } from '../shared/api.ts';
import { teamName } from '../shared/levels.ts';
import type { StudioProps } from './contract.ts';
import { StudioErrorBoundary } from './ErrorBoundary.tsx';
import { Guide } from './Guide.tsx';
import { Modal } from './Modal.tsx';
import { CoachBubble, ControlsStrip, hasStrip } from './Controls.tsx';
import { CardWall, RecapDialog, HealthBar, Intro, RemoveDialog, RepairDialog, signedTitle } from './Showcase.tsx';
import { StudioSession } from './session.ts';
import { lockPageGestures } from './touch.ts';
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

type Dialog = null | 'sprites' | 'variable' | 'list' | 'finish' | 'costume' | 'places' | 'repair' | 'recap' | { remove: string };

function StudioView({ game, level, initial, onSave, onExit, next, author }: StudioProps) {
  const showcase = game?.showcase ?? null;
  const session = useMemo(() => new StudioSession({ game, level, initial, onSave }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const root = useRef<HTMLDivElement>(null);
  const stageSvg = useRef<SVGSVGElement>(null);
  const editorHost = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  /* A showcase game opens ready to play, on the whole screen. */
  const [show, setShow] = useState(!!showcase);
  const [intro, setIntro] = useState(!!showcase);
  const [nudge, setNudge] = useState(false);
  /* A laptop with a touch screen has real arrows: the ones on screen come out when a finger plays, and go when a key is used. */
  const [touch, setTouch] = useState(() => isTouchDevice() && (!showcase || !window.matchMedia?.('(any-pointer: fine)').matches));
  useEffect(() => {
    if (!showcase) return;
    const finger = (e: PointerEvent): void => { if (e.pointerType === 'touch' && (e.target as Element).closest?.('.mc-stage-slot, .sc-play')) setTouch(true); };
    const key = (e: KeyboardEvent): void => { if (e.key.startsWith('Arrow')) setTouch(false); };
    window.addEventListener('pointerdown', finger, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', finger, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [showcase]);

  useEffect(() => {
    session.onCreateRequest = (kind) => setDialog(kind);
    session.mount({ root: root.current!, stage: stageSvg.current!, editor: editorHost.current! });
    return () => session.unmount();
  }, [session]);

  /* The coach keeps quiet under a modal or the entry screen, and knows whether a finger plays. */
  useEffect(() => session.setModal(dialog !== null || intro), [session, dialog, intro]);
  useEffect(() => session.setTouch(touch), [session, touch]);

  /* While the studio is open, fingers move blocks and sprites, never the page (no zoom, no rubber band). */
  useEffect(() => lockPageGestures(root.current!), []);

  /* After playing a little, the way in is easy to find. */
  useEffect(() => {
    if (!showcase || intro || !show) return;
    const timer = setTimeout(() => setNudge(true), 15_000);
    return () => clearTimeout(timer);
  }, [showcase, intro, show]);

  /* Escape closes show mode. */
  useEffect(() => {
    if (!show || intro) return;
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') closeShow(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  /* A small laptop loses a quarter of its screen to the browser's bars: the game takes it back while it is open. */
  const leave = (): void => {
    if (showcase && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onExit();
  };
  const openShow = (): void => {
    setShow(true);
    session.fullScreen = !!showcase;
    session.setShown(true);
    setTimeout(() => session.flag(), 300);
  };
  const closeShow = (): void => {
    setShow(false);
    session.fullScreen = false;
    session.stop();
  };

  const doc = session.doc;
  const selected = session.selectedSprite;
  const mine = !!showcase && session.tracker.completedCount > 0;
  const title = game ? (showcase ? signedTitle(game.title, author, mine) : game.title) : 'Proyecto libre';
  const picture = session.tier === 'picture';
  /* What to press or click, always in sight: under the bar on the whole screen, and in the editor of the showcase games. */
  const stripOn = (show || !!showcase) && hasStrip(session, !!showcase);
  const strip = stripOn ? <ControlsStrip session={session} touch={touch} goal={!!showcase} dark={show} /> : null;

  return (
    <div ref={root} className={`mc-studio tier-${session.tier}${show ? ' show' : ''}${showcase ? ' showcase' : ''}${stripOn ? (show ? ' ct-on' : ' ct-on ct-edit') : ''}${snap.almost ? ' try-now' : ''}${snap.running ? ' running' : ''}${snap.coach.playing ? ' playing' : ''}${snap.coach.flag ? ' flag-pulse' : ''}${snap.coach.keys && touch ? ' coach-keys' : ''}`} data-level={level}>
      {!showcase && <header className="mc-topbar">
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
      </header>}

      {showcase ? <CardWall session={session} snap={snap} onExit={leave} onRecap={() => setDialog('recap')} /> : game ? <Guide session={session} snap={snap} next={next} onFinish={() => { session.markDone(); setDialog('finish'); }} /> : <FreePrompt />}

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
          <SpritePanel
            session={session}
            onAdd={() => setDialog('sprites')}
            onCostume={showcase ? () => setDialog('costume') : null}
            onRemoveCast={(id) => setDialog({ remove: id })}
            snapRev={snap.rev}
          />
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

          {!show && strip}

          <StageBox
            stageRef={stageSvg}
            snap={snap}
            session={session}
            touch={touch}
            onInside={showcase && show ? closeShow : null}
            strip={show ? strip : null}
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
                  {showcase ? (
                    <>
                      {mine && <button type="button" className="sc-recapbtn" onClick={() => setDialog('recap')}>Cómo lo programé</button>}
                      <button type="button" className={`sc-inside${nudge || snap.ended ? ' nudge' : ''}`} onClick={closeShow}>
                        <Icon html={ICON.code} /> Ver por dentro
                      </button>
                    </>
                  ) : (
                    <button type="button" className="mc-ibtn" aria-label="Cerrar pantalla grande" onClick={closeShow}>
                      <Icon html={ICON.close} />
                    </button>
                  )}
                </div>
              ) : null
            }
          />
          {!picture && selected && (
            <Coords session={session} id={selected.id} name={selected.name} x={selected.x} y={selected.y} />
          )}

          {showcase ? (
            <div className="sc-tools">
              <button type="button" className="sc-tool" data-point="backdrops" onClick={() => setDialog('places')}>🖼️ Fondo</button>
              <button type="button" className="sc-tool" data-point="repair" onClick={() => setDialog('repair')}>🛟 Arreglar</button>
              <button type="button" className="sc-tool icon" aria-pressed={doc.ui.sound} aria-label={doc.ui.sound ? 'Voces y sonidos activados' : 'Voces y sonidos apagados'} data-point="sound" onClick={() => session.setSound(!doc.ui.sound)}>
                <Icon html={doc.ui.sound ? ICON.sound : ICON.mute} />
              </button>
            </div>
          ) : (
            <div className="mc-panel mc-places" data-point="backdrops">
              <div className="mc-panel-head"><h4>Lugar</h4></div>
              <PlaceStrip current={doc.backdrop} onPick={(id) => session.setBackdrop(id)} />
            </div>
          )}

        </aside>
      </div>

      {showcase && !intro && <HealthBar session={session} snap={snap} />}

      {intro && game && (
        <Intro
          game={game}
          session={session}
          touch={touch}
          author={author}
          mine={mine}
          onPlay={() => {
            setIntro(false);
            session.setShown(true);
            session.fullScreen = true;
            if (window.innerHeight < 760) void document.documentElement.requestFullscreen?.().catch(() => undefined);
            session.flag();
          }}
          onExit={leave}
        />
      )}

      {snap.notice && (
        <div className="mc-notice" role="status">
          <span>{snap.notice}</span>
          <button type="button" onClick={() => session.dismissNotice()}>Entendido</button>
        </div>
      )}

      {dialog === 'costume' && selected && (
        <Modal title={`¿En quién se convierte ${selected.name}?`} className="mc-wide" onClose={() => setDialog(null)}>
          <p className="mc-lead">Cambia el dibujo. Sus bloques se quedan.</p>
          <SpritePicker session={session} all onPick={(art) => { session.changeArt(selected.id, art); setDialog(null); }} />
          <div className="mc-modal-actions"><button type="button" className="mc-mbtn" onClick={() => setDialog(null)}>Cancelar</button></div>
        </Modal>
      )}
      {dialog === 'places' && (
        <Modal title="Elegí el fondo" className="mc-wide" onClose={() => setDialog(null)}>
          <PlaceStrip current={doc.backdrop} onPick={(id) => { session.setBackdrop(id); setDialog(null); }} />
          <div className="mc-modal-actions"><button type="button" className="mc-mbtn" onClick={() => setDialog(null)}>Cancelar</button></div>
        </Modal>
      )}
      {dialog === 'repair' && <RepairDialog session={session} onClose={() => setDialog(null)} />}
      {dialog === 'recap' && <RecapDialog session={session} author={author} onClose={() => setDialog(null)} />}
      {dialog !== null && typeof dialog === 'object' && (
        <RemoveDialog session={session} id={dialog.remove} onSwap={() => { session.selectSprite(dialog.remove); setDialog('costume'); }} onClose={() => setDialog(null)} />
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

/** The selected sprite's place under the stage. It follows the sprite while the game runs or while it is dragged. */
function Coords({ session, id, name, x, y }: { session: StudioSession; id: string; name: string; x: number; y: number }) {
  const read = (): { x: number; y: number } => {
    const inst = session.machine?.instances.find((i) => i.id === id);
    return { x: Math.round(inst ? inst.x : x), y: Math.round(inst ? inst.y : y) };
  };
  const [at, setAt] = useState(read);
  useEffect(() => {
    const tick = (): void => {
      const next = read();
      setAt((prev) => (prev.x === next.x && prev.y === next.y ? prev : next));
    };
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [session, id, x, y]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className="mc-coords">{name} · x: {at.x} · y: {at.y}</span>;
}

/** Every place, as small pictures. */
function PlaceStrip({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  return (
    <div className="mc-bd-strip">
      {Object.entries(BACKDROPS).map(([id, def]) => (
        <button
          key={id}
          type="button"
          className={`mc-bd${current === id ? ' sel' : ''}`}
          aria-label={`Lugar: ${def.name}`}
          aria-pressed={current === id}
          onClick={() => onPick(id)}
        >
          <svg viewBox="0 0 480 360" aria-hidden="true" dangerouslySetInnerHTML={{ __html: def.svg(`t${id}-`) }} />
          <span>{def.name}</span>
        </button>
      ))}
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
  /** What to press or click, under the bar on the whole screen. */
  strip: ReactNode;
  /** Showcase games, on the whole screen: the way into the code from the end of the game. */
  onInside: (() => void) | null;
}) {
  const { snap, session, touch } = props;
  const [answer, setAnswer] = useState('');
  useEffect(() => { if (snap.ask) setAnswer(''); }, [snap.ask?.question]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mc-stage-slot">
      {props.showBar}
      {props.strip}
      <div className="mc-stage-box" data-point="stage">
        <svg ref={props.stageRef} className="mc-stage" viewBox="0 0 480 360" role="img" aria-label="Escenario" />
        {snap.ended && (
          <div className={`mc-ended ${snap.ended}`} role="alert">
            <h3>{snap.ended === 'win' ? '¡Ganaste!' : 'Perdiste'}</h3>
            <p>{snap.ended === 'win' ? 'Lo lograste. ¿Querés jugar otra vez?' : 'No pasa nada. Probá de nuevo.'}</p>
            <button type="button" className="mc-mbtn primary" onClick={() => session.flag()}>Jugar de nuevo</button>
            {props.onInside && <button type="button" className="mc-mbtn" onClick={props.onInside}>Ver por dentro</button>}
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
        {snap.coach.bubble && <CoachBubble key={snap.coach.bubble.n} session={session} kind={snap.coach.bubble.kind} touch={touch} />}
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

interface SpritePanelProps {
  session: StudioSession;
  onAdd: () => void;
  /** Showcase games: change the drawing of the selected sprite. */
  onCostume: (() => void) | null;
  /** Showcase games: a sprite the game needs is about to be removed. */
  onRemoveCast: (id: string) => void;
  snapRev: number;
}

function SpritePanel({ session, onAdd, onCostume, onRemoveCast }: SpritePanelProps) {
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
        {selected && onCostume && (
          <button type="button" className="sc-act" data-point="costume" aria-label="Cambiar dibujo" onClick={onCostume}><span aria-hidden="true">🎭</span>Cambiar</button>
        )}
        {onCostume && (
          <button type="button" className="sc-act" aria-label="Deshacer el último cambio" onClick={() => session.undo()}><span aria-hidden="true">↶</span>Deshacer</button>
        )}
        {selected && onCostume && session.isCast(selected.id) && (
          <button type="button" className="sc-act" aria-label="Reiniciar código" onClick={() => session.resetCode(selected.id)}><span aria-hidden="true">↺</span>Reiniciar</button>
        )}
        {selected && !onCostume && (
          <label className="mc-name-row">
            <span>Nombre</span>
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
                if (session.isCast(s.id)) return onRemoveCast(s.id);
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

function SpritePicker({ session, onPick, all = false }: { session: StudioSession; onPick: (art: string) => void; all?: boolean }) {
  const ids = Object.keys(ART) as ArtId[];
  const characters = ids.filter((id) => ART[id].kind === 'character');
  const objects = all || session.offersObjects ? ids.filter((id) => ART[id].kind === 'object') : [];
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
