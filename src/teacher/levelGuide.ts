// What each level means for teachers who assign it. The team names come from shared/levels.ts.
import type { LevelId } from '../shared/levels.ts';

export interface LevelGuide {
  id: LevelId;
  /** School grades this level usually fits. */
  grades: string;
  /** The logic the level's games require (the class 2 easy games). */
  logic: string;
  /** How to tell that a child belongs here. */
  signs: string[];
}

export const LEVEL_GUIDES: readonly LevelGuide[] = [
  {
    id: 1,
    grades: '1.º y 2.º grado',
    logic: 'Secuencia: los bloques se hacen en orden, de arriba hacia abajo, cuando tocás al personaje. Bloques con dibujos y voz, sin leer.',
    signs: [
      'Es su primer contacto con la programación o con bloques.',
      'Todavía lee con dificultad o necesita que le lean las instrucciones.',
      'Disfruta contar una historia y ver que el personaje hace lo que armó.',
    ],
  },
  {
    id: 2,
    grades: '2.º y 3.º grado',
    logic: 'Lo del nivel anterior más repetir (las vueltas): una melodía que se repite sin poner los bloques muchas veces. Bloques con dibujos.',
    signs: [
      'Armó una secuencia sin ayuda y quiere que pasen más cosas a la vez.',
      'Se da cuenta cuando repite el mismo bloque muchas veces.',
      'Todavía prefiere bloques con dibujos antes que con texto.',
    ],
  },
  {
    id: 3,
    grades: '3.º y 4.º grado',
    logic: 'Bloques con texto: al hacer clic, la bandera verde, sumar puntos, ir a un lugar al azar y ganar al llegar a un puntaje.',
    signs: [
      'Lee los bloques con texto sin ayuda.',
      'Puede seguir una consigna escrita corta sin que se la lean.',
      'Le gusta que su juego cuente puntos.',
    ],
  },
  {
    id: 4,
    grades: '4.º y 5.º grado',
    logic: 'Juegos con reglas: por siempre, mover con las flechas, «cuando toque a», puntos, ganar y perder.',
    signs: [
      'Ya usó Scratch u otro entorno de bloques y no necesita guía para empezar.',
      'Piensa en reglas: «si pasa esto, entonces aquello».',
      'Le interesa que su juego tenga puntos, que se pueda ganar o perder.',
    ],
  },
  {
    id: 5,
    grades: '6.º y 7.º grado',
    logic: 'Lo del nivel anterior en juegos más largos: fases (el juego cambia al llegar a un puntaje), esconder y mostrar, y «si … entonces» con «¿tocando?».',
    signs: [
      'Terminó un juego de esquivar sin ayuda y quiere uno más largo.',
      'Sabe depurar: cuando algo no anda, busca por qué.',
      'Puede explicarle a un compañero qué hace cada bloque de su juego.',
    ],
  },
];

export const LEVEL_ADVICE = [
  'En la Clase 2 ningún nivel usa sobres (mensajes), operadores (<, =, +), variables ni coordenadas. Cada nivel tiene misiones en escalera: Construí, Construí, Completá (ya viene algo armado) y Arreglá (hay que encontrar errores), y después el Gran desafío.',
  'El grado no define el nivel: chicos del mismo grado pueden estar en niveles distintos según su experiencia.',
  'Ante la duda, conviene el nivel más bajo. Se puede subir en cualquier momento y el avance que ya tienen se conserva.',
  'Los chicos nunca ven el número: solo ven el nombre de su equipo.',
];
