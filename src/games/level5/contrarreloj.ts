/**
 * Level 5, class 1: a race against a clock. A variable counts down, coins give points, a bolt adds seconds,
 * a rock takes them away, and each phase resets the clock to less time until the win screen.
 */
import type { BlockType } from '../../language/catalog.ts';
import {
  addScore, backdrop, changeVar, div, face, forever, goToRandom, hide, ifElse, ifThen, join, lose, lt, moveWithArrows, onFlag, onPoints, project,
  randomBetween, repeatUntil, sayFor, setVar, show, sound, sprite, stopOthers, touching, variable, wait, win,
  type Block, type SpriteProgram,
} from '../../language/ir.ts';
import { blocksInList, blocksOfSprite, isObject } from '../checks.ts';
import type { Game } from '../../runtime/testing.ts';
import type { GameDefinition, StepContext } from '../types.ts';
import {
  BRANCHES, COMPARES, GUARDS, LOOPS, SAYS, belowStart, comesBefore, conditionals, declared, holdingAll, holds, inside, literal, losesOnZero, lowers, movesRandomly, nameOf,
  placed, raises, readNames, scriptsOf, setAtStart, startOf, valueOf,
} from './logic.ts';
import { releaseArrows, steer, walkTo } from './play.ts';

const SETUP = project('parque', [sprite('heroe', 'toby', [], { x: 0, y: -100, size: 80, name: 'Toby' })]);

/** Names of the variables that go down inside a loop that waits: the clock. */
function countdownNames(ctx: StepContext): string[] {
  const names = placed(ctx)
    .filter(({ block }) => LOOPS.includes(block.type) && inside(block).some((x) => x.type === 'a_wait'))
    .flatMap(({ block }) => inside(block).filter(lowers).map(nameOf));
  return [...new Set(names)].filter((n) => declared(ctx).includes(n));
}

/** Scripts that start at a number of points (or a message) and give the clock less time. */
interface Handler {
  hat: BlockType;
  points: number;
  value: number;
  announces: boolean;
}

function handlers(ctx: StepContext): Handler[] {
  const clock = countdownNames(ctx);
  return scriptsOf(ctx, ['a_points', 'a_recv']).flatMap(({ script }) => {
    const sets = blocksInList(script.body).filter((b) => b.type === 'a_setvar' && clock.includes(nameOf(b)) && literal(b.inputs.V) !== undefined);
    return sets
      .filter((b) => (literal(b.inputs.V) as number) < (startOf(ctx, nameOf(b)) ?? 0))
      .map((b) => ({
        hat: script.hat.type,
        points: Number(script.hat.fields.N ?? 0),
        value: literal(b.inputs.V) as number,
        announces: holds(script.body, ['a_backdrop']) || holds(script.body, SAYS),
      }));
  });
}

/** A handler counts once the run got there: the score reached its number, or its message was heard. */
const reached = (ctx: StepContext, h: Handler): boolean => (h.hat === 'a_points' ? ctx.stats.maxScore >= h.points : ctx.stats.ranHat('recv'));

/** Variables that are not the clock, are changed by a phase handler and decide how long something waits or how fast it moves. */
function phaseVars(ctx: StepContext): string[] {
  const clock = countdownNames(ctx);
  const names = scriptsOf(ctx, ['a_points', 'a_recv']).flatMap(({ script }) =>
    blocksInList(script.body).filter((b) => b.type === 'a_setvar' || b.type === 'a_changevar').map(nameOf),
  );
  return [...new Set(names)].filter(
    (n) => declared(ctx).includes(n) && !clock.includes(n) && placed(ctx).some(({ block }) => (block.type === 'a_wait' || block.type === 'a_arrows') && readNames([block]).includes(n)),
  );
}

function objectsThat(ctx: StepContext, test: (s: SpriteProgram) => boolean): SpriteProgram[] {
  return ctx.program.sprites.filter((s) => isObject(s) && test(s));
}

/** The smallest goal that still leaves room for phases 2 and 3, which start at 5 and 10 points. */
const MIN_GOAL = 12;

/** A win behind a score of at least `MIN_GOAL`, so the game cannot end before the phases get their turn. */
const winsOnScore = (ctx: StepContext): boolean =>
  scriptsOf(ctx).some(
    ({ script }) =>
      holds(script.body, ['a_win']) &&
      ((script.hat.type === 'a_points' && Number(script.hat.fields.N) >= MIN_GOAL) ||
        blocksInList(script.body).some(
          (b) =>
            GUARDS.includes(b.type) &&
            !!b.inputs.C &&
            holds([b.inputs.C], ['v_score']) &&
            blocksInList([b.inputs.C]).some((x) => x.type === 'v_num' && Number(x.fields.V) >= MIN_GOAL - 1),
        )),
  );

export const contrarreloj: GameDefinition = {
  id: 'contrarreloj',
  level: 5,
  class: 1,
  order: 2,
  kind: 'game',
  title: 'Contrarreloj',
  pitch: 'Juntá monedas antes de que se acabe el tiempo. Los rayos regalan segundos y cada fase te da menos.',
  concept: 'Estado con variables: un reloj que baja solo, comparaciones que deciden cuándo termina, valores al azar y fases que cambian las reglas.',
  cover: 'coin',
  setup: SETUP,
  toolbox: ['a_flag', 'a_forever', 'a_arrows'],
  phases: [
    {
      title: 'El reloj',
      goal: 'Un reloj baja solo y, al llegar a cero, se pierde.',
      steps: [
        {
          id: 'mover',
          title: 'Toby se mueve',
          text: '¡Empieza Contrarreloj! Toby tiene que correr por todo el escenario. Hacé que se mueva con las flechas mientras dura el juego.',
          hints: [
            'Todo arranca con la bandera verde. Lo que va adentro de "por siempre" se repite sin parar.',
            'Poné «mover con las flechas» adentro de «por siempre». Probá con velocidad 5.',
          ],
          demoScript: onFlag(forever(moveWithArrows(5))),
          example: [{ sprite: 'Toby', scripts: [onFlag(forever(moveWithArrows(5)))] }],
          check: (ctx) =>
            holdingAll(ctx, ['a_forever'], ['a_arrows']).some(({ sprite }) => ctx.stats.ranBy(sprite.id, 'arrows')) &&
            scriptsOf(ctx, ['a_flag']).some(({ script }) => holds(script.body, ['a_arrows'])),
        },
        {
          id: 'variable',
          title: 'El reloj',
          text: 'Creá una variable para guardar los segundos que quedan. Tiene que empezar en 30 cada vez que se aprieta la bandera.',
          hints: [
            'Creá la variable con el botón de variables. Un nombre como "tiempo" ayuda a acordarse.',
            'Al principio del juego, usá «fijar … a …» para poner la variable en 30. Lo vas a ver en un cartelito en el escenario.',
          ],
          unlock: ['a_setvar', 'v_var', 'a_changevar'],
          demoScript: onFlag(setVar('tiempo', 30), forever(moveWithArrows(5))),
          example: [{ sprite: 'Toby', scripts: [onFlag(setVar('tiempo', 30), forever(moveWithArrows(5)))] }],
          check: (ctx) => setAtStart(ctx).some((s) => s.value >= 10 && s.value <= 120) && ctx.stats.ran('var'),
        },
        {
          id: 'cuenta',
          title: 'Cuenta regresiva',
          text: 'Que el reloj baje solo: un segundo después de otro, la variable pierde uno. Mirá cómo cambia el cartelito.',
          hints: [
            'Hay que repetir algo, y entre cada repetición esperar un segundo.',
            'Lo que se repite es «sumar a … el valor …», con la variable del reloj y el valor -1.',
            'Esto va en un programa aparte, que también empieza con la bandera verde. Así Toby se mueve mientras el reloj corre.',
          ],
          unlock: ['a_wait', 'a_repeatuntil', 'v_lt'],
          demoScript: onFlag(forever(wait(1), changeVar('tiempo', -1))),
          example: [{ sprite: 'Toby', scripts: [onFlag(forever(wait(1), changeVar('tiempo', -1)))] }],
          check: (ctx) => countdownNames(ctx).length > 0 && belowStart(ctx).length > 0 && ctx.stats.count('wait') >= 2,
        },
        {
          id: 'termina',
          title: 'Se acabó el tiempo',
          text: 'Cuando el reloj llega a cero, el juego se pierde. Antes, Toby avisa con un cartel que se acabó el tiempo. Probalo sin moverte.',
          hints: [
            'En vez de "por siempre", la cuenta puede repetirse "hasta que" la variable sea menor que 1.',
            'Cuando termina de repetir, seguí con el aviso y después con "perder".',
          ],
          unlock: ['a_lose', 'a_sayfor', 'v_eq', 'v_gt', 'a_waituntil'],
          example: [
            {
              sprite: 'Toby',
              scripts: [onFlag(repeatUntil(lt(variable('tiempo'), 1), wait(1), changeVar('tiempo', -1)), sayFor('¡Se acabó el tiempo!', 2), lose())],
            },
          ],
          check: (ctx) => losesOnZero(ctx) && ctx.stats.lost && ctx.stats.ran('say'),
        },
        {
          id: 'aviso',
          title: 'Poco tiempo',
          text: 'Cuando quedan menos de 6 segundos, Toby se asusta: que su cara cambie. Si el tiempo sube otra vez, vuelve a la normalidad.',
          hints: [
            'Hay que mirar el reloj todo el tiempo, no una sola vez.',
            'Una elección «si… si no» decide la cara según un número comparado con la variable.',
          ],
          unlock: ['a_ifelse', 'a_face'],
          example: [{ sprite: 'Toby', scripts: [onFlag(forever(ifElse(lt(variable('tiempo'), 6), [face('sorpresa')], [face('feliz')])))] }],
          check: (ctx) =>
            conditionals(ctx, COMPARES, ['a_face']).some(({ block }) => readNames([block.inputs.C]).length > 0) &&
            holdingAll(ctx, LOOPS, BRANCHES, ['a_face']).length > 0 &&
            ctx.machine.instances.some((i) => i.face !== 'feliz'),
        },
      ],
    },
    {
      title: 'Monedas contra el reloj',
      goal: 'Hay que juntar monedas antes de que el tiempo se acabe.',
      steps: [
        {
          id: 'moneda',
          title: 'Una moneda',
          text: 'Sumá una moneda al escenario con el botón del más. Cada vez que empieza el juego tiene que aparecer en un lugar al azar.',
          hints: ['Buscá la moneda entre los objetos.', 'Hay un bloque que manda a un personaje a cualquier lugar del escenario.'],
          point: 'add-sprite',
          unlock: ['a_random'],
          example: [{ sprite: 'Moneda', scripts: [onFlag(goToRandom())] }],
          check: (ctx) =>
            objectsThat(ctx, (s) => blocksOfSprite(s).some(movesRandomly)).some((s) => ctx.stats.ranBy(s.id, 'move')),
        },
        {
          id: 'junta',
          title: 'Juntar monedas',
          text: 'Cuando Toby toca la moneda, gana un punto, suena algo y la moneda se va a otro lugar. Juntá tres para probarlo.',
          hints: [
            'Una condición "si" puede preguntar si la moneda toca a Toby.',
            'Y todo eso tiene que mirarse una y otra vez, no una sola vez.',
            'Adentro del "si": sumar el punto, un sonido y mandar la moneda a un lugar al azar.',
          ],
          unlock: ['a_if', 'v_touching', 'a_addscore', 'a_sound'],
          example: [{ sprite: 'Moneda', scripts: [onFlag(forever(ifThen(touching('heroe'), addScore(1), sound('magia'), goToRandom())))] }],
          check: (ctx) =>
            placed(ctx).some(
              ({ block: b }) =>
                BRANCHES.includes(b.type) && !!b.inputs.C && holds([b.inputs.C], ['v_touching']) && holds(b.body, ['a_addscore']) && inside(b).some(movesRandomly),
            ) && ctx.stats.maxScore >= 3,
        },
        {
          id: 'meta',
          title: 'La meta',
          text: 'Para ganar hay que llegar a 15 puntos antes de que se acabe el tiempo. Ponele esa meta al juego y jugá hasta ganar.',
          hints: [
            'Hay un bloque que arranca solo cuando el puntaje llega a un número.',
            'Adentro va «ganar». Si querés probarlo más rápido podés bajar la meta, pero no a menos de 12: después vienen las fases 2 y 3.',
          ],
          unlock: ['a_points', 'a_win', 'v_score'],
          example: [{ sprite: 'Toby', scripts: [onPoints(15, win())] }],
          check: (ctx) => winsOnScore(ctx) && ctx.stats.won,
        },
        {
          id: 'salta',
          title: 'La moneda se escapa',
          text: 'Una moneda quieta es muy fácil. Hacé que se mueva sola a otro lugar cada tanto, aunque nadie la toque.',
          hints: [
            'Un programa aparte de la moneda, que se repite sin parar.',
            'Esperar unos segundos, saltar a un lugar al azar y volver a empezar.',
          ],
          example: [{ sprite: 'Moneda', scripts: [onFlag(forever(wait(4), goToRandom()))] }],
          // The coin has to have really jumped by itself: its looping script ran the move again after waiting.
          check: (ctx) =>
            objectsThat(ctx, () => true).some((s) =>
              s.scripts.some((sc, i) =>
                blocksInList(sc.body).some((b) => {
                  if (!LOOPS.includes(b.type)) return false;
                  const at = (test: (x: Block) => boolean) => b.body.findIndex((x) => blocksInList([x]).some(test));
                  const wait = at((x) => x.type === 'a_wait');
                  const move = at(movesRandomly);
                  if (wait < 0 || move < 0) return false;
                  // Waiting first, one jump already proves it; jumping first, it needs a second one.
                  const jumps = ctx.stats.blockRuns(s.id, i, ['a_random', 'a_goto', 'a_setx']);
                  return jumps >= (wait < move ? 1 : 2);
                }),
              ),
            ),
        },
      ],
    },
    {
      title: 'Segundos extra',
      goal: 'Hay objetos que regalan segundos y otros que los roban.',
      steps: [
        {
          id: 'bonus',
          title: 'Un bonus que aparece',
          text: 'Sumá otro objeto, el bonus. Que esté escondido y que de vez en cuando aparezca en un lugar al azar, unos segundos, y desaparezca.',
          hints: [
            'Hay que esconderlo al principio. Después se repite: esperar, ir a un lugar al azar, mostrarse, esperar y esconderse.',
            'La espera antes de aparecer puede ser un número al azar para que nadie sepa cuándo viene.',
          ],
          point: 'add-sprite',
          unlock: ['a_hide', 'a_show', 'v_random'],
          example: [
            { sprite: 'Rayo', scripts: [onFlag(hide(), forever(wait(randomBetween(4, 7)), goToRandom(), show(), wait(3), hide()))] },
          ],
          // The bonus has to have really shown up and hidden again: it showed at least once, and hid after that.
          check: (ctx) =>
            objectsThat(ctx, (s) => {
              const blocks = blocksOfSprite(s);
              const hidAtStart = s.scripts.reduce((n, sc) => n + sc.body.filter((x) => x.type === 'a_hide').length, 0);
              return (
                ['a_show', 'a_hide', 'a_wait'].every((t) => blocks.some((b) => b.type === t)) &&
                blocks.some(movesRandomly) &&
                ctx.stats.blockRuns(s.id, undefined, ['a_show']) >= 1 &&
                ctx.stats.blockRuns(s.id, undefined, ['a_hide']) > hidAtStart
              );
            }).length > 0,
        },
        {
          id: 'bonus-suma',
          title: 'Segundos de regalo',
          text: 'Si Toby toca el bonus mientras se ve, el reloj gana segundos y el bonus desaparece.',
          hints: [
            'Es otra condición "si toca", pero ahora lo que cambia es la variable del reloj.',
            'Sumarle un número positivo a la variable la hace subir.',
            'Para que desaparezca usá el bloque de esconder.',
          ],
          example: [{ sprite: 'Rayo', scripts: [onFlag(forever(ifThen(touching('heroe'), changeVar('tiempo', 3), hide())))] }],
          check: (ctx) => {
            const clock = countdownNames(ctx);
            return conditionals(ctx, ['v_touching'], raises, 'then').some(
              ({ sprite, block }) =>
                isObject(sprite) && inside(block).some((b) => raises(b) && clock.includes(nameOf(b))) && ctx.stats.ranBy(sprite.id, 'var') && ctx.stats.touched(sprite.id, 'heroe'),
            );
          },
        },
        {
          id: 'bonus-azar',
          title: 'No siempre lo mismo',
          text: 'Que el bonus no regale siempre igual: a veces 2 segundos, a veces 5, a veces algo en el medio.',
          hints: ['Hay un bloque que da un número al azar entre dos números.', 'Ese número es lo que se le suma al reloj.'],
          example: [{ sprite: 'Rayo', scripts: [onFlag(forever(ifThen(touching('heroe'), changeVar('tiempo', randomBetween(2, 5)), hide())))] }],
          check: (ctx) => {
            const clock = countdownNames(ctx);
            return placed(ctx).some(
              ({ sprite, block }) =>
                isObject(sprite) &&
                block.type === 'a_changevar' &&
                clock.includes(nameOf(block)) &&
                raises(block) &&
                holds([block], ['v_random']) &&
                ctx.stats.ranBy(sprite.id, 'var'),
            );
          },
        },
        {
          id: 'trampa',
          title: 'La roca ladrona',
          text: 'Sumá un objeto trampa. Si Toby lo toca, el reloj pierde segundos y la trampa se va a otro lugar. Probalo a propósito.',
          hints: [
            'Es el mismo "si toca" pero al revés: el reloj baja en vez de subir.',
            'Después de tocarla tiene que irse a otro lugar, o te sigue robando cada instante.',
          ],
          point: 'add-sprite',
          example: [{ sprite: 'Roca', scripts: [onFlag(goToRandom(), forever(ifThen(touching('heroe'), changeVar('tiempo', -3), sound('boing'), goToRandom())))] }],
          check: (ctx) => {
            const clock = countdownNames(ctx);
            return conditionals(ctx, ['v_touching'], lowers, 'then').some(
              ({ sprite, block }) =>
                isObject(sprite) && inside(block).some((b) => lowers(b) && clock.includes(nameOf(b))) && ctx.stats.ranBy(sprite.id, 'var') && ctx.stats.touched(sprite.id, 'heroe'),
            );
          },
        },
      ],
    },
    {
      title: 'Fases con menos tiempo',
      goal: 'Cada fase da menos tiempo y la partida termina con una pantalla de victoria.',
      steps: [
        {
          id: 'fase2',
          title: 'Fase 2',
          text: 'Al llegar a 5 puntos empieza la fase 2: el reloj se reinicia con menos tiempo que al principio y el escenario cambia para que se note.',
          hints: [
            'El bloque que arranca al llegar a cierto puntaje sirve para esto.',
            'Adentro: poner el reloj en un número menor que el de la bandera verde, y cambiar el escenario.',
            'Un cartel de un segundo avisa la fase.',
          ],
          unlock: ['a_backdrop'],
          example: [{ sprite: 'Toby', scripts: [onPoints(5, setVar('tiempo', 20), backdrop('mar'), sayFor('¡Fase 2!', 1))] }],
          check: (ctx) => handlers(ctx).some((h) => h.announces && reached(ctx, h)),
        },
        {
          id: 'fase3',
          title: 'Fase 3',
          text: 'Sumá una fase 3, con todavía menos tiempo que la fase 2. Para probarla vas a tener que llegar bien lejos.',
          hints: ['Repetí la idea de la fase 2 con otro puntaje, más alto.', 'El número del reloj tiene que ser menor que el de la fase 2.'],
          example: [{ sprite: 'Toby', scripts: [onPoints(10, setVar('tiempo', 14), backdrop('espacio'), sayFor('¡Fase 3!', 1))] }],
          check: (ctx) => new Set(handlers(ctx).filter((h) => reached(ctx, h)).map((h) => h.value)).size >= 2,
        },
        {
          id: 'dificil',
          title: 'Cada fase, más difícil',
          text: 'No solo el reloj: la moneda también se tiene que escapar más rápido en cada fase. Guardá la fase en otra variable y usala en la espera de la moneda.',
          hints: [
            'Una variable nueva que valga 1, 2 o 3 según la fase. Se cambia dentro de cada bloque de fase.',
            'La espera de la moneda puede ser una división: un número dividido por la fase da cada vez menos.',
          ],
          unlock: ['v_div'],
          example: [
            {
              sprite: 'Moneda',
              scripts: [onFlag(forever(wait(div(6, variable('fase'))), goToRandom()))],
            },
          ],
          check: (ctx) => phaseVars(ctx).some((n) => valueOf(ctx, n) >= 2),
        },
        {
          id: 'final',
          title: 'Pantalla de victoria',
          text: 'Cuando llegás a la meta: cambia el escenario y un cartel cuenta cuántos segundos te sobraron. Ojo: el reloj no puede seguir corriendo y hacerte perder en plena fiesta. Ganá una partida nueva para comprobarlo.',
          hints: [
            'Antes de ganar, cambiá el escenario y hacé un cartel con "unir" para mezclar texto y la variable del reloj.',
            'Hay un bloque que frena los otros programas del mismo personaje. Ponelo primero.',
            'Para probarlo, ganá una partida nueva con el programa terminado. Con la meta en 12 es más fácil.',
          ],
          unlock: ['a_stopothers', 'v_join'],
          example: [
            {
              sprite: 'Toby',
              scripts: [onPoints(15, stopOthers(), backdrop('castillo'), sayFor(join('¡Ganaste! Sobraron ', variable('tiempo')), 2), win())],
            },
          ],
          check: (ctx) =>
            comesBefore(ctx, (b) => b.type === 'a_backdrop', ['a_win']) &&
            comesBefore(ctx, (b) => SAYS.includes(b.type) && holds([b], ['v_join']), ['a_win']) &&
            // A win from an earlier version of the program does not count: editing the program resets the run.
            ctx.machine.ended === 'win',
        },
      ],
    },
  ],
  challenges: [
    {
      title: 'La moneda de oro',
      text: 'Inventá una moneda especial que vale cinco puntos pero se queda poquito tiempo en pantalla. ¿Cómo decidís cuándo aparece?',
    },
    {
      title: 'Un cazador',
      text: 'Sumá un personaje que persiga a Toby y le robe segundos al tocarlo. ¿Cómo hacés para que sea justo y se pueda esquivar?',
    },
    {
      title: 'Doble o nada',
      text: 'Un objeto misterioso que, al azar, duplica o parte a la mitad el tiempo que queda. ¿Te animás a tocarlo?',
    },
    {
      title: 'Tu propia curva',
      text: 'Armá cuatro fases con relojes y metas que vos elijas. Probalo con alguien y ajustalo hasta que ganar sea posible, pero difícil.',
    },
  ],
  solution: {
    program: project(
      'parque',
      [
        sprite(
          'heroe',
          'toby',
          [
            onFlag(setVar('tiempo', 30), setVar('fase', 1), forever(moveWithArrows(5))),
            onFlag(repeatUntil(lt(variable('tiempo'), 1), wait(1), changeVar('tiempo', -1)), sayFor('¡Se acabó el tiempo!', 2), lose()),
            onFlag(forever(ifElse(lt(variable('tiempo'), 6), [face('sorpresa')], [face('feliz')]))),
            onPoints(5, setVar('tiempo', 20), setVar('fase', 2), backdrop('mar'), sayFor('¡Fase 2!', 1)),
            onPoints(10, setVar('tiempo', 14), setVar('fase', 3), backdrop('espacio'), sayFor('¡Fase 3!', 1)),
            onPoints(15, stopOthers(), backdrop('castillo'), sayFor(join('¡Ganaste! Sobraron ', variable('tiempo')), 2), win()),
          ],
          { x: 0, y: -100, size: 80, name: 'Toby' },
        ),
        sprite(
          'moneda',
          'coin',
          [
            onFlag(goToRandom(), forever(ifThen(touching('heroe'), addScore(1), sound('magia'), goToRandom()))),
            onFlag(forever(wait(div(6, variable('fase'))), goToRandom())),
          ],
          { x: 120, y: -60, name: 'Moneda' },
        ),
        sprite(
          'rayo',
          'bolt',
          [
            onFlag(hide(), forever(wait(randomBetween(4, 7)), goToRandom(), show(), wait(3), hide())),
            onFlag(forever(ifThen(touching('heroe'), changeVar('tiempo', randomBetween(2, 5)), sound('bip'), hide()))),
          ],
          { x: -120, y: -60, name: 'Rayo' },
        ),
        sprite(
          'roca',
          'rock',
          [onFlag(goToRandom(), forever(ifThen(touching('heroe'), changeVar('tiempo', -3), sound('boing'), goToRandom())))],
          { x: 160, y: 40, name: 'Roca' },
        ),
      ],
      { variables: ['tiempo', 'fase'] },
    ),
    play: (g) => playContrarreloj(g),
  },
};

/* ---------- the reference player ---------- */

const HERO = 'heroe';

function playContrarreloj(g: Game): void {
  /* First try: Toby stands still and the clock runs out. */
  g.flag();
  g.run(100);
  g.runUntil(() => g.machine.ended !== null, 60_000);
  /* Second try: touch the rock once on purpose, then chase the coin and grab the bolt when it shows up. */
  g.flag();
  g.run(100);
  const rock = g.sprite('roca');
  walkTo(g, HERO, rock.x, rock.y, 5000, 5);
  g.runUntil(() => {
    if (g.machine.ended) return true;
    const bolt = g.machine.instances.find((i) => i.spriteId === 'rayo' && i.visible);
    const target = bolt ?? g.sprite('moneda');
    steer(g, HERO, target.x, target.y, 5);
    return false;
  }, 150_000);
  releaseArrows(g);
}
