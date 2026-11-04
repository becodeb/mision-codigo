import { LEVELS } from '../shared/levels.ts';
import { LEVEL_ADVICE, LEVEL_GUIDES } from './levelGuide.ts';

/** Short reference so a teacher can assign a level. Static, no data. */
export function LevelsTab() {
  return (
    <div className="t-stack">
      <section className="t-card" aria-labelledby="niveles-intro">
        <h2 id="niveles-intro">Cómo elegir el nivel</h2>
        <ul className="t-list">
          {LEVEL_ADVICE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      {LEVEL_GUIDES.map((guide) => {
        const info = LEVELS[guide.id - 1];
        return (
          <section key={guide.id} className="t-card" aria-labelledby={`nivel-${guide.id}`}>
            <h2 id={`nivel-${guide.id}`}>
              Nivel {guide.id} · {info.teamName}
            </h2>
            <p>
              <strong>Lógica que exige.</strong> {guide.logic}
            </p>
            <p>
              <strong>Señales de que el chico corresponde a este nivel</strong>
            </p>
            <ul className="t-list">
              {guide.signs.map((sign) => (
                <li key={sign}>{sign}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
