/**
 * Equipo Salto: Tomi corre en el lugar y salta lo que viene. Un solo botón, la barra espaciadora.
 * Bloques con texto: «por siempre», «si», «cuando toque a», perder y puntos.
 */
import {
  addScore, backdrop, face, forever, goTo, ifThen, jump, keyPressed, lose, onFlag, onKey, onPoints, onTouching, project, repeat, sayFor, setScore, setSize, show, sound, sprite, wait, win,
  changeX,
} from '../../language/ir.ts';
import { blocksForLevel, type BlockType } from '../../language/catalog.ts';
import type { ProjectProgram } from '../../language/ir.ts';
import { blocksInList, numField } from '../checks.ts';
import { blocksOf, card, count, differs, firstBlock, inside, lookCards, numbers, scriptsWith, setNumber, showcaseGame, spriteOf, winMark } from './kit.ts';

/** El corredor pisa un poco más arriba que las piedras: las ve venir de frente y el salto le alcanza para pasarlas. */
const GROUND = -110;
const RUNNER = -95;
/** Piedra tras piedra, una lenta y una más rápida: se mueve de a poquito por vuelta del «por siempre». */
const ROCKS = () => onFlag(wait(1.5), forever(goTo(228, GROUND), repeat(106, changeX(-4)), addScore(1), goTo(228, GROUND), repeat(70, changeX(-6)), addScore(1)));
const HIT = () => onTouching('tomi', sound('explosion'), lose());
const BOLT = () => onFlag(wait(1), forever(goTo(228, -25), repeat(70, changeX(-6)), wait(1)));
const JUMP = () => onKey(' ', jump());
const WIN = () => onPoints(10, sound('fanfarria'), win());
const RUN = () => onFlag(forever(face('feliz'), wait(0.2), face('risa'), wait(0.2)));
const TRAVEL: BlockType[] = ['a_changex', 'a_glide', 'a_goto', 'a_move'];

const base = project('parque', [
  sprite('tomi', 'tomi', [
    JUMP(),
    onFlag(setScore(0), sayFor('¡A correr!', 2)),
    RUN(),
    WIN(),
  ], { x: -150, y: RUNNER, size: 80, name: 'Tomi' }),
  sprite('piedra', 'rock', [ROCKS(), HIT()], { x: 228, y: GROUND, size: 90, name: 'Piedras' }),
  sprite('rayo', 'bolt', [BOLT(), onTouching('tomi', sound('explosion'), lose())], { x: 228, y: -25, size: 100, visible: false, name: 'Rayo' }),
]);

const flies = (p: ProjectProgram, id: string): boolean => spriteOf(p, id).scripts.some((s) => s.hat.type === 'a_flag' && count(inside(s), ...TRAVEL) > 0);

export const SALTA_SIN_PARAR = showcaseGame({
  id: 'muestra-salto', level: 4, order: 2, title: 'Saltá sin parar', cover: 'tomi',
  pitch: 'Apretá la barra espaciadora y saltá las piedras que vienen.',
  setup: base,
  toolbox: blocksForLevel(4),
  play: [
    { icon: '⌨️', text: 'Apretá la barra espaciadora: Tomi salta.' },
    { icon: '🪨', text: 'Cada piedra que pasa de largo es un punto.' },
    { icon: '💥', text: 'Si una piedra te toca, perdés.' },
  ],
  goal: (p) => `Saltá ${winMark(p)}{piedra}`,
  pillars: [
    { id: 'saltar', broken: '{tomi} ya no salta con la barra espaciadora', ok: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K === ' ').some((s) => count(inside(s), 'a_jump') > 0), restore: { sprite: 'tomi', script: JUMP() } },
    { id: 'vienen', broken: '{piedra} ya no viene', ok: (p) => flies(p, 'piedra'), restore: { sprite: 'piedra', script: ROCKS() } },
    { id: 'sumar', broken: 'Ya no se suman puntos', ok: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') > 0), restore: { sprite: 'piedra', script: ROCKS() } },
    { id: 'perder', broken: 'Ya no se pierde al tocar una piedra', ok: (p) => scriptsWith(p, 'a_touching').some((s) => count(inside(s), 'a_lose') > 0), restore: { sprite: 'piedra', script: HIT() } },
    { id: 'ganar', broken: 'Ya no se puede ganar', ok: (p) => blocksOf(p, 'a_win').length > 0 && p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'a_win') > 0)), restore: { sprite: 'tomi', script: WIN() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'tomi', talker: 'tomi', sounder: 'piedra', picture: false, sayBlock: 'a_sayfor', newPlace: 'playa', newArt: 'lumi' }),
    card({
      id: 'velocidad', icon: '💨', label: 'Velocidad', sprite: 'piedra',
      title: 'Cambiá la velocidad de las piedras',
      how: [{ t: 'Cambiá el **-4**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_changex', caption: 'Tocá el -4: con un número más chico va más lento.' },
      concept: 'Coordenadas: cuanto más cambia la x por vuelta, más rápido va.', ask: '¿Qué número cambiaste y qué pasó?',
      built: (p) => differs(numbers(p, 'a_changex', 'N'), numbers(base, 'a_changex', 'N')),
      solve: (p) => { setNumber(firstBlock(p, 'piedra', 'a_changex'), 'N', -3); },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Meta', sprite: 'tomi',
      title: 'Cambiá la meta',
      how: [{ t: 'Cambiá el **10**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_points', caption: 'Tocá el 10 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0 && numField(s.hat, 'N') !== 10),
      solve: (p) => { firstBlock(p, 'tomi', 'a_points').fields.N = 5; },
    }),
    card({
      id: 'valor', icon: '💰', label: 'Más puntos', sprite: 'piedra',
      title: 'Que cada piedra valga más',
      how: [{ t: 'Cambiá el **1**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_addscore', caption: 'Tocá el 1 y poné un número más grande.' },
      concept: 'Puntos: un número que el juego recuerda.', ask: '¿Dónde dice cuántos puntos suma cada piedra?',
      built: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') >= 2),
      solve: (p) => { setNumber(firstBlock(p, 'piedra', 'a_addscore'), 'N', 2); },
    }),
    card({
      id: 'tecla', icon: '🎹', label: 'Otra tecla', sprite: 'tomi',
      title: 'Saltar con otra tecla',
      how: [{ t: 'Poné [a_key]', on: 'a_key' }, { t: 'Poné [a_jump]', on: 'a_jump' }, { t: 'Apretá la tecla', on: 'try' }], tap: 'stage',
      demo: onKey('ArrowUp', jump()),
      concept: 'Eventos: cada tecla despierta sus propios bloques.', ask: '¿Qué tecla elegiste y cómo la programaste?',
      built: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K !== ' ').some((s) => count(inside(s), 'a_jump') > 0),
      solve: (p) => { spriteOf(p, 'tomi').scripts.push(onKey('ArrowUp', jump())); },
    }),
    card({
      id: 'rayo', icon: '⚡', label: 'Rayo', sprite: 'rayo',
      title: 'Que aparezca el rayo',
      how: [{ t: 'Poné [a_points]', on: 'a_points' }, { t: 'Poné [a_show]', on: 'a_show' }, { t: 'Probá **▶**', on: 'try' }],
      demo: onPoints(4, show()),
      example: [{ sprite: 'rayo', scripts: [onPoints(4, show())] }],
      concept: 'Condiciones: algo nuevo aparece cuando llegás a cierto puntaje.', ask: '¿Cuándo aparece el rayo y por qué no hay que saltarlo?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_show') > 0),
      solve: (p) => { spriteOf(p, 'rayo').scripts.push(onPoints(4, show())); },
    }),
    card({
      id: 'agachar', icon: '⬇️', label: 'Agacharse', sprite: 'tomi',
      title: 'Agacharse con la flecha',
      how: [{ t: 'Poné [a_forever]', on: 'a_forever' }, { t: 'Poné [a_if]', on: 'a_if' }, { t: 'Adentro [a_setsize]', on: 'a_setsize' }, { t: 'En el hueco [v_key]', on: 'v_key' }, { t: 'Probá **▶**', on: 'try' }], tap: 'stage',
      demo: onFlag(forever(setSize(100), ifThen(keyPressed('ArrowDown'), setSize(55)))),
      example: [{ sprite: 'tomi', scripts: [onFlag(forever(setSize(100), ifThen(keyPressed('ArrowDown'), setSize(55))))] }],
      values: [{ type: 'v_key', into: 'a_if', input: 'C' }],
      concept: 'Condicionales: hacer algo solo si se cumple una condición.', ask: '¿Cuál es la pregunta que se hace el programa?',
      built: (p) => blocksOf(p, 'a_if').some((b) => b.inputs.C?.type === 'v_key' && count(blocksInList(b.body), 'a_setsize', 'a_changesize') > 0),
      solve: (p) => { spriteOf(p, 'tomi').scripts.push(onFlag(forever(setSize(100), ifThen(keyPressed('ArrowDown'), setSize(55))))); },
    }),
    card({
      id: 'mundo', icon: '🌍', label: 'Nivel 2', sprite: 'tomi',
      title: 'El segundo nivel',
      how: [{ t: 'Poné [a_points]', on: 'a_points' }, { t: 'Poné [a_backdrop]', on: 'a_backdrop' }, { t: 'Elegí otro lugar', on: 'tune' }, { t: 'Probá **▶**', on: 'try' }],
      demo: onPoints(5, backdrop('ciudad')),
      example: [{ sprite: 'tomi', scripts: [onPoints(5, backdrop('ciudad'))] }],
      tune: { type: 'a_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Condiciones: el juego cambia cuando llegás a cierto puntaje.', ask: '¿Qué cambia en el segundo nivel?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'a_backdrop' && b.fields.B !== p.backdrop))),
      solve: (p) => { spriteOf(p, 'tomi').scripts.push(onPoints(5, backdrop(p.backdrop === 'ciudad' ? 'nieve' : 'ciudad'))); },
    }),
  ],
});
