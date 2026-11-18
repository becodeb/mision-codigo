/**
 * Versiones fáciles para la muestra (Clase 2). Cada una toma un juego de la Clase 1 sin modificarlo:
 * se queda con algunos pasos, puede cambiar sus textos, ejemplos y bloques o aflojar su control, y suma
 * «Hacelo tuyo» como primer desafío. Los bloques de los pasos que se sacan NO aparecen: así no se cuelan
 * ideas de otro nivel (sobres, operadores). Si un paso que queda necesita un bloque de uno que se sacó,
 * se agrega con `unlock`.
 */
import type { GameChallenge, GameDefinition, GamePhase, GameSolution, GameStep, StepContext } from './types.ts';
import type { BlockType } from '../language/catalog.ts';

export interface StepChange {
  title?: string;
  text?: string;
  hints?: string[];
  /** Recuadro «¿Qué es esto?» con la idea nueva del paso. */
  explain?: string;
  /** Reemplaza los bloques que desbloquea el paso. */
  unlock?: BlockType[];
  /** Reemplaza el ejemplo del último escalón de pistas. */
  example?: GameStep['example'];
  /** Solo para aflojar: la solución completa tiene que seguir pasándolo. */
  check?: (ctx: StepContext) => boolean;
}

export interface EasySpec {
  /** Pasos que quedan, por id, en el orden original. */
  keep: Record<string, StepChange>;
  pitch: string;
  /** Para armar otro juego fácil del mismo original (otro nivel). */
  id?: string;
  title?: string;
  level?: GameDefinition['level'];
  /** Una solución propia cuando la versión fácil se arma distinto que el original. */
  solution?: GameSolution;
  /** Agrega el paso final «Mostrá tu juego» si el original no lo tiene. */
  addShow?: boolean;
}

export const EASY_SUFFIX = '-facil';

const MAKE_IT_YOURS: GameChallenge = {
  title: 'Hacelo tuyo',
  text: 'Cambiá lo que quieras: el lugar, los sonidos, los colores, lo que dicen. ¡Que se note que es tu juego! Después mostráselo a alguien y contale cómo se juega.',
};

const SHOW_STEP: GameStep = {
  id: 'mostrar',
  title: '¡Mostrá tu juego!',
  text: '¡Terminaste! Tocá el botón amarillo para ver tu juego en pantalla grande y jugarlo.',
  hints: ['Buscá el botón amarillo y tocalo.'],
  point: 'show',
  check: (ctx) => ctx.stats.shown,
};

export function easyVersion(game: GameDefinition, spec: EasySpec): GameDefinition {
  const known = new Set(game.phases.flatMap((p) => p.steps.map((s) => s.id)));
  for (const id of Object.keys(spec.keep)) if (!known.has(id)) throw new Error(`${game.id}: no existe el paso ${id}`);

  const phases: GamePhase[] = [];
  for (const phase of game.phases) {
    const steps: GameStep[] = [];
    for (const step of phase.steps) {
      const change = spec.keep[step.id];
      if (change) steps.push({ ...step, ...change });
    }
    if (steps.length) phases.push({ ...phase, steps });
  }
  if (spec.addShow) phases[phases.length - 1].steps.push({ ...SHOW_STEP });

  const base = spec.solution ?? game.solution;
  return {
    ...game,
    id: spec.id ?? game.id + EASY_SUFFIX,
    level: spec.level ?? game.level,
    class: 2,
    title: `${spec.title ?? game.title} ⭐`,
    pitch: spec.pitch,
    phases,
    challenges: [MAKE_IT_YOURS, ...game.challenges],
    solution: spec.addShow
      ? {
          program: base.program,
          play: async (g) => {
            await base.play(g);
            g.machine.setShown(true);
          },
        }
      : base,
  };
}
