// Container: the child's whole flow. Name screen, chooser and studio.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildChooser } from './chooser.ts';
import type { Chooser as ChooserModel } from './chooser.ts';
import { ApiError } from '../net/http.ts';
import type { SessionResponse, StudentListItem } from '../shared/api.ts';
import { endSession, getSession, listProjects, listStudents, saveProject, saveProjectKeepalive, startSession } from './api.ts';
import { createAutosave, createAutosaveRegistry, localKey } from './autosave.ts';
import { Boundary } from './Boundary.tsx';
import { Chooser } from './Chooser.tsx';
import { NameScreen } from './NameScreen.tsx';
import type { NamesState } from './NameScreen.tsx';
import { StudioHost } from './StudioHost.tsx';

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const NETWORK_HINT = 'No hay conexión con el servidor.';

function NamesContainer({ onSession }: { onSession: (session: SessionResponse) => void }) {
  const [state, setState] = useState<NamesState>({ kind: 'loading' });
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    listStudents()
      .then(({ students }) => !cancelled && setState({ kind: 'ready', students }))
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: error instanceof ApiError && !error.isNetwork ? error.message : NETWORK_HINT });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const pick = useCallback(
    (student: StudentListItem) => {
      setPendingId(student.id);
      setProblem(null);
      startSession(student.id)
        .then(onSession)
        .catch((error: unknown) => {
          setPendingId(null);
          setProblem(
            error instanceof ApiError && !error.isNetwork
              ? error.message
              : 'No pudimos entrar. Probá de nuevo en un momento.',
          );
        });
    },
    [onSession],
  );

  return (
    <NameScreen state={state} pendingId={pendingId} problem={problem} onPick={pick} onRetry={() => setAttempt((n) => n + 1)} />
  );
}

interface SignedInProps {
  session: SessionResponse;
  onSignedOut: () => void;
}

function SignedIn({ session, onSignedOut }: SignedInProps) {
  const { student, activeClass } = session;
  const storage = useMemo(browserStorage, []);
  const registry = useMemo(
    () =>
      createAutosaveRegistry((gameId) =>
        createAutosave({
          gameId,
          key: localKey(student.id, gameId),
          save: saveProject,
          storage,
          keepalive: saveProjectKeepalive,
        }),
      ),
    [student.id, storage],
  );
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    const hide = () => registry.flushAllOnHide();
    const onVisibility = () => document.visibilityState === 'hidden' && hide();
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [registry]);

  const signOut = useCallback(async () => {
    await registry.flushAll();
    registry.disposeAll();
    await endSession().catch(() => undefined);
    onSignedOut();
  }, [registry, onSignedOut]);

  // A server that forgot this session (restart, expiry) sends the child back to the names.
  const forget = useCallback(() => {
    registry.disposeAll();
    onSignedOut();
  }, [registry, onSignedOut]);

  const backToChooser = useCallback(() => setGameId(null), []);

  if (gameId !== null) {
    return (
      <Boundary onBack={backToChooser}>
        <StudioHost
          studentId={student.id}
          level={student.level}
          gameId={gameId}
          registry={registry}
          storage={storage}
          onExit={backToChooser}
          onOpenGame={setGameId}
          onSignedOut={forget}
        />
      </Boundary>
    );
  }
  return (
    <ChooserContainer student={student} activeClass={activeClass} onOpen={setGameId} onNotMe={signOut} onSignedOut={forget} />
  );
}

interface ChooserContainerProps {
  student: SessionResponse['student'];
  activeClass: SessionResponse['activeClass'];
  onOpen: (gameId: string) => void;
  onNotMe: () => void;
  onSignedOut: () => void;
}

function ChooserContainer({ student, activeClass, onOpen, onNotMe, onSignedOut }: ChooserContainerProps) {
  const [model, setModel] = useState<ChooserModel>(() => buildChooser(student.level, activeClass, []));
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const leaving = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProjects()
      .then(({ projects }) => {
        if (cancelled) return;
        setModel(buildChooser(student.level, activeClass, projects));
        setProblem(null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401 && !leaving.current) {
          leaving.current = true;
          return onSignedOut();
        }
        setModel(buildChooser(student.level, activeClass, []));
        setProblem('No pudimos traer cuánto avanzaste. Los juegos igual se pueden abrir.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [student.level, activeClass, attempt, onSignedOut]);

  return (
    <Chooser
      student={student}
      model={model}
      problem={problem}
      loading={loading}
      onOpen={onOpen}
      onReload={() => setAttempt((n) => n + 1)}
      onNotMe={onNotMe}
    />
  );
}

type Boot = { kind: 'boot' } | { kind: 'error'; message: string } | { kind: 'names' } | { kind: 'in'; session: SessionResponse };

export function WorkshopApp() {
  const [boot, setBoot] = useState<Boot>({ kind: 'boot' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBoot({ kind: 'boot' });
    getSession()
      .then((session) => !cancelled && setBoot({ kind: 'in', session }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && !error.isNetwork) setBoot({ kind: 'names' });
        else setBoot({ kind: 'error', message: NETWORK_HINT });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const toNames = useCallback(() => setBoot({ kind: 'names' }), []);
  const toSession = useCallback((session: SessionResponse) => setBoot({ kind: 'in', session }), []);

  if (boot.kind === 'boot') {
    return (
      <main className="w-screen gutter">
        <p className="w-status" role="status">Cargando…</p>
      </main>
    );
  }
  if (boot.kind === 'error') {
    return (
      <main className="w-screen gutter">
        <div className="w-wrap">
          <div className="w-message" role="alert">
            <h2>No pudimos conectar</h2>
            <p>{boot.message} Avisale a tu profe si sigue pasando.</p>
            <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>Probar de nuevo</button>
          </div>
        </div>
      </main>
    );
  }
  if (boot.kind === 'names') return <NamesContainer onSession={toSession} />;
  return <SignedIn key={boot.session.student.id} session={boot.session} onSignedOut={toNames} />;
}
