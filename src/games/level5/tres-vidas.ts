/**
 * Level 5, class 1: Nova catches stars and dodges bombs with three lives. The game grows from one falling
 * star to a rain of clones that speeds up with the score, and ends with a streak record. Variables reset on
 * the green flag, so the record is the best streak of one run, not a score that survives between runs.
 */
import type { BlockType } from '../../language/catalog.ts';
import {
  addScore, add, backdrop, changeVar, changeY, createClone, deleteClone, div, forever, gt, ifElse, ifThen, join, lose, lt, moveWithArrows, mul,
  onCloneStart, onFlag, onPoints, or, posY, project, randomBetween, repeatUntil, sayFor, score, setVar, setX, setY, show, hide, sound, sprite, touching,
  variable, wait, waitUntil, goTo,
  type Block, type SpriteProgram,
} from '../../language/ir.ts';
import { blocksInList, blocksOfSprite } from '../checks.ts';
import type { Game } from '../../runtime/testing.ts';
import type { GameDefinition, StepContext } from '../types.ts';
import {
  BRANCHES, COMPARES, LOOPS, SAYS, belowStart, cloningSprites, comesBefore, conditionals, declared, holdingAll, holds, inside, liveClones, literal, losesOnZero, lowers,
  nameOf, placed, raises, readNames, scriptsOf, setAtStart, spritesOfArt, valueOf,
} from './logic.ts';
import { clonesOf, releaseArrows, steer, varNow, walkTo } from './play.ts';

const SETUP = project('espacio', [
  sprite('nova', 'nova', [], { x: 0, y: -125, size: 80, name: 'Nova' }),
  sprite('estrella', 'star', [], { x: -120, y: 100, name: 'Estrella' }),
]);

const RANDOM_PLACE: BlockType[] = ['a_goto', 'a_setx'];
const SOUNDS: BlockType[] = ['a_sound', 'a_note'];

/** Sprites that appear at a random spot and move down inside a loop, and ran the random block. */
function fallers(ctx: StepContext): SpriteProgram[] {
  return ctx.program.sprites.filter((s) => {
    const blocks = blocksOfSprite(s);
    const place = blocks.some((b) => RANDOM_PLACE.includes(b.type) && holds([b], ['v_random']));
    const falls = blocks.some((b) => LOOPS.includes(b.type) && inside(b).some((x) => x.type === 'a_changey'));
    return place && falls && ctx.stats.ranBy(s.id, 'random');
  });
}

const scoresOnTouch = (ctx: StepContext): boolean =>
  conditionals(ctx, ['v_touching'], ['a_addscore', 'a_setscore'], 'then').length > 0 ||
  scriptsOf(ctx, ['a_touching']).some(({ script }) => holds(script.body, ['a_addscore']));

/** A rule that takes a life when a star is missed: a choice with a touch test whose «sino» lowers a variable. */
const missRule = (ctx: StepContext): boolean =>
  conditionals(ctx, ['v_touching'], lowers, 'else').length > 0 || conditionals(ctx, ['v_y'], lowers).length > 0;

const soundsOf = (list: readonly Block[]): string[] =>
  blocksInList(list).filter((b) => SOUNDS.includes(b.type)).map((b) => String(b.fields.S));

function twoSounds(ctx: StepContext): boolean {
  return placed(ctx).some(({ block: b }) => {
    if (b.type !== 'a_ifelse') return false;
    const yes = soundsOf(b.body);
    const no = soundsOf(b.elseBody);
    return yes.length > 0 && no.length > 0 && yes.some((s) => !no.includes(s));
  });
}

/** Rules that take a life when a bomb touches: placed on a bomb, or testing a touch with one. */
function bombHits(ctx: StepContext): boolean {
  const bombs = spritesOfArt(ctx, 'bomb');
  const ids = new Set(bombs.map((s) => s.id));
  return conditionals(ctx, ['v_touching'], lowers, 'then').some(({ sprite: s, block }) => {
    const targets = blocksInList([block.inputs.C]).filter((b) => b.type === 'v_touching').map((b) => String(b.fields.T));
    return ids.has(s.id) || targets.some((t) => ids.has(t));
  });
}

const cloneScripts = (ctx: StepContext) => scriptsOf(ctx, ['a_clonestart']);

/** Clone scripts that drop a clone down the stage from a random spot. */
const fallingClones = (ctx: StepContext) =>
  cloneScripts(ctx).filter(
    ({ script }) =>
      blocksInList(script.body).some((b) => RANDOM_PLACE.includes(b.type) && holds([b], ['v_random'])) &&
      blocksInList(script.body).some((b) => LOOPS.includes(b.type) && inside(b).some((x) => x.type === 'a_changey')),
  );

/** Variables that grow somewhere and are put back to zero inside a choice (a streak). */
function streakVars(ctx: StepContext): string[] {
  const grows = new Set(placed(ctx).filter(({ block }) => raises(block)).map(({ block }) => nameOf(block)));
  const resets = conditionals(ctx, [], (b) => b.type === 'a_setvar' && literal(b.inputs.V) === 0).flatMap(({ block }) =>
    inside(block).filter((b) => b.type === 'a_setvar' && literal(b.inputs.V) === 0).map(nameOf),
  );
  return [...new Set(resets)].filter((n) => grows.has(n) && declared(ctx).includes(n));
}

/** Variables that keep the biggest value of another one: «si A > B, poner B en A». */
function recordVars(ctx: StepContext): string[] {
  return conditionals(ctx, COMPARES, (b) => b.type === 'a_setvar' && !!b.inputs.V && holds([b.inputs.V], ['v_var']), 'then').flatMap(({ block }) => {
    if (new Set(readNames([block.inputs.C])).size < 2) return [];
    return inside(block)
      .filter((b) => b.type === 'a_setvar' && !!b.inputs.V && holds([b.inputs.V], ['v_var']))
      .map(nameOf);
  });
}

const shownBySay = (ctx: StepContext, name: string): boolean =>
  placed(ctx).some(({ block }) => SAYS.includes(block.type) && readNames([block]).includes(name));

export const tresVidas: GameDefinition = {
  id: 'tres-vidas',
  level: 5,
  class: 1,
  order: 1,
  kind: 'game',
  title: 'Tres vidas',
  pitch: 'Atrapá estrellas, esquivá bombas y no pierdas tus tres vidas. ¡Cada vez cae más rápido!',
  concept: 'Estado: una variable cuenta las vidas, las comparaciones deciden cuándo termina, los clones hacen llover objetos y el puntaje regula la dificultad.',
  cover: 'star',
  setup: SETUP,
  toolbox: ['a_flag', 'a_forever', 'a_arrows'],
  phases: [
    {
      title: 'Atrapá estrellas',
      goal: 'Nova atrapa una estrella que cae y cuenta sus vidas.',
      steps: [
        {
          id: 'mover',
          title: 'Nova se mueve',
          text: '¡Empieza Tres vidas! Nova tiene que atrapar estrellas. Primero hacé que se mueva con las flechas todo el tiempo que dura el juego.',
          hints: [
            'Todo arranca con la bandera verde. Lo que va adentro de "por siempre" se repite sin parar.',
            'Poné "moverse con las flechas" adentro del "por siempre". Probá con velocidad 6.',
          ],
          demo: 'a_forever',
          example: [{ sprite: 'Nova', scripts: [onFlag(forever(moveWithArrows(6)))] }],
          check: (ctx) =>
            holdingAll(ctx, ['a_forever'], ['a_arrows']).some(({ sprite }) => ctx.stats.ranBy(sprite.id, 'arrows')) &&
            scriptsOf(ctx, ['a_flag']).some(({ script }) => holds(script.body, ['a_arrows'])),
        },
        {
          id: 'cae',
          title: 'La estrella cae',
          text: 'La estrella aparece arriba, en un lugar al azar, y cae hasta salirse por abajo de la pantalla.',
          hints: [
            'Con "ir a" la ponés arriba: en x un número al azar entre -200 y 200, y en y un número alto, como 140.',
            'Para que baje, repetí "sumar a y" con un número negativo. Se repite hasta que la y de la estrella sea menor que -150.',
          ],
          unlock: ['a_goto', 'a_changey', 'a_repeatuntil', 'v_random', 'v_lt', 'v_y'],
          demo: 'a_goto',
          example: [
            {
              sprite: 'Estrella',
              scripts: [onFlag(goTo(randomBetween(-200, 200), 140), repeatUntil(lt(posY(), -150), changeY(-3)))],
            },
          ],
          check: (ctx) => fallers(ctx).length > 0,
        },
        {
          id: 'atrapar',
          title: '¡Atrapada!',
          text: 'Si Nova toca la estrella, ganás un punto. Después la estrella vuelve a caer, una y otra vez. Atrapá dos para probarlo.',
          hints: [
            'Una condición "si" puede preguntar si la estrella está tocando a Nova.',
            'La caída tiene que terminar también cuando toca a Nova: usá "o" para juntar las dos razones (llegar abajo o tocar).',
            'Todo el ciclo (aparecer arriba, caer, mirar si tocó) va adentro de un "por siempre".',
          ],
          unlock: ['a_if', 'v_touching', 'a_addscore', 'v_or'],
          example: [
            {
              sprite: 'Estrella',
              scripts: [
                onFlag(
                  forever(
                    goTo(randomBetween(-200, 200), 140),
                    repeatUntil(or(lt(posY(), -150), touching('nova')), changeY(-3)),
                    ifThen(touching('nova'), addScore(1)),
                  ),
                ),
              ],
            },
          ],
          check: (ctx) => scoresOnTouch(ctx) && ctx.stats.maxScore >= 2,
        },
        {
          id: 'vidas',
          title: 'Las vidas',
          text: 'Nova arranca con 3 vidas. Creá una variable para contarlas y que empiece en 3 cada vez que se aprieta la bandera.',
          hints: [
            'Creá la variable con el botón de variables. Ponele el nombre que quieras.',
            'Al principio del juego, "poner" tu variable en 3.',
          ],
          unlock: ['a_setvar', 'v_var', 'a_changevar'],
          demo: 'a_setvar',
          example: [{ sprite: 'Nova', scripts: [onFlag(setVar('vidas', 3), forever(moveWithArrows(6)))] }],
          check: (ctx) => setAtStart(ctx).some((s) => s.value >= 2 && s.value <= 9) && ctx.stats.ran('var'),
        },
        {
          id: 'escapa',
          title: 'Se escapó una',
          text: 'Si la estrella llega abajo sin que Nova la atrape, se pierde una vida. Si la atrapa, suma el punto. Una cosa o la otra, nunca las dos.',
          hints: [
            '"Si… sino" elige entre dos caminos: lo que va en el "si" y lo que va en el "sino".',
            'En el "si" sumá el punto. En el "sino" cambiá tu variable de vidas en -1.',
            'Dejá que se escape una estrella a propósito para ver cómo baja la variable.',
          ],
          unlock: ['a_ifelse'],
          demo: 'a_ifelse',
          example: [
            {
              sprite: 'Estrella',
              scripts: [
                onFlag(
                  forever(
                    goTo(randomBetween(-200, 200), 140),
                    repeatUntil(or(lt(posY(), -150), touching('nova')), changeY(-3)),
                    ifElse(touching('nova'), [addScore(1)], [changeVar('vidas', -1)]),
                  ),
                ),
              ],
            },
          ],
          check: (ctx) => missRule(ctx) && belowStart(ctx).length > 0,
        },
        {
          id: 'sonidos',
          title: 'Se escucha',
          text: 'Que se oiga la diferencia: un sonido cuando Nova atrapa y otro, distinto, cuando se escapa una.',
          hints: ['Poné un sonido en cada camino del "si… sino". Elegí dos que suenen muy diferente.'],
          unlock: ['a_sound'],
          example: [
            {
              sprite: 'Estrella',
              scripts: [onFlag(ifElse(touching('nova'), [addScore(1), sound('magia')], [changeVar('vidas', -1), sound('boing')]))],
            },
          ],
          check: (ctx) => twoSounds(ctx) && ctx.stats.ran('sound'),
        },
      ],
    },
    {
      title: 'Llegan las bombas',
      goal: 'Las bombas quitan vidas y, sin vidas, se pierde.',
      steps: [
        {
          id: 'bomba',
          title: 'Una bomba',
          text: 'Sumá una bomba al juego con el botón del más. Tiene que caer desde arriba, en un lugar al azar, igual que la estrella.',
          hints: [
            'Buscá la bomba entre los objetos del botón del más.',
            'Copiá la idea de la estrella: aparecer arriba en un lugar al azar y bajar hasta salirse.',
          ],
          point: 'add-sprite',
          example: [
            {
              sprite: 'Bomba',
              scripts: [onFlag(forever(goTo(randomBetween(-200, 200), 140), repeatUntil(lt(posY(), -150), changeY(-4))))],
            },
          ],
          check: (ctx) => fallers(ctx).some((s) => s.art === 'bomb'),
        },
        {
          id: 'bomba-golpe',
          title: 'Cuidado con las bombas',
          text: 'Si una bomba toca a Nova, se pierde una vida. Las bombas no dan puntos.',
          hints: [
            'Es la misma idea de "si toca", pero ahora lo que cambia es la variable de vidas.',
            'La bomba tiene que dejar de caer cuando toca a Nova, igual que la estrella.',
            'Probalo: dejá que una bomba te toque y mirá bajar la variable.',
          ],
          example: [
            {
              sprite: 'Bomba',
              scripts: [
                onFlag(
                  forever(
                    goTo(randomBetween(-200, 200), 140),
                    repeatUntil(or(lt(posY(), -150), touching('nova')), changeY(-4)),
                    ifThen(touching('nova'), changeVar('vidas', -1)),
                  ),
                ),
              ],
            },
          ],
          check: (ctx) => bombHits(ctx) && belowStart(ctx).length > 0,
        },
        {
          id: 'cero',
          title: 'Sin vidas',
          text: 'Cuando las vidas llegan a cero, el juego se termina y se pierde.',
          hints: [
            'Hay que esperar a que pase algo: "esperar hasta que" una condición se cumpla.',
            'La condición compara tu variable de vidas con un número.',
            'Después de esperar, usá "perder".',
          ],
          unlock: ['a_waituntil', 'a_lose', 'v_eq', 'v_gt'],
          example: [{ sprite: 'Nova', scripts: [onFlag(waitUntil(lt(variable('vidas'), 1)), lose())] }],
          check: (ctx) => losesOnZero(ctx) && ctx.stats.lost,
        },
        {
          id: 'fin',
          title: 'Fin del juego',
          text: 'Antes de perder, Nova cuenta cómo le fue: un cartel de dos segundos que diga los puntos que hizo.',
          hints: [
            'Un globito con tiempo, antes de "perder".',
            'Para mezclar un texto con un número, "unir" pega las dos cosas.',
            'El número lo da el bloque que lee el puntaje.',
          ],
          unlock: ['a_sayfor', 'v_join', 'v_score'],
          example: [{ sprite: 'Nova', scripts: [onFlag(waitUntil(lt(variable('vidas'), 1)), sayFor(join('Puntos: ', score()), 2), lose())] }],
          check: (ctx) =>
            comesBefore(ctx, (b) => SAYS.includes(b.type) && holds([b], ['v_join']) && holds([b], ['v_score', 'v_var']), ['a_lose']) && ctx.stats.ran('say'),
        },
      ],
    },
    {
      title: 'Lluvia de clones',
      goal: 'Caen muchas estrellas y bombas a la vez.',
      steps: [
        {
          id: 'copias',
          title: 'Una lluvia',
          text: 'Una estrella sola cayendo es poco. Hacé que la estrella cree copias de sí misma cada tanto, para que caigan varias a la vez.',
          hints: [
            'Las copias se llaman clones. Buscá el bloque que los crea.',
            'Adentro de un "por siempre": crear un clon, esperar un ratito, y otra vez.',
          ],
          unlock: ['a_clone', 'a_wait', 'a_hide'],
          example: [{ sprite: 'Estrella', scripts: [onFlag(hide(), forever(createClone(), wait(1)))] }],
          check: (ctx) => holdingAll(ctx, LOOPS, ['a_clone'], ['a_wait']).length > 0 && ctx.stats.count('clone') >= 3,
        },
        {
          id: 'clon-cae',
          title: 'Cada clon cae solo',
          text: 'Cada copia tiene que caer por su cuenta: aparecer arriba en un lugar al azar, mostrarse y bajar. La estrella original se queda escondida.',
          hints: [
            'Hay un bloque que arranca cuando nace un clon. Ahí va lo que hace cada copia.',
            'La original se esconde al empezar. Cada clon se muestra cuando ya está arriba.',
            'Lo que antes hacía la estrella en su "por siempre" ahora lo hace el clon, una sola vez.',
          ],
          unlock: ['a_clonestart', 'a_show', 'a_setx', 'a_sety'],
          example: [
            {
              sprite: 'Estrella',
              scripts: [
                onFlag(hide(), forever(createClone(), wait(1))),
                onCloneStart(
                  setX(randomBetween(-200, 200)),
                  setY(140),
                  show(),
                  repeatUntil(or(lt(posY(), -150), touching('nova')), changeY(-3)),
                ),
              ],
            },
          ],
          check: (ctx) =>
            fallingClones(ctx).some(
              ({ sprite, script }) =>
                ctx.stats.ranHatBy(sprite.id, 'clone') && holds(script.body, ['a_show']) && blocksOfSprite(sprite).some((b) => b.type === 'a_hide'),
            ),
        },
        {
          id: 'clon-reglas',
          title: 'Las reglas del clon',
          text: 'Cada copia también aplica las reglas: da el punto o quita la vida. Y cuando termina tiene que desaparecer, si no se amontonan.',
          hints: [
            'Mové las reglas de la estrella (el "si… sino") al final del bloque del clon.',
            'Hay un bloque para borrar a este clon. Va al final de todo.',
            'Si los clones no se borran, llegás al máximo de 30 y dejan de nacer.',
          ],
          unlock: ['a_delclone'],
          example: [
            {
              sprite: 'Estrella',
              scripts: [
                onCloneStart(
                  setX(randomBetween(-200, 200)),
                  setY(140),
                  show(),
                  repeatUntil(or(lt(posY(), -150), touching('nova')), changeY(-3)),
                  ifElse(touching('nova'), [addScore(1)], [changeVar('vidas', -1)]),
                  deleteClone(),
                ),
              ],
            },
          ],
          check: (ctx) =>
            cloneScripts(ctx).some(
              ({ script }) =>
                holds(script.body, ['a_delclone']) &&
                blocksInList(script.body).some((b) => BRANCHES.includes(b.type) && !!b.inputs.C && holds([b.inputs.C], ['v_touching']) && holds([...b.body, ...b.elseBody], ['a_addscore'])),
            ) &&
            ctx.stats.count('delclone') >= 3 &&
            ctx.stats.maxScore >= 3 &&
            liveClones(ctx) < 12,
        },
        {
          id: 'bombas-lluvia',
          title: 'Llueven bombas',
          text: 'Lo mismo con las bombas: que lleguen como una lluvia de copias, caigan solas y se borren al terminar.',
          hints: [
            'Hacé con la bomba lo mismo que con la estrella.',
            'La bomba original se esconde y cada clon aparece arriba, cae, golpea si toca a Nova y se borra.',
          ],
          example: [
            {
              sprite: 'Bomba',
              scripts: [
                onFlag(hide(), forever(wait(3), createClone())),
                onCloneStart(
                  setX(randomBetween(-200, 200)),
                  setY(140),
                  show(),
                  repeatUntil(or(lt(posY(), -150), touching('nova')), changeY(-4)),
                  ifThen(touching('nova'), changeVar('vidas', -1)),
                  deleteClone(),
                ),
              ],
            },
          ],
          check: (ctx) =>
            spritesOfArt(ctx, 'bomb').some(
              (s) =>
                fallingClones(ctx).some(({ sprite, script }) => sprite.id === s.id && holds(script.body, ['a_delclone'])) &&
                ctx.stats.ranHatBy(s.id, 'clone') &&
                ctx.stats.ranBy(s.id, 'delclone'),
            ),
        },
        {
          id: 'mezcla',
          title: 'Más estrellas que bombas',
          text: 'Que la mayoría de las copias sean estrellas y de vez en cuando salga una bomba. Que lo decida un número al azar.',
          hints: [
            'Pedí un número al azar entre 1 y 10. Si es menor que 8, que salga una estrella. Si no, una bomba.',
            'El bloque que crea clones puede crear copias de otro personaje, no solo de sí mismo.',
            'Podés hacer que un solo personaje decida y cree los dos tipos de clon.',
          ],
          example: [
            {
              sprite: 'Estrella',
              scripts: [
                onFlag(hide(), forever(ifElse(lt(randomBetween(1, 10), 8), [createClone()], [createClone('bomba')]), wait(1))),
              ],
            },
          ],
          check: (ctx) => conditionals(ctx, ['v_random'], ['a_clone']).length > 0 && cloningSprites(ctx).length >= 2,
        },
      ],
    },
    {
      title: 'Cada vez más difícil',
      goal: 'El juego se acelera con los puntos y guarda tu mejor racha.',
      steps: [
        {
          id: 'velocidad',
          title: 'Cada vez más rápido',
          text: 'Mientras más puntos tenés, más rápido caen las estrellas y las bombas.',
          hints: [
            'La velocidad de caída es el número que le sumás a y. Ese número puede depender del puntaje.',
            'Una cuenta como 3 + puntaje ÷ 5 empieza lenta y se acelera de a poco.',
            'Como baja, el número es negativo: multiplicalo por -1.',
          ],
          unlock: ['v_add', 'v_sub', 'v_mul', 'v_div'],
          example: [{ sprite: 'Estrella', scripts: [onCloneStart(repeatUntil(lt(posY(), -150), changeY(mul(-1, add(3, div(score(), 5))))))] }],
          check: (ctx) =>
            placed(ctx).some(({ block: b }) => b.type === 'a_changey' && inside(b).some((x) => x.type === 'v_score' || x.type === 'v_var')) &&
            ctx.stats.ran('math'),
        },
        {
          id: 'ritmo',
          title: 'Cada vez más seguido',
          text: 'Y también aparecen más seguido: la espera entre copias se achica a medida que sube el puntaje.',
          hints: [
            'La espera es el número que le das a "esperar". También puede ser una cuenta.',
            'Una división sirve: un número grande dividido por algo que crece da cada vez menos.',
          ],
          example: [{ sprite: 'Estrella', scripts: [onFlag(forever(createClone(), wait(div(12, add(score(), 10)))))] }],
          check: (ctx) =>
            holdingAll(ctx, LOOPS, ['a_clone']).some(({ block }) =>
              inside(block).some((x) => x.type === 'a_wait' && inside(x).some((y) => y.type === 'v_score' || y.type === 'v_var')),
            ),
        },
        {
          id: 'nivel',
          title: 'Nivel 2',
          text: 'Al llegar a 10 puntos empieza el nivel 2: cambia el escenario y Nova lo anuncia con un cartel.',
          hints: [
            'Hay un bloque que arranca cuando el puntaje llega a un número.',
            'Adentro cambiá el escenario y hacé que Nova diga algo.',
            'Para probarlo hay que llegar a 10 puntos, ¡jugá bien!',
          ],
          unlock: ['a_points', 'a_backdrop'],
          example: [{ sprite: 'Nova', scripts: [onPoints(10, backdrop('castillo'), sayFor('¡Nivel 2!', 1))] }],
          check: (ctx) =>
            scriptsOf(ctx, ['a_points']).some(
              ({ script }) => Number(script.hat.fields.N) >= 3 && holds(script.body, ['a_backdrop']) && holds(script.body, SAYS),
            ) &&
            ctx.stats.ranHat('points') &&
            ctx.machine.backdrop !== ctx.program.backdrop,
        },
        {
          id: 'racha',
          title: 'La racha',
          text: 'Llevá la cuenta de cuántas estrellas seguidas atrapás sin fallar. Cada error la deja otra vez en cero.',
          hints: [
            'Hace falta otra variable, distinta de las vidas.',
            'Suma uno cuando Nova atrapa una estrella. Volvela a cero cuando se escapa una estrella o te toca una bomba.',
          ],
          example: [
            {
              sprite: 'Estrella',
              scripts: [onCloneStart(ifElse(touching('nova'), [addScore(1), changeVar('racha', 1)], [changeVar('vidas', -1), setVar('racha', 0)]))],
            },
          ],
          check: (ctx) => streakVars(ctx).length > 0 && ctx.stats.maxScore >= 3,
        },
        {
          id: 'mejor',
          title: 'Tu mejor racha',
          text: 'Guardá en otra variable la mejor racha de la partida y que Nova la cuente al final del juego.',
          hints: [
            'Cada vez que la racha crece, preguntá si ya pasó a la mejor que tenías.',
            'Si es más grande, poné la mejor racha igual a la racha actual.',
            'Después sumala al cartel de despedida con "unir".',
          ],
          example: [
            {
              sprite: 'Estrella',
              scripts: [onCloneStart(ifThen(gt(variable('racha'), variable('mejor')), setVar('mejor', variable('racha'))))],
            },
          ],
          check: (ctx) => recordVars(ctx).some((n) => valueOf(ctx, n) >= 2 && shownBySay(ctx, n)),
        },
      ],
    },
  ],
  challenges: [
    {
      title: 'La estrella dorada',
      text: 'Inventá una estrella especial que casi nunca aparece, cae rápido y vale cinco puntos. ¿Cómo la hacés aparecer de vez en cuando?',
    },
    {
      title: 'Un corazón que cura',
      text: 'Sumá un corazón que devuelva una vida. Ojo: ¿qué pasa si Nova ya tiene las tres? Pensá una regla para que nunca pase de tres.',
    },
    {
      title: 'Viento loco',
      text: 'Hacé que algunas estrellas y bombas caigan en diagonal, o que cambien de lado a mitad de camino. ¿Cuánto más difícil se vuelve?',
    },
    {
      title: 'Tu propia dificultad',
      text: 'Cambiá las reglas para que el juego sea justo para vos: más vidas al principio, bombas más lentas o un escudo de cinco segundos. Probalo con un compañero.',
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
            onFlag(setVar('vidas', 3), setVar('racha', 0), setVar('mejor', 0), forever(moveWithArrows(6))),
            onFlag(waitUntil(lt(variable('vidas'), 1)), sayFor(join('Mejor racha: ', variable('mejor')), 2), lose()),
            onPoints(10, backdrop('castillo'), sayFor('¡Nivel 2!', 1)),
          ],
          { x: 0, y: -125, size: 80, name: 'Nova' },
        ),
        sprite(
          'estrella',
          'star',
          [
            onFlag(hide(), forever(ifElse(lt(randomBetween(1, 10), 8), [createClone()], [createClone('bomba')]), wait(div(12, add(score(), 10))))),
            onCloneStart(
              setX(randomBetween(-200, 200)),
              setY(140),
              show(),
              repeatUntil(or(lt(posY(), -150), touching('nova')), changeY(mul(-1, add(3, div(score(), 5))))),
              ifElse(
                touching('nova'),
                [addScore(1), changeVar('racha', 1), ifThen(gt(variable('racha'), variable('mejor')), setVar('mejor', variable('racha'))), sound('magia')],
                [changeVar('vidas', -1), setVar('racha', 0), sound('boing')],
              ),
              deleteClone(),
            ),
          ],
          { x: -120, y: 100, name: 'Estrella' },
        ),
        sprite(
          'bomba',
          'bomb',
          [
            onFlag(hide()),
            onCloneStart(
              setX(randomBetween(-200, 200)),
              setY(140),
              show(),
              repeatUntil(or(lt(posY(), -150), touching('nova')), changeY(mul(-1, add(4, div(score(), 5))))),
              ifThen(touching('nova'), changeVar('vidas', -1), setVar('racha', 0), sound('boing')),
              deleteClone(),
            ),
          ],
          { x: 120, y: 100, name: 'Bomba' },
        ),
      ],
      { variables: ['vidas', 'racha', 'mejor'] },
    ),
    play: (g) => playTresVidas(g),
  },
};

/* ---------- the reference player ---------- */

const NOVA = 'nova';

/** One frame of steering: dodge a bomb that is coming down on Nova, else go under the lowest star. */
function chaseStars(g: Game): void {
  const me = g.sprite(NOVA);
  const danger = clonesOf(g, 'bomba')
    .filter((b) => b.y > -120 && b.y < 100 && Math.abs(b.x - me.x) < 64)
    .sort((a, b) => a.y - b.y)[0];
  if (danger) {
    const side = me.x >= danger.x ? 1 : -1;
    let target = danger.x + side * 80;
    if (Math.abs(target) > 215) target = danger.x - side * 80;
    steer(g, NOVA, target, null, 4);
    return;
  }
  const star = clonesOf(g, 'estrella').filter((s) => s.y > -100).sort((a, b) => a.y - b.y)[0];
  steer(g, NOVA, star ? star.x : me.x, null, 4);
}

function playTresVidas(g: Game): void {
  g.flag();
  g.run(200);
  /* Nova hides in a corner and lets something through: a life goes. */
  walkTo(g, NOVA, -210, null, 3000);
  g.runUntil(() => varNow(g, 'vidas') < 3 || g.machine.ended !== null, 30_000);
  /* Then play properly until the second level shows up and a streak is on the board. */
  g.runUntil(() => {
    if (g.machine.ended || ((g.machine.score ?? 0) >= 12 && varNow(g, 'mejor') >= 2)) return true;
    chaseStars(g);
    return false;
  }, 150_000);
  releaseArrows(g);
  /* Finally, stop catching and lose the game. */
  walkTo(g, NOVA, 210, null, 3000);
  g.runUntil(() => g.machine.ended !== null, 90_000);
  releaseArrows(g);
}
