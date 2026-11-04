import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ImportStudentsResponse } from '../shared/api.ts';

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
    <details className="t-card t-fold">
      <summary>Pegar una lista de alumnos</summary>
      <form className="t-fold-body" onSubmit={submit} aria-label="Pegar una lista de alumnos">
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
    </details>
  );
}
