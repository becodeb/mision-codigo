/** Equipo Bosque: Nova junta estrellas con el teclado. Bloques con texto: teclas, puntos y «cuando toque a». */
import {
  addScore, backdrop, changeX, changeY, glide, goTo, goToRandom, jump, onClick, onFlag, onKey, onPoints, onTouching, project, repeat, sayFor, setScore, sound, sprite, win,
} from '../../language/ir.ts';
import { blocksForLevel, type BlockType } from '../../language/catalog.ts';
import type { Block } from '../../language/ir.ts';
import { numField } from '../checks.ts';
import type { Pillar } from '../types.ts';
import { addSprite, addTo, blocksOf, card, count, differs, firstBlock, inside, lookCards, newSprites, numbers, scriptsWith, setNumber, showcaseGame, winMark } from './kit.ts';

const STEPS: BlockType[] = ['a_changex', 'a_changey', 'a_move'];
const ARROWS: [string, string, () => Block][] = [
  ['ArrowRight', 'a la derecha', () => changeX(12)],
  ['ArrowLeft', 'a la izquierda', () => changeX(-12)],
  ['ArrowUp', 'para arriba', () => changeY(12)],
  ['ArrowDown', 'para abajo', () => changeY(-12)],
];
const COLLECT = () => onTouching('nova', addScore(1), sound('magia'), goToRandom());
const WIN = () => onPoints(10, sound('fanfarria'), win());

const base = project('espacio', [
  sprite('meteorito', 'rock', [
    onFlag(goTo(200, 60), repeat(100, glide(4, -200, 60), glide(4, 200, 60))),
    onTouching('nova', addScore(-1), sound('explosion')),
  ], { x: 200, y: 60, name: 'Meteorito' }),
  sprite('estrella', 'star', [COLLECT(), onFlag(setScore(0))], { x: 90, y: -90, name: 'Estrella' }),
  sprite('nova', 'nova', [
    onKey('ArrowRight', changeX(12)),
    onKey('ArrowLeft', changeX(-12)),
    onKey('ArrowUp', changeY(12)),
    onKey('ArrowDown', changeY(-12)),
    onFlag(sayFor('¡A buscar estrellas!', 2)),
    WIN(),
  ], { x: -150, y: -110, size: 75, name: 'Nova' }),
]);

export const NOVA_EN_EL_ESPACIO = showcaseGame({
  id: 'muestra-nova', level: 3, title: 'Nova en el espacio', cover: 'nova',
  pitch: 'Juntá 10 estrellas y esquivá el meteorito.',
  setup: base,
  toolbox: blocksForLevel(3),
  play: [
    { icon: '⭐', text: 'Juntá 10 estrellas para ganar.' },
    { icon: '☄️', text: 'Si te toca el meteorito, perdés un punto.' },
  ],
  goal: (p) => `Juntá ${winMark(p)}{estrella} y esquivá {meteorito}`,
  pillars: [
    ...ARROWS.map(([key, where, step]): Pillar => ({
      id: `mover-${key}`, broken: `{nova} ya no va ${where}`,
      ok: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K === key).some((s) => s.body.length > 0),
      restore: { sprite: 'nova', script: onKey(key, step()) },
    })),
    { id: 'sumar', broken: 'Ya no se suman puntos', ok: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') > 0), restore: { sprite: 'estrella', script: COLLECT() } },
    { id: 'ganar', broken: 'Ya no se puede ganar', ok: (p) => scriptsWith(p, 'a_points').concat(scriptsWith(p, 'a_touching')).some((s) => count(inside(s), 'a_win') > 0), restore: { sprite: 'nova', script: WIN() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'nova', talker: 'nova', sounder: 'estrella', picture: false, sayBlock: 'a_sayfor', newPlace: 'mar', newArt: 'pulpi' }),
    card({
      id: 'velocidad', icon: '💨', label: 'Velocidad', sprite: 'nova',
      title: 'Cambiá la velocidad',
      how: [{ t: 'Cambiá el **12**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_changex', caption: 'Tocá este número y cambialo.' },
      concept: 'Coordenadas: moverse es cambiar los números de x y de y.', ask: '¿Qué pasa si ponés un número más grande?',
      built: (p) => scriptsWith(p, 'a_key').some((s) => inside(s).some((b) => STEPS.includes(b.type) && Number.isFinite(numField(b, 'N')) && Math.abs(numField(b, 'N')) !== 12)),
      solve: (p) => { setNumber(firstBlock(p, 'nova', 'a_changex'), 'N', 20); },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Meta', sprite: 'nova',
      title: 'Cambiá la meta',
      how: [{ t: 'Cambiá el **10**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_points', caption: 'Tocá el 10 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0 && numField(s.hat, 'N') !== 10),
      solve: (p) => { firstBlock(p, 'nova', 'a_points').fields.N = 5; },
    }),
    card({
      id: 'valor', icon: '💰', label: 'Más puntos', sprite: 'estrella',
      title: 'Que valga más puntos',
      how: [{ t: 'Cambiá el **1**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_addscore', caption: 'Tocá el 1 y poné un número más grande.' },
      concept: 'Puntos: un número que el juego recuerda.', ask: '¿Dónde dice cuántos puntos suma?',
      built: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') >= 2),
      solve: (p) => { setNumber(firstBlock(p, 'estrella', 'a_addscore'), 'N', 3); },
    }),
    card({
      id: 'poder', icon: '⚡', label: 'Poder', sprite: 'nova',
      title: 'Un poder secreto',
      how: [{ t: 'Poné [a_key]', on: 'a_key' }, { t: 'Elegí **espacio**', on: 'tune' }, { t: 'Poné [a_jump]', on: 'a_jump' }, { t: 'Apretá **espacio**', on: 'try' }], tap: 'stage',
      demo: onKey(' ', jump()),
      tune: { type: 'a_key', field: 'K', when: (b, _p, all) => b.fields.K !== ' ' && all.filter((x) => x.type === 'a_key' && x.fields.K === b.fields.K).length > 1 },
      concept: 'Eventos: cada tecla despierta sus propios bloques.', ask: '¿Qué hace la barra espaciadora y cómo lo programaste?',
      built: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K === ' ').some((s) => s.body.length > 0),
      solve: (p) => addTo(p, 'nova', onKey(' ', jump())),
    }),
    card({
      id: 'meteorito', icon: '☄️', label: 'Peligro', sprite: 'meteorito',
      title: 'Cambiá el meteorito',
      how: [{ t: 'Cambiá el **4**', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'a_glide', caption: 'Tocá el 4: con menos segundos va más rápido.' },
      concept: 'Coordenadas y tiempo: decirle a dónde ir y cuánto tardar.', ask: '¿Por dónde pasa y dónde está escrito?',
      built: (p) => (['T', 'X', 'Y'] as const).some((k) => differs(numbers(p, 'a_glide', k), numbers(base, 'a_glide', k))),
      solve: (p) => { setNumber(firstBlock(p, 'meteorito', 'a_glide'), 'T', 2); },
    }),
    card({
      id: 'mundo', icon: '🌍', label: 'Otro mundo', sprite: 'nova',
      title: 'El segundo mundo',
      how: [{ t: 'Poné [a_points]', on: 'a_points' }, { t: 'Poné [a_backdrop]', on: 'a_backdrop' }, { t: 'Elegí otro lugar', on: 'tune' }, { t: 'Probá **▶**', on: 'try' }],
      demo: onPoints(5, backdrop('mar')),
      example: [{ sprite: 'nova', scripts: [onPoints(5, backdrop('mar'))] }],
      tune: { type: 'a_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Condiciones: el juego cambia cuando llegás a cierto puntaje.', ask: '¿Qué tiene que pasar para cambiar de mundo?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'a_backdrop' && b.fields.B !== p.backdrop))),
      solve: (p) => addTo(p, 'nova', onPoints(5, backdrop(p.backdrop === 'nieve' ? 'mar' : 'nieve'))),
    }),
    card({
      id: 'clic', icon: '👆', label: 'Clic', sprite: 'nova',
      title: 'Que reaccione al clic',
      how: [{ t: 'Poné [a_click]', on: 'a_click' }, { t: 'Poné [a_sayfor]', on: 'a_sayfor' }, { t: 'Tocá a {nova}', on: 'try' }], tap: 'nova',
      demo: onClick(sayFor('¡Hola!', 2)),
      concept: 'Eventos: un clic también despierta bloques.', ask: '¿Qué pasa si le hago clic?',
      built: (p) => scriptsWith(p, 'a_click').some((s) => s.body.length > 0),
      solve: (p) => addTo(p, 'nova', onClick(jump())),
    }),
    card({
      id: 'premio', icon: '🎁', label: 'Premio', newSprite: true, point: 'add-sprite',
      title: 'Un premio nuevo',
      how: [{ t: 'Tocá **+ Agregar**', on: 'add' }, { t: 'Poné [a_touching]', on: 'a_touching' }, { t: 'Elegí a {nova}', on: 'tune' }, { t: 'Poné [a_addscore]', on: 'a_addscore' }, { t: 'Probá **▶**', on: 'try' }],
      tune: { type: 'a_touching', field: 'T', when: (b) => b.fields.T !== 'nova' },
      demo: onTouching('nova', addScore(1), goToRandom()),
      example: [{ sprite: 'Nuevo', scripts: [onTouching('nova', addScore(2), goToRandom())] }],
      concept: 'Reglas: qué pasa cuando dos cosas se tocan.', ask: '¿Qué tiene que tocar para sumar esos puntos?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => count(inside(sc), 'a_addscore') > 0)),
      solve: (p) => addSprite(p, 'coin', onTouching('nova', addScore(1), goToRandom())),
    }),
  ],
});
