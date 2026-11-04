import { useState } from 'react';
import type { FormEvent } from 'react';

interface Props {
  /** False when the server runs without ADMIN_PASSWORD. */
  loginEnabled: boolean;
  /** Shown above the form, for example when the session ended. */
  notice: string | null;
  /** Resolves null on success, otherwise the message to show. */
  onSubmit: (password: string) => Promise<string | null>;
}

export function Login({ loginEnabled, notice, onSubmit }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || password === '') return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(password);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <main className="t-login">
      <form className="t-login-card" onSubmit={submit}>
        <h1>Panel docente</h1>
        <p className="t-muted">Misión Código</p>

        {!loginEnabled && (
          <p className="t-alert" role="alert">
            El ingreso de docentes no está habilitado. El servidor se inició sin la variable ADMIN_PASSWORD: defínala y
            reinicie el servidor.
          </p>
        )}
        {notice && loginEnabled && <p className="t-note" role="status">{notice}</p>}

        <label className="t-field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={!loginEnabled || busy}
            autoFocus
          />
        </label>

        {error && <p className="t-alert" role="alert">{error}</p>}

        <button className="t-btn t-btn-primary" type="submit" disabled={!loginEnabled || busy || password === ''}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
        <a className="t-muted t-back" href="/">Volver a la pantalla de los chicos</a>
      </form>
    </main>
  );
}
