import type { CSSProperties } from 'react';
import { ART, artThumb } from '../art/index.ts';
import type { ArtId } from '../art/index.ts';
import type { SessionStudent } from '../shared/api.ts';
import { teamName } from '../shared/levels.ts';
import { Robi } from './Robi.tsx';
import { TEAM_COLORS } from './chooser.ts';
import type { CardStatus, Chooser as ChooserModel, GameCard } from './chooser.ts';

interface Props {
  student: SessionStudent;
  model: ChooserModel;
  /** Set when the progress could not be fetched; the cards still work. */
  problem: string | null;
  loading: boolean;
  onOpen: (gameId: string) => void;
  onReload: () => void;
  onNotMe: () => void;
}

const TINTS = ['#FFE9C7', '#DDF1FF', '#E6F7DC', '#F1E6FF'];

function Cover({ cover, index }: { cover: string; index: number }) {
  const tint = TINTS[index % TINTS.length];
  const known = cover in ART;
  return (
    <div className="c-art" style={{ background: tint }}>
      {known ? (
        <span className="c-art-svg" dangerouslySetInnerHTML={{ __html: artThumb(cover as ArtId) }} />
      ) : (
        <Robi className="c-art-robi" />
      )}
    </div>
  );
}

function StatusLine({ status }: { status: CardStatus }) {
  if (status.kind === 'new') return <p className="c-status c-new">Nuevo</p>;
  if (status.kind === 'finished') return <p className="c-status c-done">¡Terminado!</p>;
  const percent = status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;
  return (
    <div className="c-status">
      <p>
        Vas por la fase {status.phase} de {status.phases}
      </p>
      <div className="c-bar" role="img" aria-label={`${percent} por ciento hecho`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function actionLabel(status: CardStatus): string {
  if (status.kind === 'new') return 'Empezar';
  if (status.kind === 'finished') return 'Abrirlo';
  return 'Seguir';
}

function GameCardView({ card, index, onOpen }: { card: GameCard; index: number; onOpen: (id: string) => void }) {
  const { game, status } = card;
  return (
    <li>
      <button className="c-card" onClick={() => onOpen(game.id)}>
        <Cover cover={game.cover} index={index} />
        <span className="c-body">
          <span className="c-title">{game.title}</span>
          <span className="c-pitch">{game.pitch}</span>
          <StatusLine status={status} />
          <span className="c-go">{actionLabel(status)}</span>
        </span>
      </button>
    </li>
  );
}

export function Chooser({ student, model, problem, loading, onOpen, onReload, onNotMe }: Props) {
  const color = TEAM_COLORS[student.level];
  return (
    <main className="w-screen gutter" style={{ '--team': color } as CSSProperties}>
      <div className="w-wrap">
        <header className="c-head">
          <Robi className="c-robi" />
          <div className="c-hello">
            <h1>¡Hola, {student.name}!</h1>
            <p className="c-team">
              <span className="c-dot" aria-hidden="true" />
              {teamName(student.level)}
            </p>
          </div>
          <button className="btn btn-quiet" onClick={onNotMe}>
            No soy yo
          </button>
        </header>

        {problem && (
          <div className="w-problem" role="alert">
            <span>{problem}</span>
            <button className="btn" onClick={onReload}>Probar de nuevo</button>
          </div>
        )}

        <h2 className="c-lead">¿Qué querés armar hoy?</h2>

        {loading ? (
          <p className="w-status" role="status">Buscando tus juegos…</p>
        ) : (
          <>
            {model.cards.length === 0 && (
              <div className="w-message">
                <h2>Todavía no hay juegos para tu equipo</h2>
                <p>Mientras tanto, podés armar lo que quieras en el proyecto libre.</p>
              </div>
            )}
            <ul className="c-grid">
              {model.cards.map((card, index) => (
                <GameCardView key={card.game.id} card={card} index={index} onOpen={onOpen} />
              ))}
              <li>
                <button className="c-card c-free" onClick={() => onOpen('libre')}>
                  <div className="c-art c-art-free">
                    <Robi className="c-art-robi" />
                  </div>
                  <span className="c-body">
                    <span className="c-title">Proyecto libre</span>
                    <span className="c-pitch">Armá lo que se te ocurra, sin pasos ni guía.</span>
                    <span className="c-go">{model.freeStarted ? 'Seguir' : 'Empezar'}</span>
                  </span>
                </button>
              </li>
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
