/**
 * What to press or click, drawn: keycaps for the keys the program uses, the hand for the characters that answer to a
 * click, and the goal in one line. Everything is derived from the child's program, so it stays true after they edit.
 */
import { useMemo } from 'react';
import { ICON } from '../art/index.ts';
import type { BubbleKind } from './coach.ts';
import { controlsOf, hasControls, type ArrowKey, type Controls } from './controls.ts';
import { HAND } from './hand.ts';
import { How, SpriteFace } from './How.tsx';
import type { StudioSession } from './session.ts';

const GLYPH: Record<ArrowKey, string> = { ArrowUp: '▲', ArrowLeft: '◀', ArrowDown: '▼', ArrowRight: '▶' };
const CELL: Record<ArrowKey, [number, number]> = { ArrowUp: [2, 1], ArrowLeft: [1, 2], ArrowDown: [2, 2], ArrowRight: [3, 2] };
const LABEL: Record<ArrowKey, string> = { ArrowUp: 'arriba', ArrowLeft: 'izquierda', ArrowDown: 'abajo', ArrowRight: 'derecha' };

/** The arrow keys in an inverted T, only the ones the game uses. */
export function Keycaps({ keys }: { keys: readonly ArrowKey[] }) {
  const top = keys.includes('ArrowUp');
  return (
    <span className="ct-pad" role="img" aria-label={`Flechas: ${keys.map((k) => LABEL[k]).join(', ')}`}>
      {keys.map((k) => (
        <kbd key={k} className="ct-key" style={{ gridColumn: CELL[k][0], gridRow: top ? CELL[k][1] : 1 }}>{GLYPH[k]}</kbd>
      ))}
    </span>
  );
}

const Who = ({ session, id, name = true }: { session: StudioSession; id: string; name?: boolean }) => (
  <span className="ct-who"><SpriteFace session={session} id={id} />{name && <b>{session.named(`{${id}}`)}</b>}</span>
);

/** The controls of the program as chips. `touch`: the keys are the arrows on the screen, the clicks are taps. */
export function ControlsLegend({ session, controls, touch, big = false }: { session: StudioSession; controls: Controls; touch: boolean; big?: boolean }) {
  const { arrows, space, movers, spacers, taps } = controls;
  const main = taps.filter((t) => t.main);
  const side = taps.filter((t) => !t.main);
  /* At most three faces on the hand: the ones that matter first. */
  const shown = [...main, ...side].slice(0, 3);
  return (
    <div className={`ct-legend${big ? ' big' : ''}`}>
      {arrows.length > 0 && (
        <span className="ct-group">
          <Keycaps keys={arrows} />
          {touch && <span className="ct-note">de la pantalla</span>}
          {movers.length > 0 && <span className="ct-to">mueven a</span>}
          {movers.slice(0, 2).map((id) => <Who key={id} session={session} id={id} />)}
        </span>
      )}
      {space && (
        <span className="ct-group">
          <kbd className="ct-key wide">espacio</kbd>
          {spacers.length > 0 && <span className="ct-to">activa a</span>}
          {spacers.slice(0, 2).map((id) => <Who key={id} session={session} id={id} />)}
        </span>
      )}
      {shown.length > 0 && (
        <span className="ct-group">
          <span className="ct-hand" aria-hidden="true" dangerouslySetInnerHTML={{ __html: HAND }} />
          <span className="ct-to">{touch ? 'Tocá a' : 'Hacé clic en'}</span>
          {shown.map((t) => <span key={t.id} className={t.main ? undefined : 'ct-side'}><Who session={session} id={t.id} name={t.main} /></span>)}
        </span>
      )}
    </div>
  );
}

/** Controls (left) and goal (right) in one row. Renders nothing when there is nothing to show. */
export function ControlsStrip({ session, touch, goal, dark }: { session: StudioSession; touch: boolean; goal: boolean; dark: boolean }) {
  const program = session.program;
  const controls = useMemo(() => controlsOf(program), [program]);
  const text = goal ? session.showcase?.goal(program) : null;
  const some = hasControls(controls);
  if (!some && !text) return null;
  return (
    <div className={`ct-strip${dark ? ' dark' : ''}`} data-point="controls">
      {some && <ControlsLegend session={session} controls={controls} touch={touch} />}
      {text && <div className="ct-goal"><How session={session} text={text} /></div>}
    </div>
  );
}

/** Whether the studio has a strip to show for this game and mode (used to size the stage around it). */
export const hasStrip = (session: StudioSession, goal: boolean): boolean => hasControls(controlsOf(session.program)) || (goal && !!session.showcase);

/** The answer to a wrong attempt, at the top of the stage. It never takes a click. */
export function CoachBubble({ session, kind, touch }: { session: StudioSession; kind: BubbleKind; touch: boolean }) {
  const c = session.controls;
  const mover = c.movers[0] ?? c.spacers[0];
  const target = (c.taps.find((t) => t.main) ?? c.taps[0])?.id;
  return (
    <div className="co-bubble" role="status">
      {kind === 'keys' && mover && (
        <>
          <Who session={session} id={mover} />
          <span>se mueve con</span>
          {c.arrows.length > 0 && <Keycaps keys={c.arrows} />}
          {c.space && <kbd className="ct-key wide">espacio</kbd>}
          {touch && <span>de la pantalla</span>}
        </>
      )}
      {kind === 'tap' && target && (
        <>
          <span>Acá se juega {touch ? 'tocando a' : 'haciendo clic en'}</span>
          <Who session={session} id={target} />
        </>
      )}
      {(kind === 'flag' || kind === 'again') && (
        <>
          <span>{kind === 'flag' ? 'Primero tocá' : 'Para jugar otra vez, tocá'}</span>
          <span className="co-flag"><span className="mc-icon" dangerouslySetInnerHTML={{ __html: ICON.flagw }} />Empezar</span>
        </>
      )}
    </div>
  );
}
