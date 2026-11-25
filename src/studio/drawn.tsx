/**
 * What to press or click, drawn with keycaps and the hand. No session and no Blockly here: the game picker uses it before
 * any studio is loaded, and the studio's legend wraps it with the child's own characters.
 */
import { ART, type ArtId } from '../art/index.ts';
import type { ArrowKey, Controls } from './controls.ts';
import { HAND } from './hand.ts';
import './drawn.css';

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

/** A drawing as a face: objects (a star, a rock) get a tighter frame so they read as large as a character. */
export function ArtFace({ art }: { art: string | undefined }) {
  const def = art ? ART[art as ArtId] : undefined;
  return def ? <svg viewBox={def.kind === 'object' ? '-40 -64 80 72' : '-60 -134 120 140'} aria-hidden="true" dangerouslySetInnerHTML={{ __html: def.svg() }} /> : null;
}

/** Who a sprite id is: its drawing and its name. */
export type WhoOf = (id: string) => { art: string | undefined; name: string };

export const Who = ({ who, id, name = true }: { who: WhoOf; id: string; name?: boolean }) => (
  <span className="ct-who"><ArtFace art={who(id).art} />{name && <b>{who(id).name}</b>}</span>
);

/** The controls as chips. `touch`: the keys are the arrows on the screen, the clicks are taps. */
export function DrawnControls({ controls, who, touch, big = false }: { controls: Controls; who: WhoOf; touch: boolean; big?: boolean }) {
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
          {movers.slice(0, 2).map((id) => <Who key={id} who={who} id={id} />)}
        </span>
      )}
      {space && (
        <span className="ct-group">
          <kbd className="ct-key wide">espacio</kbd>
          {spacers.length > 0 && <span className="ct-to">activa a</span>}
          {spacers.slice(0, 2).map((id) => <Who key={id} who={who} id={id} />)}
        </span>
      )}
      {shown.length > 0 && (
        <span className="ct-group">
          <span className="ct-hand" aria-hidden="true" dangerouslySetInnerHTML={{ __html: HAND }} />
          <span className="ct-to">{touch ? 'Tocá a' : 'Hacé clic en'}</span>
          {shown.map((t) => <span key={t.id} className={t.main ? undefined : 'ct-side'}><Who who={who} id={t.id} name={t.main} /></span>)}
        </span>
      )}
    </div>
  );
}
