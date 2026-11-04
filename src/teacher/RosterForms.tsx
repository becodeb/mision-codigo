import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CreateStudentRequest, ImportStudentsResponse } from '../shared/api.ts';
import { LevelSelect } from './StudentsTable.tsx';

export function AddStudentForm({ onAdd }: { onAdd: (student: CreateStudentRequest) => Promise<string | null> }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [level, setLevel] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || name.trim() === '') return;
    setBusy(true);
    const message = await onAdd({ name: name.trim(), group: group.trim(), level });
    setBusy(false);
    setError(message);
    if (!message) setName('');
  }

  return (
    <form className="t-card" onSubmit={submit} aria-labelledby="alumnos-agregar">
      <h2 id="alumnos-agregar">Agregar un alumno</h2>
      <div className="t-form-row">
        <label className="t-field">
          <span>Nombre</span>
          <input className="t-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="t-field">
          <span>Grupo</span>
          <input className="t-input" value={group} maxLength={40} onChange={(e) => setGroup(e.target.value)} />
        </label>
        <label className="t-field">
          <span>Nivel</span>
          <LevelSelect value={level} onChange={setLevel} label="Nivel del nuevo alumno" />
        </label>
        <button className="t-btn t-btn-primary" type="submit" disabled={busy || name.trim() === ''}>
          Agregar
        </button>
      </div>
      <p className="t-muted">Solo el nombre de pila. Si hay dos iguales en el grupo, agregue la inicial del apellido.</p>
      {error && <p className="t-alert" role="alert">{error}</p>}
    </form>
  );
}

const EXAMPLE = 'Nombre, grupo, nivel\nLuna, 3.º A, 1\nMateo, 3.º A, 2\nSofía, 4.º B, 4';

export function ImportBox({ onImport }: { onImport: (text: string) => Promise<ImportStudentsResponse | string> }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportStudentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || text.trim() === '') return;
    setBusy(true);
    setResult(null);
    setError(null);
    const outcome = await onImport(text);
    setBusy(false);
    if (typeof outcome === 'string') setError(outcome);
    else {
      setResult(outcome);
      // Keep the text when lines failed, to fix and send again: repeated lines only update.
      if (outcome.errors.length === 0) setText('');
    }
  }

  return (
    <form className="t-card" onSubmit={submit} aria-labelledby="alumnos-importar">
      <h2 id="alumnos-importar">Pegar una lista</h2>
      <p>
        Una línea por alumno, con el formato <code>Nombre, grupo, nivel</code> (separado por comas o tabuladores; se puede
        pegar directo desde una planilla). El nivel va de 1 a 5. Si el nombre y el grupo ya existen, se actualiza el nivel.
      </p>
      <p className="t-muted">Cargue solo el nombre de pila, sin apellidos.</p>
      <textarea
        className="t-textarea"
        aria-label="Lista para importar"
        rows={9}
        value={text}
        placeholder={EXAMPLE}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
      />
      <div className="t-form-row">
        <button className="t-btn t-btn-primary" type="submit" disabled={busy || text.trim() === ''}>
          {busy ? 'Importando…' : 'Importar lista'}
        </button>
      </div>
      {error && <p className="t-alert" role="alert">{error}</p>}
      {result && (
        <div className="t-result" role="status">
          <p>
            <strong>{result.created}</strong> {result.created === 1 ? 'alumno creado' : 'alumnos creados'} y{' '}
            <strong>{result.updated}</strong> {result.updated === 1 ? 'actualizado' : 'actualizados'}.
          </p>
          {result.errors.length > 0 && (
            <>
              <p className="t-alert">
                {result.errors.length === 1 ? 'Una línea no se pudo importar:' : `${result.errors.length} líneas no se pudieron importar:`}
              </p>
              <ul className="t-errors">
                {result.errors.map((e) => (
                  <li key={e.line}>
                    Línea {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}
