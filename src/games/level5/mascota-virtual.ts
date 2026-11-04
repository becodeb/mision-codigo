/**
 * Level 5, class 1: a virtual pet whose hunger and energy fall on their own. The child feeds it, puts it to
 * sleep, makes its face follow its state, decides when it grows, wins or gets sick, and adds a mini-game.
 */
import type { BlockType } from '../../language/catalog.ts';
import {
  add, and, backdrop, changeSize, changeVar, div, eq, face, forever, goToRandom, gt, hide, ifElse, ifThen, join, lose, lt, onClick, onFlag, onReceive, or,
  project, repeat, sayFor, send, setVar, show, sound, sprite, stopOthers, variable, wait, waitUntil, win,
  type Block,
} from '../../language/ir.ts';
import { blocksInList, isObject } from '../checks.ts';
import type { Game } from '../../runtime/testing.ts';
import type { GameDefinition, StepContext } from '../types.ts';
import {
  BRANCHES, COMPARES, GUARDS, LOOPS, SAYS, belowStart, comesBefore, conditionals, declared, holdingAll, holds, inside, literal, losesOnZero, lowers,
  movesRandomly, nameOf, placed, raises, readNames, scriptsOf, setAtStart, startOf, valueOf,
} from './logic.ts';
import { varNow } from './play.ts';

const SETUP = project('parque', [sprite('mascota', 'michi', [], { x: 0, y: -100, name: 'Michi' })]);

const distinct = (list: readonly string[]): number => new Set(list).size;

/** Names of the variables that go down inside a loop that waits: hunger, energy... */
function drains(ctx: StepContext): string[] {
  const names = placed(ctx)
    .filter(({ block }) => LOOPS.includes(block.type) && inside(block).some((x) => x.type === 'a_wait'))
    .flatMap(({ block }) => inside(block).filter(lowers).map(nameOf));
  return [...new Set(names)].filter((n) => declared(ctx).includes(n));
}

/** Variables that go down inside a loop that waits, but only behind a comparison that reads that same variable: «si comida > 0, restar uno». */
function guardedDrains(ctx: StepContext): string[] {
  return placed(ctx)
    .filter(({ block }) => LOOPS.includes(block.type) && inside(block).some((x) => x.type === 'a_wait'))
    .flatMap(({ block }) =>
      inside(block)
        .filter((b) => BRANCHES.includes(b.type) && !!b.inputs.C && holds([b.inputs.C], COMPARES))
        .flatMap((b) =>
          inside(b)
            .filter(lowers)
            .map(nameOf)
            .filter((n) => readNames([b.inputs.C as Block]).includes(n)),
        ),
    );
}

/** Click scripts of object sprites that raise a variable that drains by itself. */
function feeders(ctx: StepContext) {
  const down = drains(ctx);
  return scriptsOf(ctx, ['a_click'])
    .filter(({ sprite }) => isObject(sprite))
    .map((p) => ({ ...p, names: [...new Set(blocksInList(p.script.body).filter(raises).map(nameOf))].filter((n) => down.includes(n)) }))
    .filter((p) => p.names.length > 0 && ctx.stats.ranHatBy(p.sprite.id, 'click'));
}

/** Variables that are capped after being raised: «si pasa de 10, poner en 10». */
function cappedNames(ctx: StepContext): { name: string; limit: number }[] {
  return feeders(ctx).flatMap(({ script, names }) =>
    blocksInList(script.body)
      .filter((b) => BRANCHES.includes(b.type) && !!b.inputs.C && holds([b.inputs.C], COMPARES))
      .flatMap((b) =>
        inside(b)
          .filter((x) => x.type === 'a_setvar' && names.includes(nameOf(x)) && literal(x.inputs.V) !== undefined && readNames([b.inputs.C]).includes(nameOf(x)))
          .map((x) => ({ name: nameOf(x), limit: literal(x.inputs.V) as number })),
      ),
  );
}

/** The second care action: a click script on another object that raises another draining variable and takes time. */
function sleepers(ctx: StepContext) {
  const fed = feeders(ctx);
  const down = drains(ctx);
  return scriptsOf(ctx, ['a_click'])
    .filter(({ sprite, script }) => isObject(sprite) && holds(script.body, ['a_wait']) && ctx.stats.ranHatBy(sprite.id, 'click'))
    .filter(({ sprite, script }) => {
      const raised = blocksInList(script.body).filter(raises).map(nameOf).filter((n) => down.includes(n));
      return fed.some((f) => f.sprite.id !== sprite.id && raised.some((n) => !f.names.includes(n)));
    });
}

/** Variables set to two different plain numbers, that a click script reads before raising something. */
function stateVars(ctx: StepContext): string[] {
  const values = new Map<string, Set<number>>();
  for (const { block } of placed(ctx)) {
    const n = block.type === 'a_setvar' ? literal(block.inputs.V) : undefined;
    if (n !== undefined) values.set(nameOf(block), (values.get(nameOf(block)) ?? new Set()).add(n));
  }
  const guards = scriptsOf(ctx, ['a_click']).flatMap(({ script }) =>
    blocksInList(script.body)
      .filter((b) => BRANCHES.includes(b.type) && !!b.inputs.C && inside(b).some(raises))
      .flatMap((b) => readNames([b.inputs.C])),
  );
  return [...values].filter(([n, v]) => v.size >= 2 && declared(ctx).includes(n) && guards.includes(n)).map(([n]) => n);
}

const facesIn = (list: readonly Block[]): string[] =>
  blocksInList(list).filter((b) => b.type === 'a_face').map((b) => String(b.fields.E));

/** Variables computed from two or more others, inside a loop, that a face choice then reads. */
function moodVars(ctx: StepContext): string[] {
  const looped = holdingAll(ctx, LOOPS, ['a_setvar']).flatMap(({ block }) =>
    inside(block).filter((b) => b.type === 'a_setvar' && !!b.inputs.V && distinct(readNames([b.inputs.V])) >= 2).map(nameOf),
  );
  const faceChoices = conditionals(ctx, COMPARES, ['a_face']);
  return [...new Set(looped)].filter((n) => faceChoices.some(({ block }) => readNames([block.inputs.C as never]).includes(n)));
}

/** A win behind a comparison with a variable. */
const winsOnState = (ctx: StepContext): boolean =>
  scriptsOf(ctx).some(
    ({ script }) =>
      holds(script.body, ['a_win']) &&
      blocksInList(script.body).some((b) => GUARDS.includes(b.type) && !!b.inputs.C && holds([b.inputs.C], COMPARES) && holds([b.inputs.C], ['v_var'])),
  );

const GROW: BlockType[] = ['a_changesize', 'a_setsize'];

const grewUp = (ctx: StepContext): boolean =>
  ctx.machine.instances.some((i) => {
    const sp = ctx.program.sprites.find((s) => s.id === i.id);
    return !!sp && !i.isClone && i.size > (sp.size ?? 100);
  });

export const mascotaVirtual: GameDefinition = {
  id: 'mascota-virtual',
  level: 5,
  class: 1,
  order: 3,
  kind: 'game',
  title: 'Mascota virtual',
  pitch: 'Cuidá a tu mascota: se queda sin comida y sin energía sola, y su cara te cuenta cómo está.',
  concept: 'Estado que cambia solo: variables que bajan con el tiempo, topes y comparaciones, una variable que recuerda si duerme, un estado calculado y reglas para ganar o perder.',
  cover: 'michi',
  setup: SETUP,
  toolbox: ['a_flag'],
  phases: [
    {
      title: 'Se gasta sola',
      goal: 'La comida y la energía de tu mascota bajan solas.',
      steps: [
        {
          id: 'casa',
          title: 'Su casa',
          text: '¡Tu mascota virtual llegó! Primero elegí dónde vive: tocá uno de los lugares.',
          hints: ['Mirá los dibujitos de abajo. Elegí el que más le guste a tu mascota.'],
          point: 'backdrops',
          check: (ctx) => ctx.program.backdrop !== SETUP.backdrop,
        },
        {
          id: 'variables',
          title: 'Comida y energía',
          text: 'Una mascota necesita comida y energía. Creá una variable para cada una y que las dos empiecen en 10 cada vez que se aprieta la bandera.',
          hints: [
            'Creá las variables con el botón de variables. Ponéles nombres que se entiendan.',
            'Al principio del juego, usá «fijar … a …» para poner cada variable en 10. Las vas a ver en cartelitos en el escenario.',
          ],
          unlock: ['a_setvar', 'v_var', 'a_changevar'],
          demo: 'a_setvar',
          example: [{ sprite: 'Michi', scripts: [onFlag(setVar('comida', 10), setVar('energia', 10))] }],
          check: (ctx) => distinct(setAtStart(ctx).filter((s) => s.value >= 5 && s.value <= 100).map((s) => s.name)) >= 2 && ctx.stats.ran('var'),
        },
        {
          id: 'hambre-baja',
          title: 'Le da hambre',
          text: 'La comida baja sola: cada 2 segundos pierde uno, sin que nadie toque nada. Mirá el cartelito y esperá.',
          hints: [
            'Algo que se repite sin parar, con una espera adentro.',
            'En cada vuelta, «sumar a … el valor …» con la variable de comida y el valor -1.',
            'Este programa también empieza con la bandera verde, pero es otro, aparte del que fija los números.',
          ],
          unlock: ['a_wait', 'a_forever'],
          demo: 'a_forever',
          example: [{ sprite: 'Michi', scripts: [onFlag(forever(wait(2), changeVar('comida', -1)))] }],
          check: (ctx) => drains(ctx).length >= 1 && belowStart(ctx).length >= 1 && ctx.stats.count('wait') >= 2,
        },
        {
          id: 'energia-baja',
          title: 'Se cansa',
          text: 'La energía también baja sola, pero a su ritmo: más lento que la comida. Cada una de las dos va por su cuenta.',
          hints: [
            'Es lo mismo que la comida, con otra variable y otra espera.',
            'Un programa más para la energía. Si querés, todo puede ir en la misma bandera verde.',
          ],
          example: [{ sprite: 'Michi', scripts: [onFlag(forever(wait(3), changeVar('energia', -1)))] }],
          check: (ctx) => drains(ctx).length >= 2 && belowStart(ctx).length >= 2,
        },
        {
          id: 'no-negativo',
          title: 'Nunca menos de cero',
          text: 'Una mascota no puede tener comida negativa. Hacé que ni la comida ni la energía bajen de cero: las dos tienen que tener su protección. Dejá correr el tiempo para comprobarlo.',
          hints: [
            'Antes de bajar, preguntá si la variable todavía es mayor que 0.',
            'Si es mayor, recién ahí se le resta uno.',
            'Tiene que haber una pregunta para la comida y otra para la energía.',
          ],
          unlock: ['a_if', 'v_gt', 'v_lt'],
          example: [{ sprite: 'Michi', scripts: [onFlag(forever(wait(2), ifThen(gt(variable('comida'), 0), changeVar('comida', -1))))] }],
          check: (ctx) =>
            drains(ctx).length >= 2 &&
            drains(ctx).every((n) => guardedDrains(ctx).includes(n)) &&
            ctx.machine.timerSeconds() > 2 &&
            declared(ctx).every((n) => valueOf(ctx, n) >= 0) &&
            declared(ctx).some((n) => (startOf(ctx, n) ?? 0) > 0 && valueOf(ctx, n) === 0),
        },
      ],
    },
    {
      title: 'Cuidala',
      goal: 'La alimentás y la ponés a dormir.',
      steps: [
        {
          id: 'comida',
          title: 'La comida',
          text: 'Sumá una comida al escenario con el botón del más. Va a ser lo que tu mascota come.',
          hints: ['Buscá una comida entre los objetos. Una manzana va bien.'],
          point: 'add-sprite',
          check: (ctx) => ctx.program.sprites.some(isObject),
        },
        {
          id: 'comer',
          title: 'A comer',
          text: 'Cuando tocás la comida, la mascota come: sube su variable de comida y suena algo. Tocala para probarlo.',
          hints: [
            'Hay un bloque que arranca cuando tocan a un personaje.',
            'Adentro: «sumar a … el valor …», con la variable de comida. Probá con 3.',
            'No te olvides del sonido.',
          ],
          unlock: ['a_click', 'a_sound'],
          example: [{ sprite: 'Manzana', scripts: [onClick(changeVar('comida', 3), sound('boing'))] }],
          check: (ctx) => feeders(ctx).length > 0,
        },
        {
          id: 'tope',
          title: 'No se puede comer de más',
          text: 'La comida no puede pasar de 10: aunque toques mil veces, se queda en 10. Tocá la comida varias veces seguidas para probar.',
          hints: [
            'Después de sumar, preguntá si la variable se pasó de 10.',
            'Fijate en el cartelito: después de tocar la comida tiene que quedarse en 10, nunca más.',
            'Si se pasó, fijala en 10 con «fijar … a …».',
          ],
          example: [{ sprite: 'Manzana', scripts: [onClick(changeVar('comida', 3), ifThen(gt(variable('comida'), 10), setVar('comida', 10)))] }],
          // Right after a feeding the number sits exactly at the cap: without it, it would be above.
          check: (ctx) => cappedNames(ctx).some((c) => valueOf(ctx, c.name) === c.limit),
        },
        {
          id: 'dormir',
          title: 'A dormir',
          text: 'Sumá otro objeto para que la mascota duerma. Si lo tocás, la energía sube de a poco durante unos segundos.',
          hints: [
            'Dormir lleva tiempo: repetí varias veces "esperar un segundo y subir un poco".',
            'Usá un objeto que no sea la comida, y una variable distinta.',
            'Acordate de que la energía tampoco puede pasar de 10.',
          ],
          point: 'add-sprite',
          unlock: ['a_repeat'],
          example: [{ sprite: 'Nube', scripts: [onClick(repeat(4, wait(1), changeVar('energia', 2)))] }],
          check: (ctx) => sleepers(ctx).length > 0,
        },
        {
          id: 'dormida',
          title: 'Mientras duerme',
          text: 'Una mascota dormida no puede comer. Hacé que, mientras duerme, tocar la comida no haga nada. Para eso tenés que acordarte de si está durmiendo.',
          hints: [
            'Una variable más que valga 1 si duerme y 0 si está despierta.',
            'Fijala en 1 con «fijar … a …» al empezar a dormir, y en 0 al despertar.',
            'La comida pregunta por esa variable antes de sumar.',
          ],
          unlock: ['v_eq'],
          example: [
            { sprite: 'Nube', scripts: [onClick(setVar('durmiendo', 1), repeat(4, wait(1), changeVar('energia', 2)), setVar('durmiendo', 0))] },
            { sprite: 'Manzana', scripts: [onClick(ifThen(eq(variable('durmiendo'), 0), changeVar('comida', 3)))] },
          ],
          check: (ctx) => stateVars(ctx).length > 0,
        },
      ],
    },
    {
      title: 'Su cara cuenta',
      goal: 'La cara de tu mascota cuenta cómo está.',
      steps: [
        {
          id: 'cara-triste',
          title: 'Se pone triste',
          text: 'Cuando le falta algo, la mascota lo muestra: si la comida o la energía están muy bajas, que cambie de cara. Dejá pasar el tiempo para verlo.',
          hints: [
            'Hay que mirar su estado todo el tiempo, no una sola vez.',
            'Una condición compara la variable con un número, por ejemplo menor que 4.',
          ],
          unlock: ['a_face', 'a_ifelse'],
          example: [{ sprite: 'Michi', scripts: [onFlag(forever(ifThen(lt(variable('comida'), 4), face('triste'))))] }],
          check: (ctx) =>
            conditionals(ctx, COMPARES, ['a_face']).length > 0 &&
            holdingAll(ctx, LOOPS, BRANCHES, ['a_face']).length > 0 &&
            ctx.machine.instances.some((i) => i.art.kind === 'character' && i.face !== 'feliz'),
        },
        {
          id: 'cara-dos',
          title: 'Y vuelve a estar contenta',
          text: 'La cara tiene que cambiar para los dos lados: triste si le falta algo, contenta si está bien. Una cosa o la otra.',
          hints: ['«Si… si no» tiene un lugar para cada caso.', 'Ponele una cara distinta a cada camino.'],
          example: [{ sprite: 'Michi', scripts: [onFlag(forever(ifElse(lt(variable('comida'), 4), [face('triste')], [face('feliz')])))] }],
          check: (ctx) =>
            placed(ctx).some(({ block: b }) => {
              if (b.type !== 'a_ifelse' || !b.inputs.C || !holds([b.inputs.C], COMPARES)) return false;
              const yes = facesIn(b.body);
              const no = facesIn(b.elseBody);
              return yes.length > 0 && no.length > 0 && yes.some((f) => !no.includes(f));
            }),
        },
        {
          id: 'cara-tres',
          title: 'Más de dos caras',
          text: 'Dos caras son pocas. Hacé que haya al menos tres estados: bien, así así y mal, y que cuando duerme tenga su propia cara.',
          hints: [
            'Una elección puede esconder otra elección adentro de su «si no».',
            'Mal, así así y bien dan tres caminos. Dormida es un cuarto caso, que se pregunta con la variable que recuerda si duerme: tiene que tener su propia cara.',
          ],
          example: [
            {
              sprite: 'Michi',
              scripts: [
                onFlag(
                  forever(
                    ifElse(eq(variable('durmiendo'), 1), [face('dormido')], [
                      ifElse(lt(variable('comida'), 3), [face('triste')], [ifElse(lt(variable('comida'), 6), [face('enojo')], [face('feliz')])]),
                    ]),
                  ),
                ),
              ],
            },
          ],
          check: (ctx) => {
            const asleep = stateVars(ctx);
            return holdingAll(ctx, LOOPS, BRANCHES, ['a_face']).some(
              ({ block }) =>
                distinct(facesIn(inside(block))) >= 3 &&
                inside(block).filter((x) => BRANCHES.includes(x.type)).length >= 2 &&
                // One of the choices asks about the variable that remembers who sleeps, and gives that case a face.
                inside(block).some(
                  (x) => BRANCHES.includes(x.type) && !!x.inputs.C && readNames([x.inputs.C]).some((n) => asleep.includes(n)) && facesIn([...x.body, ...x.elseBody]).length > 0,
                ),
            );
          },
        },
        {
          id: 'animo',
          title: 'El ánimo',
          text: 'En vez de mirar la comida y la energía por separado, calculá una sola variable, el ánimo, que sea el promedio de las dos. Después la cara solo mira el ánimo.',
          hints: [
            'Una variable nueva, que se vuelve a calcular todo el tiempo.',
            'Promedio: sumar las dos y dividir por 2.',
            'Cambiá las condiciones de la cara para que usen el ánimo, no la comida ni la energía.',
          ],
          unlock: ['v_add', 'v_div'],
          example: [
            {
              sprite: 'Michi',
              scripts: [
                onFlag(forever(setVar('animo', div(add(variable('comida'), variable('energia')), 2)))),
                onFlag(forever(ifElse(lt(variable('animo'), 4), [face('triste')], [face('feliz')]))),
              ],
            },
          ],
          check: (ctx) => moodVars(ctx).some((n) => valueOf(ctx, n) >= 1),
        },
      ],
    },
    {
      title: 'Ganar, enfermarse y jugar',
      goal: 'Tu mascota puede enfermarse, crecer y ganar, y juega con vos.',
      steps: [
        {
          id: 'enferma',
          title: 'Se enferma',
          text: 'Si se queda sin comida o sin energía, la mascota se enferma y el juego se pierde. Antes, que ponga cara y diga algo. Dejala sin cuidar para verlo.',
          hints: [
            'Hay que esperar hasta que pase una de las dos cosas. Una condición puede juntar dos comparaciones.',
            'Antes de perder: una cara y un cartel.',
          ],
          unlock: ['a_lose', 'a_waituntil', 'a_sayfor', 'v_or'],
          example: [
            {
              sprite: 'Michi',
              scripts: [onFlag(waitUntil(or(lt(variable('comida'), 1), lt(variable('energia'), 1))), face('triste'), sayFor('Me enfermé...', 2), lose())],
            },
          ],
          check: (ctx) =>
            losesOnZero(ctx) && ctx.stats.lost && comesBefore(ctx, (b) => b.type === 'a_face' || SAYS.includes(b.type), ['a_lose']),
        },
        {
          id: 'crece',
          title: 'Crece si la cuidás',
          text: 'Mientras la comida y la energía estén bien arriba (más de 4), la mascota crece de a poco: cada segundo suma a una variable de crecimiento y se hace un poquito más grande.',
          hints: [
            'Una repetición con espera de un segundo.',
            'La condición tiene que cumplir las dos cosas a la vez: las dos comparaciones juntas.',
            'Adentro: subir la variable de crecimiento y cambiar el tamaño.',
          ],
          unlock: ['v_and', 'a_changesize'],
          example: [
            {
              sprite: 'Michi',
              scripts: [
                onFlag(
                  forever(
                    wait(1),
                    ifThen(and(gt(variable('comida'), 4), gt(variable('energia'), 4)), changeVar('crecimiento', 1), changeSize(2)),
                  ),
                ),
              ],
            },
          ],
          check: (ctx) =>
            placed(ctx).some(
              ({ block: b }) =>
                BRANCHES.includes(b.type) &&
                !!b.inputs.C &&
                distinct(readNames([b.inputs.C])) >= 2 &&
                holds(b.body, ['a_changevar']) &&
                inside(b).some(raises) &&
                holds(b.body, GROW),
            ) && grewUp(ctx),
        },
        {
          id: 'gana',
          title: 'Ganó',
          text: 'Cuando el crecimiento llega a 20, ¡la mascota ganó! Cambiá el escenario, que lo anuncie con un cartel y cortá lo demás para que no se estropee la fiesta.',
          hints: [
            'Esperar hasta que la variable de crecimiento sea mayor que 19.',
            'Los otros programas del mismo personaje se pueden frenar con un bloque especial.',
            'Cambiá el escenario y mostrá un cartel antes de ganar.',
          ],
          unlock: ['a_win', 'a_backdrop', 'a_stopothers', 'v_join'],
          example: [
            {
              sprite: 'Michi',
              scripts: [onFlag(waitUntil(gt(variable('crecimiento'), 19)), stopOthers(), backdrop('teatro'), sayFor('¡Crecí!', 2), win())],
            },
          ],
          check: (ctx) => winsOnState(ctx) && ctx.stats.won && comesBefore(ctx, (b) => b.type === 'a_backdrop' || SAYS.includes(b.type), ['a_win']),
        },
        {
          id: 'minijuego',
          title: 'Un minijuego',
          text: 'Sumá un minijuego: tocás a la mascota y aparece una pelota en lugares al azar, de a uno, unos segundos cada vez. Cada vez que tocás la pelota a tiempo, la mascota crece más rápido.',
          hints: [
            'Tocar a la mascota manda un mensaje. La pelota escucha ese mensaje.',
            'La pelota arranca escondida. Al escuchar, repite: ir a un lugar al azar, mostrarse, esperar y esconderse.',
            'Si tocan la pelota mientras se ve, subí la variable de crecimiento y escondela.',
          ],
          point: 'add-sprite',
          unlock: ['a_recv', 'a_send', 'a_hide', 'a_show', 'a_random'],
          example: [
            { sprite: 'Michi', scripts: [onClick(send('m3'))] },
            {
              sprite: 'Pelota',
              scripts: [
                onFlag(hide()),
                onReceive('m3', repeat(8, goToRandom(), show(), wait(1), hide())),
                onClick(changeVar('crecimiento', 2), sound('magia'), hide()),
              ],
            },
          ],
          check: (ctx) => {
            const hasSend = scriptsOf(ctx, ['a_click']).some(({ script }) => holds(script.body, ['a_send']));
            return (
              hasSend &&
              ctx.program.sprites.some(
                (s) =>
                  isObject(s) &&
                  s.scripts.some((sc) => sc.hat.type === 'a_recv' && blocksInList(sc.body).some((b) => LOOPS.includes(b.type) && inside(b).some(movesRandomly) && inside(b).some((x) => x.type === 'a_wait'))) &&
                  s.scripts.some((sc) => sc.hat.type === 'a_click' && blocksInList(sc.body).some(raises)) &&
                  ctx.stats.ranHatBy(s.id, 'recv') &&
                  ctx.stats.ranHatBy(s.id, 'click'),
              )
            );
          },
        },
        {
          id: 'cuesta',
          title: 'Jugar cansa',
          text: 'Jugar gasta energía. Hacé que cada juego le cueste un poco, y que si está muy cansada no quiera jugar y lo diga.',
          hints: [
            'Antes de mandar el mensaje, preguntá si la energía alcanza.',
            'Si alcanza: bajar la energía y mandar el mensaje. Si no, un cartel.',
            'Es una elección «si… si no» con un camino para cada caso.',
          ],
          example: [
            {
              sprite: 'Michi',
              scripts: [onClick(ifElse(gt(variable('energia'), 3), [changeVar('energia', -2), send('m3')], [sayFor('Estoy muy cansada', 1)]))],
            },
          ],
          check: (ctx) =>
            conditionals(ctx, COMPARES, (b) => b.type === 'a_send', 'then').some(
              ({ sprite, block }) =>
                holds(block.body, ['a_changevar']) && inside(block).some(lowers) && holds(block.elseBody, SAYS) && ctx.stats.ranHatBy(sprite.id, 'click'),
            ),
        },
      ],
    },
  ],
  challenges: [
    {
      title: 'Una enfermedad misteriosa',
      text: 'Hacé que, de vez en cuando y al azar, la mascota se enferme aunque la cuides bien. Sumá una medicina que la cure. ¿Cómo evitás que sea imposible ganar?',
    },
    {
      title: 'Día y noche',
      text: 'Que cada tanto el escenario pase de día a noche y que de noche la mascota se canse el doble de rápido. ¿Qué tiene que recordar el programa?',
    },
    {
      title: 'Una segunda mascota',
      text: 'Sumá otra mascota con sus propias variables y reglas. ¿Pueden jugar juntas? ¿Qué pasa si una se enferma?',
    },
    {
      title: 'Tu propio minijuego',
      text: 'Inventá otro minijuego con reglas distintas, por ejemplo un juego de memoria o uno de reflejos, que dé crecimiento si lo ganás.',
    },
  ],
  solution: {
    program: project(
      'ciudad',
      [
        sprite(
          'mascota',
          'michi',
          [
            onFlag(setVar('comida', 10), setVar('energia', 10), setVar('durmiendo', 0), setVar('animo', 10), setVar('crecimiento', 0)),
            onFlag(forever(wait(2), ifThen(gt(variable('comida'), 0), changeVar('comida', -1)))),
            onFlag(forever(wait(3), ifThen(and(gt(variable('energia'), 0), eq(variable('durmiendo'), 0)), changeVar('energia', -1)))),
            onFlag(forever(setVar('animo', div(add(variable('comida'), variable('energia')), 2)))),
            onFlag(
              forever(
                ifElse(eq(variable('durmiendo'), 1), [face('dormido')], [
                  ifElse(lt(variable('animo'), 3), [face('triste')], [ifElse(lt(variable('animo'), 6), [face('enojo')], [face('feliz')])]),
                ]),
              ),
            ),
            onFlag(waitUntil(or(lt(variable('comida'), 1), lt(variable('energia'), 1))), stopOthers(), face('triste'), sayFor('Me enfermé...', 2), lose()),
            onFlag(
              forever(
                wait(1),
                ifThen(and(gt(variable('comida'), 4), gt(variable('energia'), 4)), changeVar('crecimiento', 1), changeSize(2)),
              ),
            ),
            onFlag(waitUntil(gt(variable('crecimiento'), 19)), stopOthers(), backdrop('teatro'), face('risa'), sayFor(join('¡Crecí! ', variable('crecimiento')), 2), win()),
            onClick(
              ifElse(gt(variable('energia'), 3), [changeVar('energia', -2), send('m3')], [sayFor('Estoy muy cansada', 1)]),
            ),
          ],
          { x: 0, y: -100, name: 'Michi' },
        ),
        sprite(
          'manzana',
          'apple',
          [
            onClick(
              ifThen(
                eq(variable('durmiendo'), 0),
                changeVar('comida', 3),
                ifThen(gt(variable('comida'), 10), setVar('comida', 10)),
                sound('boing'),
              ),
            ),
          ],
          { x: -170, y: -110, name: 'Manzana' },
        ),
        sprite(
          'nube',
          'cloud',
          [
            onClick(
              ifThen(
                eq(variable('durmiendo'), 0),
                setVar('durmiendo', 1),
                repeat(4, wait(1), changeVar('energia', 2), ifThen(gt(variable('energia'), 10), setVar('energia', 10))),
                setVar('durmiendo', 0),
              ),
            ),
          ],
          { x: 170, y: 40, name: 'Nube' },
        ),
        sprite(
          'pelota',
          'ball',
          [
            onFlag(hide()),
            onReceive('m3', repeat(8, goToRandom(), show(), wait(1), hide())),
            onClick(changeVar('crecimiento', 2), sound('magia'), hide()),
          ],
          { x: 100, y: -60, name: 'Pelota' },
        ),
      ],
      { variables: ['comida', 'energia', 'durmiendo', 'animo', 'crecimiento'] },
    ),
    play: (g) => playMascota(g),
  },
};

/* ---------- the reference player ---------- */

function playMascota(g: Game): void {
  /* First try: nobody takes care of it, so it gets sick. */
  g.flag();
  g.run(100);
  g.runUntil(() => g.machine.ended !== null, 120_000);
  /* Second try: a caring child who watches the numbers. */
  g.flag();
  g.run(300);
  for (let i = 0; i < 4; i++) {
    g.tap('manzana');
    g.run(60);
  }
  g.tap('nube');
  g.run(200);
  g.tap('manzana'); /* it sleeps: nothing happens */
  g.run(100);
  let lastGame = -99_999;
  g.runUntil(() => {
    if (g.machine.ended) return true;
    const asleep = varNow(g, 'durmiendo') === 1;
    const ball = g.sprite('pelota').visible;
    if (ball) g.tap('pelota');
    else if (!asleep && varNow(g, 'comida') <= 6) g.tap('manzana');
    else if (!asleep && varNow(g, 'energia') <= 5) g.tap('nube');
    else if (!asleep && varNow(g, 'energia') >= 8 && varNow(g, 'comida') >= 7 && g.time.now() - lastGame > 9000) {
      lastGame = g.time.now();
      g.tap('mascota');
    }
    return false;
  }, 300_000);
}
