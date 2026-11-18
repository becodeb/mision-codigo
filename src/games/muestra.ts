/** Clase 2: un juego fácil por nivel para la última clase y la muestra. Los originales siguen en la Clase 1. */
import type { BlockType } from '../language/catalog.ts';
import { isCharacter, spritesWithHat } from './checks.ts';
import { easyVersion } from './easy.ts';
import { miMascota } from './level1/mi-mascota.ts';
import { bandaParque } from './level2/banda-parque.ts';
import { cazaPulpi } from './level3/caza-pulpi.ts';
import { chispa } from './level4/chispa.ts';
import { tresVidas } from './level5/tres-vidas.ts';
import type { GameDefinition } from './types.ts';

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
    crece: {
      text: 'Tu mascota crece. Cuando la tocás, que se agrande dos veces. Después tocala.',
      explain: 'Los bloques se hacen en orden, de arriba hacia abajo. Si ponés dos veces «agrandar», crece dos veces.',
    },
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
    vueltas: {
      text: 'Usá las vueltas, el bloque de flechitas que giran, y poné dos notas adentro. Después tocá al músico.',
      explain: 'Las vueltas repiten lo que tienen adentro. El número dice cuántas veces. Así no hace falta poner la misma nota muchas veces.',
    },
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
    ganar: {
      text: 'Cuando juntes 10 puntos, ganás. Armá la victoria y ganalo de verdad.',
      explain: '«Cuando los puntos lleguen a…» es un bloque que espera: se activa solo cuando los puntos llegan a ese número.',
      hints: ['Es otro bloque que empieza cuando los puntos llegan a un número.', 'Adentro va el bloque de ganar.', 'Tocá a Pulpi hasta llegar a 10.'],
    },
    mostrar: {},
  },
});

export const CHISPA_FACIL = easyVersion(chispa, {
  pitch: 'Mové a Michi con las flechas, juntá monedas y que no te atrape Chispa.',
  keep: {
    escena: {},
    heroe: {
      explain: '«Por siempre» repite lo de adentro sin parar mientras dura el juego. Así Michi te escucha las flechas todo el tiempo, no una sola vez.',
    },
    rebota: {
      explain: '«Mover» avanza unos pasos y «rebotar si toca un borde» lo da vuelta al llegar a la orilla. Dentro de «por siempre», va y viene solo.',
    },
    pierde: {
      explain: '«Cuando toque a …» es un bloque que espera: se activa en el momento en que Michi choca con ese personaje.',
    },
    moneda: {},
    recoger: {
      explain: 'Los puntos son un número que el juego recuerda. «Sumar 1 a puntos» le agrega uno. Lo ves arriba del escenario.',
    },
    reaparece: {
      text: 'Cada vez que Michi junta la moneda, la moneda tiene que saltar a otro lugar. Michi le avisa con un sobre. Juntá 3 monedas.',
      explain: 'Un personaje no puede mover a otro, pero le puede mandar un aviso: eso es el sobre. Michi usa «enviar» con un color, y la moneda usa «al recibir» ese mismo color para saber que tiene que moverse. Es como un mensajito entre personajes.',
      hints: [
        'En Michi: abajo de «cuando toque a moneda», poné «enviar» y elegí un color.',
        'En la moneda: poné «al recibir» con el mismo color, y abajo «ir a posición aleatoria».',
      ],
    },
    ganar: {
      text: 'Con 8 monedas, Michi gana. Armá la victoria y ganala de verdad.',
      explain: '«Cuando los puntos lleguen a…» es un bloque que espera: se activa solo cuando los puntos llegan a ese número.',
      hints: [
        'Es otro bloque que empieza cuando los puntos llegan a un número.',
        'Adentro va el bloque de ganar. Antes podés poner un festejo.',
        'Si te cuesta, hacé más lenta a Chispa: bajá los pasos de su «mover».',
      ],
    },
    mostrar: {},
  },
});

export const TRES_VIDAS_FACIL = easyVersion(tresVidas, {
  pitch: 'Atrapá estrellas, esquivá bombas y no te quedes sin vidas.',
  addShow: true,
  keep: {
    mover: {
      explain: '«Por siempre» repite lo de adentro sin parar mientras dura el juego, así Nova te escucha las flechas todo el tiempo.',
    },
    cae: {
      explain: 'La pantalla tiene coordenadas: x es izquierda-derecha e y es arriba-abajo. Restar a y hace bajar. «Repetir hasta que» repite hasta que se cumple algo, por ejemplo que y sea muy chica (que llegó abajo). «Número al azar» elige un número distinto cada vez.',
    },
    atrapar: {
      explain: '«Si … entonces» es una pregunta: solo hace lo de adentro cuando la respuesta es sí. Por ejemplo: ¿la estrella está tocando a Nova? Entonces, un punto.',
    },
    vidas: {
      explain: 'Una variable es una cajita con nombre que guarda un número. Creá una que se llame «vidas»: «fijar» pone un valor y «sumar a» lo cambia (con -1 resta).',
    },
    escapa: {
      explain: '«Si … entonces … si no» elige uno de dos caminos: si atrapó, suma un punto; si no, resta una vida. Nunca hace los dos.',
    },
    bomba: {},
    'bomba-golpe': {},
    cero: {
      explain: '«Esperar hasta que» se queda quieto hasta que pasa algo, por ejemplo que las vidas sean 0. Recién ahí sigue con el bloque de abajo.',
    },
  },
});

export const MUESTRA: GameDefinition[] = [MASCOTA_FACIL, BANDA_FACIL, PULPI_FACIL, CHISPA_FACIL, TRES_VIDAS_FACIL];
