/** Equipo Galaxia: volar esquivando rayos. Variables, clones, azar, si / si no. */
import {
  addScore, answer, ask, changeVar, changeX, createClone, deleteClone, face, forever, goTo, gt, hide, ifElse, join, lose, lt, moveWithArrows, onCloneStart, onFlag, onPoints, onTouching, posX,
  project, randomBetween, repeatUntil, sayFor, score, setScore, setSize, setVar, show, sound, sprite, sub, variable, wait, waitUntil, win,
} from '../../language/ir.ts';
import type { Block, ProjectProgram } from '../../language/ir.ts';
import { blocksForLevel } from '../../language/catalog.ts';
import { blocksInList, numField } from '../checks.ts';
import { addSprite, addTo, blocksOf, card, count, firstBlock, inside, lookCards, scriptsWith, showcaseGame, spriteOf } from './kit.ts';

const CLONE = () => onCloneStart(goTo(228, randomBetween(-140, 120)), show(), repeatUntil(lt(posX(), -215), changeX(sub(0, variable('velocidad')))), deleteClone());
/** Cada rayo pega una sola vez: al tocar a Chispa se borra. */
const HIT = () => onTouching('chispa', changeVar('vidas', -1), sound('explosion'), deleteClone());
const SPAWN = () => onFlag(hide(), forever(createClone(), wait(2.5)));
const COLLECT = () => onTouching('chispa', addScore(1), sound('campana'), hide());
const WIN = () => onPoints(10, sound('fanfarria'), win());

const base = project('castillo', [
  sprite('rayo', 'bolt', [SPAWN(), CLONE(), HIT()], { x: 160, y: 60, name: 'Rayo' }),
  sprite('moneda', 'coin', [
    onFlag(forever(hide(), goTo(228, randomBetween(-140, 120)), show(), repeatUntil(lt(posX(), -215), changeX(-5)))),
    COLLECT(),
  ], { x: 60, y: -60, size: 130, name: 'Moneda' }),
  sprite('chispa', 'chispa', [
    onFlag(setVar('vidas', 5), setVar('velocidad', 4), setScore(0), forever(moveWithArrows(7))),
    onFlag(waitUntil(lt(variable('vidas'), 1)), lose()),
    onTouching('rayo', face('triste'), wait(1), face('feliz')),
    WIN(),
    onFlag(sayFor('¡A volar!', 2)),
  ], { x: -170, y: -60, size: 70, name: 'Chispa' }),
], { variables: ['vidas', 'velocidad'] });

const setOf = (p: ProjectProgram, name: string): Block[] => blocksOf(p, 'a_setvar').filter((b) => b.fields.NAME === name);
/** El valor de un «fijar»: en el editor el literal puede ser texto o número. */
const valueOf = (b: Block): number => Number(b.inputs.V?.fields.V ?? NaN);

export const VUELO_DE_CHISPA = showcaseGame({
  id: 'muestra-chispa', level: 5, title: 'El vuelo de Chispa', cover: 'chispa',
  pitch: 'Volá por el castillo, juntá 10 monedas y esquivá los rayos.',
  setup: base,
  toolbox: blocksForLevel(5),
  play: [
    { icon: '⌨️', text: 'Volá con las flechas del teclado.' },
    { icon: '🪙', text: 'Juntá 10 monedas para ganar.' },
    { icon: '⚡', text: 'Cada rayo te saca una vida. Tenés 5.' },
  ],
  pillars: [
    { id: 'mover', broken: '{chispa} ya no vuela con las flechas', ok: (p) => blocksOf(p, 'a_forever').some((b) => count(blocksInList(b.body), 'a_arrows') > 0) || scriptsWith(p, 'a_key').some((s) => s.body.length > 0), restore: { sprite: 'chispa', script: onFlag(forever(moveWithArrows(7))) } },
    { id: 'variables', broken: 'Falta decir cuántas vidas y qué velocidad hay al empezar', ok: (p) => ['vidas', 'velocidad'].every((v) => setOf(p, v).length > 0), restore: { sprite: 'chispa', script: onFlag(setVar('vidas', 5), setVar('velocidad', 4)) } },
    { id: 'rayos', broken: 'Ya no salen rayos', ok: (p) => blocksOf(p, 'a_clone').length > 0, restore: { sprite: 'rayo', script: SPAWN() } },
    { id: 'clon', broken: 'Los rayos ya no vuelan', ok: (p) => scriptsWith(p, 'a_clonestart').some((s) => s.body.length > 0), restore: { sprite: 'rayo', script: CLONE() } },
    { id: 'golpe', broken: 'Los rayos ya no sacan vidas', ok: (p) => blocksOf(p, 'a_changevar').some((b) => b.fields.NAME === 'vidas' && valueOf(b) < 0) || p.sprites.some((s) => s.scripts.some((sc) => sc.hat.type === 'a_touching' && count(inside(sc), 'a_lose') > 0)), restore: { sprite: 'rayo', script: HIT() } },
    { id: 'sumar', broken: 'Ya no se suman puntos', ok: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') > 0), restore: { sprite: 'moneda', script: COLLECT() } },
    { id: 'ganar', broken: 'Ya no se puede ganar', ok: (p) => p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'a_win') > 0)), restore: { sprite: 'chispa', script: WIN() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'chispa', talker: 'chispa', sounder: 'moneda', picture: false, sayBlock: 'a_sayfor', newPlace: 'nieve', newArt: 'boo' }),
    card({
      id: 'vidas', icon: '❤️', label: 'Cambiar las vidas', sprite: 'chispa',
      title: 'Cambiá las vidas', text: '«vidas» es una **variable**: un número con nombre que el juego recuerda. ¿Con cuántas empieza?',
      how: ['En {chispa}, buscá «fijar vidas a 5».', 'Cambiá el **5**.', 'Tocá Empezar y mirá las vidas.'],
      block: { type: 'a_setvar', caption: 'Tocá el 5 y poné otra cantidad de vidas.', where: (b) => b.fields.NAME === 'vidas' },
      concept: 'Variables: un número con nombre que el programa recuerda y cambia.', ask: '¿Qué es una variable en tu juego?',
      built: (p) => setOf(p, 'vidas').some((b) => valueOf(b) !== 5),
      solve: (p) => { setOf(p, 'vidas')[0].inputs.V.fields.V = '9'; },
    }),
    card({
      id: 'velocidad', icon: '💨', label: 'Rayos más rápidos', sprite: 'chispa',
      title: 'Cambiá la velocidad de los rayos', text: 'Todos los rayos usan la variable «velocidad». **Cambiala en un lugar y cambian todos.**',
      how: ['En {chispa}, buscá «fijar velocidad a 4».', 'Cambiá el **4**.', 'Tocá Empezar.'],
      block: { type: 'a_setvar', caption: 'Tocá el 4 y poné otra velocidad.', where: (b) => b.fields.NAME === 'velocidad' },
      concept: 'Variables: cambiar un solo valor cambia todo lo que lo usa.', ask: '¿Por qué cambian todos los rayos si tocaste un solo número?',
      built: (p) => setOf(p, 'velocidad').some((b) => valueOf(b) !== 4),
      solve: (p) => { setOf(p, 'velocidad')[0].inputs.V.fields.V = '7'; },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Cambiar la meta', sprite: 'chispa',
      title: 'Cambiá la meta', text: '¿Con cuántas monedas se gana? **Vos decidís.**',
      how: ['En {chispa}, buscá «cuando los puntos lleguen a 10».', 'Cambiá el **10**.', 'Probá el juego.'],
      block: { type: 'a_points', caption: 'Tocá el 10 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0 && numField(s.hat, 'N') !== 10),
      solve: (p) => { firstBlock(p, 'chispa', 'a_points').fields.N = 6; },
    }),
    card({
      id: 'escalada', icon: '📈', label: 'Cada vez más difícil', sprite: 'moneda',
      title: 'Cada vez más difícil', text: 'Que **la velocidad suba** mientras jugás. Por ejemplo, con cada moneda.',
      how: ['En {moneda}, buscá «cuando toque a {chispa}».', 'Agregá «sumar a … el valor 1» y elegí **velocidad**.', 'Jugá: con cada moneda, los rayos aceleran.'],
      demo: onTouching('chispa', addScore(1), sound('campana'), hide(), changeVar('velocidad', 1)),
      example: [{ sprite: 'moneda', scripts: [onTouching('chispa', addScore(1), sound('campana'), hide(), changeVar('velocidad', 1))] }],
      concept: 'Variables: cambiarlas durante el juego sube la dificultad.', ask: '¿Cómo hace el juego para ponerse más difícil solo?',
      built: (p) => blocksOf(p, 'a_changevar').some((b) => b.fields.NAME === 'velocidad'),
      solve: (p) => { spriteOf(p, 'moneda').scripts[1].body.push(changeVar('velocidad', 1)); },
    }),
    card({
      id: 'sino', icon: '🔀', label: 'Usar «si… si no»', sprite: 'chispa',
      title: 'Si… si no…', text: 'Que {chispa} haga **una cosa si se cumple algo, y otra si no**. Por ejemplo: con más de 5 puntos es grande; si no, chica.',
      how: ['En {chispa}, poné «si … entonces … si no» adentro del «por siempre».', 'En el hueco, una comparación de **Operadores**: «puntos > 5».', 'Poné un bloque en cada parte. ¡Probalo!'],
      demo: onFlag(setVar('vidas', 5), setVar('velocidad', 4), setScore(0), forever(moveWithArrows(7), ifElse(gt(score(), 5), [setSize(110)], [setSize(70)]))),
      example: [{ sprite: 'chispa', scripts: [onFlag(forever(moveWithArrows(7), ifElse(gt(score(), 5), [setSize(110)], [setSize(70)])))] }],
      concept: 'Condicionales: elegir entre dos caminos.', ask: '¿Cuáles son los dos caminos y cuándo toma cada uno?',
      built: (p) => blocksOf(p, 'a_ifelse').some((b) => !!b.inputs.C && b.body.length > 0 && b.elseBody.length > 0),
      solve: (p) => { spriteOf(p, 'chispa').scripts[0].body[3].body.push(ifElse(gt(score(), 5), [setSize(110)], [setSize(70)])); },
    }),
    card({
      id: 'azar', icon: '🎲', label: 'Algo al azar', sprite: 'rayo',
      title: 'Que algo sea al azar', text: 'Usá «número al azar» para que **cada rayo sea distinto**: su tamaño, por ejemplo.',
      how: ['En {rayo}, abajo de «cuando empiece como clon», poné «fijar tamaño al».', 'En el número, meté «número al azar entre 50 y 150».', 'Tocá Empezar.'],
      demo: onCloneStart(setSize(100), goTo(228, 0), show(), repeatUntil(lt(posX(), -215), changeX(-4)), deleteClone()),
      example: [{ sprite: 'rayo', scripts: [onCloneStart(setSize(randomBetween(50, 150)))] }],
      concept: 'Azar: el juego es distinto cada vez.', ask: '¿Qué cosa decide la computadora al azar?',
      built: (p) => blocksOf(p, 'v_random').length > blocksOf(base, 'v_random').length,
      solve: (p) => { spriteOf(p, 'rayo').scripts[1].body.unshift(setSize(randomBetween(50, 150))); },
    }),
    card({
      id: 'nombre', icon: '🙋', label: 'Que pregunte el nombre', sprite: 'chispa',
      title: 'Que te pregunte el nombre', text: 'Que el juego **pregunte quién juega y después lo salude**.',
      how: ['En {chispa}, poné otra bandera con «preguntar ¿Cómo te llamás? y esperar».', 'Abajo «decir», y en el texto meté «respuesta» (o «unir hola con respuesta»).', 'Tocá Empezar.'],
      demo: onFlag(ask('¿Cómo te llamás?'), sayFor('¡Hola!', 2)),
      example: [{ sprite: 'chispa', scripts: [onFlag(ask('¿Cómo te llamás?'), sayFor(join('¡Hola, ', answer()), 2))] }],
      concept: 'Entrada y salida: el programa pregunta y usa la respuesta.', ask: '¿Dónde queda guardado lo que escribís?',
      built: (p) => blocksOf(p, 'a_ask').length > 0 && blocksOf(p, 'v_answer').length > 0,
      solve: (p) => addTo(p, 'chispa', onFlag(ask('¿Cómo te llamás?'), sayFor(join('¡Hola, ', answer()), 2))),
    }),
    card({
      id: 'corazon', icon: '💗', label: 'Ganar vidas', newSprite: true, point: 'add-sprite',
      title: 'Un corazón que da vidas', text: 'Agregá algo que **sume una vida** cuando {chispa} lo toca.',
      how: ['Tocá **Agregar** y elegí el corazón.', 'Poné «cuando toque a {chispa}» y abajo «sumar a vidas el valor 1».', 'Agregale «ir a posición aleatoria» para que se mueva.'],
      demo: onTouching('chispa', changeVar('vidas', 1)),
      example: [{ sprite: 'Nuevo', scripts: [onTouching('chispa', changeVar('vidas', 1), hide(), wait(5), goTo(0, randomBetween(-100, 100)), show())] }],
      concept: 'Variables y reglas: tocar algo cambia un valor.', ask: '¿Qué le pasa a la variable vidas?',
      built: (p) => blocksOf(p, 'a_changevar').some((b) => b.fields.NAME === 'vidas' && valueOf(b) > 0),
      solve: (p) => addSprite(p, 'heart', onTouching('chispa', changeVar('vidas', 1))),
    }),
  ],
});
