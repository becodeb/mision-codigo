/** Level 4, class 1: find the treasure while guards patrol. Phase 2 at 5 points is faster and deadly; 10 points win. */
import type { Block } from '../../language/ir.ts';
import {
  addScore, backdrop, bounce, forever, goTo, goToRandom, ifThen, lose, move, moveWithArrows, onFlag, onPoints, onReceive, onTouching, point, project,
  sayFor, score, send, setScore, sound, sprite, stopOthers, touching, win,
} from '../../language/ir.ts';
import type { ScriptRef } from '../checks.ts';
import { PLACES, blocksInList, chosenBackdrop, messageReaches, nestedIn, numField, patrolSprites, refBlocks, refHas, refsOfHat, spriteCount, travelled } from '../checks.ts';
import type { GameDefinition, StepContext } from '../types.ts';
import { Pilot, centerOf, touchingNow } from './autopilot.ts';

const SETUP = project('parque', [sprite('explorador', 'toby', [], { x: -190, y: -130, size: 80, name: 'Explorador' })]);
const START = { x: -190, y: -130 };
const HERO_SPEED = 5;

/** «cuando toque a …» scripts aimed at another sprite of the project. */
const touchScripts = (ctx: StepContext) =>
  refsOfHat(ctx, 'a_touching', (h) => ctx.program.sprites.some((s) => s.id === h.fields.T));

const scoresBy = (ref: { script: { body: Block[] } }, sign: 1 | -1): boolean =>
  blocksInList(ref.script.body).some((b) => b.type === 'a_addscore' && numField(b, 'N') * sign > 0);

/** Scripts that notice a touch: «cuando toque a …», or a «si ¿tocando …?» inside the script. `key` says who touches whom. */
function touchDetectors(ctx: StepContext): { ref: ScriptRef; key: string }[] {
  const out: { ref: ScriptRef; key: string }[] = [];
  for (const sprite of ctx.program.sprites) {
    for (const script of sprite.scripts) {
      const ref = { sprite, script };
      if (script.hat.type === 'a_touching' && ctx.program.sprites.some((s) => s.id === script.hat.fields.T)) out.push({ ref, key: `${sprite.id}>${String(script.hat.fields.T)}` });
      for (const b of blocksInList(script.body)) {
        if (b.type === 'a_if' && b.inputs.C?.type === 'v_touching' && b.inputs.C.fields.T !== 'EDGE') out.push({ ref, key: `${sprite.id}>${String(b.inputs.C.fields.T)}` });
      }
    }
  }
  return out;
}

/** Messages sent when the explorer finds the treasure. A penalty that reused one would also fire on every find. */
function findMessages(ctx: StepContext): Set<string> {
  const finds = touchScripts(ctx).filter((r) => scoresBy(r, 1));
  return new Set(finds.flatMap((r) => refBlocks(r).filter((b) => b.type === 'a_send').map((b) => String(b.fields.M))));
}

/**
 * Touch detectors that end up taking a point away and sending the explorer back, directly or through a message.
 * The detector must not be the one that rewards the treasure, and a message must be a different one from the treasure's,
 * with its receiving script already started. The check pairs it with the runtime stats: that detector's touch really
 * happened and the score really went down.
 */
function penalties(ctx: StepContext): { ref: ScriptRef; key: string }[] {
  const found = findMessages(ctx);
  const takes = (ref: ScriptRef): boolean => scoresBy(ref, -1) && refHas(ref, ['a_goto']);
  const lands = (ref: ScriptRef): boolean => takes(ref) && !found.has(String(ref.script.hat.fields.M)) && ctx.stats.ranHatBy(ref.sprite.id, 'recv');
  return touchDetectors(ctx).filter(({ ref }) => !scoresBy(ref, 1) && (takes(ref) || messageReaches(ctx, [ref], lands)));
}

/** The largest «mover» speed inside the «por siempre» of a script. */
const speedOf = (body: Block[]): number => Math.max(0, ...nestedIn(body, 'a_forever').filter((b) => b.type === 'a_move').map((b) => numField(b, 'N')));

export const tesoro: GameDefinition = {
  id: 'tesoro',
  level: 4,
  class: 1,
  order: 1,
  kind: 'game',
  title: 'Búsqueda del tesoro',
  pitch: 'Encontrá el tesoro sin que te atrapen los guardias.',
  concept: 'Bucle por siempre, «cuando toque», puntos y fases: «detener mis otros programas» cambia las reglas de un personaje.',
  cover: 'treasure',
  setup: SETUP,
  toolbox: ['a_flag'],
  phases: [
    {
      title: 'Llegar al tesoro',
      goal: 'El explorador se mueve con las flechas y gana un punto al tocar el tesoro.',
      steps: [
        {
          id: 'escena',
          title: 'Elegí el lugar',
          text: 'La búsqueda empieza en algún lugar. Elegí el escenario: tocá el que más te guste.',
          hints: ['Mirá los escenarios de abajo. Tocá el que más te guste. Podés tocar cualquiera.'],
          point: 'backdrops',
          check: (ctx) => ctx.ui.backdropChosen,
        },
        {
          id: 'mover',
          title: 'Que se mueva con las flechas',
          text: 'El explorador tiene que moverse con las flechas del teclado, todo el tiempo. Armá: al presionar la bandera, por siempre «mover con las flechas». Probalo.',
          hints: ['El bloque «por siempre» repite lo que tenga adentro. Poné el de las flechas adentro.'],
          unlock: ['a_forever', 'a_arrows'],
          demoScript: onFlag(forever(moveWithArrows(HERO_SPEED))),
          demoSprite: 'explorador',
          check: (ctx) =>
            refsOfHat(ctx, 'a_flag').some((r) => nestedIn(r.script.body, 'a_forever').some((b) => b.type === 'a_arrows') && ctx.stats.ranBy(r.sprite.id, 'arrows') && travelled(ctx, r.sprite.id)),
        },
        {
          id: 'tesoro',
          title: 'Sumá el tesoro',
          text: 'Sin tesoro no hay búsqueda. Sumá un personaje con el botón del más y elegí el tesoro.',
          hints: ['Buscá el cofre del tesoro entre los objetos. Después arrastralo adonde quieras.'],
          point: 'add-sprite',
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 1,
        },
        {
          id: 'tocar',
          title: 'Encontrar el tesoro',
          text: 'Cuando el explorador toque el tesoro, tiene que sumar un punto y sonar algo. Usá «cuando toque a …» en el explorador.',
          hints: ['En el menú del bloque elegí al tesoro.', 'Adentro poné «sumar 1 a puntos» y un sonido.'],
          unlock: ['a_touching', 'a_addscore', 'a_sound'],
          demoScript: onTouching('tesoro', addScore(1), sound('magia')),
          demoSprite: 'explorador',
          check: (ctx) => touchScripts(ctx).some((r) => scoresBy(r, 1) && r.script.hat.fields.T !== r.sprite.id) && ctx.stats.ranHat('touching') && ctx.stats.maxScore >= 1,
        },
        {
          id: 'cero',
          title: 'Empezar de cero',
          text: 'Cada partida tiene que empezar con cero puntos. Con la bandera verde, fijá los puntos en 0.',
          hints: ['Pegá «fijar puntos a» con el número 0 arriba del «por siempre».'],
          unlock: ['a_setscore'],
          demoScript: onFlag(setScore(0), forever(moveWithArrows(HERO_SPEED))),
          demoSprite: 'explorador',
          check: (ctx) => refsOfHat(ctx, 'a_flag').some((r) => refBlocks(r).some((b) => b.type === 'a_setscore' && numField(b, 'N') === 0)) && ctx.stats.ranHat('flag'),
        },
      ],
    },
    {
      title: 'Otro lugar',
      goal: 'Cada tesoro encontrado aparece en otro lugar, y el explorador cuenta cuántos lleva.',
      steps: [
        {
          id: 'otro-lugar',
          title: 'El tesoro se mueve',
          text: 'Un tesoro que no se mueve se encuentra una vez y listo. Cada vez que el explorador lo encuentra, el tesoro tiene que aparecer en otro lugar. Encontralo 3 veces.',
          hints: [
            'Un personaje no puede mover a otro. Tiene que avisarle.',
            'El explorador manda un mensaje cuando toca el tesoro; el tesoro lo recibe y se va a un lugar al azar.',
          ],
          unlock: ['a_send', 'a_recv', 'a_random'],
          example: [
            { sprite: 'Explorador', scripts: [onTouching('tesoro', addScore(1), sound('magia'), send('m1'))] },
            { sprite: 'Tesoro', scripts: [onReceive('m1', goToRandom())] },
          ],
          check: (ctx) =>
            messageReaches(ctx, touchScripts(ctx).filter((r) => scoresBy(r, 1)), (r) => refHas(r, PLACES)) && ctx.stats.maxScore >= 3,
        },
        {
          id: 'marcador',
          title: 'Contar los tesoros',
          text: 'El explorador tiene que decir en voz alta cuántos tesoros lleva. Hay un bloque «puntos» que se puede poner donde va un texto.',
          hints: [
            'Usá «decir … por … segundos» y poné el bloque «puntos» en el lugar del texto.',
            'Ponelo al final del programa «cuando toque a tesoro» del explorador, después de avisar al tesoro.',
          ],
          unlock: ['a_sayfor', 'v_score'],
          example: [{ sprite: 'Explorador', scripts: [onTouching('tesoro', addScore(1), send('m1'), sayFor(score(), 0.6))] }],
          check: (ctx) =>
            blocksInList(ctx.program.sprites.flatMap((s) => s.scripts.flatMap((sc) => sc.body))).some((b) => ['a_say', 'a_sayfor', 'a_thinkfor'].includes(b.type) && b.inputs.T?.type === 'v_score') &&
            ctx.stats.ran('readscore'),
        },
      ],
    },
    {
      title: 'El guardián',
      goal: 'Dos guardias patrullan y te sacan puntos si te tocan.',
      steps: [
        {
          id: 'guardian',
          title: 'Un guardián',
          text: 'Alguien cuida el tesoro. Sumá otro personaje para que sea el guardián.',
          hints: ['Un robot hace de buen guardia. Podés elegir el que quieras.'],
          point: 'add-sprite',
          check: (ctx) => spriteCount(ctx) >= SETUP.sprites.length + 2,
        },
        {
          id: 'patrulla',
          title: 'Que patrulle',
          text: 'Un guardián de verdad no se queda parado: patrulla de un lado al otro sin parar, y da la vuelta cuando llega al borde.',
          hints: [
            'Para que repita sin parar usá «por siempre».',
            'Adentro: avanzar unos pasos y rebotar si toca un borde.',
            'Si va muy rápido, bajá la cantidad de pasos. Con 3 se puede jugar.',
          ],
          unlock: ['a_move', 'a_bounce'],
          example: [{ sprite: 'Guardia', scripts: [onFlag(forever(move(3), bounce()))] }],
          check: (ctx) => patrolSprites(ctx).length >= 1,
        },
        {
          id: 'castigo',
          title: 'Si te toca, perdés un punto',
          text: 'Si el guardia toca al explorador, el explorador pierde un punto y vuelve a donde empezó. Usá un mensaje distinto al del tesoro. Probalo dejando que te toque.',
          hints: [
            'El guardia puede mirar todo el tiempo si está tocando al explorador, con «si … entonces» y «¿tocando …?» adentro de su «por siempre».',
            'Un personaje no puede mover a otro: el guardia le manda un mensaje al explorador.',
            'El explorador, al recibirlo, suma un número negativo a los puntos y vuelve al inicio con «ir a x: y:».',
            'Ojo con el mensaje: el tesoro ya usa uno (por ejemplo m1) y el menú arranca en m1. Si el guardia manda el mismo, cada tesoro te va a dar un punto y después te lo va a sacar. Elegí otro, como m2.',
          ],
          unlock: ['a_goto', 'a_if', 'v_touching'],
          example: [
            { sprite: 'Guardia', scripts: [onFlag(forever(move(3), bounce(), ifThen(touching('explorador'), send('m2'))))] },
            { sprite: 'Explorador', scripts: [onReceive('m2', addScore(-1), goTo(START.x, START.y), sound('boing'))] },
          ],
          check: (ctx) => penalties(ctx).some(({ key }) => ctx.stats.touched(...(key.split('>') as [string, string]))) && ctx.stats.scoreDrops >= 1,
        },
        {
          id: 'segundo',
          title: 'Otro guardián, otro camino',
          text: 'Un guardia solo es fácil de esquivar. Sumá un segundo que patrulle de arriba para abajo, y que también te saque un punto.',
          hints: [
            'Para que vaya hacia arriba hay que cambiar hacia dónde apunta antes de patrullar.',
            'El segundo guardia necesita revisar si toca al explorador, igual que el primero.',
          ],
          unlock: ['a_point'],
          example: [{ sprite: 'Guardia 2', scripts: [onFlag(point('0'), forever(move(3), bounce(), ifThen(touching('explorador'), send('m2'))))] }],
          check: (ctx) =>
            spriteCount(ctx) >= SETUP.sprites.length + 3 &&
            patrolSprites(ctx).length >= 2 &&
            patrolSprites(ctx).some((s) => s.scripts.some((sc) => blocksInList(sc.body).some((b) => b.type === 'a_point' && ['0', '180'].includes(String(b.fields.D))))) &&
            new Set(penalties(ctx).map((p) => p.key)).size >= 2,
        },
      ],
    },
    {
      title: 'Fase 2',
      goal: 'A los 5 puntos los guardias se enojan: son más rápidos y atrapar es perder. Con 10 puntos ganás.',
      steps: [
        {
          id: 'fase2',
          title: 'Empieza la fase 2',
          text: 'Cuando juntes 5 puntos, el juego tiene que cambiar: otro escenario y un mensaje de «fase 2» para todos. Jugá hasta que pase.',
          hints: [
            'Hay un bloque que empieza cuando los puntos llegan a un número.',
            'Adentro: cambiar el escenario y enviar «fase 2». Elegí un escenario nuevo: el parque ya viene puesto, así que ese no cuenta.',
          ],
          unlock: ['a_points', 'a_backdrop'],
          example: [{ sprite: 'Explorador', scripts: [onPoints(5, backdrop('ciudad'), send('p2'))] }],
          check: (ctx) =>
            refsOfHat(ctx, 'a_points').some(
              (r) =>
                numField(r.script.hat, 'N') >= 3 &&
                numField(r.script.hat, 'N') <= 8 &&
                refHas(r, ['a_send']) &&
                refBlocks(r).some((b) => b.type === 'a_backdrop' && chosenBackdrop(ctx, b)),
            ) && ctx.stats.ranHat('points'),
        },
        {
          id: 'veloz',
          title: 'Guardias más veloces',
          text: 'En la fase 2 los dos guardias patrullan más rápido. Cuando reciban el mensaje, cada uno tiene que dejar de hacer lo de antes y empezar un patrullaje nuevo, más veloz. Jugá hasta que llegues a la fase 2 para verlo.',
          hints: [
            'Hay un bloque que apaga los otros programas del mismo personaje.',
            'Primero apagá lo anterior; después un «por siempre» nuevo con más pasos.',
            'Si no apagás lo anterior, los dos programas van a querer mover al guardia a la vez.',
            'Es lo mismo para los dos guardias.',
          ],
          unlock: ['a_stopothers'],
          example: [{ sprite: 'Guardia', scripts: [onFlag(forever(move(3), bounce())), onReceive('p2', stopOthers(), forever(move(6), bounce()))] }],
          check: (ctx) =>
            ctx.program.sprites.filter((s) => {
              const slow = Math.max(0, ...s.scripts.filter((sc) => sc.hat.type === 'a_flag').map((sc) => speedOf(sc.body)));
              return s.scripts.some(
                (sc) =>
                  sc.hat.type === 'a_recv' &&
                  sc.body.some((b) => b.type === 'a_stopothers') &&
                  speedOf(sc.body) > slow &&
                  messageReaches(ctx, refsOfHat(ctx, 'a_points'), (r) => r.script === sc),
              ) && ctx.stats.ranHatBy(s.id, 'recv');
            }).length >= 2,
        },
        {
          id: 'mortal',
          title: 'Ahora tocar es perder',
          text: 'En la fase 2 el guardia no perdona: si toca al explorador, el juego termina y perdés. Dejate atrapar una vez para ver cómo queda.',
          hints: [
            'Hay un bloque para perder.',
            'Ponelo en el programa nuevo del guardia: «por siempre», y adentro «si está tocando al explorador, entonces perder».',
          ],
          unlock: ['a_lose'],
          example: [
            {
              sprite: 'Guardia',
              scripts: [onReceive('p2', stopOthers(), forever(move(6), bounce(), ifThen(touching('explorador'), lose())))],
            },
          ],
          check: (ctx) => refsOfHat(ctx, 'a_recv').some((r) => refHas(r, ['a_lose'])) && ctx.stats.lost,
        },
        {
          id: 'ganar',
          title: 'La meta',
          text: 'Todo tesoro merece un final. Cuando juntes 10 puntos, ganás el juego. ¡Y ganalo de verdad!',
          hints: [
            'Es otro bloque que empieza cuando los puntos llegan a un número.',
            'Adentro va el bloque de ganar.',
            'Esquivá a los guardias: en la fase 2 si te tocan perdés.',
            'Si no podés ganar, hacé más lentos a los guardias de la fase 2: bajá los pasos de su «mover» (por ejemplo de 6 a 4).',
            'También podés bajar la meta de 10 a 8, pero no a menos de 7 y siempre más que los puntos de la fase 2.',
          ],
          unlock: ['a_win'],
          example: [{ sprite: 'Explorador', scripts: [onPoints(10, sayFor('¡Encontraste el tesoro!', 1), win())] }],
          check: (ctx) => {
            const early = refsOfHat(ctx, 'a_points').filter((r) => !refHas(r, ['a_win'])).map((r) => numField(r.script.hat, 'N'));
            return (
              refsOfHat(ctx, 'a_points').some((r) => refHas(r, ['a_win']) && numField(r.script.hat, 'N') >= 7 && numField(r.script.hat, 'N') > Math.max(0, ...early)) && ctx.stats.won
            );
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
      title: 'Un guardia que te persigue',
      text: 'Hacé un guardia que, en vez de patrullar, vaya hacia donde está el explorador cada tanto. ¿Cómo lo hacés justo?',
    },
    {
      title: 'Tesoros de distinto valor',
      text: 'Sumá un segundo tesoro que valga 3 puntos pero esté en un lugar peligroso. ¿Dónde lo ponés?',
    },
    {
      title: 'Tres fases',
      text: 'Agregá una fase 3 a los 8 puntos con otro escenario y un guardia más. ¿Cómo hacés que cada fase se sienta distinta?',
    },
    {
      title: 'Zona segura',
      text: 'Inventá un lugar donde el explorador no puede ser tocado. ¿Cómo hacés para que los guardias no lo agarren ahí?',
    },
  ],
  solution: {
    program: project(
      'castillo',
      [
        sprite(
          'explorador',
          'toby',
          [
            onFlag(setScore(0), goTo(START.x, START.y), forever(moveWithArrows(HERO_SPEED))),
            onTouching('tesoro', addScore(1), sound('magia'), send('m1'), sayFor(score(), 0.6)),
            onReceive('m2', addScore(-1), goTo(START.x, START.y), sound('boing')),
            onPoints(5, backdrop('ciudad'), send('p2')),
            onPoints(10, sayFor('¡Encontraste el tesoro!', 1), win()),
          ],
          { x: START.x, y: START.y, size: 80, name: 'Explorador' },
        ),
        sprite('tesoro', 'treasure', [onReceive('m1', goToRandom())], { x: 150, y: -20, size: 130, name: 'Tesoro' }),
        sprite(
          'guardia',
          'robi',
          [
            onFlag(forever(move(3), bounce(), ifThen(touching('explorador'), send('m2')))),
            onReceive('p2', stopOthers(), forever(move(6), bounce(), ifThen(touching('explorador'), lose()))),
          ],
          { x: -200, y: -30, size: 70, name: 'Guardia' },
        ),
        sprite(
          'guardia2',
          'robi',
          [
            onFlag(point('0'), forever(move(3), bounce(), ifThen(touching('explorador'), send('m2')))),
            onReceive('p2', stopOthers(), forever(move(6), bounce(), ifThen(touching('explorador'), lose()))),
          ],
          { x: 100, y: -150, size: 70, name: 'Guardia 2' },
        ),
      ],
    ),
    play: (game) => {
      const hero = () => game.sprite('explorador');
      const treasure = () => game.sprite('tesoro');
      const careful = new Pilot(game, { hero: 'explorador', speed: HERO_SPEED / 2, hazards: ['guardia', 'guardia2'] });
      const reckless = new Pilot(game, { hero: 'explorador', speed: HERO_SPEED / 2, hazards: [] });
      const points = (): number => game.machine.score ?? 0;

      /** Walks to the treasure again and again until the score reaches `goal`. */
      const collect = (goal: number): void => {
        let overlap = 0;
        let away = 0;
        game.runUntil(() => {
          if (points() >= goal || game.machine.ended) return true;
          overlap = touchingNow(hero(), treasure()) ? overlap + 1 : 0;
          if (overlap > 12) {
            away = 40;
            overlap = 0;
          }
          const to = away > 0 ? { x: 0, y: -60 } : centerOf(treasure());
          if (away > 0) away--;
          careful.steer(to.x, to.y);
          return false;
        }, 120_000);
        careful.release();
      };
      /** Walks into a guard on purpose until `done` says it worked. */
      const bumpInto = (id: string, done: () => boolean): void => {
        game.runUntil(() => {
          const c = centerOf(game.sprite(id));
          reckless.steer(c.x, c.y);
          return done();
        }, 40_000);
        reckless.release();
        game.run(200);
      };

      // First game: feel the penalty, then reach phase 2 and let a guard catch the explorer.
      game.flag();
      game.run(200);
      const before = points();
      bumpInto('guardia', () => points() < before);
      collect(5);
      game.run(100);
      bumpInto('guardia', () => game.machine.ended !== null);
      // Second game: play to the end.
      game.flag();
      game.run(200);
      collect(10);
      game.run(1_500);
      game.machine.setShown(true);
    },
  },
};

