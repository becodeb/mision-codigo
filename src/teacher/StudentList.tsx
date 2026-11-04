// The roster as a list of big touch-friendly cards: level in one tap, search, order or group.
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AdminStudent, UpdateStudentRequest } from '../shared/api.ts';
import { getLevel, teamName } from '../shared/levels.ts';
import type { LevelId } from '../shared/levels.ts';
import { TEAM_COLORS } from '../workshop/teamColors.ts';
import { LevelButtons } from './LevelButtons.tsx';
import { groupByLevel, searchRoster, sortByName } from './roster.ts';

interface RowProps {
  student: AdminStudent;
  /** Message of the last failed level save for this child. */
  levelError: string | null;
  onLevel: (student: AdminStudent, level: LevelId) => void;
  /** Resolves null on success, otherwise the message to show. */
  onUpdate: (id: number, patch: UpdateStudentRequest) => Promise<string | null>;
  onDelete: (id: number) => Promise<string | null>;
}

function StudentRow({ student, levelError, onLevel, onUpdate, onDelete }: RowProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [group, setGroup] = useState(student.group);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  // Follow the server copy after a refresh.
  useEffect(() => {
    setName(student.name);
    setGroup(student.group);
  }, [student.name, student.group]);

  async function save(patch: UpdateStudentRequest) {
    const message = await onUpdate(student.id, patch);
    setError(message);
    if (message) {
      setName(student.name);
      setGroup(student.group);
    }
  }

  const commitText = () => {
    const patch: UpdateStudentRequest = {};
    if (name.trim() !== student.name) patch.name = name.trim();
    if (group.trim() !== student.group) patch.group = group.trim();
    if (Object.keys(patch).length > 0) void save(patch);
  };
  const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setName(student.name);
      setGroup(student.group);
      event.currentTarget.blur();
    }
  };

  const message = levelError ?? error;
  return (
    <li className="t-stu" style={{ '--team': TEAM_COLORS[student.level] } as CSSProperties}>
      <div className="t-stu-id">
        <span className="t-stu-name">{student.name}</span>
        <span className="t-stu-sub">
          <span className="t-dot" aria-hidden="true" />
          {teamName(student.level)}
          {student.group && <> · {student.group}</>}
        </span>
      </div>
      <button
        type="button"
        className="t-btn t-stu-more"
        aria-expanded={open}
        aria-label={`Más opciones de ${student.name}`}
        onClick={() => {
          setOpen((o) => !o);
          setArmed(false);
        }}
      >
        ⋯
      </button>
      <LevelButtons value={student.level} label={`Nivel de ${student.name}`} onPick={(level) => onLevel(student, level)} />
      {message && <p className="t-row-error" role="alert">{message}</p>}
      {open && (
        <div className="t-stu-edit">
          <label className="t-field">
            <span>Nombre</span>
            <input
              className="t-input"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitText}
              onKeyDown={onKey}
            />
          </label>
          <label className="t-field">
            <span>Grado</span>
            <input
              className="t-input"
              value={group}
              maxLength={40}
              onChange={(event) => setGroup(event.target.value)}
              onBlur={commitText}
              onKeyDown={onKey}
            />
          </label>
          {armed ? (
            <div className="t-confirm">
              <span>¿Borrar a {student.name} y su avance?</span>
              <button
                className="t-btn t-btn-danger"
                onClick={async () => {
                  const failure = await onDelete(student.id);
                  if (failure) {
                    setError(failure);
                    setArmed(false);
                  }
                }}
              >
                Sí, borrar
              </button>
              <button className="t-btn" onClick={() => setArmed(false)}>Cancelar</button>
            </div>
          ) : (
            <button className="t-btn t-stu-delete" onClick={() => setArmed(true)} aria-label={`Borrar a ${student.name}`}>
              Borrar alumno
            </button>
          )}
        </div>
      )}
    </li>
  );
}

type Order = 'name' | 'level';

interface Props {
  students: AdminStudent[];
  levelErrors: Record<number, string>;
  /** Short confirmation of the last level change, shown near the list. */
  notice: string | null;
  onLevel: RowProps['onLevel'];
  onUpdate: RowProps['onUpdate'];
  onDelete: RowProps['onDelete'];
}

export function StudentList({ students, levelErrors, notice, onLevel, onUpdate, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<Order>('name');
  const searching = query.trim() !== '';
  const shown = useMemo(() => searchRoster(students, query), [students, query]);
  const sorted = useMemo(() => sortByName(shown), [shown]);
  const groups = useMemo(() => groupByLevel(shown), [shown]);

  const row = (student: AdminStudent) => (
    <StudentRow
      key={student.id}
      student={student}
      levelError={levelErrors[student.id] ?? null}
      onLevel={onLevel}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );

  return (
    <section className="t-card" aria-labelledby="alumnos-lista">
      <div className="t-card-head">
        <h2 id="alumnos-lista">
          Alumnos ({searching ? `${shown.length} de ${students.length}` : students.length})
        </h2>
      </div>
      <div className="t-listbar">
        <input
          className="t-input t-search"
          type="search"
          placeholder="Buscar por nombre o grado"
          aria-label="Buscar alumnos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="t-seg2" role="group" aria-label="Orden de la lista">
          <button type="button" aria-pressed={order === 'name'} onClick={() => setOrder('name')}>
            A–Z
          </button>
          <button type="button" aria-pressed={order === 'level'} onClick={() => setOrder('level')}>
            Por nivel
          </button>
        </div>
      </div>
      <p className="t-notice" role="status" aria-live="polite">{notice}</p>
      {students.length === 0 ? (
        <p className="t-empty">Todavía no hay alumnos. Agregue uno arriba o pegue una lista más abajo.</p>
      ) : shown.length === 0 ? (
        <p className="t-empty">Ningún alumno coincide con la búsqueda.</p>
      ) : order === 'name' ? (
        <ul className="t-stus">{sorted.map(row)}</ul>
      ) : (
        groups
          .filter((g) => !searching || g.students.length > 0)
          .map((g) => (
            <section
              key={g.level}
              className="t-lvgroup"
              style={{ '--team': TEAM_COLORS[g.level] } as CSSProperties}
              aria-label={`Nivel ${g.level}, ${teamName(g.level)}`}
            >
              <h3>
                <span className="t-dot" aria-hidden="true" />
                Nivel {g.level} · {getLevel(g.level).teamName}
                <span className="t-badge">{g.students.length}</span>
              </h3>
              {g.students.length === 0 ? (
                <p className="t-muted">Nadie en este nivel.</p>
              ) : (
                <ul className="t-stus">{g.students.map(row)}</ul>
              )}
            </section>
          ))
      )}
    </section>
  );
}
