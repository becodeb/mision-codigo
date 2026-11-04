// Always-visible row to add a forgotten child in seconds. Remembers the last grade and level.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { CreateStudentRequest } from '../shared/api.ts';
import { teamName } from '../shared/levels.ts';
import type { LevelId } from '../shared/levels.ts';
import { LevelButtons } from './LevelButtons.tsx';
import { loadLastUsed, saveLastUsed } from './roster.ts';

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

interface Props {
  /** Resolves the saved child's name on success, otherwise `{ error }` with the message to show. */
  onAdd: (student: CreateStudentRequest) => Promise<{ error: string } | { added: string }>;
}

export function QuickAdd({ onAdd }: Props) {
  const storage = useMemo(browserStorage, []);
  const initial = useMemo(() => loadLastUsed(storage), [storage]);
  const [name, setName] = useState('');
  const [group, setGroup] = useState(initial.group);
  const [level, setLevel] = useState<LevelId>(initial.level);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (busy || clean === '') return;
    setBusy(true);
    setDone(null);
    const outcome = await onAdd({ name: clean, group: group.trim(), level });
    setBusy(false);
    if ('error' in outcome) {
      setError(outcome.error);
      return;
    }
    setError(null);
    setName('');
    saveLastUsed(storage, { group: group.trim(), level });
    setDone(`«${outcome.added}» se agregó al ${teamName(level)}.`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(null), 4000);
    nameRef.current?.focus();
  }

  return (
    <form className="t-card t-quick" onSubmit={submit} aria-labelledby="alumnos-agregar">
      <h2 id="alumnos-agregar">Agregar un alumno</h2>
      <div className="t-quick-top">
        <input
          ref={nameRef}
          className="t-input"
          aria-label="Nombre del nuevo alumno"
          placeholder="Nombre"
          value={name}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
        />
        <button className="t-btn t-btn-primary t-quick-go" type="submit" disabled={busy || name.trim() === ''}>
          {busy ? 'Agregando…' : 'Agregar'}
        </button>
      </div>
      <div className="t-quick-bottom">
        <input
          className="t-input t-quick-group"
          aria-label="Grado del nuevo alumno"
          placeholder="Grado (ej. 3.º A)"
          value={group}
          maxLength={40}
          autoComplete="off"
          onChange={(event) => setGroup(event.target.value)}
        />
        <LevelButtons value={level} onPick={setLevel} label="Nivel del nuevo alumno" />
      </div>
      <div aria-live="polite">
        {done && <p className="t-ok">{done}</p>}
        {error && <p className="t-alert" role="alert">{error}</p>}
      </div>
    </form>
  );
}
