/** Level 1, class 1: the hero appears, makes a friend, travels and says goodbye. A story told in blocks. */
import type { BlockType } from '../../language/catalog.ts';
import { fBackdrop, fClick, fFace, fFlag, fGrow, fJump, fLeft, fRight, fSay, fSound, fSpin, fStar, fText, project, sprite } from '../../language/ir.ts';
import {
  blocksInList, blocksOfType, chosenBackdrop, countAny, distinctFields, hasSequence, kindsAfter, spriteCount, spritesWithBlocks, spritesWithHat,
} from '../checks.ts';
import type { GameDefinition, StepContext } from '../types.ts';

const SETUP = project('parque', []);

const MOVES: BlockType[] = ['f_right', 'f_left', 'f_up', 'f_down', 'f_jump'];
const SPEECH: BlockType[] = ['f_say', 'f_text'];
/** What can happen when someone is tapped for the applause. */
const PARTY: BlockType[] = ['f_star', 'f_sound', 'f_spin', 'f_face', 'f_grow', 'f_shrink', 'f_say', 'f_text', 'f_jump'];

/** A phrase the child wrote with the pencil bubble: not empty and not the «Hola» that comes with the block. */
const ownWords = (ctx: StepContext): boolean =>
  ctx.program.sprites.some(
    (s) =>
      ctx.stats.ranBy(s.id, 'say') &&
      blocksInList(s.scripts.flatMap((sc) => sc.body)).some((b) => {
        const t = String(b.fields.T ?? '').trim();
        return b.type === 'f_text' && t.length >= 2 && t.toLowerCase() !== 'hola';
      }),
  );

/** Walks to a first new place, keeps walking, and then arrives at a second new place that is not the first. */
const arrivesTwice = (ctx: StepContext): boolean =>
  ctx.program.sprites.some((s) =>
    s.scripts.some((sc) => {
      const flat = blocksInList(sc.body);
      const first = flat.findIndex((b) => b.type === 'f_backdrop' && chosenBackdrop(ctx, b));
      const walk = first < 0 ? -1 : flat.findIndex((b, i) => i > first && MOVES.includes(b.type));
      return walk >= 0 && flat.some((b, i) => i > walk && b.type === 'f_backdrop' && chosenBackdrop(ctx, b) && b.fields.B !== flat[first].fields.B);
    }),
  );

export const presentacion: GameDefinition = {
  id: 'presentacion',
  level: 1,
  class: 1,
  order: 1,
  kind: 'story',
  title: 'La gran presentación',
  pitch: 'Un héroe llega, hace un amigo, viaja y se despide. ¡Vos inventás la historia!',
  concept: 'Secuencia: ordenar bloques en el tiempo para contar una historia con principio, viaje y final.',
  cover: 'toby',
  setup: SETUP,
  toolbox: ['f_flag', 'f_say'],
  phases: [
    {
      title: 'Aparece el héroe',
      goal: 'Elegís el lugar y al héroe, y el héroe se presenta.',
      steps: [
        {
          id: 'lugar',
          title: 'Elegí el lugar',
          text: '¡Hola! Soy Robi. Hoy vas a inventar tu propia historia. Primero elegí dónde pasa: tocá el lugar que más te guste.',
          hints: ['Mirá los dibujitos de abajo. Tocá el que más te guste. Podés tocar cualquiera.'],
          point: 'backdrops',
          check: (ctx) => ctx.ui.backdropChosen,
        },
        {
          id: 'heroe',
          title: 'Elegí al héroe',
          text: 'Ahora elegí quién es el héroe. Tocá el botón con el más.',
          hints: ['El botón con el más está al lado de los personajes.'],
          point: 'add-sprite',
          check: (ctx) => spriteCount(ctx) > SETUP.sprites.length,
        },
        {
          id: 'saludo',
          title: '¡Que salude!',
          text: 'Tu héroe tiene que saludar. Arrastrá el globito abajo de la bandera verde. Tocá la frase para elegir otra. Después tocá el botón verde.',
          hints: ['El globito va pegado abajo de la bandera.'],
          demo: 'f_say',
          check: (ctx) => spritesWithHat(ctx, { hat: 'f_flag', types: SPEECH }).length >= 1 && ctx.stats.ran('say'),
        },
        {
          id: 'caminar',
          title: '¡Que entre caminando!',
          text: 'Ahora que camine. Poné flechas abajo del globito. Cada flecha es un paso. Poné tres o más y probá con el botón verde.',
          hints: ['Cada flecha mueve al héroe un poquito. Para llegar lejos, poné varias.'],
          unlock: ['f_right', 'f_left', 'f_up', 'f_down', 'f_jump'],
          demo: 'f_right',
          check: (ctx) => countAny(ctx, MOVES) >= 3 && ctx.stats.count('move') >= 3,
        },
      ],
    },
    {
      title: 'Un amigo',
      goal: 'Llega un amigo y los dos conversan.',
      steps: [
        {
          id: 'amigo',
          title: 'Sumá un amigo',
          text: 'Toda historia necesita a alguien más. Sumá un amigo con el botón del más.',
          hints: ['Es el mismo botón que usaste para elegir al héroe.'],
          point: 'add-sprite',
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 2,
        },
        {
          id: 'charla',
          title: 'Que charlen',
          text: 'Que conversen de verdad. Cada uno tiene que decir dos cosas o más con el globito. Probá con el botón verde.',
          hints: [
            'Elegí al amigo y armale su propio programa, igual que al héroe.',
            'Cada uno necesita su bandera verde y dos globitos abajo.',
            'Si querés escribir algo tuyo, el globito con el lápiz te deja hacerlo.',
          ],
          unlock: ['f_text'],
          example: [
            { sprite: 'Héroe', scripts: [fFlag(fSay('HOLA'), fSay('NOMBRE'))] },
            { sprite: 'Amigo', scripts: [fFlag(fSay('AMIGO'), fSay('JUGAR'))] },
          ],
          check: (ctx) => spritesWithBlocks(ctx, SPEECH, 2, 'say').length >= 2 && ctx.stats.count('say') >= 4,
        },
        {
          id: 'tu-frase',
          title: 'Escribí tu frase',
          text: 'Ahora que el héroe diga algo que inventes vos. Usá el globito con el lápiz y escribí una frase. Después tocá el botón verde.',
          hints: [
            'El globito con el lápiz te deja escribir. Tocá las letras y escribí.',
            'Escribí lo que quieras, menos «Hola». Tiene que ser algo tuyo.',
          ],
          example: [{ sprite: 'Héroe', scripts: [fFlag(fText('Vamos a jugar'))] }],
          check: (ctx) => ownWords(ctx),
        },
        {
          id: 'turno',
          title: 'Contesta cuando lo tocás',
          text: 'Ahora el amigo contesta cuando lo tocás. Usá la manito y poné un globito abajo. Después tocá al amigo en el escenario.',
          hints: [
            'La manito es otro comienzo, como la bandera verde.',
            'Sacá la manito, pegale un globito abajo y tocá al amigo en el escenario.',
          ],
          unlock: ['f_click'],
          example: [{ sprite: 'Amigo', scripts: [fClick(fSay('SI'))] }],
          check: (ctx) => spriteCount(ctx) >= 2 && spritesWithHat(ctx, { hat: 'f_click', types: SPEECH }).length >= 1,
        },
      ],
    },
    {
      title: 'Viaje a otro lugar',
      goal: 'Los dos viajan, el lugar cambia y pasa algo sorprendente.',
      steps: [
        {
          id: 'viaje',
          title: 'Los dos caminan',
          text: 'Ahora viajan. Hacé que el héroe y el amigo caminen con las flechas, tres pasos o más cada uno.',
          hints: [
            'Cada uno necesita sus propias flechas, abajo de su bandera verde.',
            'Si el amigo viene de la derecha, usá la flecha para el otro lado.',
          ],
          example: [
            { sprite: 'Héroe', scripts: [fFlag(fRight(), fRight(), fRight())] },
            { sprite: 'Amigo', scripts: [fFlag(fLeft(), fLeft(), fLeft())] },
          ],
          check: (ctx) => spritesWithBlocks(ctx, MOVES, 3, 'move').length >= 2,
        },
        {
          id: 'lugar-nuevo',
          title: '¡Otro lugar!',
          text: 'Llegaron a un lugar nuevo. Hacé que el paisaje cambie solo, después de caminar. Usá «cambiar de lugar» y elegí un lugar distinto.',
          hints: [
            'Primero van las flechas y después «cambiar de lugar».',
            'Tocá el dibujito del bloque y elegí un lugar nuevo. El parque ya viene puesto, así que ese no cuenta.',
          ],
          unlock: ['f_backdrop'],
          example: [{ sprite: 'Héroe', scripts: [fFlag(fRight(), fRight(), fRight(), fBackdrop('castillo'))] }],
          check: (ctx) =>
            blocksOfType(ctx, 'f_backdrop').some((b) => chosenBackdrop(ctx, b)) &&
            ctx.stats.ran('backdrop') &&
            hasSequence(ctx, MOVES, ['f_backdrop']),
        },
        {
          id: 'asombro',
          title: '¡Qué sorpresa!',
          text: 'En el lugar nuevo, alguien se sorprende. Después de «cambiar de lugar», poné tres cosas distintas: una cara, un sonido, un globito, un giro...',
          hints: [
            'Poné los bloques abajo de «cambiar de lugar».',
            'Probá con la carita, el parlante, el globito y el giro.',
          ],
          unlock: ['f_face', 'f_sound', 'f_spin', 'f_grow', 'f_shrink'],
          example: [
            { sprite: 'Héroe', scripts: [fFlag(fBackdrop('castillo'), fFace('sorpresa'), fSound('magia'), fSay('GUAU'), fSpin())] },
          ],
          check: (ctx) => kindsAfter(ctx, ['f_backdrop']) >= 3,
        },
        {
          id: 'tercer-lugar',
          title: 'Y un lugar más',
          text: 'El viaje sigue. Después de la sorpresa, que caminen otra vez y lleguen a un tercer lugar. Usá otro «cambiar de lugar», distinto a los anteriores.',
          hints: [
            'Poné más flechas y después otro «cambiar de lugar».',
            'Elegí un lugar que no hayas usado. El parque no cuenta, porque viene puesto.',
          ],
          example: [{ sprite: 'Héroe', scripts: [fFlag(fRight(), fBackdrop('castillo'), fSpin(), fRight(), fRight(), fBackdrop('mar'))] }],
          check: (ctx) => arrivesTwice(ctx) && ctx.stats.count('backdrop') >= 2,
        },
      ],
    },
    {
      title: 'La despedida',
      goal: 'Se despiden con caras, sonidos y una estrella.',
      steps: [
        {
          id: 'caras',
          title: 'Cada uno con su cara',
          text: 'Llegó la hora de despedirse. Cada uno se pone una carita distinta: contento, triste, muerto de risa...',
          hints: [
            'Cada uno tiene su carita. Tocá el dibujito para elegir otra.',
            'Probá con una cara de alegría y otra de pena.',
          ],
          example: [
            { sprite: 'Héroe', scripts: [fFlag(fFace('triste'), fSay('CHAU'))] },
            { sprite: 'Amigo', scripts: [fFlag(fFace('risa'), fSay('CHAU'))] },
          ],
          check: (ctx) => spritesWithBlocks(ctx, ['f_face'], 1, 'face').length >= 2 && distinctFields(ctx, 'f_face', 'E') >= 2,
        },
        {
          id: 'sonidos',
          title: 'Sonidos y vueltas',
          text: 'Que cada uno suene distinto. Elegí un sonido para cada uno. Y que festejen: poné dos giros o agrandar.',
          hints: [
            'El parlante tiene varios sonidos. Tocá el dibujito para cambiarlo.',
            'Con el giro y el agrandar, tu personaje festeja.',
          ],
          example: [
            { sprite: 'Héroe', scripts: [fFlag(fSound('guau'), fSpin())] },
            { sprite: 'Amigo', scripts: [fFlag(fSound('miau'), fGrow())] },
          ],
          check: (ctx) =>
            spritesWithBlocks(ctx, ['f_sound'], 1, 'sound').length >= 2 &&
            distinctFields(ctx, 'f_sound', 'S') >= 2 &&
            countAny(ctx, ['f_spin', 'f_grow', 'f_shrink']) >= 2 &&
            (ctx.stats.ran('spin') || ctx.stats.ran('size')),
        },
        {
          id: 'estrella',
          title: 'Una estrella para el aplauso',
          text: 'Un aplauso final: cuando tocás a alguien, aparece una estrella. Usá la manito y la estrella. Después tocá a tu personaje.',
          hints: [
            'La manito empieza lo que pasa cuando tocás.',
            'Pegale la estrella abajo y tocá al personaje en el escenario.',
          ],
          unlock: ['f_star'],
          example: [{ sprite: 'Héroe', scripts: [fClick(fStar(), fSound('aplauso'))] }],
          check: (ctx) => spritesWithHat(ctx, { hat: 'f_click', types: ['f_star'] }).length >= 1 && ctx.stats.maxScore >= 1,
        },
        {
          id: 'fiesta',
          title: 'Una fiesta de aplausos',
          text: 'Que el aplauso sea una fiesta. Cuando tocás a alguien, que pasen cinco cosas o más, de tres tipos distintos: estrella, sonido, giro, cara, globito...',
          hints: [
            'Sumá más bloques abajo de la estrella.',
            'Probá con el sonido, el giro y la carita. Después tocá a tu personaje.',
          ],
          example: [{ sprite: 'Héroe', scripts: [fClick(fStar(), fSound('aplauso'), fSpin(), fFace('risa'), fGrow())] }],
          check: (ctx) => spritesWithHat(ctx, { hat: 'f_click', types: PARTY, min: 5, kinds: 3 }).length >= 1,
        },
        {
          id: 'mostrar',
          title: '¡Mostrá tu historia!',
          text: '¡Terminaste! Tocá el botón amarillo para ver tu historia en pantalla grande.',
          hints: ['Buscá el botón amarillo y tocalo.'],
          point: 'show',
          check: (ctx) => ctx.stats.shown,
        },
      ],
    },
  ],
  challenges: [
    {
      title: 'Un baile de presentación',
      text: 'Inventá un baile larguísimo para el héroe: seis pasos o más, con giros y saltos. ¿Cómo lo hacés diferente a los de tus compañeros?',
    },
    {
      title: 'Un tercer personaje',
      text: 'Sumá a alguien que aparezca recién al final y diga algo sorprendente. ¿Quién es? ¿Qué dice?',
    },
    {
      title: 'Cuatro lugares',
      text: 'Tu historia ya pasa por tres lugares. Sumá un cuarto. ¿A dónde van? ¿Qué pasa en cada uno?',
    },
    {
      title: 'Un final con mucha fiesta',
      text: 'Inventá un final con todos los sonidos que se te ocurran. ¿Cuál es el mejor festejo?',
    },
    {
      title: 'Dos finales',
      text: 'Hacé que tocar al héroe sea un final y que tocar al amigo sea otro final distinto. ¿Cuál es el más gracioso?',
    },
    {
      title: 'Mostrásela a alguien',
      text: 'Mostrale tu historia a un compañero y preguntale qué parte le gustó más. ¿Qué cambiarías para que sea todavía mejor?',
    },
  ],
  solution: {
    program: project('teatro', [
      sprite(
        'heroe',
        'toby',
        [
          fFlag(
            fSay('HOLA'), fText('Vamos a jugar'),
            fRight(), fRight(), fRight(),
            fBackdrop('castillo'),
            fFace('sorpresa'), fSound('guau'), fSay('GUAU'), fSpin(),
            fRight(), fRight(), fBackdrop('mar'),
            fFace('triste'), fSay('CHAU'),
          ),
          fClick(fStar(), fSound('aplauso'), fSpin(), fFace('risa'), fGrow()),
        ],
        { x: -150, y: -110, name: 'Héroe' },
      ),
      sprite(
        'amigo',
        'michi',
        [
          fFlag(
            fSay('AMIGO'), fSay('SI'),
            fLeft(), fLeft(), fJump(),
            fFace('risa'), fSound('miau'), fGrow(),
          ),
          fClick(fSay('QUIERO')),
        ],
        { x: 150, y: -110, flip: -1, dir: -90, name: 'Amigo' },
      ),
    ]),
    play: (game) => {
      game.flag();
      game.run(40_000);
      game.tap('amigo');
      game.run(3_000);
      game.tap('heroe');
      game.run(2_000);
      game.machine.setShown(true);
    },
  },
};
