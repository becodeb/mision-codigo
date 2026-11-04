// Container: teacher login and the tabs of the panel.
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../net/http.ts';
import * as adminApi from './adminApi.ts';
import { ClassTab } from './ClassTab.tsx';
import { LevelsTab } from './LevelsTab.tsx';
import { Login } from './Login.tsx';
import { ProgressTab } from './ProgressTab.tsx';
import { StudentsTab } from './StudentsTab.tsx';
import './teacher.css';

type TabId = 'alumnos' | 'clase' | 'progreso' | 'niveles';
const TABS: { id: TabId; label: string }[] = [
  { id: 'alumnos', label: 'Alumnos' },
  { id: 'clase', label: 'Clase activa' },
  { id: 'progreso', label: 'Progreso' },
  { id: 'niveles', label: 'Niveles' },
];

/** Teacher-facing wording for the login failures, whatever the server says. */
function loginMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'admin_disabled') {
      return 'El ingreso de docentes no está habilitado en este servidor (falta ADMIN_PASSWORD).';
    }
    if (error.code === 'too_many_attempts') {
      return 'Demasiados intentos fallidos. Espere unos minutos antes de volver a intentar.';
    }
    if (error.code === 'wrong_password') return 'La contraseña no es correcta.';
    if (error.isNetwork) return 'No se pudo conectar con el servidor.';
  }
  return 'No se pudo ingresar. Pruebe de nuevo.';
}

type Gate =
  | { kind: 'checking' }
  | { kind: 'error' }
  | { kind: 'login'; loginEnabled: boolean; notice: string | null }
  | { kind: 'in' };

export function TeacherApp() {
  const [gate, setGate] = useState<Gate>({ kind: 'checking' });
  const [tab, setTab] = useState<TabId>('alumnos');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getAdminSession()
      .then((session) => {
        if (cancelled) return;
        setGate(session.authenticated ? { kind: 'in' } : { kind: 'login', loginEnabled: session.loginEnabled, notice: null });
      })
      .catch(() => !cancelled && setGate({ kind: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(
    () =>
      adminApi.onAuthLost(() =>
        setGate({ kind: 'login', loginEnabled: true, notice: 'La sesión terminó. Ingrese de nuevo para continuar.' }),
      ),
    [],
  );

  const submit = useCallback(async (password: string): Promise<string | null> => {
    try {
      await adminApi.login(password);
      setGate({ kind: 'in' });
      return null;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'admin_disabled') {
        setGate({ kind: 'login', loginEnabled: false, notice: null });
      }
      return loginMessage(error);
    }
  }, []);

  const signOut = useCallback(async () => {
    await adminApi.logout().catch(() => undefined);
    setGate({ kind: 'login', loginEnabled: true, notice: null });
  }, []);

  if (gate.kind === 'checking') {
    return <p className="t-center t-muted" role="status">Cargando…</p>;
  }
  if (gate.kind === 'error') {
    return (
      <main className="t-login">
        <div className="t-login-card">
          <h1>Panel docente</h1>
          <p className="t-alert" role="alert">No se pudo conectar con el servidor.</p>
          <button className="t-btn t-btn-primary" onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
        </div>
      </main>
    );
  }
  if (gate.kind === 'login') {
    return <Login loginEnabled={gate.loginEnabled} notice={gate.notice} onSubmit={submit} />;
  }

  return (
    <div className="t-app">
      <header className="t-top">
        <div className="t-brand">
          <strong>Misión Código</strong>
          <span className="t-muted">Panel docente</span>
        </div>
        <div aria-label="Secciones" className="t-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="t-panel"
              className={`t-tab${tab === t.id ? ' on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="t-top-end">
          <a className="t-link" href="/">Pantalla de los chicos</a>
          <button className="t-btn" onClick={() => void signOut()}>Salir</button>
        </div>
      </header>
      <main className="t-main" id="t-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'alumnos' && <StudentsTab />}
        {tab === 'clase' && <ClassTab />}
        {tab === 'progreso' && <ProgressTab />}
        {tab === 'niveles' && <LevelsTab />}
      </main>
    </div>
  );
}
