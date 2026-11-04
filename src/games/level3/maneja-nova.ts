/**
 * Level 3, class 1: fly Nova with the arrow keys and land on planets. Landing is real contact: the
 * «cuando toque a» hat is an event, not a conditional, so level 3 has it. The points hats carry the phases.
 */
import type { Block } from '../../language/ir.ts';
import {
  addScore, backdrop, changeX, changeY, face, goTo, goToRandom, hide, jump, onFlag, onKey, onPoints, onReceive, onTouching, project, repeat, sayFor,
  send, setScore, setSize, show, sound, sprite, wait, win,
} from '../../language/ir.ts';
import { PLACES, REACTIONS, appearLater, blocksInList, messageReaches, numField, refBlocks, refHas, refsOfHat, spriteCount } from '../checks.ts';
import type { GameDefinition, StepContext } from '../types.ts';

const SETUP = project('parque', [sprite('nova', 'nova', [], { x: -170, y: -100, size: 90, name: 'Nova' })]);

const SIZES = ['a_setsize', 'a_changesize'] as const;
const STEP = 20;

/** Key scripts for one key. */
const keyScripts = (ctx: StepContext, key: string) => refsOfHat(ctx, 'a_key', (h) => h.fields.K === key);

/** Whether a key script nudges along an axis in the given direction (1 or -1). */
const nudges = (ctx: StepContext, key: string, block: 'a_changex' | 'a_changey', sign: 1 | -1): boolean =>
  keyScripts(ctx, key).some((r) => refBlocks(r).some((b) => b.type === block && numField(b, 'N') * sign > 0));

const NOVA = 'nova';

/** Touch scripts that watch another sprite of the project, with the blocks that must score or cost points. */
const touchScripts = (ctx: StepContext) =>
  refsOfHat(ctx, 'a_touching', (h) => ctx.program.sprites.some((s) => s.id === h.fields.T)).filter((r) => r.sprite.id !== r.script.hat.fields.T);

/** Touch scripts that earn a point: a landing. */
const landings = (ctx: StepContext) => touchScripts(ctx).filter((r) => refBlocks(r).some((b) => b.type === 'a_addscore' && numField(b, 'N') > 0));

/** Landings after which the planet goes elsewhere: it moves itself, or the landing tells it to by message. */
const fleeing = (ctx: StepContext) =>
  landings(ctx).filter(
    (l) => (l.sprite.id !== NOVA && refHas(l, PLACES)) || messageReaches(ctx, [l], (r) => r.sprite.id !== NOVA && refHas(r, PLACES)),
  );

const loopHas = (loop: Block, types: readonly string[]): boolean => blocksInList(loop.body).some((b) => types.includes(b.type));

export const manejaNova: GameDefinition = {
  id: 'maneja-nova',
  level: 3,
  class: 1,
  order: 2,
  kind: 'game',
  title: 'Manejá a Nova',
  pitch: 'Volá por el espacio con las flechas y aterrizá en los planetas.',
  concept: 'Teclado, coordenadas y mensajes: el control de Nova sale de eventos de tecla y las fases de los puntos.',
  cover: 'nova',
  setup: SETUP,
  toolbox: ['a_key'],
  phases: [
    {
      title: 'Los controles',
      goal: 'Nova vuela por todo el escenario con el teclado.',
      steps: [
        {
          id: 'espacio',
          title: 'Elegí el espacio',
          text: 'Nova es astronauta, así que necesita un lugar para volar. Elegí el escenario del espacio: tocá el que más te guste.',
          hints: ['Mirá los dibujitos de abajo. Tocá el que más te guste, el que parezca el espacio. Podés tocar cualquiera.'],
          point: 'backdrops',
          check: (ctx) => ctx.ui.backdropChosen,
        },
        {
          id: 'derecha',
          title: 'Volar a la derecha',
          text: 'Armá el primer control: al presionar la tecla flecha derecha, Nova avanza hacia la derecha con «cambiar x en». Después apretá la flecha en el teclado.',
          hints: ['Los números positivos van a la derecha. Probá con 20.'],
          unlock: ['a_changex'],
          demoScript: onKey('ArrowRight', changeX(20)),
          check: (ctx) => nudges(ctx, 'ArrowRight', 'a_changex', 1) && ctx.stats.ranHat('key'),
        },
        {
          id: 'izquierda',
          title: 'Volar a la izquierda',
          text: 'Ahora el control de la flecha izquierda. Fijate qué número hace que Nova vaya para el otro lado.',
          hints: ['Para ir hacia la izquierda el número tiene que ser negativo, por ejemplo -20.'],
          demoScript: onKey('ArrowLeft', changeX(-20)),
          check: (ctx) => nudges(ctx, 'ArrowLeft', 'a_changex', -1) && ctx.stats.ranHat('key'),
        },
        {
          id: 'vertical',
          title: 'Arriba y abajo',
          text: 'Faltan las flechas de arriba y de abajo. Para subir y bajar se usa «cambiar y en».',
          hints: ['Subir es un número positivo y bajar es uno negativo.', 'Necesitás un programa para cada flecha.'],
          unlock: ['a_changey'],
          demoScript: [onKey('ArrowUp', changeY(20)), onKey('ArrowDown', changeY(-20))],
          check: (ctx) => nudges(ctx, 'ArrowUp', 'a_changey', 1) && nudges(ctx, 'ArrowDown', 'a_changey', -1) && ctx.stats.ranHat('key'),
        },
        {
          id: 'turbo',
          title: 'Un poder para la barra',
          text: 'La barra espaciadora todavía no hace nada. Dale un poder a Nova: un salto, un sonido, una cara... lo que quieras.',
          hints: ['En «al presionar tecla» elegí «espacio» con el menú.'],
          unlock: ['a_jump', 'a_sound', 'a_note', 'a_face'],
          demoScript: onKey(' ', jump()),
          check: (ctx) => keyScripts(ctx, ' ').some((r) => refHas(r, [...REACTIONS, ...PLACES])) && ctx.stats.ranHat('key'),
        },
      ],
    },
    {
      title: 'Aterrizar',
      goal: 'Un planeta espera: volá con Nova hasta él y tocalo para aterrizar.',
      steps: [
        {
          id: 'planeta',
          title: 'Un planeta para aterrizar',
          text: 'Hace falta un lugar donde aterrizar. Sumá un planeta con el botón del más y ponelo lejos de Nova.',
          hints: ['Cualquier objeto redondo sirve de planeta. Después arrastralo hasta el otro lado del escenario.'],
          point: 'add-sprite',
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 1,
        },
        {
          id: 'aterrizar',
          title: 'Aterrizaje con punto',
          text: 'Para aterrizar, Nova tiene que llegar volando y tocar el planeta. Cada aterrizaje tiene que sumar un punto. Después volá con las flechas hasta tocarlo.',
          hints: [
            'El planeta se da cuenta cuando Nova lo toca: «cuando toque a» y elegí a Nova.',
            'Adentro poné «sumar 1 a puntos».',
          ],
          unlock: ['a_touching', 'a_addscore'],
          example: [{ sprite: 'Planeta', scripts: [onTouching('nova', addScore(1))] }],
          check: (ctx) => landings(ctx).length > 0 && ctx.stats.ranHat('touching') && ctx.stats.maxScore >= 1,
        },
        {
          id: 'mensaje',
          title: 'Nova festeja',
          text: 'Que sea Nova quien festeje el aterrizaje: cuando el planeta es tocado por Nova, tiene que avisarle a Nova para que diga algo.',
          hints: [
            'Para que un personaje le avise a otro hay que mandar un mensaje.',
            'El planeta manda el mensaje cuando Nova lo toca, y Nova lo recibe.',
            'Cuando Nova lo reciba, que diga algo.',
          ],
          unlock: ['a_send', 'a_recv', 'a_sayfor'],
          example: [
            { sprite: 'Planeta', scripts: [onTouching('nova', addScore(1), send('m1'))] },
            { sprite: 'Nova', scripts: [onReceive('m1', sayFor('¡Aterricé!', 0.5), face('risa'))] },
          ],
          check: (ctx) =>
            landings(ctx).some((c) => messageReaches(ctx, [c], (r) => r.sprite.id !== c.sprite.id && refHas(r, REACTIONS))) && ctx.stats.ranHat('recv'),
        },
        {
          id: 'inicio',
          title: 'Cada viaje empieza igual',
          text: 'Cada viaje tiene que empezar desde cero: con la bandera verde, Nova vuelve a su base y los puntos se ponen en 0.',
          hints: [
            'Lo que pasa al empezar va debajo de la bandera verde.',
            'Para mandar a Nova a un lugar exacto está «ir a x: y:».',
          ],
          unlock: ['a_flag', 'a_goto', 'a_setscore'],
          example: [{ sprite: 'Nova', scripts: [onFlag(goTo(-170, -100), setScore(0))] }],
          check: (ctx) => {
            const flags = refsOfHat(ctx, 'a_flag');
            return (
              flags.some((r) => refHas(r, ['a_goto'])) &&
              flags.some((r) => refBlocks(r).some((b) => b.type === 'a_setscore' && numField(b, 'N') === 0)) &&
              ctx.stats.ranHat('flag')
            );
          },
        },
      ],
    },
    {
      title: 'El planeta se mueve',
      goal: 'El planeta no se queda quieto y aparece un meteorito que quita puntos.',
      steps: [
        {
          id: 'escapa',
          title: 'Un planeta que huye',
          text: 'Después de un aterrizaje el planeta tiene que irse a otro lugar, y Nova tiene que volar de nuevo. Conseguí 3 aterrizajes.',
          hints: [
            'Hay un bloque que manda a un personaje a un lugar cualquiera.',
            'Ponelo en el programa del planeta, el que se activa cuando Nova lo toca.',
          ],
          unlock: ['a_random'],
          example: [{ sprite: 'Planeta', scripts: [onTouching('nova', addScore(1), send('m1'), goToRandom())] }],
          check: (ctx) => fleeing(ctx).length > 0 && ctx.stats.maxScore >= 3,
        },
        {
          id: 'deriva',
          title: 'Un planeta inquieto',
          text: 'Ahora el planeta se mueve solo, despacio, aunque nadie lo toque. Nova tiene que seguirlo.',
          hints: [
            'Lo que pasa solo empieza con la bandera verde.',
            'Repetí muchas veces: esperar unos segundos y cambiar de lugar.',
            'Si es muy rápido, Nova no llega. Probá con una espera de 3 o 4 segundos.',
          ],
          unlock: ['a_repeat', 'a_wait', 'a_glide'],
          example: [{ sprite: 'Planeta', scripts: [onFlag(repeat(150, wait(4), goToRandom()))] }],
          check: (ctx) =>
            refsOfHat(ctx, 'a_flag').some(
              (r) =>
                fleeing(ctx).some((l) => l.sprite.id === r.sprite.id) &&
                blocksInList(r.script.body).some((b) => b.type === 'a_repeat' && numField(b, 'N') >= 5 && loopHas(b, ['a_wait']) && loopHas(b, PLACES)),
            ) && ctx.stats.ran('repeat'),
        },
        {
          id: 'meteorito',
          title: 'Cuidado con el meteorito',
          text: 'Hay un meteorito en el camino. Sumá una piedra al escenario: si Nova la toca por error, perdés un punto y la piedra se va a otro lugar. Volá hasta ella una vez para probarlo.',
          hints: [
            'Para sumar puntos el número es positivo. ¿Y para perderlos?',
            'Sumá la piedra con el botón del más y armá su programa como el del planeta, pero al revés.',
          ],
          example: [{ sprite: 'Meteorito', scripts: [onTouching('nova', addScore(-1), sound('boing'), goToRandom())] }],
          check: (ctx) =>
            spriteCount(ctx) >= SETUP.sprites.length + 2 &&
            touchScripts(ctx).some((r) => r.sprite.id !== NOVA && refBlocks(r).some((b) => b.type === 'a_addscore' && numField(b, 'N') < 0) && ctx.stats.ranHatBy(r.sprite.id, 'touching')),
        },
      ],
    },
    {
      title: 'Un mundo nuevo',
      goal: 'A los 5 puntos Nova llega a un mundo nuevo, más difícil, con un planeta hogar que gana el juego.',
      steps: [
        {
          id: 'mundo',
          title: 'Llegar a otro mundo',
          text: 'Cuando juntes 5 puntos, Nova llega a un mundo nuevo: tiene que cambiar el escenario. Jugá hasta ver el cambio.',
          hints: [
            'Hay un bloque que empieza cuando los puntos llegan a un número.',
            'Adentro poné el cambio de escenario y elegí uno distinto.',
            'Para probar más rápido podés poner un número más chico, como 3.',
          ],
          unlock: ['a_points', 'a_backdrop'],
          example: [{ sprite: 'Nova', scripts: [onPoints(5, backdrop('ciudad'))] }],
          check: (ctx) =>
            refsOfHat(ctx, 'a_points').some(
              (r) => numField(r.script.hat, 'N') >= 3 && numField(r.script.hat, 'N') <= 8 && refBlocks(r).some((b) => b.type === 'a_backdrop' && b.fields.B !== ctx.program.backdrop),
            ) &&
            ctx.stats.ranHat('points') &&
            ctx.stats.ran('backdrop'),
        },
        {
          id: 'hogar',
          title: 'El planeta hogar',
          text: 'En el mundo nuevo espera el planeta hogar, pero solo aparece cuando llegás. Sumá otro personaje que arranque escondido y se muestre al llegar a los 5 puntos.',
          hints: [
            'Un personaje escondido ni se ve ni se puede tocar.',
            'Escondelo con la bandera verde.',
            'Mostralo con el mismo bloque de puntos que cambia el escenario, o con un mensaje.',
          ],
          unlock: ['a_hide', 'a_show'],
          example: [{ sprite: 'Hogar', scripts: [onFlag(hide()), onPoints(5, show())] }],
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 3 && appearLater(ctx).length > 0,
        },
        {
          id: 'dificil',
          title: 'El nuevo mundo es difícil',
          text: 'En el mundo nuevo todo cuesta más. Que el planeta de antes cambie al llegar: más chico, o más cambiante. Avisale con un mensaje.',
          hints: [
            'Mandá el mensaje de «fase 2» desde el bloque de los 5 puntos.',
            'El planeta lo recibe y se achica, o repite más seguido el cambio de lugar.',
          ],
          unlock: ['a_setsize', 'a_changesize'],
          example: [
            { sprite: 'Nova', scripts: [onPoints(5, backdrop('ciudad'), send('p2'))] },
            { sprite: 'Planeta', scripts: [onReceive('p2', setSize(100), repeat(150, wait(3.5), goToRandom()))] },
          ],
          check: (ctx) =>
            messageReaches(
              ctx,
              refsOfHat(ctx, 'a_points'),
              (r) => refHas(r, SIZES) || blocksInList(r.script.body).some((b) => b.type === 'a_repeat' && loopHas(b, PLACES)),
            ) && ctx.stats.ranHat('recv'),
        },
        {
          id: 'ganar',
          title: 'Llegar a casa',
          text: 'Aterrizar en el planeta hogar tiene que ganar el juego. Volá hasta llegar a casa.',
          hints: [
            'Al planeta hogar se llega volando, como al otro: se da cuenta cuando Nova lo toca.',
            'Cuando Nova lo toca, tiene que pasar «ganar».',
          ],
          unlock: ['a_win'],
          example: [{ sprite: 'Hogar', scripts: [onTouching('nova', sayFor('¡Llegamos a casa!', 1), win())] }],
          check: (ctx) => touchScripts(ctx).some((r) => refHas(r, ['a_win'])) && ctx.stats.won,
        },
        {
          id: 'mostrar',
          title: '¡Mostrá tu juego!',
          text: '¡Terminaste! Tocá el botón amarillo para ver tu juego en pantalla grande y volar con Nova.',
          hints: ['Buscá el botón amarillo y tocalo.'],
          point: 'show',
          check: (ctx) => ctx.stats.shown,
        },
      ],
    },
  ],
  challenges: [
    {
      title: 'Más meteoritos',
      text: 'Sumá más piedras que quiten puntos cuando Nova las toca. ¿Cuántas podés poner sin que el juego sea imposible?',
    },
    {
      title: 'El poder secreto',
      text: 'Inventá un poder para Nova con otra tecla: que se agrande, que cambie de cara, que suene una nota. ¿Cuándo conviene usarlo?',
    },
    {
      title: 'Un viaje con tres mundos',
      text: 'Agregá otro mundo con otro escenario cuando juntes más puntos. ¿Cómo hacés que cada mundo se sienta distinto?',
    },
    {
      title: 'Cuenta de combustible',
      text: 'Hacé que Nova se canse: cada tanto dice que le falta combustible y se achica. ¿Qué pasa en el juego cuando se achica?',
    },
  ],
  solution: {
    program: project(
      'espacio',
      [
        sprite(
          'nova',
          'nova',
          [
            onFlag(goTo(-170, -100), setScore(0), face('feliz')),
            onKey('ArrowRight', changeX(STEP)),
            onKey('ArrowLeft', changeX(-STEP)),
            onKey('ArrowUp', changeY(STEP)),
            onKey('ArrowDown', changeY(-STEP)),
            onKey(' ', jump(), sound('boing')),
            onReceive('m1', sayFor('¡Aterricé!', 0.5), face('risa')),
            onPoints(5, backdrop('ciudad'), send('p2')),
          ],
          { x: -170, y: -100, size: 90, name: 'Nova' },
        ),
        sprite(
          'planeta',
          'ball',
          [
            onFlag(goTo(120, 10), repeat(150, wait(4), goToRandom())),
            onTouching('nova', addScore(1), sound('magia'), send('m1'), goToRandom()),
            onReceive('p2', setSize(100), repeat(150, wait(3.5), goToRandom())),
          ],
          { x: 120, y: 10, size: 230, name: 'Planeta' },
        ),
        sprite(
          'meteorito',
          'rock',
          [onTouching('nova', addScore(-1), sound('boing'), goToRandom()), onFlag(repeat(150, wait(3), goToRandom()))],
          { x: -60, y: -20, size: 150, name: 'Meteorito' },
        ),
        sprite('hogar', 'heart', [onFlag(hide()), onPoints(5, show()), onTouching('nova', sayFor('¡Llegamos a casa!', 1), win())], { x: -150, y: 40, size: 200, name: 'Hogar' }),
      ],
    ),
    play: (game) => {
      /** Where Nova stands relative to a sprite, and whether they touch. */
      const touching = (id: string): boolean => game.machine.touchingTarget(game.sprite('nova'), id);
      /** Flies Nova toward a sprite like a child would: hold the arrow that closes the biggest gap, look, repeat. */
      const flyTo = (id: string): void => {
        const score = game.machine.score;
        for (let i = 0; i < 200 && game.machine.score === score && !game.machine.ended && !touching(id); i++) {
          const nova = game.sprite('nova');
          const target = game.sprite(id);
          const dx = target.x - nova.x;
          const dy = target.y - nova.y;
          const key = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowUp' : 'ArrowDown';
          game.hold(key, 80);
          game.run(40);
        }
        game.run(300);
      };
      game.flag();
      game.run(200);
      // The spacebar power, then a flight into the meteorite to see what it costs.
      game.hold(' ', 100);
      flyTo('meteorito');
      game.run(300);
      for (let i = 0; i < 60 && (game.machine.score ?? 0) < 5; i++) flyTo('planeta');
      for (let i = 0; i < 20 && !game.machine.ended; i++) {
        flyTo('hogar');
        game.run(1_500);
      }
      game.machine.setShown(true);
    },
  },
};
