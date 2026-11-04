// What each level means for teachers who assign it. The team names come from shared/levels.ts.
import type { LevelId } from '../shared/levels.ts';

export interface LevelGuide {
  id: LevelId;
  /** The logic the level's games require. */
  logic: string;
  /** How to tell that a child belongs here. */
  signs: string[];
}

export const LEVEL_GUIDES: readonly LevelGuide[] = [
  {
    id: 1,
    logic: 'Secuencia: los bloques se ejecutan de arriba hacia abajo. Bloques con dibujos y voz, sin leer textos largos.',
    signs: [
      'Es su primer contacto con la programación o con bloques.',
      'Todavía lee con dificultad o necesita que le lean las instrucciones.',
      'Disfruta contar una historia y ver que el personaje hace lo que armó.',
    ],
  },
  {
    id: 2,
    logic: 'Eventos, tiempos y repetir: «cuando toco esto, pasa aquello», varios personajes y mensajes de colores.',
    signs: [
      'Armó una secuencia sin ayuda y quiere que pasen más cosas a la vez.',
      'Entiende que un personaje puede esperar o reaccionar a otro.',
      'Todavía prefiere bloques con dibujos antes que con texto.',
    ],
  },
  {
    id: 3,
    logic: 'Teclado, coordenadas y mensajes con bloques de texto. Sin condicionales: los puntos y las fases se arman con mensajes.',
    signs: [
      'Lee los bloques con texto sin ayuda.',
      'Entiende dónde está un objeto con las coordenadas x e y.',
      'Quiere controlar un personaje con el teclado o armar un cuento con finales distintos.',
    ],
  },
  {
    id: 4,
    logic: 'Bucle y reglas: por siempre, «si toca», puntos, ganar y perder. Juegos de esquivar y atrapar.',
    signs: [
      'Ya usó Scratch u otro entorno de bloques y no necesita guía para empezar.',
      'Piensa en reglas: «si pasa esto, entonces aquello».',
      'Le interesa que su juego tenga puntos, que se pueda ganar o perder.',
    ],
  },
  {
    id: 5,
    logic: 'Estado: variables, comparaciones, «si no», azar, clones y listas. Vidas, tiempo y dificultad que cambia.',
    signs: [
      'Usó variables y puede explicar para qué sirven.',
      'Sabe depurar: cuando algo no anda, busca por qué.',
      'Pide hacer cosas que los bloques anteriores no permiten, como vidas o enemigos que se repiten.',
    ],
  },
];

export const LEVEL_ADVICE = [
  'El grado no define el nivel: chicos del mismo grado pueden estar en niveles distintos según su experiencia.',
  'Ante la duda, conviene el nivel más bajo. Se puede subir en cualquier momento y el avance que ya tienen se conserva.',
  'Los chicos nunca ven el número: solo ven el nombre de su equipo.',
];
