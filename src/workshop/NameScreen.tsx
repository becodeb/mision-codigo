import { useId, useMemo, useState } from 'react';
import type { StudentListItem } from '../shared/api.ts';
import { Robi } from './Robi.tsx';
import { filterStudents, groupStudents } from './names.ts';

export type NamesState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; students: StudentListItem[] };

interface Props {
  state: NamesState;
  /** Id of the name being opened, while the server answers. */
  pendingId: number | null;
  /** A problem while opening a name, shown above the list. */
  problem: string | null;
  onPick: (student: StudentListItem) => void;
  onRetry: () => void;
}

export function NameScreen({ state, pendingId, problem, onPick, onRetry }: Props) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const students = state.kind === 'ready' ? state.students : [];
  const matches = useMemo(() => filterStudents(students, query), [students, query]);
  const groups = useMemo(() => groupStudents(matches), [matches]);
  const busy = pendingId !== null;

  return (
    <main className="w-screen gutter">
      <div className="w-wrap">
        <header className="n-hero">
          <Robi className="n-robi" />
          <div>
            <h1>¿Cómo te llamás?</h1>
            <p className="n-lead">Escribí tu nombre o tocalo en la lista.</p>
          </div>
        </header>

        {state.kind === 'loading' && <p className="w-status" role="status">Buscando los nombres…</p>}

        {state.kind === 'error' && (
          <div className="w-message" role="alert">
            <h2>No pudimos conectar</h2>
            <p>{state.message} Avisale a tu profe si sigue pasando.</p>
            <button className="btn btn-primary" onClick={onRetry}>Probar de nuevo</button>
          </div>
        )}

        {state.kind === 'ready' && students.length === 0 && (
          <div className="w-message">
            <h2>Todavía no hay nombres</h2>
            <p>Tu profe tiene que cargar la lista de la clase. Avisale que no aparece ningún nombre.</p>
            <button className="btn" onClick={onRetry}>Mirar de nuevo</button>
          </div>
        )}

        {state.kind === 'ready' && students.length > 0 && (
          <>
            <form
              className="n-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                if (matches.length === 1 && !busy) onPick(matches[0]);
              }}
            >
              <label htmlFor={inputId} className="sr-only">Tu nombre</label>
              <input
                id={inputId}
                className="n-input"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Escribí tu nombre"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
              />
              {query !== '' && (
                <button type="button" className="btn n-clear" onClick={() => setQuery('')}>
                  Borrar
                </button>
              )}
            </form>

            {problem && <p className="w-problem" role="alert">{problem}</p>}

            <p className="sr-only" role="status">
              {matches.length === 0 ? 'No hay nombres que coincidan.' : `${matches.length} nombres.`}
            </p>

            {matches.length === 0 ? (
              <div className="w-message">
                <h2>No encontramos ese nombre</h2>
                <p>Fijate cómo lo escribiste, o borrá y buscalo en la lista.</p>
                <button className="btn btn-primary" onClick={() => setQuery('')}>Ver todos los nombres</button>
              </div>
            ) : (
              groups.map(({ group, students: list }) => (
                <section key={group} className="n-group" aria-label={group || 'Otros chicos'}>
                  <h2>{group || 'Otros chicos'}</h2>
                  <ul className="n-names">
                    {list.map((student) => (
                      <li key={student.id}>
                        <button
                          className="n-name"
                          disabled={busy}
                          aria-busy={pendingId === student.id}
                          onClick={() => onPick(student)}
                        >
                          {student.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </>
        )}

        <footer className="w-foot">
          <a href="/docente">Soy docente</a>
        </footer>
      </div>
    </main>
  );
}
