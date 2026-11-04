/** Level 2, class 1: two racers with loops, a referee that starts them, a second lap and a podium. */
import type { BlockType } from '../../language/catalog.ts';
import type { Block, SpriteProgram } from '../../language/ir.ts';
import {
  fBackdrop, fFace, fFlag, fGrow, fJump, fLeft, fRecv, fRepeat, fRight, fSay, fSend, fShrink, fSound, fSpin, fStar, fWait, project,
  sprite,
} from '../../language/ir.ts';
import {
  blocksInList, blocksOfSprite, blocksOfType, countAny, hasSequence, kindsAfter, sequenceSprites, spriteCount, spritesRan,
  spritesWithHat,
} from '../checks.ts';
import type { GameDefinition, StepContext } from '../types.ts';

const SETUP = project('parque', []);

const WALKS: BlockType[] = ['f_right', 'f_left', 'f_up', 'f_down'];
const MOVES: BlockType[] = [...WALKS, 'f_jump'];
const SPEECH: BlockType[] = ['f_say', 'f_text'];
const FINISH: BlockType[] = ['f_face', 'f_sound', 'f_spin', 'f_grow', 'f_shrink', 'f_star'];
const CHEER: BlockType[] = ['f_sound', 'f_spin', 'f_grow', 'f_shrink', 'f_face', 'f_say', 'f_text'];

const isRepeatOfMoves = (b: Block, minTimes = 2): boolean =>
  b.type === 'f_repeat' && Number(b.fields.N) >= minTimes && blocksInList(b.body).some((x) => MOVES.includes(x.type));

/** Sprites with at least `min` loops that repeat some movement. */
const looping = (ctx: StepContext, min: number, minTimes = 2): SpriteProgram[] =>
  ctx.program.sprites.filter((s) => blocksOfSprite(s).filter((b) => isRepeatOfMoves(b, minTimes)).length >= min && ctx.stats.ranBy(s.id, 'repeat'));

/** How long a racer's program takes to move, in seconds: steps, jumps and waits, loops unrolled. */
function raceSeconds(sprite: SpriteProgram): number {
  const secs = (list: readonly Block[]): number =>
    list.reduce((t, b) => {
      const own = b.type === 'f_jump' ? 0.52 : WALKS.includes(b.type) ? 0.38 : b.type === 'f_wait' ? Number(b.fields.N ?? 0) : 0;
      const times = b.type === 'f_repeat' ? Math.min(500, Number(b.fields.N ?? 0)) : 1;
      return t + own + secs(b.body) * times;
    }, 0);
  return sprite.scripts.reduce((t, sc) => t + secs(sc.body), 0);
}

const racers = (ctx: StepContext): SpriteProgram[] =>
  ctx.program.sprites.filter((s) => blocksOfSprite(s).some((b) => MOVES.includes(b.type)));

/** What a racer does after its last run: the reactions at the end of its script, as a comparable string. */
function endingOf(sprite: SpriteProgram): string {
  const parts: string[] = [];
  for (const sc of sprite.scripts) {
    const ends = sc.body.map((b, i) => (b.type === 'f_repeat' || MOVES.includes(b.type) ? i : -1));
    const last = Math.max(...ends);
    if (last < 0) continue;
    for (const b of blocksInList(sc.body.slice(last + 1))) {
      if (FINISH.includes(b.type)) parts.push(`${b.type}:${b.fields.E ?? b.fields.S ?? ''}`);
    }
  }
  return parts.join('|');
}

export const laCarrera: GameDefinition = {
  id: 'la-carrera',
  level: 2,
  class: 1,
  order: 1,
  kind: 'game',
  title: 'La carrera',
  pitch: 'Armá una carrera con árbitro, saltos, estrellas y un podio. ¿Quién gana?',
  concept: 'Repetir, eventos con mensajes de color y tiempos: quien gana lo deciden los bloques de cada corredor.',
  cover: 'car',
  setup: SETUP,
  toolbox: ['f_flag'],
  phases: [
    {
      title: 'Dos corredores',
      goal: 'Dos corredores salen y corren con las vueltas.',
      steps: [
        {
          id: 'pista',
          title: 'Elegí la pista',
          text: '¡Hoy hay una carrera! Primero elegí dónde es la pista: tocá uno de los lugares.',
          hints: ['Mirá los dibujitos de abajo. Tocá el que más te guste.'],
          point: '#backdrops',
          check: (ctx) => ctx.program.backdrop !== SETUP.backdrop,
        },
        {
          id: 'corredores',
          title: 'Elegí a los corredores',
          text: 'Ahora elegí a los dos corredores. Tocá el botón con el más dos veces.',
          hints: ['Podés elegir dos iguales o dos distintos.'],
          point: '#sp-add',
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 2,
        },
        {
          id: 'correr',
          title: '¡A correr!',
          text: 'Para correr lejos usá las vueltas: el bloque con flechitas que giran. Repite lo que pongas adentro. Armalo para los dos y tocá el botón verde.',
          hints: ['Poné una flecha adentro de las vueltas y pegá todo abajo de la bandera verde.'],
          unlock: ['f_repeat', 'f_right', 'f_left'],
          demo: 'f_repeat',
          check: (ctx) => looping(ctx, 1).length >= 2 && ctx.stats.count('move') >= 6,
        },
        {
          id: 'animo',
          title: 'Se animan',
          text: 'Antes de largar, cada corredor se anima con el globito. Poné el globito antes de las vueltas.',
          hints: ['El globito va antes, para que hable y después corra.'],
          unlock: ['f_say'],
          demo: 'f_say',
          check: (ctx) => sequenceSprites(ctx, SPEECH, ['f_repeat']).length >= 2 && spritesRan(ctx, 'say') >= 2,
        },
      ],
    },
    {
      title: 'Los bloques deciden',
      goal: 'Un árbitro da la salida y los bloques deciden quién gana.',
      steps: [
        {
          id: 'arbitro',
          title: 'Un árbitro',
          text: 'Hace falta un árbitro. Sumá un tercer personaje que mande un sobre cuando empieza. Los corredores salen cuando les llega ese sobre.',
          hints: [
            'El árbitro usa la bandera verde y manda el sobre.',
            'Los corredores empiezan con el sobre que se recibe, en vez de la bandera.',
            'El sobre de los corredores tiene que ser del mismo color que el del árbitro.',
          ],
          unlock: ['f_send', 'f_recv'],
          example: [
            { sprite: 'Árbitro', scripts: [fFlag(fSay('JUGAR'), fSend('yellow'))] },
            { sprite: 'Corredor', scripts: [fRecv('yellow', fRepeat(5, fRight()))] },
          ],
          check: (ctx) =>
            spriteCount(ctx) >= SETUP.sprites.length + 3 &&
            countAny(ctx, ['f_send']) >= 1 &&
            spritesWithHat(ctx, { hat: 'f_recv', types: ['f_repeat'] }).length >= 2,
        },
        {
          id: 'ventaja',
          title: 'Uno es más rápido',
          text: 'Ahora los bloques deciden quién gana. Hacé que un corredor tarde más que el otro: dale más pasos, o ponelo a esperar con el reloj.',
          hints: [
            'Un corredor con menos pasos llega antes.',
            'El reloj hace esperar a un corredor antes de salir.',
          ],
          unlock: ['f_wait'],
          example: [
            { sprite: 'Corredor veloz', scripts: [fRecv('yellow', fRepeat(5, fRight()))] },
            { sprite: 'Corredor lento', scripts: [fRecv('yellow', fWait(3), fRepeat(5, fRight()))] },
          ],
          check: (ctx) => {
            const times = racers(ctx).map(raceSeconds);
            return times.length >= 2 && Math.max(...times) - Math.min(...times) >= 1;
          },
        },
        {
          id: 'festejo',
          title: 'Festeja o se pone triste',
          text: 'El que llega primero festeja y el otro se pone triste. Poné algo distinto al final del programa de cada corredor.',
          hints: [
            'Después de las vueltas, poné una carita o un sonido.',
            'Uno puede girar de alegría. El otro puede achicarse de tristeza.',
          ],
          unlock: ['f_face', 'f_sound', 'f_spin', 'f_grow', 'f_shrink'],
          example: [
            { sprite: 'Ganador', scripts: [fRecv('yellow', fRepeat(5, fRight()), fFace('risa'), fSpin())] },
            { sprite: 'Perdedor', scripts: [fRecv('yellow', fRepeat(5, fRight()), fFace('triste'), fShrink())] },
          ],
          check: (ctx) => {
            const ends = racers(ctx).map(endingOf).filter((e) => e);
            return ends.length >= 2 && new Set(ends).size >= 2 && (ctx.stats.ran('face') || ctx.stats.ran('sound') || ctx.stats.ran('spin') || ctx.stats.ran('size'));
          },
        },
      ],
    },
    {
      title: 'Segunda vuelta',
      goal: 'Una segunda vuelta con saltos y una hinchada.',
      steps: [
        {
          id: 'vuelta',
          title: 'La vuelta de regreso',
          text: '¡Hay segunda vuelta! Cuando terminan la ida, los dos vuelven corriendo para el otro lado, con otras vueltas.',
          hints: [
            'Cada corredor necesita otras vueltas, pegadas abajo de las primeras.',
            'Para volver, usá la flecha del otro lado.',
          ],
          example: [{ sprite: 'Corredor', scripts: [fRecv('yellow', fRepeat(5, fRight()), fRepeat(5, fLeft()))] }],
          check: (ctx) => looping(ctx, 2, 2).length >= 2 && ctx.stats.count('repeat') >= 4,
        },
        {
          id: 'saltos',
          title: 'Vallas en la pista',
          text: 'Hay vallas en la pista. Adentro de las vueltas, que los dos corredores salten.',
          hints: [
            'El salto va adentro de las vueltas, al lado de la flecha.',
            'Cada vuelta salta una vez.',
          ],
          unlock: ['f_jump'],
          example: [{ sprite: 'Corredor', scripts: [fRecv('yellow', fRepeat(5, fRight(), fJump()))] }],
          check: (ctx) =>
            ctx.program.sprites.filter((s) => blocksOfSprite(s).some((b) => b.type === 'f_repeat' && blocksInList(b.body).some((x) => x.type === 'f_jump')) && ctx.stats.ranBy(s.id, 'repeat')).length >= 2,
        },
        {
          id: 'hinchada',
          title: 'La hinchada',
          text: 'Falta la hinchada. Sumá un cuarto personaje que, cuando salen los corredores, hace tres cosas: sonido, giro, agrandar... Pero no corre.',
          hints: [
            'La hinchada también espera el sobre, como los corredores.',
            'Poné tres bloques de reacciones, no flechas.',
          ],
          example: [{ sprite: 'Hincha', scripts: [fRecv('yellow', fSound('tambor'), fSpin(), fGrow())] }],
          check: (ctx) => {
            const fans = spritesWithHat(ctx, { hat: 'f_recv', types: CHEER, min: 3, kinds: 2 });
            return spriteCount(ctx) >= SETUP.sprites.length + 4 && fans.some((s) => !blocksOfSprite(s).some((b) => MOVES.includes(b.type)));
          },
        },
      ],
    },
    {
      title: 'Estrellas y podio',
      goal: 'El ganador gana estrellas y todos pasan al podio.',
      steps: [
        {
          id: 'estrellas',
          title: 'Estrellas para el ganador',
          text: 'El ganador gana estrellas al llegar. Poné tres estrellas o más después de las vueltas.',
          hints: [
            'La estrella va abajo de las vueltas de quien llega primero.',
            'Poné tres estrellas seguidas.',
          ],
          unlock: ['f_star'],
          example: [{ sprite: 'Ganador', scripts: [fRecv('yellow', fRepeat(5, fRight()), fStar(), fStar(), fStar())] }],
          check: (ctx) => countAny(ctx, ['f_star']) >= 3 && hasSequence(ctx, ['f_repeat'], ['f_star']) && ctx.stats.maxScore >= 3,
        },
        {
          id: 'podio',
          title: 'Al podio',
          text: 'Cuando termina la carrera, el lugar cambia al podio. Usá el cartel del paisaje después de las vueltas, y elegí un lugar distinto.',
          hints: [
            'El cartel del paisaje va después de las vueltas, no antes.',
            'Tiene que ser un lugar distinto al de la pista.',
          ],
          unlock: ['f_backdrop'],
          example: [{ sprite: 'Ganador', scripts: [fRecv('yellow', fRepeat(5, fRight()), fBackdrop('teatro'))] }],
          check: (ctx) =>
            blocksOfType(ctx, 'f_backdrop').some((b) => b.fields.B !== ctx.program.backdrop) &&
            hasSequence(ctx, ['f_repeat'], ['f_backdrop']) &&
            ctx.stats.ran('backdrop'),
        },
        {
          id: 'festejan',
          title: 'Festejan en el podio',
          text: 'En el podio, todos festejan. Después del cartel del paisaje, poné tres cosas distintas: globito, cara, sonido, giro...',
          hints: [
            'Poné los bloques abajo del cartel del paisaje.',
            'Una cara, un sonido y un globito ya son tres cosas distintas.',
          ],
          example: [{ sprite: 'Ganador', scripts: [fRecv('yellow', fBackdrop('teatro'), fFace('risa'), fSound('aplauso'), fSay('GRACIAS'))] }],
          check: (ctx) => kindsAfter(ctx, ['f_backdrop']) >= 3,
        },
        {
          id: 'mostrar',
          title: '¡Mostrá tu carrera!',
          text: '¡Terminaste! Tocá el botón amarillo para ver tu carrera en pantalla grande.',
          hints: ['Buscá el botón amarillo y tocalo.'],
          point: '#btn-show',
          check: (ctx) => ctx.stats.shown,
        },
      ],
    },
  ],
  challenges: [
    {
      title: 'Una carrera con tres corredores',
      text: 'Sumá un corredor más. ¿Cómo hacés que llegue segundo? ¿Y que festeje distinto?',
    },
    {
      title: 'La carrera más rara',
      text: 'Inventá una carrera donde nadie camina igual: uno salta, otro gira, otro va despacio. ¿Quién gana?',
    },
    {
      title: 'Cuenta regresiva',
      text: 'Hacé que el árbitro diga tres cosas antes de largar, con el reloj entre cada una.',
    },
    {
      title: 'Carrera en dos pistas',
      text: 'Hacé que la carrera empiece en un lugar y termine en otro. ¿Cómo cambia la historia?',
    },
  ],
  solution: {
    program: project('ciudad', [
      sprite('arbitro', 'robi', [fFlag(fSay('JUGAR'), fSend('yellow'))], { x: 0, y: -40, name: 'Árbitro' }),
      sprite(
        'rojo',
        'toby',
        [
          fRecv(
            'yellow',
            fSay('HOLA'),
            fRepeat(5, fRight(), fJump()),
            fRepeat(3, fLeft()),
            fFace('risa'), fSound('aplauso'), fSpin(),
            fStar(), fStar(), fStar(),
            fBackdrop('teatro'),
            fFace('feliz'), fSound('magia'), fSay('GRACIAS'), fGrow(),
          ),
        ],
        { x: -200, y: -90, name: 'Corredor rojo' },
      ),
      sprite(
        'azul',
        'michi',
        [
          fRecv(
            'yellow',
            fSay('AMIGO'),
            fWait(3),
            fRepeat(4, fRight(), fJump()),
            fRepeat(3, fLeft()),
            fFace('triste'), fSound('tambor'), fShrink(),
          ),
        ],
        { x: -200, y: -130, name: 'Corredor azul' },
      ),
      sprite(
        'hincha',
        'pulpi',
        [fRecv('yellow', fSound('tambor'), fSpin(), fGrow(), fShrink(), fSound('aplauso'))],
        { x: 190, y: -60, size: 80, name: 'Hincha' },
      ),
    ]),
    play: (game) => {
      game.flag();
      game.run(45_000);
      game.machine.setShown(true);
    },
  },
};
