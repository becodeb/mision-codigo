// Container for the «Progreso» tab. Refreshes itself while it is visible.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminProgressResponse, AdminStudent } from '../shared/api.ts';
import * as adminApi from './adminApi.ts';
import { GamesTable, NotStarted, ProgressTable } from './ProgressView.tsx';
import { gameRows, groupsOf, notStarted, progressRows } from './progressView.ts';
import { errorMessage } from './StudentsTab.tsx';

export const REFRESH_MS = 15_000;

export function ProgressTab() {
  const [progress, setProgress] = useState<AdminProgressResponse | null>(null);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [group, setGroup] = useState<string>('');

  const refresh = useCallback(async () => {
    try {
      const [next, list] = await Promise.all([adminApi.getProgress(), adminApi.listStudents()]);
      setProgress(next);
      setStudents(list.students);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const deleteProject = async (studentId: number, gameId: string): Promise<string | null> => {
    try {
      await adminApi.deleteProject(studentId, gameId);
      await refresh();
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  };

  const groups = useMemo(() => groupsOf(students), [students]);
  const rows = useMemo(() => progressRows(progress?.entries ?? [], group || null), [progress, group]);
  const games = useMemo(() => gameRows(progress?.games ?? []), [progress]);
  const waiting = useMemo(
    () => notStarted(students.filter((s) => !group || s.group === group), progress?.entries ?? []),
    [students, progress, group],
  );

  return (
    <div className="t-stack">
      <div className="t-toolbar">
        <label className="t-inline">
          <span>Grupo</span>
          <select className="t-select" value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="">Todos</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <button className="t-btn" onClick={() => void refresh()}>Actualizar</button>
        <span className="t-muted" role="status">
          {updatedAt
            ? `Se actualiza solo cada ${REFRESH_MS / 1000} segundos. Última vez: ${updatedAt.toLocaleTimeString('es-AR')}.`
            : 'Cargando…'}
        </span>
      </div>

      {error && <p className="t-alert" role="alert">No se pudo actualizar: {error}</p>}

      {progress && (
        <>
          <section className="t-card" aria-labelledby="progreso-alumnos">
            <h2 id="progreso-alumnos">Por alumno</h2>
            <ProgressTable rows={rows} onDeleteProject={deleteProject} />
            <NotStarted students={waiting} />
          </section>
          <section className="t-card" aria-labelledby="progreso-juegos">
            <h2 id="progreso-juegos">Por juego</h2>
            <GamesTable rows={games} />
          </section>
        </>
      )}
    </div>
  );
}
