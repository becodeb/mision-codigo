/** Clase 2: un juego fácil por nivel para la última clase y la muestra. Los originales siguen en la Clase 1. */
import type { BlockType } from '../language/catalog.ts';
import {
  addScore, bounce, face, forever, goToRandom, hide, lose, move, moveWithArrows, onFlag, onPoints, onTouching, point, project, show, sound, sprite, win,
} from '../language/ir.ts';
import { PLACES, isCharacter, refHas, refsOfHat, spritesWithHat } from './checks.ts';
import { easyVersion } from './easy.ts';
import { miMascota } from './level1/mi-mascota.ts';
import { bandaParque } from './level2/banda-parque.ts';
import { cazaPulpi } from './level3/caza-pulpi.ts';
import { chispa } from './level4/chispa.ts';
import { Pilot, centerOf, touchingNow } from './level4/autopilot.ts';
import type { GameDefinition, GameSolution, StepContext } from './types.ts';

const PET_REACTIONS: BlockType[] = ['f_sound', 'f_spin', 'f_face', 'f_jump', 'f_grow', 'f_shrink', 'f_say', 'f_text'];

export const MASCOTA_FACIL = easyVersion(miMascota, {
  pitch: 'Elegí tu mascota y hacé que reaccione y crezca cuando la tocás.',
  keep: {
    mascota: {},
    casa: {},
    toque: {
      explain: 'La manito es un bloque que espera: todo lo que pongas abajo pasa cuando alguien toca a tu mascota.',
    },
    reacciones: {
      title: 'Más reacciones',
      text: 'Cuando la tocás, que haga tres cosas. Por ejemplo: una cara, un giro y un salto. Después tocala.',
      hints: ['Poné los bloques uno abajo del otro, debajo de la manito.', 'Probá con la carita, el giro y el salto.'],
      check: (ctx) => spritesWithHat(ctx, { hat: 'f_click', types: PET_REACTIONS, min: 3, kinds: 2 }).some(isCharacter),
    },
    nombre: {},
    comer: {},
    crece: {
      text: 'Tu mascota crece. Cuando la tocás, que se agrande dos veces. Después tocala.',
      explain: 'Los bloques se hacen en orden, de arriba hacia abajo. Si ponés dos veces «agrandar», crece dos veces.',
    },
    gracias: {},
    'otra-cosa': {},
    mostrar: {},
  },
});

export const BANDA_FACIL = easyVersion(bandaParque, {
  pitch: 'Armá un músico que toca tu melodía, baila y repite el estribillo.',
  keep: {
    escena: {},
    tocar: {
      explain: 'La nota musical hace sonar una nota. Tocando el dibujito de la nota la cambiás por otra: do, re, mi…',
    },
    melodia: {
      text: 'Armá una melodía de cinco notas. Cambiá algunas para que no suenen todas iguales. Después tocá al músico.',
    },
    baile: {
      text: 'Que baile mientras toca: poné un salto y un giro entre las notas. Después tocalo.',
    },
    banda: {},
    melodias: {},
    ensayo: {},
    vueltas: {
      text: 'Usá las vueltas, el bloque de flechitas que giran, y poné dos notas adentro. Después tocá al músico.',
      explain: 'Las vueltas repiten lo que tienen adentro. El número dice cuántas veces. Así no hace falta poner la misma nota muchas veces.',
    },
    coro: {},
    mostrar: {},
  },
});

export const PULPI_FACIL = easyVersion(cazaPulpi, {
  pitch: 'Tocá a Pulpi para sumar puntos antes de que se escape. ¡Llegá a 10!',
  keep: {
    fondo: {},
    reaccion: {
      explain: '«Al hacer clic en este personaje» es un bloque que espera: lo que pongas abajo pasa cada vez que alguien toca a Pulpi.',
    },
    punto: {
      explain: 'Los puntos son un número que el juego recuerda. «Sumar 1 a puntos» le agrega uno cada vez que se ejecuta. Lo ves arriba del escenario.',
    },
    cero: {
      explain: '«Al presionar la bandera» pasa cuando empieza el juego. Ahí se preparan las cosas: por ejemplo, poner los puntos en 0.',
    },
    escapa: {
      explain: '«Ir a posición aleatoria» manda al personaje a un lugar al azar del escenario: ni vos sabés dónde va a aparecer.',
    },
    solo: {},
    repite: {},
    nada: {},
    ganar: {
      text: 'Cuando juntes 10 puntos, ganás. Armá la victoria y ganalo de verdad.',
      unlock: ['a_points', 'a_win'],
      explain: '«Cuando los puntos lleguen a…» es un bloque que espera: se activa solo cuando los puntos llegan a ese número.',
      hints: ['Es otro bloque que empieza cuando los puntos llegan a un número.', 'Adentro va el bloque de ganar.', 'Tocá a Pulpi hasta llegar a 10.'],
    },
    mostrar: {},
  },
});

/* ---------- Nivel 4 y 5: Chispa sin sobres ---------- */

/** La moneda se mueve sola cuando la toca el personaje que junta puntos con ella: sin mensajes. */
function coinJumps(ctx: StepContext): boolean {
  const pickups = refsOfHat(ctx, 'a_touching').filter((r) => refHas(r, ['a_addscore']) && !refHas(r, ['a_lose']));
  const targets = new Set(pickups.map((r) => String(r.script.hat.fields.T)));
  return refsOfHat(ctx, 'a_touching').some((r) => targets.has(r.sprite.id) && refHas(r, PLACES)) && ctx.stats.maxScore >= 3;
}

const COIN_STEP = {
  title: 'La moneda salta',
  text: 'Cada vez que Michi toca la moneda, la moneda tiene que saltar a otro lugar. Armalo en la moneda: «cuando toque a Michi» y abajo «ir a posición aleatoria». Juntá 3 monedas.',
  explain: 'Cada personaje tiene sus propios bloques. La moneda también se da cuenta cuando la tocan: «cuando toque a Michi» funciona en la moneda igual que en Michi.',
  hints: ['Tocá la moneda abajo, en «Personajes», para armar sus bloques.', '«Cuando toque a Michi» y abajo «ir a posición aleatoria».'],
  unlock: ['a_random'] as BlockType[],
  example: [{ sprite: 'Moneda', scripts: [onTouching('michi', goToRandom())] }],
  check: coinJumps,
};

const winStep = (goal: number) => ({
  text: `Con ${goal} monedas, Michi gana. Armá la victoria y ganala de verdad.`,
  explain: '«Cuando los puntos lleguen a…» es un bloque que espera: se activa solo cuando los puntos llegan a ese número.',
  hints: [
    'Es otro bloque que empieza cuando los puntos llegan a un número. Ponelo en Michi.',
    'Adentro va el bloque de ganar. Antes podés poner un sonido de festejo.',
    'Si te cuesta, hacé más lento al dragón: bajá los pasos de su «mover».',
  ],
  unlock: ['a_points', 'a_win'] as BlockType[],
  example: [{ sprite: 'Michi', scripts: [onPoints(goal, sound('aplauso'), win())] }],
});

const CHISPA_EXPLAINS = {
  heroe: { explain: '«Por siempre» repite lo de adentro sin parar mientras dura el juego. Así Michi te escucha las flechas todo el tiempo, no una sola vez.' },
  rebota: { explain: '«Mover» avanza unos pasos y «rebotar si toca un borde» lo da vuelta al llegar a la orilla. Dentro de «por siempre», va y viene solo.' },
  pierde: { explain: '«Cuando toque a …» es un bloque que espera: se activa en el momento en que Michi choca con ese personaje.' },
  recoger: { explain: 'Los puntos son un número que el juego recuerda. «Sumar 1 a puntos» le agrega uno. Lo ves arriba del escenario.' },
};

/** Juega como un chico: primero se deja atrapar, después junta monedas esquivando hasta ganar. */
function chispaSolution(dragons: boolean, goal: number): GameSolution {
  const hazards = dragons ? ['chispa', 'chispita'] : ['chispa'];
  const michi = [
    onFlag(forever(moveWithArrows(5))),
    onTouching('chispa', face('triste'), sound('boing'), lose()),
    ...(dragons ? [onTouching('chispita', face('triste'), sound('boing'), lose())] : []),
    onTouching('moneda', addScore(1), sound('magia')),
    onPoints(goal, sound('aplauso'), win()),
  ];
  const program = project('castillo', [
    sprite('michi', 'michi', michi, { x: -180, y: -120, size: 80, name: 'Michi' }),
    sprite('chispa', 'chispa', [onFlag(forever(move(3), bounce()))], { x: -200, y: -30, size: 80, name: 'Chispa' }),
    sprite('moneda', 'coin', [onTouching('michi', goToRandom())], { x: 120, y: 30, size: 130, name: 'Moneda' }),
    ...(dragons
      ? [sprite('chispita', 'chispa', [onFlag(hide(), point('0')), onPoints(5, show(), forever(move(3), bounce()))], { x: 100, y: -150, size: 60, name: 'Chispita' })]
      : []),
  ]);
  return {
    program,
    play: (game) => {
      const hero = () => game.sprite('michi');
      const coin = () => game.sprite('moneda');
      const careful = new Pilot(game, { hero: 'michi', speed: 2.5, hazards });
      const reckless = new Pilot(game, { hero: 'michi', speed: 2.5, hazards: [] });
      const points = (): number => game.machine.score ?? 0;
      game.flag();
      game.run(200);
      game.runUntil(() => {
        const c = centerOf(game.sprite('chispa'));
        reckless.steer(c.x, c.y);
        return game.machine.ended !== null;
      }, 60_000);
      reckless.release();
      game.run(200);
      game.flag();
      game.run(200);
      let overlap = 0;
      let away = 0;
      game.runUntil(() => {
        if (points() >= goal || game.machine.ended) return true;
        overlap = touchingNow(hero(), coin()) ? overlap + 1 : 0;
        if (overlap > 12) {
          away = 40;
          overlap = 0;
        }
        const to = away > 0 ? { x: 0, y: -60 } : centerOf(coin());
        if (away > 0) away--;
        careful.steer(to.x, to.y);
        return false;
      }, 240_000);
      careful.release();
      game.run(1_500);
      game.machine.setShown(true);
    },
  };
}

export const CHISPA_FACIL = easyVersion(chispa, {
  pitch: 'Mové a Michi con las flechas, juntá monedas y que no te atrape Chispa.',
  solution: chispaSolution(false, 8),
  keep: {
    escena: {},
    ...CHISPA_EXPLAINS,
    moneda: {},
    reaparece: COIN_STEP,
    ganar: winStep(8),
    mostrar: {},
  },
});

export const DOS_DRAGONES = easyVersion(chispa, {
  id: 'dos-dragones',
  title: 'Dos dragones',
  level: 5,
  pitch: 'Juntá monedas esquivando a Chispa. A las 5 monedas aparece un segundo dragón.',
  solution: chispaSolution(true, 10),
  keep: {
    escena: {},
    ...CHISPA_EXPLAINS,
    moneda: {},
    reaparece: COIN_STEP,
    segundo: {},
    aparece: {
      text: 'El segundo dragón empieza escondido y aparece cuando juntás 5 monedas. Escondelo con la bandera y mostralo con «cuando los puntos lleguen a 5».',
      explain: 'Un personaje escondido no se ve y no puede tocar a nadie. «Cuando los puntos lleguen a 5» espera hasta que tengas 5 puntos, y recién ahí hace lo de abajo.',
      hints: ['Seleccioná al segundo dragón abajo, en «Personajes».', 'Con la bandera: «esconder». Con «cuando los puntos lleguen a 5»: «mostrar».'],
      unlock: ['a_hide', 'a_show', 'a_points'],
      example: [{ sprite: 'Chispita', scripts: [onFlag(hide()), onPoints(5, show())] }],
    },
    vertical: {
      text: 'Cuando aparece, el segundo dragón patrulla de arriba para abajo: primero apunta hacia arriba y después, por siempre, avanza y rebota.',
      explain: '«Apuntar en dirección» cambia hacia dónde mira: 0 es arriba, 90 a la derecha, 180 abajo.',
      hints: ['Agregalo abajo de «mostrar», en el bloque de los 5 puntos.', '«Apuntar en dirección 0», y después «por siempre» con «mover» y «rebotar».'],
      example: [{ sprite: 'Chispita', scripts: [onPoints(5, show(), point('0'), forever(move(3), bounce()))] }],
    },
    pierde2: {},
    ganar: winStep(10),
    mostrar: {},
  },
});

/** After the four short missions of each level: the «Gran desafío», for whoever finishes them. */
export const MUESTRA: GameDefinition[] = [MASCOTA_FACIL, BANDA_FACIL, PULPI_FACIL, CHISPA_FACIL, DOS_DRAGONES].map((g) => ({
  ...g,
  order: 10,
  title: `Gran desafío: ${g.title}`,
}));
