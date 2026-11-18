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
    toque: {},
    reacciones: {
      title: 'Más reacciones',
      text: 'Cuando la tocás, que haga tres cosas. Por ejemplo: una cara, un giro y un salto. Después tocala.',
      hints: ['Poné los bloques uno abajo del otro, debajo de la manito.', 'Probá con la carita, el giro y el salto.'],
      check: (ctx) => spritesWithHat(ctx, { hat: 'f_click', types: PET_REACTIONS, min: 3, kinds: 2 }).some(isCharacter),
    },
    crece: {
      text: 'Tu mascota crece. Cuando la tocás, que se agrande dos veces. Después tocala.',
    },
    mostrar: {},
  },
});

export const BANDA_FACIL = easyVersion(bandaParque, {
  pitch: 'Armá un músico que toca tu melodía, baila y repite el estribillo.',
  keep: {
    escena: {},
    tocar: {},
    melodia: {
      text: 'Armá una melodía de cinco notas. Cambiá algunas para que no suenen todas iguales. Después tocá al músico.',
    },
    baile: {
      text: 'Que baile mientras toca: poné un salto y un giro entre las notas. Después tocalo.',
    },
    vueltas: {
      text: 'Usá las vueltas, el bloque de flechitas que giran, y poné dos notas adentro. Después tocá al músico.',
    },
    mostrar: {},
  },
});

export const PULPI_FACIL = easyVersion(cazaPulpi, {
  pitch: 'Tocá a Pulpi para sumar puntos antes de que se escape. ¡Llegá a 10!',
  keep: {
    fondo: {},
    reaccion: {},
    punto: {},
    cero: {},
    escapa: {},
    ganar: {
      text: 'Cuando juntes 10 puntos, ganás. Armá la victoria y ganalo de verdad.',
      hints: ['Es otro bloque que empieza cuando los puntos llegan a un número.', 'Adentro va el bloque de ganar.', 'Tocá a Pulpi hasta llegar a 10.'],
    },
    mostrar: {},
  },
});

export const CHISPA_FACIL = easyVersion(chispa, {
  pitch: 'Mové a Michi con las flechas, juntá monedas y que no te atrape Chispa.',
  keep: {
    escena: {},
    heroe: {},
    rebota: {},
    pierde: {},
    moneda: {},
    recoger: {},
    reaparece: {},
    ganar: {
      text: 'Con 8 monedas, Michi gana. Armá la victoria y ganala de verdad.',
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
    mover: {},
    cae: {},
    atrapar: {},
    vidas: {},
    escapa: {},
    bomba: {},
    'bomba-golpe': {},
    cero: {},
  },
});

export const MUESTRA: GameDefinition[] = [MASCOTA_FACIL, BANDA_FACIL, PULPI_FACIL, CHISPA_FACIL, TRES_VIDAS_FACIL];
