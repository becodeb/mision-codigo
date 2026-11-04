// Presentational parts of the «Progreso» tab.
import { useState } from 'react';
import type { AdminStudent } from '../shared/api.ts';
import type { GameRow, ProgressRow } from './progressView.ts';

interface RowsProps {
  rows: ProgressRow[];
  /** Resolves null on success, otherwise the message to show. */
  onDeleteProject: (studentId: number, gameId: string) => Promise<string | null>;
}

function ProgressLine({ row, onDeleteProject }: { row: ProgressRow; onDeleteProject: RowsProps['onDeleteProject'] }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <tr>
      <th scope="row">{row.name}</th>
      <td>{row.group || <span className="t-muted">—</span>}</td>
      <td>{row.gameTitle}</td>
      <td>
        {row.finished ? (
          <span className="t-muted">—</span>
        ) : row.currentStep ? (
          <span title={row.currentStep.id}>{row.currentStep.title}</span>
        ) : (
          <span className="t-muted">Sin paso actual</span>
        )}
      </td>
      <td className="t-num">
        {row.completedCount}
        {row.totalSteps !== null && <span className="t-muted"> de {row.totalSteps}</span>}
      </td>
      <td className="t-num">{row.minutes}</td>
      <td>{row.finished ? <span className="t-badge t-badge-ok">Terminó</span> : <span className="t-badge">En curso</span>}</td>
      <td className="t-actions">
        {error && <span className="t-row-error" role="alert">{error}</span>}
        {armed ? (
          <span className="t-confirm">
            <span>¿Borrar el proyecto?</span>
            <button
              className="t-btn t-btn-danger"
              onClick={async () => {
                const message = await onDeleteProject(row.studentId, row.gameId);
                setError(message);
                setArmed(false);
              }}
            >
              Sí, borrar
            </button>
            <button className="t-btn" onClick={() => setArmed(false)}>Cancelar</button>
          </span>
        ) : (
          <button
            className="t-btn"
            onClick={() => setArmed(true)}
            aria-label={`Borrar el proyecto ${row.gameTitle} de ${row.name}`}
          >
            Borrar proyecto
          </button>
        )}
      </td>
    </tr>
  );
}

export function ProgressTable({ rows, onDeleteProject }: RowsProps) {
  if (rows.length === 0) {
    return <p className="t-empty">Todavía no hay proyectos guardados. Aparecen apenas un chico empieza un juego.</p>;
  }
  return (
    <div className="t-scroll">
      <table className="t-table">
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Grupo</th>
            <th>Juego</th>
            <th>Paso actual</th>
            <th className="t-num">Pasos hechos</th>
            <th className="t-num">Minutos</th>
            <th>Estado</th>
            <th><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ProgressLine key={row.key} row={row} onDeleteProject={onDeleteProject} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GamesTable({ rows }: { rows: GameRow[] }) {
  if (rows.length === 0) return <p className="t-empty">Todavía no hay datos por juego.</p>;
  return (
    <div className="t-scroll">
      <table className="t-table">
        <thead>
          <tr>
            <th>Juego</th>
            <th className="t-num">Empezaron</th>
            <th className="t-num">Terminaron</th>
            <th className="t-num">Minutos (promedio)</th>
            <th>Pasos donde se traban</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.gameId}>
              <th scope="row">{row.title}</th>
              <td className="t-num">{row.started}</td>
              <td className="t-num">{row.finished}</td>
              <td className="t-num">{row.averageMinutes}</td>
              <td>
                {row.stuck.length === 0 ? (
                  <span className="t-muted">Nadie trabado</span>
                ) : (
                  <ul className="t-stuck">
                    {row.stuck.map((step) => (
                      <li key={step.id} title={step.id}>
                        {step.title} <span className="t-badge">{step.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NotStarted({ students }: { students: AdminStudent[] }) {
  if (students.length === 0) return null;
  return (
    <p className="t-muted">
      Todavía no empezaron ({students.length}): {students.map((s) => s.name).join(', ')}.
    </p>
  );
}
