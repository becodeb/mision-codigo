/** Level 4, class 1: dodge Chispa while collecting coins. A second dragon at 5 points, faster dragons at 10, a win at 15. */
import type { Block } from '../../language/ir.ts';
import {
  addScore, backdrop, bounce, face, forever, goToRandom, hide, lose, move, moveWithArrows, onFlag, onPoints, onReceive, onTouching, point, project, sayFor,
  score, send, show, sound, sprite, stopOthers, win,
} from '../../language/ir.ts';
import {
  PLACES, appearLater, blocksInList, chosenBackdrop, lethalTargets, messageReaches, nestedIn, numField, patrolSprites, refBlocks, refHas, refsOfHat, spriteCount,
} from '../checks.ts';
import type { GameDefinition, StepContext } from '../types.ts';
import { Pilot, centerOf, touchingNow } from './autopilot.ts';

const SETUP = project('parque', [
  sprite('michi', 'michi', [], { x: -180, y: -120, size: 80, name: 'Michi' }),
  sprite('chispa', 'chispa', [], { x: -200, y: -30, size: 80, name: 'Chispa' }),
]);
const HERO_SPEED = 5;

/** «cuando toque a …» scripts aimed at another sprite of the project. */
const touchScripts = (ctx: StepContext) => refsOfHat(ctx, 'a_touching', (h) => ctx.program.sprites.some((s) => s.id === h.fields.T));

/** Touch scripts that give points instead of ending the game. */
const pickups = (ctx: StepContext) =>
  touchScripts(ctx).filter((r) => refBlocks(r).some((b) => b.type === 'a_addscore' && numField(b, 'N') > 0) && !refHas(r, ['a_lose']));

const phaseHats = (ctx: StepContext) => refsOfHat(ctx, 'a_points').filter((r) => !refHas(r, ['a_win']));

/** Sprites with a message script that stops their other programs and starts a new «por siempre» that moves. */
const reprogrammed = (ctx: StepContext) =>
  ctx.program.sprites.filter((s) =>
    s.scripts.some((sc) => sc.hat.type === 'a_recv' && sc.body.some((b) => b.type === 'a_stopothers') && nestedIn(sc.body, 'a_forever').some((b: Block) => b.type === 'a_move')),
  );

export const chispa: GameDefinition = {
  id: 'chispa',
  level: 4,
  class: 1,
  order: 2,
  kind: 'game',
  title: 'Que no te atrape Chispa',
  pitch: 'Juntá monedas esquivando a los dragones. ¡Cada vez van más rápido!',
  concept: 'Bucle por siempre, rebotar, «cuando toque» y fases: los dragones cambian de reglas con mensajes y «detener mis otros programas».',
  cover: 'chispa',
  setup: SETUP,
  toolbox: ['a_flag'],
  phases: [
    {
      title: 'Chispa rebota',
      goal: 'Chispa va y viene sin parar, y si te toca perdés.',
      steps: [
        {
          id: 'escena',
          title: 'Elegí el lugar',
          text: 'Chispa vive en algún lugar. Elegí el escenario: tocá el que más te guste.',
          hints: ['Mirá los escenarios de abajo. Tocá el que más te guste. Podés tocar cualquiera.'],
          point: 'backdrops',
          check: (ctx) => ctx.ui.backdropChosen,
        },
        {
          id: 'heroe',
          title: 'Mové a Michi',
          text: 'Michi tiene que moverse con las flechas, todo el tiempo. Armá: al presionar la bandera, por siempre «mover con las flechas». Probalo.',
          hints: ['El bloque «por siempre» repite lo que tenga adentro. Poné el de las flechas adentro.'],
          unlock: ['a_forever', 'a_arrows'],
          demo: 'a_arrows',
          check: (ctx) =>
            refsOfHat(ctx, 'a_flag').some((r) => nestedIn(r.script.body, 'a_forever').some((b) => b.type === 'a_arrows')) && ctx.stats.ran('arrows'),
        },
        {
          id: 'rebota',
          title: 'Chispa va y viene',
          text: 'Que Chispa patrulle: avanza sin parar y da la vuelta cuando llega al borde. Armalo en Chispa, no en Michi.',
          hints: [
            'Chispa también necesita su «por siempre» abajo de la bandera verde.',
            'Adentro: avanzar unos pasos y rebotar si toca un borde.',
          ],
          unlock: ['a_move', 'a_bounce'],
          demo: 'a_bounce',
          check: (ctx) => patrolSprites(ctx).length >= 1,
        },
        {
          id: 'pierde',
          title: 'Si te toca, perdés',
          text: 'Si Chispa toca a Michi, el juego termina y perdés. Armalo en Michi con «cuando toque a …» y dejate atrapar para probarlo.',
          hints: ['En el menú del bloque elegí a Chispa. Adentro va «¡perder!».', 'Antes de perder podés poner una cara triste o un sonido.'],
          unlock: ['a_touching', 'a_lose', 'a_face', 'a_sound'],
          demo: 'a_touching',
          check: (ctx) => lethalTargets(ctx).size >= 1 && ctx.stats.ranHat('touching') && ctx.stats.lost,
        },
      ],
    },
    {
      title: 'Monedas',
      goal: 'Michi junta monedas mientras esquiva a Chispa.',
      steps: [
        {
          id: 'moneda',
          title: 'Sumá una moneda',
          text: 'Hace falta algo para juntar. Sumá un personaje con el botón del más y elegí una moneda.',
          hints: ['Buscá la moneda entre los objetos. Después arrastrala adonde quieras.'],
          point: 'add-sprite',
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 1,
        },
        {
          id: 'recoger',
          title: 'Juntar la moneda',
          text: 'Cuando Michi toque la moneda, tiene que sumar un punto y sonar algo. Pero la moneda no te hace perder.',
          hints: ['Es otro «cuando toque a …» en Michi, ahora con la moneda.', 'Adentro: sumar 1 a puntos y un sonido.'],
          unlock: ['a_addscore'],
          example: [{ sprite: 'Michi', scripts: [onTouching('moneda', addScore(1), sound('magia'))] }],
          check: (ctx) => pickups(ctx).length >= 1 && ctx.stats.maxScore >= 1,
        },
        {
          id: 'reaparece',
          title: 'La moneda se mueve',
          text: 'Una moneda que no se mueve se junta una vez y listo. Cada vez que Michi la junta, tiene que aparecer en otro lugar. Juntá 3 monedas.',
          hints: [
            'Un personaje no puede mover a otro. Tiene que avisarle.',
            'Michi manda un mensaje al juntar la moneda; la moneda lo recibe y se va a un lugar al azar.',
          ],
          unlock: ['a_send', 'a_recv', 'a_random'],
          example: [
            { sprite: 'Michi', scripts: [onTouching('moneda', addScore(1), send('m1'))] },
            { sprite: 'Moneda', scripts: [onReceive('m1', goToRandom())] },
          ],
          check: (ctx) => messageReaches(ctx, pickups(ctx), (r) => refHas(r, PLACES)) && ctx.stats.maxScore >= 3,
        },
        {
          id: 'marcador',
          title: 'Contar las monedas',
          text: 'Michi tiene que decir en voz alta cuántas monedas lleva. Hay un bloque «puntos» que se puede poner donde va un texto.',
          hints: [
            'Usá «decir … por … segundos» y poné el bloque «puntos» en el lugar del texto.',
            'Ponelo al final del programa «cuando toque a moneda» de Michi, después del mensaje.',
          ],
          unlock: ['a_sayfor', 'v_score'],
          example: [{ sprite: 'Michi', scripts: [onTouching('moneda', addScore(1), send('m1'), sayFor(score(), 0.5))] }],
          check: (ctx) =>
            blocksInList(ctx.program.sprites.flatMap((s) => s.scripts.flatMap((sc) => sc.body))).some(
              (b) => ['a_say', 'a_sayfor', 'a_thinkfor'].includes(b.type) && b.inputs.T?.type === 'v_score',
            ) && ctx.stats.ran('readscore'),
        },
      ],
    },
    {
      title: 'Un segundo dragón',
      goal: 'A los 5 puntos aparece un segundo dragón que patrulla de arriba para abajo.',
      steps: [
        {
          id: 'cinco',
          title: 'Aviso a los 5 puntos',
          text: 'Cuando juntes 5 monedas, el juego tiene que avisarle a todos que empieza la fase 2. Jugá hasta que pase.',
          hints: [
            'Hay un bloque que empieza cuando los puntos llegan a un número.',
            'Adentro mandá el mensaje de «fase 2».',
          ],
          unlock: ['a_points'],
          example: [{ sprite: 'Michi', scripts: [onPoints(5, send('p2'))] }],
          check: (ctx) =>
            phaseHats(ctx).some((r) => numField(r.script.hat, 'N') >= 3 && numField(r.script.hat, 'N') <= 8 && refHas(r, ['a_send'])) && ctx.stats.ranHat('points'),
        },
        {
          id: 'segundo',
          title: 'Sumá otro dragón',
          text: 'Sumá un segundo dragón con el botón del más. Elegí a Chispa otra vez, o a quien quieras.',
          hints: ['Después de sumarlo, achicalo un poco para distinguirlo del primero.'],
          point: 'add-sprite',
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 2,
        },
        {
          id: 'aparece',
          title: 'Aparece en la fase 2',
          text: 'El segundo dragón no debería estar desde el principio. Que aparezca recién cuando empieza la fase 2.',
          hints: [
            'Un personaje escondido no se ve y no puede tocar a nadie.',
            'Escondelo con la bandera verde y mostralo cuando llegue el mensaje de la fase 2.',
          ],
          unlock: ['a_hide', 'a_show'],
          example: [{ sprite: 'Dragón 2', scripts: [onFlag(hide()), onReceive('p2', show())] }],
          check: (ctx) => appearLater(ctx).length > 0,
        },
        {
          id: 'vertical',
          title: 'Un dragón que sube y baja',
          text: 'Dos dragones iguales aburren. Que el segundo patrulle de arriba para abajo, y no de un lado al otro.',
          hints: [
            'Para que vaya hacia arriba hay que cambiar hacia dónde apunta, antes de empezar a patrullar.',
            'Después va lo mismo de siempre: «por siempre», avanzar y rebotar.',
          ],
          unlock: ['a_point'],
          example: [{ sprite: 'Dragón 2', scripts: [onReceive('p2', show(), point('0'), forever(move(3), bounce()))] }],
          check: (ctx) =>
            patrolSprites(ctx).length >= 2 &&
            patrolSprites(ctx).some((s) => s.scripts.some((sc) => blocksInList(sc.body).some((b) => b.type === 'a_point' && ['0', '180'].includes(String(b.fields.D))))),
        },
        {
          id: 'pierde2',
          title: 'Los dos hacen perder',
          text: 'El segundo dragón también tiene que hacer perder si toca a Michi. Fijate qué hiciste con el primero.',
          hints: ['Michi necesita otro «cuando toque a …», ahora con el segundo dragón.'],
          example: [{ sprite: 'Michi', scripts: [onTouching('chispita', face('triste'), lose())] }],
          check: (ctx) => lethalTargets(ctx).size >= 2,
        },
      ],
    },
    {
      title: 'Más rápido',
      goal: 'A los 10 puntos todo se acelera y cambia el escenario. Con 15 monedas ganás.',
      steps: [
        {
          id: 'diez',
          title: 'Empieza la fase 3',
          text: 'Cuando juntes 10 monedas, el juego da otro salto: cambia el escenario y se manda el mensaje de «fase 3». Jugá hasta ver el cambio.',
          hints: [
            'Es otro bloque de puntos, con un número más grande que el anterior.',
            'Adentro: cambiar el escenario, y enviar «fase 3». Elegí un escenario nuevo: el parque ya viene puesto, así que ese no cuenta.',
          ],
          unlock: ['a_backdrop'],
          example: [{ sprite: 'Michi', scripts: [onPoints(10, backdrop('ciudad'), send('p3'))] }],
          check: (ctx) =>
            phaseHats(ctx).some(
              (r) =>
                numField(r.script.hat, 'N') >= 8 &&
                numField(r.script.hat, 'N') <= 14 &&
                refHas(r, ['a_send']) &&
                refBlocks(r).some((b) => b.type === 'a_backdrop' && chosenBackdrop(ctx, b)) &&
                ctx.stats.maxScore >= numField(r.script.hat, 'N'),
            ),
        },
        {
          id: 'rapido',
          title: 'Dragones más veloces',
          text: 'En la fase 3 los dos dragones van más rápido. Cuando reciban el mensaje tienen que dejar de hacer lo de antes y empezar un patrullaje nuevo, más veloz. Jugá hasta la fase 3 para verlo.',
          hints: [
            'Hay un bloque que apaga los otros programas del mismo personaje.',
            'Primero apagá lo anterior; después un «por siempre» nuevo con más pasos.',
            'Es lo mismo para los dos dragones.',
            'Para verlo funcionar tenés que juntar monedas hasta llegar a la fase 3. Si te cuesta, esquivá a los dragones con calma.',
          ],
          unlock: ['a_stopothers'],
          example: [{ sprite: 'Chispa', scripts: [onFlag(forever(move(3), bounce())), onReceive('p3', stopOthers(), forever(move(5), bounce()))] }],
          check: (ctx) => reprogrammed(ctx).length >= 2 && ctx.stats.ranHat('recv') && ctx.stats.ran('stopothers'),
        },
        {
          id: 'ganar',
          title: 'La meta',
          text: 'Con 15 monedas, Michi ganó. Armá la victoria. Y ganala de verdad: si te cuesta, hacé más lentos a los dragones o poné una meta un poco más chica.',
          hints: [
            'Es otro bloque que empieza cuando los puntos llegan a un número.',
            'Adentro va el bloque de ganar. Antes podés poner un festejo.',
            'La meta tiene que ser más grande que los puntos de la fase 3 (más de 10). Podés bajarla de 15 a 12, pero no menos.',
            'Para hacer más lentos a los dragones, bajá los pasos de su «mover» en la fase 3: por ejemplo de 5 a 4.',
          ],
          unlock: ['a_win'],
          example: [{ sprite: 'Michi', scripts: [onPoints(15, sayFor('¡Ganaste!', 1), win())] }],
          check: (ctx) => {
            const early = phaseHats(ctx).map((r) => numField(r.script.hat, 'N'));
            return refsOfHat(ctx, 'a_points').some((r) => refHas(r, ['a_win']) && numField(r.script.hat, 'N') >= 8 && numField(r.script.hat, 'N') > Math.max(0, ...early)) && ctx.stats.won;
          },
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
      title: 'Un dragón que sorprende',
      text: 'Hacé que un dragón aparezca de golpe en un lugar al azar cada tanto. ¿Cómo hacés para que sea justo?',
    },
    {
      title: 'Monedas de oro',
      text: 'Sumá una moneda especial que valga 3 puntos pero esté en un lugar peligroso. ¿Dónde la ponés?',
    },
    {
      title: 'Un escudo',
      text: 'Inventá algo que proteja a Michi unos segundos: que una tecla lo haga invencible un ratito. ¿Qué cambia en tu juego?',
    },
    {
      title: 'Tu propia fase',
      text: 'Agregá una fase 4 con otro escenario, otro sonido y otra regla nueva. ¿Qué hace que se sienta distinta?',
    },
  ],
  solution: {
    program: project(
      'castillo',
      [
        sprite(
          'michi',
          'michi',
          [
            onFlag(forever(moveWithArrows(HERO_SPEED))),
            onTouching('chispa', face('triste'), sound('boing'), lose()),
            onTouching('chispita', face('triste'), sound('boing'), lose()),
            onTouching('moneda', addScore(1), sound('magia'), send('m1'), sayFor(score(), 0.5)),
            onPoints(5, send('p2')),
            onPoints(10, backdrop('ciudad'), send('p3')),
            onPoints(15, sayFor('¡Ganaste!', 1), win()),
          ],
          { x: -180, y: -120, size: 80, name: 'Michi' },
        ),
        sprite(
          'chispa',
          'chispa',
          [onFlag(forever(move(3), bounce())), onReceive('p3', stopOthers(), forever(move(5), bounce()))],
          { x: -200, y: -30, size: 80, name: 'Chispa' },
        ),
        sprite('moneda', 'coin', [onReceive('m1', goToRandom())], { x: 120, y: 30, size: 130, name: 'Moneda' }),
        sprite(
          'chispita',
          'chispa',
          [
            onFlag(hide(), point('0')),
            onReceive('p2', show(), forever(move(3), bounce())),
            onReceive('p3', stopOthers(), forever(move(5), bounce())),
          ],
          { x: 100, y: -150, size: 60, name: 'Chispita' },
        ),
      ],
    ),
    play: (game) => {
      const hero = () => game.sprite('michi');
      const coin = () => game.sprite('moneda');
      const careful = new Pilot(game, { hero: 'michi', speed: HERO_SPEED / 2, hazards: ['chispa', 'chispita'] });
      const reckless = new Pilot(game, { hero: 'michi', speed: HERO_SPEED / 2, hazards: [] });
      const points = (): number => game.machine.score ?? 0;

      const collect = (goal: number): void => {
        let overlap = 0;
        let away = 0;
        game.runUntil(() => {
          if (points() >= goal || game.machine.ended) return true;
          overlap = touchingNow(hero(), coin()) ? overlap + 1 : 0;
          if (overlap > 12) {
            away = 40;
            overlap = 0;
          }
          const to = away > 0 ? { x: 0, y: -60 } : centerOf(coin());
          if (away > 0) away--;
          careful.steer(to.x, to.y);
          return false;
        }, 240_000);
        careful.release();
      };

      // First game: let Chispa catch Michi.
      game.flag();
      game.run(200);
      game.runUntil(() => {
        const c = centerOf(game.sprite('chispa'));
        reckless.steer(c.x, c.y);
        return game.machine.ended !== null;
      }, 60_000);
      reckless.release();
      game.run(200);
      // Second game: collect 15 coins and win.
      game.flag();
      game.run(200);
      collect(15);
      game.run(1_500);
      game.machine.setShown(true);
    },
  },
};
