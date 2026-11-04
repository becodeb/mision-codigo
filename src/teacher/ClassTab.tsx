// «Clase activa»: which class the children see, and which games each level gets in each class.
import { useEffect, useState } from 'react';
import { gamesFor } from '../games/catalog.ts';
import { CLASS_IDS, LEVELS } from '../shared/levels.ts';
import type { ClassId } from '../shared/levels.ts';
import * as adminApi from './adminApi.ts';
import { errorMessage } from './StudentsTab.tsx';

export function ClassTab() {
  const [active, setActive] = useState<ClassId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi
      .getSettings()
      .then((settings) => setActive(settings.activeClass))
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  async function choose(classId: ClassId) {
    if (busy || classId === active) return;
    setBusy(true);
    setError(null);
    try {
      setActive((await adminApi.setActiveClass(classId)).activeClass);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  return (
    <div className="t-stack">
      <section className="t-card" aria-labelledby="clase-activa">
        <h2 id="clase-activa">Clase activa</h2>
        <p>
          Los chicos ven los juegos de la clase activa para su nivel, además de los que ya empezaron y el proyecto libre. El
          cambio se aplica la próxima vez que abran su lista de juegos.
        </p>
        <div className="t-segment" role="group" aria-label="Clase activa">
          {CLASS_IDS.map((classId) => (
            <button
              key={classId}
              className={`t-seg-btn${active === classId ? ' on' : ''}`}
              aria-pressed={active === classId}
              disabled={busy || active === null}
              onClick={() => void choose(classId)}
            >
              Clase {classId}
              {active === classId && <span className="t-seg-tag">activa</span>}
            </button>
          ))}
        </div>
        {error && <p className="t-alert" role="alert">{error}</p>}
      </section>

      <section className="t-card" aria-labelledby="clase-juegos">
        <h2 id="clase-juegos">Juegos de cada nivel</h2>
        <div className="t-scroll">
          <table className="t-table">
            <thead>
              <tr>
                <th>Nivel</th>
                {CLASS_IDS.map((classId) => (
                  <th key={classId} className={active === classId ? 't-col-on' : undefined}>
                    Clase {classId}
                    {active === classId ? ' (activa)' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((level) => (
                <tr key={level.id}>
                  <th scope="row">
                    {level.id} · {level.teamName}
                  </th>
                  {CLASS_IDS.map((classId) => {
                    const games = gamesFor(level.id, classId);
                    return (
                      <td key={classId} className={active === classId ? 't-col-on' : undefined}>
                        {games.length === 0 ? (
                          <span className="t-muted">Sin juegos cargados</span>
                        ) : (
                          <ol className="t-games">
                            {games.map((g) => (
                              <li key={g.id}>{g.title}</li>
                            ))}
                          </ol>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
