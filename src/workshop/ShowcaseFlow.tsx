// Containers of the open class when a level has several games: where a child lands on entering, and the picker.
import { useCallback, useEffect, useRef, useState } from 'react';
import { showcasesFor } from '../games/showcase/index.ts';
import { ApiError } from '../net/http.ts';
import type { SessionResponse } from '../shared/api.ts';
import type { LevelId } from '../shared/levels.ts';
import { getSession, listProjects } from './api.ts';
import { GamePicker } from './GamePicker.tsx';
import { sameSession } from './live.ts';
import { buildPicker, firstToOpen, type Picker } from './picker.ts';
import { usePolling } from './usePolling.ts';

interface EntryProps {
  level: LevelId;
  onOpen: (gameId: string) => void;
  onSignedOut: () => void;
}

/** Asks what the child has started and opens the game played last, or the first. A failed request never blocks the entry. */
export function EntryContainer({ level, onOpen, onSignedOut }: EntryProps) {
  const callbacks = useRef({ onOpen, onSignedOut });
  callbacks.current = { onOpen, onSignedOut };
  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then(({ projects }) => !cancelled && callbacks.current.onOpen(firstToOpen(level, projects).id))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) callbacks.current.onSignedOut();
        else callbacks.current.onOpen(showcasesFor(level)[0].id);
      });
    return () => {
      cancelled = true;
    };
  }, [level]);
  return (
    <main className="w-screen gutter">
      <p className="w-status" role="status">Abriendo tu proyecto…</p>
    </main>
  );
}

interface PickerProps {
  student: SessionResponse['student'];
  activeClass: SessionResponse['activeClass'];
  onOpen: (gameId: string) => void;
  onNotMe: () => void;
  onSignedOut: () => void;
  /** The server has a newer copy of the session (the teacher changed the level). */
  onSessionChange: (session: SessionResponse) => void;
}

export function PickerContainer({ student, activeClass, onOpen, onNotMe, onSignedOut, onSessionChange }: PickerProps) {
  const [picker, setPicker] = useState<Picker | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const alive = useRef(true);
  const leaving = useRef(false);
  const shown = useRef<SessionResponse>({ student, activeClass });
  shown.current = { student, activeClass };
  const callbacks = useRef({ onSignedOut, onSessionChange });
  callbacks.current = { onSignedOut, onSessionChange };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const signedOut = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    callbacks.current.onSignedOut();
  }, []);

  // Fresh progress on every visit: the studio flushed its saves before leaving, so the server has them.
  useEffect(() => {
    let cancelled = false;
    const level = shown.current.student.level;
    Promise.all([listProjects(), getSession().catch(() => null)])
      .then(([{ projects }, session]) => {
        if (cancelled) return;
        const now = session ?? shown.current;
        setPicker(buildPicker(now.student.level, projects));
        setProblem(null);
        if (session && !sameSession(session, shown.current)) callbacks.current.onSessionChange(session);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) return signedOut();
        setPicker(buildPicker(level, []));
        setProblem('No pudimos traer cuánto avanzaste. Los juegos igual se pueden abrir.');
      });
    return () => {
      cancelled = true;
    };
  }, [signedOut]);

  // A level change by the teacher reaches the child here, with a new list; a failed poll is simply tried again later.
  usePolling(async () => {
    if (!picker || leaving.current) return;
    let session: SessionResponse;
    try {
      session = await getSession();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return signedOut();
      throw error;
    }
    if (!alive.current || sameSession(session, shown.current)) return;
    const { projects } = await listProjects();
    if (!alive.current) return;
    setPicker(buildPicker(session.student.level, projects));
    setProblem(null);
    callbacks.current.onSessionChange(session);
  });

  if (!picker) {
    return (
      <main className="w-screen gutter">
        <p className="w-status" role="status">Buscando tus juegos…</p>
      </main>
    );
  }
  return <GamePicker student={student} picker={picker} problem={problem} onOpen={onOpen} onNotMe={onNotMe} />;
}
