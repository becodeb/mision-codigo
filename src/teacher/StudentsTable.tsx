import { useEffect, useState } from 'react';
import type { AdminStudent, UpdateStudentRequest } from '../shared/api.ts';
import { LEVELS, isLevelId } from '../shared/levels.ts';

export const LevelSelect = ({
  value,
  onChange,
  id,
  label,
  disabled,
}: {
  value: number;
  onChange: (level: 1 | 2 | 3 | 4 | 5) => void;
  id?: string;
  label: string;
  disabled?: boolean;
}) => (
  <select
    id={id}
    className="t-select"
    aria-label={label}
    value={value}
    disabled={disabled}
    onChange={(event) => {
      const level = Number(event.target.value);
      if (isLevelId(level)) onChange(level);
    }}
  >
    {LEVELS.map((level) => (
      <option key={level.id} value={level.id}>
        {level.id} · {level.teamName}
      </option>
    ))}
  </select>
);

interface RowProps {
  student: AdminStudent;
  /** Resolves null on success, otherwise the message to show. */
  onUpdate: (id: number, patch: UpdateStudentRequest) => Promise<string | null>;
  onDelete: (id: number) => Promise<string | null>;
}

function StudentRow({ student, onUpdate, onDelete }: RowProps) {
  const [name, setName] = useState(student.name);
  const [group, setGroup] = useState(student.group);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Follow the server copy after a refresh.
  useEffect(() => {
    setName(student.name);
    setGroup(student.group);
  }, [student.name, student.group]);

  async function save(patch: UpdateStudentRequest) {
    setBusy(true);
    const message = await onUpdate(student.id, patch);
    setBusy(false);
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

  return (
    <tr>
      <td>
        <input
          className="t-input"
          aria-label={`Nombre de ${student.name}`}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitText}
          onKeyDown={onKey}
        />
      </td>
      <td>
        <input
          className="t-input"
          aria-label={`Grupo de ${student.name}`}
          value={group}
          maxLength={40}
          onChange={(event) => setGroup(event.target.value)}
          onBlur={commitText}
          onKeyDown={onKey}
        />
      </td>
      <td>
        <LevelSelect
          value={student.level}
          label={`Nivel de ${student.name}`}
          disabled={busy}
          onChange={(level) => void save({ level })}
        />
      </td>
      <td className="t-actions">
        {error && <span className="t-row-error" role="alert">{error}</span>}
        {armed ? (
          <span className="t-confirm">
            <span>¿Borrar a {student.name} y su avance?</span>
            <button
              className="t-btn t-btn-danger"
              onClick={async () => {
                const message = await onDelete(student.id);
                if (message) {
                  setError(message);
                  setArmed(false);
                }
              }}
            >
              Sí, borrar
            </button>
            <button className="t-btn" onClick={() => setArmed(false)}>Cancelar</button>
          </span>
        ) : (
          <button className="t-btn" onClick={() => setArmed(true)} aria-label={`Borrar a ${student.name}`}>
            Borrar
          </button>
        )}
      </td>
    </tr>
  );
}

interface Props {
  students: AdminStudent[];
  onUpdate: RowProps['onUpdate'];
  onDelete: RowProps['onDelete'];
}

export function StudentsTable({ students, onUpdate, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? students.filter((s) => `${s.name} ${s.group}`.toLowerCase().includes(needle))
    : students;

  return (
    <section className="t-card" aria-labelledby="alumnos-lista">
      <div className="t-card-head">
        <h2 id="alumnos-lista">Lista de alumnos ({students.length})</h2>
        <input
          className="t-input t-search"
          type="search"
          placeholder="Buscar por nombre o grupo"
          aria-label="Buscar alumnos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {students.length === 0 ? (
        <p className="t-empty">Todavía no hay alumnos. Agregue uno o pegue una lista más abajo.</p>
      ) : shown.length === 0 ? (
        <p className="t-empty">Ningún alumno coincide con la búsqueda.</p>
      ) : (
        <div className="t-scroll">
          <table className="t-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Grupo</th>
                <th>Nivel</th>
                <th><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((student) => (
                <StudentRow key={student.id} student={student} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
