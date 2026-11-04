/** Level 1, class 1: a pet that reacts when tapped, eats, grows, makes a friend and plays with it. */
import type { BlockType } from '../../language/catalog.ts';
import {
  fBackdrop, fClick, fFace, fFlag, fGrow, fJump, fLeft, fRight, fSay, fShrink, fSound, fSpin, fStar, fText, project, sprite,
  type SpriteProgram,
} from '../../language/ir.ts';
import {
  blocksInList, blocksOfType, chosenBackdrop, hasSequence, isCharacter, isObject, scriptsOfHat, spritesWithBlocks, spritesWithHat,
} from '../checks.ts';
import type { GameDefinition, StepContext } from '../types.ts';

const SETUP = project('ciudad', [sprite('manzana', 'apple', [], { x: 170, y: -125, name: 'Manzana' })]);

const MOVES: BlockType[] = ['f_right', 'f_left', 'f_up', 'f_down', 'f_jump'];
const SPEECH: BlockType[] = ['f_say', 'f_text'];
const REACTIONS: BlockType[] = ['f_sound', 'f_spin', 'f_face', 'f_jump', 'f_grow', 'f_shrink', 'f_say', 'f_text'];

const characters = (ctx: StepContext): SpriteProgram[] => ctx.program.sprites.filter(isCharacter);

/** A name or phrase the child wrote: not empty and not the «Hola» that comes with the block. */
const isOwnText = (b: { type: string; fields: Record<string, unknown> }): boolean => {
  const t = String(b.fields.T ?? '').trim();
  return b.type === 'f_text' && t.length >= 2 && t.toLowerCase() !== 'hola';
};

/** Reactions a sprite has under its «al tocarme», counted one by one, and how many kinds they are. */
function tapReactions(sprite: SpriteProgram): { total: number; kinds: number } {
  const list = scriptsOfHat(sprite, 'f_click').flatMap((sc) => blocksInList(sc.body)).filter((b) => REACTIONS.includes(b.type));
  return { total: list.length, kinds: new Set(list.map((b) => (b.type === 'f_text' ? 'f_say' : b.type))).size };
}

/** What a sprite does when tapped, as a comparable string: the kinds of reaction it uses. */
function tapSignature(sprite: SpriteProgram): string {
  const kinds = new Set<string>();
  for (const script of scriptsOfHat(sprite, 'f_click')) {
    for (const b of blocksInList(script.body)) if (REACTIONS.includes(b.type)) kinds.add(b.type === 'f_text' ? 'f_say' : b.type);
  }
  return [...kinds].sort().join(',');
}

export const miMascota: GameDefinition = {
  id: 'mi-mascota',
  level: 1,
  class: 1,
  order: 2,
  kind: 'game',
  title: 'Mi mascota',
  pitch: 'Elegí una mascota, dale de comer, mirala crecer y sumale una amiga.',
  concept: 'Secuencia y causa-efecto: cada toque dispara una cadena de bloques en orden; la segunda mascota practica la misma idea con otros bloques.',
  cover: 'michi',
  setup: SETUP,
  toolbox: ['f_click'],
  phases: [
    {
      title: 'Tu mascota',
      goal: 'Elegís a tu mascota y reacciona cuando la tocás.',
      steps: [
        {
          id: 'mascota',
          title: 'Elegí tu mascota',
          text: '¡Hola! Soy Robi. Hoy vas a tener una mascota. Tocá el botón con el más y elegí cuál querés.',
          hints: ['El botón con el más está al lado de los personajes.'],
          point: 'add-sprite',
          check: (ctx) => characters(ctx).length >= 1,
        },
        {
          id: 'casa',
          title: 'Su casa',
          text: 'Ahora elegí dónde vive tu mascota. Tocá un lugar que no tenga el borde de color.',
          hints: ['Mirá los dibujitos de abajo. El que tiene borde de color ya está puesto. Tocá otro, el que más le guste a tu mascota.'],
          point: 'backdrops',
          check: (ctx) => ctx.program.backdrop !== SETUP.backdrop,
        },
        {
          id: 'toque',
          title: 'Que haga un sonido',
          text: 'Tu mascota hace un sonido cuando la tocás. Sacá la manito y poné el parlante abajo. Después tocá a tu mascota en el escenario.',
          hints: ['La manito es el comienzo. El parlante va pegado abajo.'],
          unlock: ['f_sound'],
          demo: 'f_click',
          check: (ctx) => spritesWithHat(ctx, { hat: 'f_click', types: ['f_sound'] }).some(isCharacter),
        },
        {
          id: 'reacciones',
          title: 'Muchas reacciones',
          text: 'Una mascota de verdad hace muchas cosas. Cuando la tocás, que haga cuatro cosas o más, de al menos tres tipos distintos: cara, giro, salto, sonido...',
          hints: ['Pegá más bloques abajo del parlante. Probá la carita, el giro y el salto.'],
          unlock: ['f_spin', 'f_face', 'f_jump', 'f_grow', 'f_shrink', 'f_say'],
          demo: 'f_face',
          check: (ctx) => spritesWithHat(ctx, { hat: 'f_click', types: REACTIONS, min: 4, kinds: 3 }).some(isCharacter),
        },
        {
          id: 'nombre',
          title: 'Su nombre',
          text: 'Tu mascota necesita un nombre. Usá el globito con el lápiz y escribí su nombre, para que lo diga cuando la tocás. Después tocala.',
          hints: [
            'El globito con el lápiz está con los demás bloques. Va abajo de la manito de tu mascota.',
            'Tocá las letras del globito y escribí un nombre que no sea «Hola».',
          ],
          unlock: ['f_text'],
          example: [{ sprite: 'Mi mascota', scripts: [fClick(fSound('miau'), fText('Soy Mimi'))] }],
          check: (ctx) =>
            spritesWithHat(ctx, { hat: 'f_click', types: ['f_text'] })
              .filter(isCharacter)
              .some((s) => blocksInList(scriptsOfHat(s, 'f_click').flatMap((sc) => sc.body)).some(isOwnText)),
        },
      ],
    },
    {
      title: 'Come y crece',
      goal: 'La mascota come y crece.',
      steps: [
        {
          id: 'comer',
          title: 'La manzana',
          text: 'La manzana es la comida. Hacé que le pasen dos cosas a la manzana cuando la tocás, como si se la estuvieran comiendo. Después tocala.',
          hints: [
            'La manzana también tiene su propia manito. Elegila y armale un programa.',
            'Una manzana mordida se achica y suena. Pueden ser dos cosas cualquiera: un sonido, una cara, un giro...',
          ],
          example: [{ sprite: 'Manzana', scripts: [fClick(fSound('boing'), fShrink())] }],
          check: (ctx) =>
            spritesWithHat(ctx, { hat: 'f_click', types: REACTIONS, min: 2 }).some(isObject),
        },
        {
          id: 'crece',
          title: 'Crece y crece',
          text: 'Y tu mascota crece cuando come. Hacé que se agrande dos veces cuando la tocás.',
          hints: [
            'Hay un bloque que hace más grande.',
            'Ponelo dos veces abajo de la manito de tu mascota.',
          ],
          example: [{ sprite: 'Mi mascota', scripts: [fClick(fGrow(), fGrow())] }],
          check: (ctx) => spritesWithHat(ctx, { hat: 'f_click', types: ['f_grow'], min: 2 }).some(isCharacter) && ctx.stats.ran('size'),
        },
        {
          id: 'gracias',
          title: 'Da las gracias',
          text: 'Cuando termina de crecer, tu mascota da las gracias: dice algo con el globito y se pone contenta con una cara.',
          hints: [
            'Primero crece, después habla.',
            'Poné el globito y la carita abajo de lo que crece.',
          ],
          example: [{ sprite: 'Mi mascota', scripts: [fClick(fGrow(), fGrow(), fSay('GRACIAS'), fFace('feliz'))] }],
          check: (ctx) =>
            hasSequence(ctx, ['f_grow'], SPEECH) && hasSequence(ctx, ['f_grow'], ['f_face']) && ctx.stats.ran('say') && ctx.stats.ran('face'),
        },
        {
          id: 'otra-cosa',
          title: 'Una cosa más',
          text: 'Tu mascota quiere más cosas. Sumá otra, distinta de la manzana: una pelota o un corazón. Armale su manito para que pase algo cuando la tocás. Después tocala.',
          hints: [
            'Es el botón del más. Buscá entre los objetos.',
            'Elegí la cosa nueva y armale su manito, igual que a la manzana.',
          ],
          point: 'add-sprite',
          example: [{ sprite: 'Pelota', scripts: [fClick(fSound('boing'), fGrow())] }],
          check: (ctx) => {
            const touched = spritesWithHat(ctx, { hat: 'f_click', types: REACTIONS }).filter(isObject);
            return touched.length >= 2 && new Set(touched.map((s) => s.art)).size >= 2;
          },
        },
      ],
    },
    {
      title: 'Una segunda mascota',
      goal: 'Sumás otra mascota con sus propias reacciones.',
      steps: [
        {
          id: 'otra',
          title: 'Sumá otra mascota',
          text: 'Tu mascota está sola. Sumá una segunda, distinta de la primera.',
          hints: ['Es el mismo botón del más. Elegí otro animal.'],
          point: 'add-sprite',
          check: (ctx) => new Set(characters(ctx).map((s) => s.art)).size >= 2,
        },
        {
          id: 'propias',
          title: 'Sus propias reacciones',
          text: 'La nueva mascota no hace lo mismo que la primera. Armale un toque con otras reacciones, dos o más. Después tocala.',
          hints: [
            'Elegí a la nueva mascota y armale su manito.',
            'Si la primera gira y salta, esta puede achicarse y poner cara de risa.',
          ],
          example: [{ sprite: 'Segunda mascota', scripts: [fClick(fShrink(), fFace('risa'), fSpin())] }],
          check: (ctx) => {
            const touched = spritesWithHat(ctx, { hat: 'f_click', types: REACTIONS, min: 2 }).filter(isCharacter);
            return touched.length >= 2 && new Set(touched.map(tapSignature)).size >= 2;
          },
        },
        {
          id: 'voz',
          title: 'Cada una con su voz',
          text: 'Cada mascota tiene su voz. Elegí un sonido distinto para cada una y tocalas a las dos.',
          hints: [
            'El parlante tiene varios sonidos. Tocá el dibujito para cambiarlo.',
            'Uno puede ser un miau y el otro un guau.',
          ],
          example: [
            { sprite: 'Mi mascota', scripts: [fClick(fSound('miau'))] },
            { sprite: 'Segunda mascota', scripts: [fClick(fSound('guau'))] },
          ],
          check: (ctx) => {
            const voices = spritesWithBlocks(ctx, ['f_sound'], 1, 'sound').filter(isCharacter);
            const sounds = new Set(voices.flatMap((s) => blocksInList(s.scripts.flatMap((sc) => sc.body)).filter((b) => b.type === 'f_sound').map((b) => b.fields.S)));
            return voices.length >= 2 && sounds.size >= 2;
          },
        },
        {
          id: 'truco',
          title: 'Un truco largo',
          text: 'La segunda mascota aprende un truco largo. Cuando la tocás, que haga seis cosas o más, de cuatro tipos distintos. Después tocala.',
          hints: [
            'Pegá más bloques abajo de su manito: sonido, cara, giro, salto, achicar...',
            'Seis bloques en fila hacen un truco. Probá que no sean todos iguales.',
          ],
          example: [{ sprite: 'Segunda mascota', scripts: [fClick(fSound('guau'), fShrink(), fFace('risa'), fSpin(), fJump(), fSay('GRACIAS'))] }],
          check: (ctx) =>
            characters(ctx)
              .slice(1)
              .some((s) => {
                const { total, kinds } = tapReactions(s);
                return total >= 6 && kinds >= 4 && ctx.stats.ranHatBy(s.id, 'click');
              }),
        },
      ],
    },
    {
      title: 'Juegan juntas',
      goal: 'Las dos mascotas viajan a otro lugar y juegan.',
      steps: [
        {
          id: 'viajan',
          title: 'Viajan juntas',
          text: 'Con la bandera verde, las mascotas viajan a un lugar nuevo. Usá «cambiar de lugar» y elegí un lugar distinto al de la casa.',
          hints: [
            'La bandera verde es otro comienzo. Pegale «cambiar de lugar» abajo.',
            'Tocá el dibujito del bloque para elegir el lugar. El parque ya viene puesto, así que ese no cuenta.',
          ],
          unlock: ['f_flag', 'f_backdrop'],
          example: [{ sprite: 'Mi mascota', scripts: [fFlag(fBackdrop('castillo'))] }],
          check: (ctx) =>
            spritesWithHat(ctx, { hat: 'f_flag', types: ['f_backdrop'] }).length >= 1 &&
            blocksOfType(ctx, 'f_backdrop').some((b) => chosenBackdrop(ctx, b)) &&
            ctx.stats.ran('backdrop'),
        },
        {
          id: 'juegan',
          title: 'A jugar',
          text: 'En el lugar nuevo, las dos juegan: caminan y saltan. Cada una tiene que moverse tres veces o más.',
          hints: [
            'Cada mascota necesita sus propias flechas, abajo de su bandera verde.',
            'Las flechas caminan y el resorte salta.',
          ],
          unlock: ['f_right', 'f_left', 'f_up', 'f_down'],
          example: [
            { sprite: 'Mi mascota', scripts: [fFlag(fRight(), fJump(), fRight())] },
            { sprite: 'Segunda mascota', scripts: [fFlag(fLeft(), fJump(), fLeft())] },
          ],
          check: (ctx) => spritesWithHat(ctx, { hat: 'f_flag', types: MOVES, min: 3 }).filter(isCharacter).length >= 2,
        },
        {
          id: 'estrellas',
          title: 'Juntá estrellas',
          text: 'Cada vez que tocás una mascota, ganás una estrella. Hacelo con las dos y tocalas varias veces.',
          hints: [
            'La estrella va abajo de la manito de cada mascota.',
            'Tocá a las dos mascotas en el escenario para ganar estrellas.',
          ],
          unlock: ['f_star'],
          example: [{ sprite: 'Mi mascota', scripts: [fClick(fGrow(), fStar())] }],
          check: (ctx) => spritesWithHat(ctx, { hat: 'f_click', types: ['f_star'] }).filter(isCharacter).length >= 2 && ctx.stats.maxScore >= 2,
        },
        {
          id: 'mostrar',
          title: '¡Mostrá a tus mascotas!',
          text: '¡Terminaste! Tocá el botón amarillo para ver tu juego en pantalla grande.',
          hints: ['Buscá el botón amarillo y tocalo.'],
          point: 'show',
          check: (ctx) => ctx.stats.shown,
        },
      ],
    },
  ],
  challenges: [
    {
      title: 'Un truco secreto',
      text: 'Inventá un truco larguísimo para tu primera mascota: cuando la tocás, hace ocho cosas seguidas. ¿Cuál es el truco más gracioso?',
    },
    {
      title: 'La mascota dormilona',
      text: 'Hacé que una mascota se achique, ponga cara de dormida y suene distinto cuando la tocás. ¿Cómo se despierta?',
    },
    {
      title: 'Una carrera de mascotas',
      text: 'Hacé que las dos mascotas corran con las flechas. ¿Cuál llega más lejos? ¿Cómo hacés que una gane?',
    },
    {
      title: 'La historia de tu mascota',
      text: 'Contá una historia corta con globitos y cambios de lugar: ¿qué le pasa a tu mascota hoy?',
    },
    {
      title: 'Una tercera mascota',
      text: 'Sumá una mascota más con su propia voz y sus propias reacciones. ¿Cómo hacés para que no se parezca a las otras dos?',
    },
    {
      title: 'La fiesta de las mascotas',
      text: 'Hacé que, al tocar la pelota, las dos mascotas festejen a la vez con una estrella cada una. ¿Cuántas estrellas juntás?',
    },
  ],
  solution: {
    program: project(
      'parque',
      [
        sprite(
          'manzana',
          'apple',
          [fClick(fSound('boing'), fShrink(), fSpin())],
          { x: 170, y: -125, name: 'Manzana' },
        ),
        sprite('pelota', 'ball', [fClick(fSound('boing'), fGrow())], { x: 100, y: -125, name: 'Pelota' }),
        sprite(
          'gata',
          'michi',
          [
            fClick(fSound('miau'), fText('Soy Mimi'), fSpin(), fFace('risa'), fJump(), fGrow(), fGrow(), fSay('GRACIAS'), fFace('feliz'), fStar()),
            fFlag(fBackdrop('castillo'), fRight(), fJump(), fRight()),
          ],
          { x: -120, y: -110, name: 'Mi mascota' },
        ),
        sprite(
          'perro',
          'toby',
          [
            fClick(fSound('guau'), fShrink(), fFace('sorpresa'), fSpin(), fJump(), fSay('GRACIAS'), fStar()),
            fFlag(fLeft(), fJump(), fLeft()),
          ],
          { x: 60, y: -110, flip: -1, dir: -90, name: 'Segunda mascota' },
        ),
      ],
    ),
    play: (game) => {
      game.tap('manzana');
      game.run(2_000);
      game.tap('pelota');
      game.run(1_500);
      game.tap('gata');
      game.run(9_000);
      game.tap('perro');
      game.run(7_000);
      game.flag();
      game.run(6_000);
      game.tap('gata');
      game.tap('perro');
      game.run(9_000);
      game.machine.setShown(true);
    },
  },
};
