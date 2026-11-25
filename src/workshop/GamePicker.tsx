// Presentational: the screen where a child of the open class picks one of the games of their level.
import { ART, BACKDROPS, type ArtId, type BackdropId } from '../art/index.ts';
import type { SessionStudent } from '../shared/api.ts';
import { hasControls } from '../studio/controls.ts';
import { DrawnControls, type WhoOf } from '../studio/drawn.tsx';
import type { PickCard, Picker } from './picker.ts';
import { Robi } from './Robi.tsx';

interface Props {
  student: SessionStudent;
  picker: Picker;
  /** Set when the progress could not be fetched; the cards still work. */
  problem: string | null;
  onOpen: (gameId: string) => void;
  onNotMe: () => void;
}

/** The game's backdrop with its cover drawing on top: what the child will see when it opens. */
function sceneSVG(card: PickCard): string {
  const { game } = card;
  const backdrop = BACKDROPS[game.setup.backdrop as BackdropId];
  const art = ART[game.cover as ArtId];
  const object = art?.kind === 'object';
  const piece = art ? `<svg x="150" y="${object ? 70 : 40}" width="180" height="${object ? 190 : 270}" viewBox="${object ? '-40 -64 80 72' : '-64 -138 128 146'}">${art.svg()}</svg>` : '';
  return `${backdrop ? backdrop.svg(`pk${game.id}-`) : ''}${piece}`;
}

/** The faces and names of the game as it comes: the picker reads them from the setup, not from a child's project. */
const whoIn = (card: PickCard): WhoOf => (id) => {
  const sprite = card.game.setup.sprites.find((s) => s.id === id);
  return { art: sprite?.art, name: sprite?.name ?? id };
};

const progressLabel = (c: PickCard): string => (c.finished ? 'terminado' : `${c.done} de ${c.total} hechos`);

function GameCard({ card, onOpen }: { card: PickCard; onOpen: (id: string) => void }) {
  const { game, done, total, finished, started, last } = card;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const verb = finished ? 'Jugar otra vez' : started ? 'Seguir' : '¡Jugar!';
  return (
    <article className={`pk-card${finished ? ' done' : ''}${last ? ' last' : ''}`}>
      <div className="pk-scene">
        <svg viewBox="0 0 480 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: sceneSVG(card) }} />
        {last && <span className="pk-flag">Seguí con este</span>}
        {finished && <span className="pk-tick" aria-hidden="true">✓</span>}
      </div>
      <div className="pk-body">
        <h2>{game.title}</h2>
        {hasControls(card.controls) && <DrawnControls controls={card.controls} who={whoIn(card)} touch={false} />}
        <p className="pk-pitch">{game.pitch}</p>
        <div className="pk-prog" role="img" aria-label={progressLabel(card)}>
          <strong>{finished ? '¡Terminado!' : <>{done}<i>/{total}</i></>}</strong>
          <span className="pk-bar"><i style={{ width: `${percent}%` }} /></span>
        </div>
        <button type="button" className="pk-go" aria-label={`${verb}: ${game.title}. ${progressLabel(card)}`} onClick={() => onOpen(game.id)}>{verb}</button>
      </div>
    </article>
  );
}

export function GamePicker({ student, picker, problem, onOpen, onNotMe }: Props) {
  const n = picker.cards.length;
  return (
    <main className="pk-screen" aria-labelledby="pk-title">
      <header className="pk-head">
        <Robi className="pk-robi" />
        <h1 id="pk-title">¡Hola, {student.name}! ¿A qué querés jugar?</h1>
      </header>
      {problem && <p className="pk-problem" role="status">{problem}</p>}
      <div className="pk-grid" data-n={n} style={{ ['--n' as string]: n }}>
        {picker.cards.map((card) => <GameCard key={card.game.id} card={card} onOpen={onOpen} />)}
      </div>
      <footer className="pk-foot">
        <button type="button" className="pk-notme" onClick={onNotMe}>No soy {student.name}</button>
      </footer>
    </main>
  );
}
