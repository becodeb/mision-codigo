// Container: loads one project, mounts the studio and wires its saving.
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { gameById } from '../games/catalog.ts';
import { ApiError } from '../net/http.ts';
import type { GameProgress } from '../shared/api.ts';
import type { LevelId } from '../shared/levels.ts';
import type { StudioProps } from '../studio/contract.ts';
import { getProject } from './api.ts';
import { loadProject, localKey } from './autosave.ts';
import type { AutosaveRegistry, SaveStatus } from './autosave.ts';
import { FREE_GAME_ID, nextGame } from './chooser.ts';
import { SaveNotice } from './SaveNotice.tsx';

const Studio = lazy(() => import('../studio/Studio.tsx').then((module) => ({ default: module.Studio })));

interface Props {
  studentId: number;
  level: LevelId;
  gameId: string;
  registry: AutosaveRegistry;
  storage: Storage | null;
  /** Back to the chooser. */
  onExit: () => void;
  onOpenGame: (gameId: string) => void;
  /** The session is gone: back to the name screen. */
  onSignedOut: () => void;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; initial: StudioProps['initial'] };

export function StudioHost({ studentId, level, gameId, registry, storage, onExit, onOpenGame, onSignedOut }: Props) {
  const game = useMemo(() => (gameId === FREE_GAME_ID ? null : (gameById(gameId) ?? null)), [gameId]);
  const autosave = registry.get(gameId);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [status, setStatus] = useState<SaveStatus>(autosave.status());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setStatus(autosave.status());
    return autosave.subscribe(setStatus);
  }, [autosave]);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: 'loading' });
    loadProject({ fetchServer: () => getProject(gameId), storage, key: localKey(studentId, gameId) })
      .then((loaded) => {
        if (cancelled) return;
        if (loaded?.needsUpload) autosave.update(loaded.project, loaded.progress);
        setLoad({ kind: 'ready', initial: loaded ? { project: loaded.project, progress: loaded.progress } : null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) return onSignedOut();
        const message = error instanceof ApiError ? error.message : 'No pudimos abrir tu proyecto.';
        setLoad({ kind: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, studentId, storage, autosave, attempt, onSignedOut]);

  const onSave = useCallback(
    (project: unknown, progress: GameProgress) => autosave.update(project, progress),
    [autosave],
  );

  const exit = useCallback(() => {
    void registry.flushAll().then(onExit);
  }, [registry, onExit]);

  const next = useMemo(() => {
    const following = nextGame(game);
    return following ? { title: following.title, open: () => onOpenGame(following.id) } : null;
  }, [game, onOpenGame]);

  if (load.kind === 'loading') {
    return (
      <main className="w-screen gutter">
        <p className="w-status" role="status">Abriendo tu proyecto…</p>
      </main>
    );
  }

  if (load.kind === 'error') {
    return (
      <main className="w-screen gutter">
        <div className="w-wrap">
          <div className="w-message" role="alert">
            <h2>No pudimos abrir tu proyecto</h2>
            <p>{load.message} Tu trabajo no se perdió. Probá de nuevo.</p>
            <div className="w-row">
              <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>Probar de nuevo</button>
              <button className="btn" onClick={onExit}>Volver</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <Suspense
        fallback={
          <main className="w-screen gutter">
            <p className="w-status" role="status">Preparando el estudio…</p>
          </main>
        }
      >
        <Studio
          key={gameId}
          game={game}
          level={level}
          initial={load.initial}
          onSave={onSave}
          onExit={exit}
          next={next}
        />
      </Suspense>
      <SaveNotice status={status} />
    </>
  );
}
