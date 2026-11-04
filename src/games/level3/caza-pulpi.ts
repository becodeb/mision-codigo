/** Level 3, class 1: tap Pulpi for points. It runs away, a second target appears, and 10 points win. */
import type { Block } from '../../language/ir.ts';
import {
  addScore, backdrop, face, goToRandom, hide, move, onClick, onFlag, onPoints, onReceive, point, project, repeat, sayFor, send, setScore, setSize,
  show, sound, sprite, wait, win,
} from '../../language/ir.ts';
import { PLACES, REACTIONS, appearLater, blocksInList, chosenBackdrop, messageReaches, numField, refBlocks, refHas, refsOfHat, spriteCount } from '../checks.ts';
import type { GameDefinition, StepContext } from '../types.ts';

const SETUP = project('parque', [sprite('pulpi', 'pulpi', [], { x: 0, y: -60, size: 90, name: 'Pulpi' })]);

const SIZES = ['a_setsize', 'a_changesize'] as const;

/** Every «repetir» in a flag script, nested ones included. */
const flagLoops = (ctx: StepContext): Block[] =>
  refsOfHat(ctx, 'a_flag').flatMap((ref) => blocksInList(ref.script.body).filter((b) => b.type === 'a_repeat'));

const loopHas = (loop: Block, types: readonly string[]): boolean => blocksInList(loop.body).some((b) => types.includes(b.type));

/** Every wait length inside a repeat. */
const loopWaits = (loop: Block): number[] => blocksInList(loop.body).filter((b) => b.type === 'a_wait').map((b) => numField(b, 'N'));

/** Click scripts that score and move. */
const catchers = (ctx: StepContext) => refsOfHat(ctx, 'a_click').filter((r) => refHas(r, ['a_addscore']) && refHas(r, PLACES));

/** Points thresholds of scripts that do not win. */
const phaseHats = (ctx: StepContext) => refsOfHat(ctx, 'a_points').filter((r) => !refHas(r, ['a_win']));

const winHats = (ctx: StepContext) => refsOfHat(ctx, 'a_points').filter((r) => refHas(r, ['a_win']));

export const cazaPulpi: GameDefinition = {
  id: 'caza-pulpi',
  level: 3,
  class: 1,
  order: 1,
  kind: 'game',
  title: 'Cazá a Pulpi',
  pitch: 'Pulpi se escapa de todos. ¿Podés atraparlo diez veces?',
  concept: 'Eventos de toque, puntos, mensajes y umbrales: las fases del juego salen de «cuando los puntos lleguen a».',
  cover: 'pulpi',
  setup: SETUP,
  toolbox: ['a_click'],
  phases: [
    {
      title: 'Un toque, un punto',
      goal: 'Tocás a Pulpi, sumás un punto y se escapa a otro lugar.',
      steps: [
        {
          id: 'fondo',
          title: 'Elegí dónde es la cacería',
          text: 'Pulpi se esconde en algún lugar. Elegí el escenario de la cacería: tocá el que más te guste.',
          hints: ['Mirá los escenarios de abajo. Tocá el que más te guste. Podés tocar cualquiera.'],
          point: 'backdrops',
          check: (ctx) => ctx.ui.backdropChosen,
        },
        {
          id: 'reaccion',
          title: 'Pulpi reacciona',
          text: 'Cuando alguien toca a Pulpi, tiene que hacer algo. Armá «al hacer clic en este personaje» y pegale que diga algo. Después tocalo en el escenario.',
          hints: [
            'El bloque de clic va primero y el de decir se pega abajo.',
            'Probá otras reacciones: un sonido, una cara o un saltito.',
          ],
          unlock: ['a_sayfor', 'a_sound', 'a_face', 'a_jump'],
          demoScript: onClick(sayFor('¡Hola!', 1)),
          check: (ctx) => refsOfHat(ctx, 'a_click').some((r) => refHas(r, REACTIONS)) && ctx.stats.ranHat('click'),
        },
        {
          id: 'punto',
          title: 'Un punto por toque',
          text: 'Cada vez que atrapás a Pulpi tiene que valer un punto. Sumá «sumar 1 a puntos» abajo del clic y tocalo varias veces.',
          hints: ['El bloque de puntos va dentro del mismo programa del clic.'],
          unlock: ['a_addscore'],
          demoScript: onClick(addScore(1)),
          check: (ctx) => refsOfHat(ctx, 'a_click').some((r) => refBlocks(r).some((b) => b.type === 'a_addscore' && numField(b, 'N') > 0)) && ctx.stats.maxScore >= 1,
        },
        {
          id: 'cero',
          title: 'Empezar de cero',
          text: 'Cada partida tiene que empezar con cero puntos. Con la bandera verde, fijá los puntos en 0. Después tocá la bandera.',
          hints: ['Hay un bloque «fijar puntos a». Ponele el número 0 y pegalo debajo de la bandera verde.'],
          unlock: ['a_flag', 'a_setscore'],
          demoScript: onFlag(setScore(0)),
          check: (ctx) => refsOfHat(ctx, 'a_flag').some((r) => refBlocks(r).some((b) => b.type === 'a_setscore' && numField(b, 'N') === 0)) && ctx.stats.ranHat('flag'),
        },
        {
          id: 'escapa',
          title: 'Pulpi se escapa',
          text: 'Un cazador de verdad no la tiene fácil: cuando lo atrapás, Pulpi se escapa a otro lugar. Usá «ir a posición aleatoria».',
          hints: ['Ponelo en el mismo programa del clic, después de sumar el punto.'],
          unlock: ['a_random'],
          demoScript: onClick(addScore(1), goToRandom()),
          check: (ctx) => catchers(ctx).length > 0 && ctx.stats.ranHat('click') && ctx.stats.ran('move'),
        },
      ],
    },
    {
      title: 'Pulpi se mueve solo',
      goal: 'Pulpi ya no espera quieto: cambia de lugar por su cuenta.',
      steps: [
        {
          id: 'solo',
          title: 'No se queda quieto',
          text: 'Ahora Pulpi cambia de lugar aunque nadie lo toque. Hacé que apenas empiece el juego se mueva solo.',
          hints: [
            'Lo que pasa apenas empieza el juego va debajo de la bandera verde.',
            'Usá un bloque de movimiento, por ejemplo «ir a posición aleatoria».',
          ],
          example: [{ sprite: 'Pulpi', scripts: [onFlag(setScore(0), goToRandom())] }],
          check: (ctx) => refsOfHat(ctx, 'a_flag').some((r) => refHas(r, PLACES) && ctx.stats.ranHatBy(r.sprite.id, 'flag')),
        },
        {
          id: 'repite',
          title: 'Una y otra vez',
          text: 'Moverse una sola vez no alcanza. Que Pulpi siga cambiando de lugar mucho rato, con una pausa entre cada cambio para poder verlo.',
          hints: [
            'Todo lo que quieras repetir va adentro del bloque «repetir».',
            'Adentro poné una espera y un cambio de lugar.',
            'Un número grande de repeticiones, como 60, hace que dure bastante.',
          ],
          unlock: ['a_repeat', 'a_wait'],
          example: [{ sprite: 'Pulpi', scripts: [onFlag(setScore(0), repeat(60, wait(1), goToRandom()))] }],
          check: (ctx) =>
            flagLoops(ctx).some((loop) => numField(loop, 'N') >= 5 && loopHas(loop, ['a_wait']) && loopHas(loop, PLACES)) &&
            ctx.stats.ran('repeat') &&
            ctx.stats.ran('wait'),
        },
        {
          id: 'ritmo',
          title: 'El ritmo justo',
          text: 'Si cambia muy rápido es imposible, y si tarda mucho es aburrido. Poné una pausa distinta de 1 segundo, hasta que se pueda jugar, y atrapalo 3 veces.',
          hints: [
            'Probá con una pausa de entre medio segundo y dos segundos, pero no 1: ese número ya viene puesto.',
            'Si te cuesta mucho, alargá la pausa. Si es muy fácil, acortala.',
            'Después de cambiar el número, tocá la bandera y atrapá a Pulpi 3 veces.',
          ],
          example: [{ sprite: 'Pulpi', scripts: [onFlag(setScore(0), repeat(60, wait(0.8), goToRandom()))] }],
          check: (ctx) =>
            flagLoops(ctx).some((loop) => loopWaits(loop).some((w) => w !== 1 && w >= 0.3 && w <= 2.5)) && (ctx.machine.score ?? 0) >= 3,
        },
        {
          id: 'nada',
          title: 'Pulpi nada',
          text: 'Para ser más difícil de atrapar, Pulpi también nada: antes de cambiar de lugar, que avance un buen trecho hacia un lado y vuelva hacia el otro.',
          hints: [
            'Avanzar mucho de a poquito se hace repitiendo «mover».',
            'Para volver, cambiá hacia dónde apunta y repetí otra vez.',
          ],
          unlock: ['a_move', 'a_point'],
          example: [
            {
              sprite: 'Pulpi',
              scripts: [onFlag(setScore(0), repeat(60, repeat(25, move(3)), point('-90'), repeat(25, move(3)), point('90'), wait(0.5), goToRandom()))],
            },
          ],
          check: (ctx) =>
            flagLoops(ctx).some((loop) => loopHas(loop, ['a_move']) && loopHas(loop, ['a_point'])) && ctx.stats.ran('move') && ctx.stats.ran('repeat'),
        },
      ],
    },
    {
      title: 'Cinco puntos',
      goal: 'A los 5 puntos cambia el mundo: otro escenario, un Pulpi más difícil y otro objetivo.',
      steps: [
        {
          id: 'cinco',
          title: 'Un mundo nuevo',
          text: 'Cuando juntes 5 puntos, el juego tiene que dar un salto: cambiá el escenario. Atrapá a Pulpi hasta ver el cambio.',
          hints: [
            'Hay un bloque que empieza cuando los puntos llegan a un número.',
            'Adentro poné el cambio de escenario y elegí uno distinto al de antes. El parque ya viene puesto, así que ese no cuenta.',
            'Para probar más rápido, podés poner un número más chico.',
          ],
          unlock: ['a_points', 'a_backdrop'],
          example: [{ sprite: 'Pulpi', scripts: [onPoints(5, backdrop('espacio'))] }],
          check: (ctx) =>
            refsOfHat(ctx, 'a_points').some(
              (r) => numField(r.script.hat, 'N') >= 3 && numField(r.script.hat, 'N') <= 8 && refBlocks(r).some((b) => b.type === 'a_backdrop' && chosenBackdrop(ctx, b)),
            ) &&
            ctx.stats.ranHat('points') &&
            ctx.stats.ran('backdrop'),
        },
        {
          id: 'mensaje',
          title: 'Pulpi se achica',
          text: 'En el mundo nuevo, Pulpi tiene que ser más difícil de atrapar. Que se achique cuando empieza la fase 2. Avisale con un mensaje.',
          hints: [
            'Un mensaje es como un grito: lo manda un bloque y lo escucha otro.',
            'Mandá «fase 2» cuando los puntos lleguen a 5 y recibilo en Pulpi.',
            'Al recibir el mensaje, cambiá el tamaño de Pulpi.',
          ],
          unlock: ['a_send', 'a_recv', 'a_setsize', 'a_changesize'],
          example: [{ sprite: 'Pulpi', scripts: [onPoints(5, backdrop('espacio'), send('p2')), onReceive('p2', setSize(70))] }],
          check: (ctx) => messageReaches(ctx, refsOfHat(ctx, 'a_points'), (r) => refHas(r, SIZES)) && ctx.stats.ranHat('recv') && ctx.stats.ran('size'),
        },
        {
          id: 'segundo',
          title: 'Otro objetivo',
          text: 'Sumá otro personaje para cazar: apretá el botón con el más y elegí al otro objetivo.',
          hints: ['Podés elegir cualquiera. Después arrastralo en el escenario hasta donde quieras.'],
          point: 'add-sprite',
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 1,
        },
        {
          id: 'segundo-juega',
          title: 'También vale puntos',
          text: 'El otro objetivo tiene que jugar igual que Pulpi: al tocarlo suma un punto y se escapa a otro lugar.',
          hints: [
            'Mirá cómo armaste a Pulpi: el otro objetivo necesita algo parecido.',
            'Al hacer clic en él: sumar 1 a puntos y después ir a posición aleatoria.',
          ],
          example: [{ sprite: 'Pulpito', scripts: [onClick(addScore(1), goToRandom())] }],
          check: (ctx) => new Set(catchers(ctx).map((r) => r.sprite.id)).size >= 2 && ctx.program.sprites.filter((s) => ctx.stats.ranHatBy(s.id, 'click')).length >= 2,
        },
        {
          id: 'aparece',
          title: 'Aparece en la fase 2',
          text: 'El otro objetivo no debería estar desde el principio. Que aparezca recién cuando empieza la fase 2.',
          hints: [
            'Un personaje escondido no se ve ni se puede tocar.',
            'Escondelo con la bandera verde y mostralo cuando llegue el mensaje de la fase 2.',
          ],
          unlock: ['a_hide', 'a_show'],
          example: [{ sprite: 'Pulpito', scripts: [onFlag(hide()), onReceive('p2', show())] }],
          check: (ctx) => appearLater(ctx).length > 0,
        },
      ],
    },
    {
      title: 'Diez puntos',
      goal: 'Todo se pone más difícil hasta que llegás a 10 puntos y ganás.',
      steps: [
        {
          id: 'fase3',
          title: 'Otra vuelta de tuerca',
          text: 'Antes de la meta, una dificultad más: cuando juntes 8 puntos, mandá otro mensaje y que Pulpi cambie otra vez. Llegá a ese punto para probarlo.',
          hints: [
            'Es otro bloque de puntos, con un número más grande que el anterior.',
            'Mandá «fase 3» y hacé que Pulpi, al recibirla, se achique más o cambie de lugar más seguido.',
          ],
          example: [
            { sprite: 'Pulpi', scripts: [onPoints(8, send('p3')), onReceive('p3', setSize(55), repeat(120, wait(0.5), goToRandom()))] },
          ],
          check: (ctx) => {
            const hats = phaseHats(ctx).map((r) => numField(r.script.hat, 'N'));
            return new Set(hats).size >= 2 && ctx.stats.maxScore >= Math.max(...hats) && messageReaches(ctx, phaseHats(ctx).filter((r) => numField(r.script.hat, 'N') === Math.max(...hats)));
          },
        },
        {
          id: 'ganar',
          title: 'La meta',
          text: 'La cacería necesita una meta. Cuando juntes 10 puntos, el juego tiene que terminar con una victoria. ¡Y ganalo de verdad!',
          hints: [
            'Es otro bloque que empieza cuando los puntos llegan a un número.',
            'Adentro va el bloque de ganar.',
            'Tocá a Pulpi y al otro objetivo hasta llegar a 10.',
            'Ganar corta el juego en el momento: no pongas esperas largas antes de «ganar», o los toques siguen sumando.',
          ],
          unlock: ['a_win'],
          example: [{ sprite: 'Pulpi', scripts: [onPoints(10, win())] }],
          check: (ctx) => {
            const early = phaseHats(ctx).map((r) => numField(r.script.hat, 'N'));
            return winHats(ctx).some((r) => numField(r.script.hat, 'N') >= 7 && numField(r.script.hat, 'N') > Math.max(0, ...early)) && ctx.stats.won;
          },
        },
        {
          id: 'festejo',
          title: 'Un buen festejo',
          text: 'Ganar merece una fiesta. Antes de que termine el juego, que pasen al menos dos cosas distintas: decir algo, un sonido, una cara...',
          hints: [
            'Poné los bloques de festejo antes del bloque de ganar.',
            'Una cara y un sonido de aplausos quedan bien.',
            'Que sea algo rápido: con «decir … por 2 segundos» el juego sigue mientras tanto y los toques todavía suman puntos de más antes de ganar.',
          ],
          example: [{ sprite: 'Pulpi', scripts: [onPoints(10, face('risa'), sound('aplauso'), win())] }],
          check: (ctx) =>
            winHats(ctx).some((r) => {
              const body = r.script.body;
              const at = body.findIndex((b) => b.type === 'a_win');
              return new Set(body.slice(0, at).filter((b) => REACTIONS.includes(b.type)).map((b) => b.type)).size >= 2;
            }) && ctx.stats.won,
        },
        {
          id: 'mostrar',
          title: '¡Mostrá tu juego!',
          text: '¡Terminaste! Tocá el botón amarillo para ver tu juego en pantalla grande y jugarlo.',
          hints: ['Buscá el botón amarillo y tocalo.'],
          point: 'show',
          check: (ctx) => ctx.stats.shown,
        },
      ],
    },
  ],
  challenges: [
    {
      title: 'Un objetivo que duele',
      text: 'Inventá un personaje que, si lo tocás, te saca puntos. ¿Dónde lo ponés para que sea difícil no tocarlo?',
    },
    {
      title: 'Cada fase, su mundo',
      text: 'Hacé que cada fase tenga su propio escenario y su propio sonido. ¿Cómo se nota que el juego se puso más difícil?',
    },
    {
      title: 'Pulpi con humor',
      text: 'Hacé que Pulpi se ría, se burle o se enoje según cuántos puntos tengas. ¿Qué cara le queda mejor al final?',
    },
    {
      title: 'Una meta más lejana',
      text: 'Cambiá el juego para que haga falta llegar a 20 puntos. ¿Cuántas fases necesitás para que no se vuelva aburrido?',
    },
  ],
  solution: {
    program: project(
      'mar',
      [
        sprite(
          'pulpi',
          'pulpi',
          [
            onFlag(
              setScore(0),
              repeat(60, repeat(25, move(3)), point('-90'), repeat(25, move(3)), point('90'), wait(0.5), goToRandom()),
            ),
            onClick(addScore(1), goToRandom(), sound('magia'), sayFor('¡Me atrapaste!', 0.4)),
            onPoints(5, backdrop('espacio'), send('p2')),
            onReceive('p2', setSize(70)),
            onPoints(8, send('p3')),
            onReceive('p3', setSize(55), repeat(120, wait(0.5), goToRandom())),
            onPoints(10, face('risa'), sound('aplauso'), win()),
          ],
          { x: 0, y: -60, size: 90, name: 'Pulpi' },
        ),
        sprite(
          'pulpito',
          'pulpi',
          [onFlag(hide()), onReceive('p2', show(), repeat(120, wait(0.9), goToRandom())), onClick(addScore(1), goToRandom(), sound('boing'))],
          { x: 120, y: -100, size: 60, name: 'Pulpito' },
        ),
      ],
    ),
    play: (game) => {
      const ids = ['pulpi', 'pulpito'];
      const tapIfSeen = (id: string): void => {
        const s = game.sprite(id);
        if (s.visible) game.machine.tapAt(s.x, s.y + 20);
      };
      game.flag();
      game.run(400);
      for (let turn = 0; turn < 600 && !game.machine.ended; turn++) {
        tapIfSeen(ids[turn % ids.length]);
        game.run(160);
      }
      game.machine.setShown(true);
    },
  },
};
