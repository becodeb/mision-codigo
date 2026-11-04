/** Level 2, class 1: musicians that play when tapped, a repeated chorus, and a conductor that cues them with envelopes. */
import type { BlockType } from '../../language/catalog.ts';
import type { Block, SpriteProgram } from '../../language/ir.ts';
import {
  fClick, fFace, fGrow, fJump, fNote, fRecv, fRepeat, fSend, fShrink, fSpin, fWait, project, sprite,
} from '../../language/ir.ts';
import {
  blocksInList, blocksOfSprite, distinctFields, runsOf, scriptsOfHat, spriteCount, spritesRan, spritesRanHat, spritesWithHat,
} from '../checks.ts';
import type { GameDefinition, StepContext } from '../types.ts';

// Starts on a place a band is unlikely to pick, so tapping the marked one is never the natural choice.
const SETUP = project('espacio', []);

const DANCE: BlockType[] = ['f_jump', 'f_spin', 'f_grow', 'f_shrink', 'f_face'];

/** The notes a sprite plays when tapped, in order. */
const tapNotes = (s: SpriteProgram): string[] =>
  scriptsOfHat(s, 'f_click').flatMap((sc) => blocksInList(sc.body).filter((b) => b.type === 'f_note').map((b) => String(b.fields.S)));

const notesIn = (list: readonly Block[]): string[] =>
  blocksInList(list).filter((b) => b.type === 'f_note').map((b) => String(b.fields.S));

/** Sprites with a «repetir» that holds at least `min` notes, and that the stats saw looping. */
const chorusSingers = (ctx: StepContext, min: number, distinct: number): SpriteProgram[] =>
  ctx.program.sprites.filter(
    (s) =>
      ctx.stats.ranBy(s.id, 'repeat') &&
      blocksOfSprite(s).some((b) => {
        if (b.type !== 'f_repeat' || Number(b.fields.N) < 2) return false;
        const notes = notesIn(b.body);
        return notes.length >= min && new Set(notes).size >= distinct;
      }),
  );

export const bandaParque: GameDefinition = {
  id: 'banda-parque',
  level: 2,
  class: 1,
  order: 2,
  kind: 'game',
  title: 'La banda del parque',
  pitch: 'Armá tu banda: músicos que tocan al tocarlos y un director que los hace sonar juntos.',
  concept: 'Secuencias largas, repetir un estribillo y coordinar varios personajes con mensajes de color.',
  cover: 'pulpi',
  setup: SETUP,
  toolbox: ['f_click'],
  phases: [
    {
      title: 'Un músico',
      goal: 'Tu primer músico toca una melodía cuando lo tocás.',
      steps: [
        {
          id: 'escena',
          title: 'Elegí el lugar y el músico',
          text: '¡Vamos a armar una banda! Primero tocá el lugar que más te guste en los dibujitos de abajo. Después tocá el botón con el más y elegí a tu primer músico.',
          hints: ['Los dos pasos son importantes: tocar un lugar (cualquiera) y elegir un músico.'],
          point: 'add-sprite',
          check: (ctx) => ctx.ui.backdropChosen && spriteCount(ctx) > SETUP.sprites.length,
        },
        {
          id: 'tocar',
          title: 'Una nota',
          text: 'Tu músico toca una nota cuando lo tocás. Sacá la manito y poné la nota musical abajo. Después tocá al músico en el escenario.',
          hints: ['La manito es el comienzo y la nota va pegada abajo.'],
          unlock: ['f_note'],
          demoScript: fClick(fNote('do')),
          check: (ctx) => spritesWithHat(ctx, { hat: 'f_click', types: ['f_note'] }).length >= 1 && ctx.stats.count('note') >= 1,
        },
        {
          id: 'melodia',
          title: 'Una melodía',
          text: 'Una nota sola no es una canción. Armá una melodía: cinco notas o más, con tres notas distintas por lo menos. Después tocá al músico.',
          hints: ['Tocá el dibujito de cada nota para cambiarla por otra.', 'Tres notas distintas son, por ejemplo, do, mi y sol.'],
          demoScript: fClick(fNote('do'), fNote('mi'), fNote('sol'), fNote('mi'), fNote('do')),
          check: (ctx) =>
            ctx.program.sprites.some((s) => ctx.stats.ranBy(s.id, 'note') && ctx.stats.ranHatBy(s.id, 'click') && tapNotes(s).length >= 5 && new Set(tapNotes(s)).size >= 3),
        },
        {
          id: 'baile',
          title: 'Que baile',
          text: 'Que baile mientras toca. Entre las notas, que salte, gire o se agrande. Poné dos movimientos distintos o más.',
          hints: ['El baile va mezclado con las notas, no solo al final.', 'Probá con el salto, el giro y el agrandar.'],
          unlock: ['f_jump', 'f_spin', 'f_grow', 'f_shrink', 'f_face'],
          demoScript: fClick(fNote('do'), fJump(), fNote('mi'), fSpin(), fNote('sol')),
          check: (ctx) =>
            spritesWithHat(ctx, { hat: 'f_click', types: DANCE, min: 2, kinds: 2 }).some((s) => tapNotes(s).length >= 3),
        },
      ],
    },
    {
      title: 'Tres músicos',
      goal: 'Tenés tres músicos y cada uno toca su propia melodía.',
      steps: [
        {
          id: 'banda',
          title: 'Sumá músicos',
          text: 'Un músico solo no hace una banda. Sumá dos más: tres en total.',
          hints: ['Es el mismo botón del más. Podés elegir tres distintos.'],
          point: 'add-sprite',
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 3,
        },
        {
          id: 'melodias',
          title: 'Cada uno, su melodía',
          text: 'Cada músico toca su propia melodía cuando lo tocás: cuatro notas o más, y que no suenen igual.',
          hints: [
            'Elegí a cada músico y armale su manito con notas.',
            'Cambiá las notas para que su canción sea distinta a la de los otros.',
          ],
          example: [
            { sprite: 'Músico uno', scripts: [fClick(fNote('do'), fNote('mi'), fNote('sol'), fNote('mi'))] },
            { sprite: 'Músico dos', scripts: [fClick(fNote('fa'), fNote('la'), fNote('fa'), fNote('re'))] },
            { sprite: 'Músico tres', scripts: [fClick(fNote('sol'), fNote('si'), fNote('re'), fNote('si'))] },
          ],
          check: (ctx) => {
            const players = ctx.program.sprites.filter((s) => tapNotes(s).length >= 4);
            return players.length >= 3 && new Set(players.map((s) => tapNotes(s).join('-'))).size >= 3;
          },
        },
        {
          id: 'ensayo',
          title: '¡A ensayar!',
          text: '¡A ensayar! Tocá a cada músico en el escenario para escuchar cómo suena tu banda.',
          hints: ['Tocá al músico en el escenario, no en la lista.'],
          check: (ctx) => spritesRan(ctx, 'note') >= 3,
        },
      ],
    },
    {
      title: 'Estribillo',
      goal: 'Armás el estribillo, la parte de la canción que se repite, con las vueltas.',
      steps: [
        {
          id: 'vueltas',
          title: 'La parte que se repite',
          text: 'El estribillo es la parte de la canción que se repite. Usá las vueltas, el bloque de flechitas que giran: poné dos o tres notas adentro. Después tocá al músico para oírlo.',
          hints: [
            'Las vueltas repiten todo lo que tienen adentro.',
            'Poné notas distintas adentro, así se oye un estribillo.',
          ],
          unlock: ['f_repeat'],
          example: [{ sprite: 'Músico uno', scripts: [fClick(fNote('do'), fRepeat(3, fNote('mi'), fNote('sol')))] }],
          check: (ctx) => chorusSingers(ctx, 2, 2).length >= 1,
        },
        {
          id: 'largo',
          title: 'Una canción larga',
          text: 'Ahora una canción larga: que un músico toque doce notas o más cuando lo tocás. Con las vueltas no hace falta poner doce.',
          hints: [
            'Si las vueltas repiten cuatro veces dos notas, ya son ocho.',
            'Podés poner notas antes y después de las vueltas.',
          ],
          example: [{ sprite: 'Músico uno', scripts: [fClick(fNote('do'), fRepeat(4, fNote('mi'), fNote('sol')), fNote('do'), fNote('re'), fNote('mi'))] }],
          check: (ctx) => ctx.program.sprites.some((s) => runsOf(s, ['f_note']) >= 12) && ctx.stats.count('note') >= 12,
        },
        {
          id: 'coro',
          title: 'Un coro',
          text: 'Que no cante uno solo. Hacé que al menos dos músicos usen las vueltas en su melodía. Después tocá a cada uno.',
          hints: ['Elegí a otro músico y poné las vueltas en su canción.', 'Tocá a los dos músicos en el escenario, así las vueltas suenan.'],
          example: [{ sprite: 'Músico dos', scripts: [fClick(fRepeat(2, fNote('fa'), fNote('la')))] }],
          check: (ctx) => chorusSingers(ctx, 1, 1).length >= 2,
        },
      ],
    },
    {
      title: 'El director',
      goal: 'Un director manda sobres de colores y la banda toca sola.',
      steps: [
        {
          id: 'director',
          title: 'Sumá un director',
          text: 'Hace falta un director, un cuarto personaje. Cuando lo tocás, manda un sobre de color. Después tocalo.',
          hints: [
            'Sumá al director con el botón del más.',
            'El director usa la manito y el sobre que se manda.',
          ],
          unlock: ['f_send'],
          example: [{ sprite: 'Director', scripts: [fClick(fSend('red'))] }],
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 4 && spritesWithHat(ctx, { hat: 'f_click', types: ['f_send'] }).length >= 1,
        },
        {
          id: 'sobres',
          title: 'Cada uno espera su sobre',
          text: 'Los músicos tocan cuando les llega un sobre. Dale a cada uno un color distinto. Después tocá al director.',
          hints: [
            'El sobre que se recibe empieza la melodía del músico.',
            'El color del sobre que se manda tiene que ser igual al que recibe el músico.',
          ],
          unlock: ['f_recv'],
          example: [
            { sprite: 'Director', scripts: [fClick(fSend('red'), fSend('blue'))] },
            { sprite: 'Músico uno', scripts: [fRecv('red', fNote('do'), fNote('mi'))] },
            { sprite: 'Músico dos', scripts: [fRecv('blue', fNote('fa'), fNote('la'))] },
          ],
          check: (ctx) =>
            spritesWithHat(ctx, { hat: 'f_recv', types: ['f_note'], min: 2 }).length >= 2 &&
            distinctFields(ctx, 'f_recv', 'C') >= 2 &&
            ctx.stats.ran('broadcast'),
        },
        {
          id: 'concierto',
          title: 'El gran concierto',
          text: 'El director dirige el concierto: manda un sobre, espera con el reloj, manda otro, y otro más. ¡Que suene toda la banda!',
          hints: [
            'El reloj va entre un sobre y el siguiente.',
            'Tres sobres, dos esperas. Cada músico espera el color que le toca.',
          ],
          unlock: ['f_wait'],
          example: [{ sprite: 'Director', scripts: [fClick(fSend('red'), fWait(2), fSend('blue'), fWait(2), fSend('yellow'))] }],
          check: (ctx) => {
            const conducts = ctx.program.sprites.some((s) =>
              s.scripts.some((sc) => {
                const all = blocksInList(sc.body);
                return all.filter((b) => b.type === 'f_send').length >= 3 && all.some((b) => b.type === 'f_wait');
              }),
            );
            return conducts && spritesRanHat(ctx, 'f_recv') >= 3;
          },
        },
        {
          id: 'mostrar',
          title: '¡Mostrá tu banda!',
          text: '¡Terminaste! Tocá el botón amarillo para ver tu banda en pantalla grande.',
          hints: ['Buscá el botón amarillo y tocalo.'],
          point: 'show',
          check: (ctx) => ctx.stats.shown,
        },
      ],
    },
  ],
  challenges: [
    {
      title: 'Una canción conocida',
      text: 'Inventá una canción que tu familia pueda reconocer, con las siete notas. ¿Cuál es? ¿Quién la toca?',
    },
    {
      title: 'Silencios',
      text: 'Usá el reloj para dejar silencios en la melodía. ¿Cómo cambia la canción cuando hay pausas?',
    },
    {
      title: 'Una banda que baila',
      text: 'Hacé que cada músico baile distinto mientras toca: uno salta, otro gira, otro cambia de cara.',
    },
    {
      title: 'Dos escenas',
      text: 'Hacé que el concierto empiece en un lugar y termine en otro, con «cambiar de lugar».',
    },
  ],
  solution: {
    program: project('parque', [
      sprite(
        'flauta',
        'michi',
        [
          fClick(
            fNote('do'), fNote('mi'), fNote('sol'), fJump(), fNote('la'), fNote('sol'), fSpin(), fNote('mi'),
            fRepeat(3, fNote('do'), fNote('re')),
          ),
          fRecv('red', fNote('do'), fNote('mi'), fNote('sol')),
        ],
        { x: -150, y: -110, name: 'Flauta' },
      ),
      sprite(
        'tambor',
        'toby',
        [
          fClick(fNote('fa'), fNote('fa'), fNote('la'), fGrow(), fNote('si'), fNote('la'), fRepeat(2, fNote('fa'), fNote('sol')), fShrink()),
          fRecv('blue', fNote('fa'), fNote('la'), fNote('si')),
        ],
        { x: 0, y: -110, name: 'Tambor' },
      ),
      sprite(
        'trompeta',
        'pulpi',
        [
          fClick(fNote('sol'), fNote('re'), fNote('si'), fNote('re'), fFace('feliz')),
          fRecv('yellow', fNote('sol'), fNote('si'), fNote('re')),
        ],
        { x: 150, y: -110, flip: -1, dir: -90, name: 'Trompeta' },
      ),
      sprite(
        'director',
        'robi',
        [fClick(fSend('red'), fWait(2), fSend('blue'), fWait(2), fSend('yellow'))],
        { x: 0, y: -30, size: 80, name: 'Director' },
      ),
    ]),
    play: (game) => {
      game.tap('flauta');
      game.run(9_000);
      game.tap('tambor');
      game.run(7_000);
      game.tap('trompeta');
      game.run(4_000);
      game.tap('director');
      game.run(12_000);
      game.machine.setShown(true);
    },
  },
};
