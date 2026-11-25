/** Equipo Camino: Toby cruza un camino de piedras hasta el tesoro. Bloques con texto: teclas, coordenadas, mensajes y «cuando toque a». */
import {
  addScore, backdrop, changeX, changeY, glide, goTo, jump, onFlag, onKey, onPoints, onReceive, onTouching, project, repeat, sayFor, send, setScore, sound, sprite, win,
} from '../../language/ir.ts';
import type { Block, ProjectProgram } from '../../language/ir.ts';
import { blocksForLevel, type BlockType } from '../../language/catalog.ts';
import { numField } from '../checks.ts';
import type { Pillar } from '../types.ts';
import { addSprite, addTo, blocksOf, card, count, differs, firstBlock, inside, lookCards, newSprites, numbers, scriptsWith, setNumber, showcaseGame, spriteOf, winMark } from './kit.ts';

/** «tu turno»: whoever sends it puts Toby back where he started. */
const BACK = 'm1';
const START = { x: -205, y: -60 };
const STEPS: BlockType[] = ['a_changex', 'a_changey'];
const ARROWS: [string, string, () => Block][] = [
  ['ArrowRight', 'a la derecha', () => changeX(10)],
  ['ArrowLeft', 'a la izquierda', () => changeX(-10)],
  ['ArrowUp', 'para arriba', () => changeY(10)],
  ['ArrowDown', 'para abajo', () => changeY(-10)],
];
const HURT = () => onTouching('toby', sound('explosion'), send(BACK));
const GOAL = () => onTouching('toby', addScore(1), sound('campana'), send(BACK));
const HOME = () => onReceive(BACK, goTo(START.x, START.y));
const WIN = () => onPoints(3, sound('fanfarria'), win());
/** Sube y baja por una columna, de un lado a otro, sin parar. */
const bob = (x: number, from: number, to: number, secs: number) => onFlag(repeat(200, glide(secs, x, to), glide(secs, x, from)));

const base = project('selva', [
  sprite('toby', 'toby', [
    ...ARROWS.map(([key, , step]) => onKey(key, step())),
    onFlag(setScore(0), sayFor('¡A cruzar!', 2)),
    HOME(),
    WIN(),
  ], { x: START.x, y: START.y, size: 70, name: 'Toby' }),
  sprite('tesoro', 'treasure', [GOAL()], { x: 188, y: -60, size: 130, name: 'Tesoro' }),
  sprite('piedra', 'rock', [bob(-120, -140, 60, 1.6), HURT()], { x: -120, y: -140, size: 110, name: 'Piedra' }),
  sprite('piedra2', 'rock', [HURT()], { x: -5, y: -30, size: 110, name: 'Piedra' }),
  sprite('piedra3', 'rock', [HURT()], { x: -5, y: 105, size: 110, name: 'Piedra' }),
  sprite('piedra4', 'rock', [bob(110, 40, -140, 1.1), HURT()], { x: 110, y: 40, size: 110, name: 'Piedra' }),
]);

/** What the rocks do when Toby touches them: any rock that sends a message. */
const sendsBack = (p: ProjectProgram, skip: string[] = ['toby', 'tesoro']): boolean =>
  p.sprites.some((s) => !skip.includes(s.id) && s.scripts.some((sc) => sc.hat.type === 'a_touching' && count(inside(sc), 'a_send') > 0));
const CHEER: BlockType[] = ['a_jump', 'a_say', 'a_sayfor', 'a_thinkfor', 'a_changesize', 'a_setsize', 'a_note', 'a_backdrop'];
const MOVES: BlockType[] = ['a_goto', 'a_glide', 'a_jump', 'a_changex', 'a_changey', 'a_move', 'a_random'];

export const EL_CAMINO_DE_PIEDRAS = showcaseGame({
  id: 'muestra-camino', level: 3, order: 2, title: 'El camino de piedras', cover: 'toby',
  pitch: 'Cruzá el camino hasta el tesoro sin tocar las piedras.',
  setup: base,
  toolbox: blocksForLevel(3),
  play: [
    { icon: '⌨️', text: 'Mové a Toby con las flechas.' },
    { icon: '🪨', text: 'Si tocás una piedra, volvés al principio.' },
    { icon: '🏆', text: 'Llegá 3 veces al tesoro para ganar.' },
  ],
  goal: (p) => `Llevá a {toby} hasta {tesoro} ${winMark(p) ? `${winMark(p)}veces ` : ''}sin tocar {piedra}`,
  pillars: [
    ...ARROWS.map(([key, where, step]): Pillar => ({
      id: `mover-${key}`, broken: `{toby} ya no va ${where}`,
      ok: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K === key).some((s) => s.body.length > 0),
      restore: { sprite: 'toby', script: onKey(key, step()) },
    })),
    { id: 'piedras', broken: 'Las piedras ya no te mandan al principio', ok: (p) => sendsBack(p), restore: { sprite: 'piedra', script: HURT() } },
    { id: 'volver', broken: '{toby} ya no vuelve al principio', ok: (p) => scriptsWith(p, 'a_recv').some((s) => count(inside(s), 'a_goto') > 0), restore: { sprite: 'toby', script: HOME() } },
    { id: 'sumar', broken: 'Llegar al tesoro ya no suma puntos', ok: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') > 0), restore: { sprite: 'tesoro', script: GOAL() } },
    { id: 'ganar', broken: 'Ya no se puede ganar', ok: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0), restore: { sprite: 'toby', script: WIN() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'toby', talker: 'toby', sounder: 'piedra', picture: false, sayBlock: 'a_sayfor', newPlace: 'mar', newArt: 'michi' }),
    card({
      id: 'velocidad', icon: '💨', label: 'Velocidad', sprite: 'toby',
      title: 'Cambiá la velocidad',
      how: [{ t: 'Cambiá el **10**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_changex', caption: 'Tocá este número y cambialo.' },
      concept: 'Coordenadas: moverse es cambiar los números de x y de y.', ask: '¿Qué pasa si ponés un número más grande?',
      built: (p) => scriptsWith(p, 'a_key').some((s) => inside(s).some((b) => STEPS.includes(b.type) && Number.isFinite(numField(b, 'N')) && Math.abs(numField(b, 'N')) !== 10)),
      solve: (p) => { setNumber(firstBlock(p, 'toby', 'a_changex'), 'N', 14); },
    }),
    card({
      id: 'otra', icon: '➕', label: 'Otra piedra', newSprite: true, point: 'add-sprite',
      title: 'Una piedra más en el camino',
      how: [{ t: 'Tocá **+ Agregar**', on: 'add' }, { t: 'Poné [a_touching]', on: 'a_touching' }, { t: 'Elegí a {toby}', on: 'tune' }, { t: 'Poné [a_send]', on: 'a_send' }, { t: 'Probá **▶**', on: 'try' }],
      tune: { type: 'a_touching', field: 'T', when: (b) => b.fields.T !== 'toby' },
      demo: onTouching('toby', send(BACK)),
      example: [{ sprite: 'Nuevo', scripts: [onTouching('toby', sound('explosion'), send(BACK))] }],
      concept: 'Mensajes: un personaje avisa y otro hace caso.', ask: '¿Qué le avisa tu piedra a Toby cuando la toca?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => sc.hat.type === 'a_touching' && sc.hat.fields.T === 'toby' && inside(sc).some((b) => b.type === 'a_send' && b.fields.M === BACK))),
      solve: (p) => addSprite(p, 'rock', onTouching('toby', send(BACK))),
    }),
    card({
      id: 'distinta', icon: '🎢', label: 'Se mueve', sprite: 'piedra',
      title: 'Una piedra que se mueve distinto',
      how: [{ t: 'Cambiá el **1.6**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_glide', caption: 'Tocá un número: con menos segundos va más rápido.' },
      concept: 'Coordenadas y tiempo: decirle a dónde ir y cuánto tardar.', ask: '¿Por dónde pasa la piedra y dónde está escrito?',
      built: (p) => (['T', 'X', 'Y'] as const).some((k) => differs(numbers(p, 'a_glide', k), numbers(base, 'a_glide', k))),
      solve: (p) => { setNumber(firstBlock(p, 'piedra', 'a_glide'), 'T', 0.8); },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Meta', sprite: 'toby',
      title: 'Cambiá la meta',
      how: [{ t: 'Cambiá el **3**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_points', caption: 'Tocá el 3 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0 && numField(s.hat, 'N') !== 3),
      solve: (p) => { firstBlock(p, 'toby', 'a_points').fields.N = 2; },
    }),
    card({
      id: 'mundo', icon: '🌍', label: 'Otro mundo', sprite: 'toby',
      title: 'El segundo mundo',
      how: [{ t: 'Poné [a_points]', on: 'a_points' }, { t: 'Poné [a_backdrop]', on: 'a_backdrop' }, { t: 'Elegí otro lugar', on: 'tune' }, { t: 'Probá **▶**', on: 'try' }],
      demo: onPoints(2, backdrop('nieve')),
      example: [{ sprite: 'toby', scripts: [onPoints(2, backdrop('nieve'))] }],
      tune: { type: 'a_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Condiciones: el juego cambia cuando llegás a cierto puntaje.', ask: '¿Qué tiene que pasar para cambiar de mundo?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'a_backdrop' && b.fields.B !== p.backdrop))),
      solve: (p) => addTo(p, 'toby', onPoints(2, backdrop(p.backdrop === 'nieve' ? 'mar' : 'nieve'))),
    }),
    card({
      id: 'atajo', icon: '⚡', label: 'Atajo', sprite: 'toby',
      title: 'Un atajo con una tecla',
      how: [{ t: 'Poné [a_key]', on: 'a_key' }, { t: 'Elegí **espacio**', on: 'tune' }, { t: 'Poné [a_goto]', on: 'a_goto' }, { t: 'Apretá **espacio**', on: 'try' }], tap: 'stage',
      demo: onKey(' ', goTo(60, -60)),
      tune: { type: 'a_key', field: 'K', when: (b, _p, all) => b.fields.K !== ' ' && all.filter((x) => x.type === 'a_key' && x.fields.K === b.fields.K).length > 1 },
      concept: 'Coordenadas: ir a un lugar es decirle su x y su y.', ask: '¿A qué lugar te lleva la tecla y cómo lo sabés?',
      built: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K === ' ').some((s) => count(inside(s), ...MOVES) > 0),
      solve: (p) => addTo(p, 'toby', onKey(' ', goTo(60, -60))),
    }),
    card({
      id: 'festejo', icon: '🎉', label: 'Festejo', sprite: 'tesoro',
      title: 'Un festejo en el tesoro',
      how: [{ t: 'Poné [a_jump]', on: 'a_jump' }, { t: 'Probá **▶**', on: 'try' }],
      demo: onTouching('toby', addScore(1), sound('campana'), jump(), send(BACK)),
      concept: 'Secuencia: las órdenes se cumplen una abajo de la otra.', ask: '¿Qué hace el tesoro cuando llegás?',
      built: (p) => spriteOf(p, 'tesoro').scripts.some((sc) => count(inside(sc), ...CHEER) > 0),
      solve: (p) => { spriteOf(p, 'tesoro').scripts[0].body.splice(2, 0, jump()); },
    }),
  ],
});
