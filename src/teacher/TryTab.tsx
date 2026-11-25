// «Probar»: enters as one of the test names, which children never see in their list.
import { useEffect, useState } from 'react';
import { isTestGroup, TEST_GROUP, type AdminStudent } from '../shared/api.ts';
import { showcasesFor } from '../games/showcase/index.ts';
import { teamName } from '../shared/levels.ts';
import { startSession } from '../workshop/api.ts';
import * as adminApi from './adminApi.ts';
import { errorMessage } from './StudentsTab.tsx';

export function TryTab() {
  const [students, setStudents] = useState<AdminStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi
      .listStudents()
      .then((r) => setStudents(r.students.filter((s) => isTestGroup(s.group)).sort((a, b) => a.level - b.level)))
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  async function enter(id: number) {
    setBusy(true);
    setError(null);
    try {
      await startSession(id);
      window.location.assign('/');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <section className="t-card" aria-labelledby="probar">
      <h2 id="probar">Probar los juegos</h2>
      <p>Entra como un chico de prueba. Estos nombres no aparecen en la lista de los chicos.</p>
      {error && <p className="t-alert" role="alert">{error}</p>}
      {students?.length === 0 && <p>Todavía no hay nombres de prueba. Agregue alumnos en el grupo «{TEST_GROUP}», uno por nivel.</p>}
      <div className="t-scroll">
        <table className="t-table">
          <tbody>
            {students?.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.name}</th>
                <td>{s.level} · {teamName(s.level)}</td>
                <td>{showcasesFor(s.level).map((g) => g.title).join(' · ')}</td>
                <td><button className="t-btn t-btn-primary" disabled={busy} onClick={() => void enter(s.id)}>Entrar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
