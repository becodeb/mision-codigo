/**
 * Versión para mirar (sin servidor): elegís un equipo y jugás sus misiones de la Clase 2. Usa el estudio y la
 * lista de juegos reales; el avance queda solo en este navegador. No tiene nombres de chicos ni panel docente.
 */
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '../styles/base.css';
import '../workshop/workshop.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { gameById } from '../games/catalog.ts';
import { showcasesFor } from '../games/showcase/index.ts';
import { SHOWCASE_ON } from '../shared/showcase.ts';
import type { GameProgress, ProjectSummary } from '../shared/api.ts';
import { LEVELS, isLevelId, type LevelId } from '../shared/levels.ts';
import { Studio } from '../studio/Studio.tsx';
import { FREE_GAME_ID, buildChooser, nextGame } from '../workshop/chooser.ts';
import { Chooser } from '../workshop/Chooser.tsx';
import { GamePicker } from '../workshop/GamePicker.tsx';
import { buildPicker, firstToOpen, hasChoice, nextToPlay } from '../workshop/picker.ts';
import { TEAM_COLORS } from '../workshop/teamColors.ts';

const GRADES: Record<LevelId, string> = { 1: '1.º y 2.º grado', 2: '2.º y 3.º grado', 3: '3.º y 4.º grado', 4: '4.º y 5.º grado', 5: '6.º y 7.º grado' };

interface Saved {
  project: unknown;
  progress: GameProgress;
  updatedAt: string;
}

const key = (level: LevelId, gameId: string) => `mc-demo:${level}:${gameId}`;

function load(level: LevelId, gameId: string): Saved | null {
  try {
    const raw = localStorage.getItem(key(level, gameId));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function store(level: LevelId, gameId: string, value: Saved): void {
  try {
    localStorage.setItem(key(level, gameId), JSON.stringify(value));
  } catch {
    // Solo una comodidad: sin almacenamiento, la demo igual funciona.
  }
}

/** #/3 es el equipo 3 (entra al juego que dejó); #/3/m3-teclado abre un juego; #/3/juegos muestra a cuál jugar. */
function readHash(): { level: LevelId | null; gameId: string | null } {
  const [, l, g] = location.hash.split('/');
  const n = Number(l);
  return { level: isLevelId(n) ? n : null, gameId: g ? decodeURIComponent(g) : null };
}

function go(level: LevelId | null, gameId: string | null = null): void {
  location.hash = level === null ? '' : gameId ? `/${level}/${encodeURIComponent(gameId)}` : `/${level}`;
}

const PICKER_ROUTE = 'juegos';

/** What this browser has saved of the showcase games of a level, as the server would list it. */
function savedOf(level: LevelId): ProjectSummary[] {
  return showcasesFor(level).flatMap((g) => {
    const s = load(level, g.id);
    return s ? [{ gameId: g.id, progress: s.progress, updatedAt: s.updatedAt }] : [];
  });
}

function Teams() {
  return (
    <main className="w-screen gutter">
      <div className="w-wrap">
        <header className="c-head">
          <div className="c-hello">
            <h1>Misión Código</h1>
            <p>Versión para mirar: elegí un equipo y probá sus misiones. El avance queda guardado solo en este navegador.</p>
          </div>
        </header>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginTop: 20 }}>
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              className="w-btn"
              onClick={() => go(l.id)}
              style={{ padding: '22px 16px', borderRadius: 16, border: `3px solid ${TEAM_COLORS[l.id]}`, background: '#fff', textAlign: 'left', cursor: 'pointer' }}
            >
              <strong style={{ fontSize: 22, display: 'block' }}>{l.teamName}</strong>
              <span style={{ opacity: 0.75 }}>{GRADES[l.id]}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

function App() {
  const [route, setRoute] = useState(readHash);
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const { level } = route;
  if (level === null) return <Teams />;
  const several = SHOWCASE_ON && hasChoice(level);
  if (several && route.gameId === PICKER_ROUTE) {
    return (
      <GamePicker
        student={{ id: 0, name: 'visitante', group: '', level }}
        picker={buildPicker(level, savedOf(level))}
        problem={null}
        onOpen={(id) => go(level, id)}
        onNotMe={() => go(null)}
      />
    );
  }
  const gameId = route.gameId ?? (SHOWCASE_ON ? firstToOpen(level, savedOf(level)).id : null);

  if (gameId) {
    const game = gameId === FREE_GAME_ID ? null : (gameById(gameId) ?? null);
    const following = game?.showcase ? (several ? nextToPlay(game, savedOf(level)) : null) : nextGame(game);
    const next = following ? { title: following.title, open: () => go(level, following.id) } : null;
    return (
      <Studio
        key={`${level}:${gameId}`}
        game={game}
        level={level}
        initial={load(level, gameId)}
        onSave={(project, progress) => store(level, gameId, { project, progress, updatedAt: new Date().toISOString() })}
        onExit={() => go(SHOWCASE_ON ? null : level)}
        next={next}
        onChoose={game?.showcase && several ? () => go(level, PICKER_ROUTE) : undefined}
      />
    );
  }

  const ids = [FREE_GAME_ID, ...buildChooser(level, 2, []).cards.map((c) => c.game.id)];
  const projects: ProjectSummary[] = ids.flatMap((id) => {
    const s = load(level, id);
    return s ? [{ gameId: id, progress: s.progress, updatedAt: s.updatedAt }] : [];
  });
  return (
    <Chooser
      student={{ id: 0, name: 'visitante', group: '', level }}
      model={buildChooser(level, 2, projects)}
      problem={null}
      loading={false}
      onOpen={(id) => go(level, id)}
      onReload={() => setTick((n) => n + 1)}
      onNotMe={() => go(null)}
    />
  );
}

createRoot(document.getElementById('root')!).render(<App />);
