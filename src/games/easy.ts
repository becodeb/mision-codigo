/**
 * Versiones fáciles para la muestra (Clase 2). Cada una toma un juego de la Clase 1 sin modificarlo:
 * se queda con algunos pasos, puede cambiar sus textos o aflojar su control, y suma «Hacelo tuyo» como
 * primer desafío. Los bloques que desbloqueaban los pasos que se sacan pasan al paso siguiente que queda,
 * así la solución de referencia sigue usando solo bloques ofrecidos y las pruebas del catálogo la validan.
 */
import type { GameChallenge, GameDefinition, GamePhase, GameStep, StepContext } from './types.ts';
import type { BlockType } from '../language/catalog.ts';

export interface StepChange {
  title?: string;
  text?: string;
  hints?: string[];
  /** Solo para aflojar: la solución completa tiene que seguir pasándolo. */
  check?: (ctx: StepContext) => boolean;
}

export interface EasySpec {
  /** Pasos que quedan, por id, en el orden original. */
  keep: Record<string, StepChange>;
  pitch: string;
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

  let pending: BlockType[] = [];
  const phases: GamePhase[] = [];
  for (const phase of game.phases) {
    const steps: GameStep[] = [];
    for (const step of phase.steps) {
      const change = spec.keep[step.id];
      if (!change) {
        pending.push(...(step.unlock ?? []));
        continue;
      }
      const unlock = [...new Set([...pending, ...(step.unlock ?? [])])];
      pending = [];
      steps.push({ ...step, ...change, ...(unlock.length ? { unlock } : {}) });
    }
    if (steps.length) phases.push({ ...phase, steps });
  }
  if (spec.addShow) phases[phases.length - 1].steps.push({ ...SHOW_STEP });
  if (pending.length) {
    const last = phases[phases.length - 1].steps.at(-1)!;
    last.unlock = [...new Set([...(last.unlock ?? []), ...pending])];
  }

  const play = game.solution.play;
  return {
    ...game,
    id: game.id + EASY_SUFFIX,
    class: 2,
    title: `${game.title} ⭐`,
    pitch: spec.pitch,
    phases,
    challenges: [MAKE_IT_YOURS, ...game.challenges],
    solution: spec.addShow
      ? {
          program: game.solution.program,
          play: async (g) => {
            await play(g);
            g.machine.setShown(true);
          },
        }
      : game.solution,
  };
}
