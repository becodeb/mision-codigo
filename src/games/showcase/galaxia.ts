/** Equipo Galaxia: volar esquivando rayos. Variables, clones, azar, si / si no. */
import {
  addScore, answer, ask, changeVar, changeX, createClone, deleteClone, face, forever, goTo, gt, hide, ifElse, join, lose, lt, moveWithArrows, onCloneStart, onFlag, onPoints, onTouching, posX,
  project, randomBetween, repeatUntil, sayFor, score, setScore, setSize, setVar, show, sound, sprite, sub, variable, wait, waitUntil, win,
} from '../../language/ir.ts';
import type { Block, ProjectProgram } from '../../language/ir.ts';
import { blocksForLevel } from '../../language/catalog.ts';
import { blocksInList, numField } from '../checks.ts';
import { addSprite, addTo, blocksOf, card, count, firstBlock, inside, lookCards, scriptsWith, showcaseGame, spriteOf, winMark } from './kit.ts';

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

/** Una pregunta de verdad: comparar dos números fijos da siempre lo mismo. */
const asks = (q: Block | undefined): boolean => !!q && (!Object.keys(q.inputs).length || Object.values(q.inputs).some((x) => x.type !== 'v_num' && x.type !== 'v_text'));

/** What a branch does, without the editor's ids: two equal branches are no choice. */
const same = (list: readonly Block[]): string => JSON.stringify(list, (key, value: unknown) => (key === 'id' ? undefined : value));
const twoSame = (all: readonly Block[]): boolean => all.some((b) => b.type === 'a_ifelse' && b.body.length > 0 && b.elseBody.length > 0 && same(b.body) === same(b.elseBody));

export const VUELO_DE_CHISPA = showcaseGame({
  id: 'muestra-chispa', level: 5, title: 'El vuelo de Chispa', cover: 'chispa',
  pitch: 'Volá por el castillo, juntá 10 monedas y esquivá los rayos.',
  setup: base,
  toolbox: blocksForLevel(5),
  play: [
    { icon: '🪙', text: 'Juntá 10 monedas para ganar.' },
    { icon: '⚡', text: 'Cada rayo te saca una vida. Tenés 5.' },
  ],
  goal: (p) => `Juntá ${winMark(p)}{moneda} y esquivá {rayo}`,
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
    ...lookCards(base, { hero: 'chispa', talker: 'chispa', sounder: 'moneda', picture: false, sayBlock: 'a_sayfor', newPlace: 'nieve', newArt: 'boo', sayAim: 'Que {chispa} diga otra cosa cuando empieza el juego', soundAim: 'Que suene otro sonido cuando {chispa} junta una {moneda}', soundTry: 'Tocá **▶** y juntá una {moneda}: ¡suena distinto!' }),
    card({
      id: 'vidas', icon: '❤️', label: 'Vidas', sprite: 'chispa',
      title: 'Cambiá las vidas',
      aim: 'Que empieces con más o menos vidas',
      how: [{ t: 'En el [a_setvar] que dice vidas, cambiá el **5** por otro número', on: 'change' }, { t: 'Tocá **▶** y mirá cuántas vidas tenés al empezar', on: 'try' }],
      block: { type: 'a_setvar', caption: 'Tocá el 5 y poné otra cantidad de vidas.', where: (b) => b.fields.NAME === 'vidas' },
      concept: 'Variables: un número con nombre que el programa recuerda y cambia.', ask: '¿Qué es una variable en tu juego?',
      built: (p) => setOf(p, 'vidas').some((b) => valueOf(b) !== 5),
      solve: (p) => { setOf(p, 'vidas')[0].inputs.V.fields.V = '9'; },
    }),
    card({
      id: 'velocidad', icon: '💨', label: 'Velocidad', sprite: 'chispa',
      title: 'Cambiá la velocidad de los rayos',
      aim: 'Que los {rayo} vuelen más rápido o más lento',
      how: [{ t: 'En el [a_setvar] que dice velocidad, cambiá el **4** por otro número', on: 'change' }, { t: 'Tocá **▶** y mirá qué tan rápido vuelan los {rayo}', on: 'try' }],
      block: { type: 'a_setvar', caption: 'Tocá el 4 y poné otra velocidad.', where: (b) => b.fields.NAME === 'velocidad' },
      concept: 'Variables: cambiar un solo valor cambia todo lo que lo usa.', ask: '¿Por qué cambian todos los rayos si tocaste un solo número?',
      built: (p) => setOf(p, 'velocidad').some((b) => valueOf(b) !== 4),
      solve: (p) => { setOf(p, 'velocidad')[0].inputs.V.fields.V = '7'; },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Meta', sprite: 'chispa',
      title: 'Cambiá la meta',
      aim: 'Que se gane con más o menos monedas',
      how: [{ t: 'En [a_points], cambiá el **10** por otro número', on: 'change' }, { t: 'Tocá **▶** y juntá monedas hasta ganar', on: 'try' }],
      block: { type: 'a_points', caption: 'Tocá el 10 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0 && numField(s.hat, 'N') !== 10),
      solve: (p) => { firstBlock(p, 'chispa', 'a_points').fields.N = 6; },
    }),
    card({
      id: 'escalada', icon: '📈', label: 'Acelerar', sprite: 'moneda',
      title: 'Cada vez más difícil',
      aim: 'Que los {rayo} vuelen más rápido cada vez que juntás una moneda',
      how: [{ t: 'Poné [a_changevar] abajo del [a_hide], al final', on: 'a_changevar' }, { t: 'En [a_changevar], elegí **velocidad**', on: 'tune' }, { t: 'Tocá **▶** y juntá monedas: ¡los rayos aceleran!', on: 'try' }],
      demo: onTouching('chispa', addScore(1), sound('campana'), hide(), changeVar('velocidad', 1)),
      example: [{ sprite: 'moneda', scripts: [onTouching('chispa', addScore(1), sound('campana'), hide(), changeVar('velocidad', 1))] }],
      tune: { type: 'a_changevar', field: 'NAME', when: (b) => b.fields.NAME !== 'velocidad' },
      concept: 'Variables: cambiarlas durante el juego sube la dificultad.', ask: '¿Cómo hace el juego para ponerse más difícil solo?',
      built: (p) => blocksOf(p, 'a_changevar').some((b) => b.fields.NAME === 'velocidad'),
      solve: (p) => { spriteOf(p, 'moneda').scripts[1].body.push(changeVar('velocidad', 1)); },
    }),
    card({
      id: 'sino', icon: '🔀', label: 'Si… si no', sprite: 'chispa',
      title: 'Si… si no…',
      aim: 'Que {chispa} cambie de tamaño según los puntos que tenés',
      how: [{ t: 'Poné [a_ifelse] abajo de [a_arrows], dentro de «por siempre»', on: 'a_ifelse' }, { t: 'Poné [a_setsize] arriba de «si no»', on: 'a_setsize#1' }, { t: 'Poné otro [a_setsize] abajo de «si no»', on: 'a_setsize#2' }, { t: 'Cambiá el **100** de abajo por **70**', on: 'tune' }, { t: 'Poné [v_gt] en el hueco de [a_ifelse]', on: 'v_gt' }, { t: 'Poné [v_score] a la izquierda del [v_gt]', on: 'v_score' }, { t: 'En el [v_gt], cambiá el **10** por **5**', on: 'tune_gt' }, { t: 'Tocá **▶** y juntá 6 puntos: ¡{chispa} cambia de tamaño!', on: 'try' }],
      demo: onFlag(setVar('vidas', 5), setVar('velocidad', 4), setScore(0), forever(moveWithArrows(7), ifElse(gt(score(), 5), [setSize(110)], [setSize(70)]))),
      example: [{ sprite: 'chispa', scripts: [onFlag(forever(moveWithArrows(7), ifElse(gt(score(), 5), [setSize(110)], [setSize(70)])))] }],
      tune: [
        { type: 'a_setsize', field: 'N', when: (_b, _p, all) => twoSame(all) },
        { type: 'v_gt', field: 'B', on: 'tune_gt', when: (b) => b.inputs.A?.type === 'v_score' && numField(b, 'B') === 10 },
      ],
      values: [{ type: 'v_gt', into: 'a_ifelse', input: 'C' }, { type: 'v_score', into: 'v_gt', input: 'A' }],
      concept: 'Condicionales: elegir entre dos caminos.', ask: '¿Cuáles son los dos caminos y cuándo toma cada uno?',
      built: (p) => blocksOf(p, 'a_ifelse').some((b) => asks(b.inputs.C) && !(b.inputs.C?.type === 'v_gt' && numField(b.inputs.C, 'B') === 10) && b.body.length > 0 && b.elseBody.length > 0 && same(b.body) !== same(b.elseBody)),
      solve: (p) => { spriteOf(p, 'chispa').scripts[0].body[3].body.push(ifElse(gt(score(), 5), [setSize(110)], [setSize(70)])); },
    }),
    card({
      id: 'azar', icon: '🎲', label: 'Azar', sprite: 'rayo',
      title: 'Que algo sea al azar',
      aim: 'Que los {rayo} salgan en tiempos distintos cada vez',
      how: [{ t: 'Poné [v_random] en el hueco de [a_wait], donde está el **2.5**', on: 'v_random' }, { t: 'Tocá **▶** y mirá cuándo salen los {rayo}', on: 'try' }],
      demo: SPAWN(),
      example: [{ sprite: 'rayo', scripts: [onFlag(hide(), forever(createClone(), wait(randomBetween(1, 5))))] }],
      values: [{ type: 'v_random', into: 'a_wait', input: 'N' }],
      concept: 'Azar: el juego es distinto cada vez.', ask: '¿Qué cosa decide la computadora al azar?',
      built: (p) => blocksOf(p, 'v_random').length > blocksOf(base, 'v_random').length,
      solve: (p) => { firstBlock(p, 'rayo', 'a_wait').inputs.N = randomBetween(1, 5); },
    }),
    card({
      id: 'nombre', icon: '🙋', label: 'Tu nombre', sprite: 'chispa',
      title: 'Que te pregunte el nombre',
      aim: 'Que {chispa} te pregunte cómo te llamás y te salude',
      how: [{ t: 'Poné [a_ask] arriba del [a_sayfor], justo abajo de [a_flag]', on: 'a_ask' }, { t: 'Poné [v_answer] en el hueco de [a_sayfor], donde está el texto', on: 'v_answer' }, { t: 'Tocá **▶**, escribí tu nombre y leé cómo te saluda {chispa}', on: 'try' }],
      demo: onFlag(ask('¿Cómo te llamás?'), sayFor('¡Hola!', 2)),
      example: [{ sprite: 'chispa', scripts: [onFlag(ask('¿Cómo te llamás?'), sayFor(join('¡Hola, ', answer()), 2))] }],
      values: [{ type: 'v_answer', into: 'a_sayfor', input: 'T' }],
      concept: 'Entrada y salida: el programa pregunta y usa la respuesta.', ask: '¿Dónde queda guardado lo que escribís?',
      built: (p) => blocksOf(p, 'a_ask').length > 0 && blocksOf(p, 'v_answer').length > 0,
      solve: (p) => addTo(p, 'chispa', onFlag(ask('¿Cómo te llamás?'), sayFor(join('¡Hola, ', answer()), 2))),
    }),
    card({
      id: 'corazon', icon: '💗', label: 'Corazón', newSprite: true, point: 'add-sprite',
      title: 'Un corazón que da vidas',
      aim: 'Que {chispa} gane una vida al tocar un personaje nuevo',
      how: [{ t: 'Tocá **+ Agregar** y sumá un personaje', on: 'add' }, { t: 'Traé [a_touching] a un lugar vacío', on: 'a_touching' }, { t: 'En [a_touching], elegí a {chispa}', on: 'tune' }, { t: 'Poné [a_changevar] abajo de [a_touching]', on: 'a_changevar' }, { t: 'Tocá **▶** y llevá a {chispa} hasta el personaje nuevo: ¡suma una vida!', on: 'try' }],
      demo: onTouching('chispa', changeVar('vidas', 1)),
      example: [{ sprite: 'Nuevo', scripts: [onTouching('chispa', changeVar('vidas', 1), hide(), wait(5), goTo(0, randomBetween(-100, 100)), show())] }],
      tune: { type: 'a_touching', field: 'T', when: (b) => b.fields.T !== 'chispa' },
      concept: 'Variables y reglas: tocar algo cambia un valor.', ask: '¿Qué le pasa a la variable vidas?',
      built: (p) => blocksOf(p, 'a_changevar').some((b) => b.fields.NAME === 'vidas' && valueOf(b) > 0),
      solve: (p) => addSprite(p, 'heart', onTouching('chispa', changeVar('vidas', 1))),
    }),
  ],
});
