/**
 * What to press or click, drawn: keycaps for the keys the program uses, the hand for the characters that answer to a
 * click, and the goal in one line. Everything is derived from the child's program, so it stays true after they edit.
 */
import { ICON } from '../art/index.ts';
import type { BubbleKind } from './coach.ts';
import { hasControls, type Controls } from './controls.ts';
import { DrawnControls, Keycaps, Who, type WhoOf } from './drawn.tsx';
import { How } from './How.tsx';
import type { StudioSession } from './session.ts';

/** The child's own characters: a Toby they turned into Lumi reads «Lumi». */
const whoIn = (session: StudioSession): WhoOf => (id) => ({
  art: session.doc.sprites.find((s) => s.id === id)?.art ?? session.game?.setup.sprites.find((s) => s.id === id)?.art,
  name: session.named(`{${id}}`),
});

/** The controls of the program as chips. `touch`: the keys are the arrows on the screen, the clicks are taps. */
export function ControlsLegend({ session, controls, touch, big = false }: { session: StudioSession; controls: Controls; touch: boolean; big?: boolean }) {
  return <DrawnControls controls={controls} who={whoIn(session)} touch={touch} big={big} />;
}

/** Controls (left) and goal (right) in one row. Renders nothing when there is nothing to show. */
export function ControlsStrip({ session, touch, goal }: { session: StudioSession; touch: boolean; goal: boolean }) {
  const controls = session.controls;
  const text = goal ? session.showcase?.goal(session.program) : null;
  const some = hasControls(controls);
  if (!some && !text) return null;
  return (
    <div className="ct-strip dark" data-point="controls">
      {some && <ControlsLegend session={session} controls={controls} touch={touch} />}
      {text && <div className="ct-goal"><How session={session} text={text} /></div>}
    </div>
  );
}

/** Whether the studio has a strip to show for this game and mode (used to size the stage around it). */
export const hasStrip = (session: StudioSession, goal: boolean): boolean => hasControls(session.controls) || (goal && !!session.showcase);

/** The answer to a wrong attempt, at the top of the stage. It never takes a click. */
export function CoachBubble({ session, kind, touch }: { session: StudioSession; kind: BubbleKind; touch: boolean }) {
  const c = session.controls;
  const who = whoIn(session);
  const mover = c.movers[0] ?? c.spacers[0];
  const target = (c.taps.find((t) => t.main) ?? c.taps[0])?.id;
  return (
    <div className="co-bubble" role="status">
      {kind === 'keys' && mover && (
        <>
          <Who who={who} id={mover} />
          <span>se mueve con</span>
          {c.arrows.length > 0 && <Keycaps keys={c.arrows} />}
          {c.space && <kbd className="ct-key wide">espacio</kbd>}
          {touch && <span>de la pantalla</span>}
        </>
      )}
      {kind === 'tap' && target && (
        <>
          <span>Acá se juega {touch ? 'tocando a' : 'haciendo clic en'}</span>
          <Who who={who} id={target} />
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
