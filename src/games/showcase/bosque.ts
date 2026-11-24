/** Equipo Bosque: Nova junta estrellas con el teclado. Bloques con texto: teclas, puntos y «cuando toque a». */
import {
  addScore, backdrop, changeX, changeY, glide, goTo, goToRandom, jump, onClick, onFlag, onKey, onPoints, onTouching, project, repeat, sayFor, setScore, sound, sprite, win,
} from '../../language/ir.ts';
import { blocksForLevel, type BlockType } from '../../language/catalog.ts';
import type { Block } from '../../language/ir.ts';
import { numField } from '../checks.ts';
import type { Pillar } from '../types.ts';
import { addSprite, addTo, blocksOf, card, count, differs, firstBlock, inside, lookCards, newSprites, numbers, scriptsWith, setNumber, showcaseGame } from './kit.ts';

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
    { icon: '⌨️', text: 'Movete con las flechas del teclado.' },
    { icon: '⭐', text: 'Juntá 10 estrellas para ganar.' },
    { icon: '☄️', text: 'Si te toca el meteorito, perdés un punto.' },
  ],
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
      id: 'velocidad', icon: '💨', label: 'Más rápido', sprite: 'nova',
      title: 'Cambiá la velocidad', text: 'El número de «cambiar x» dice **cuánto avanza** {nova} cada vez.',
      how: ['En {nova}, buscá «cambiar x en 12».', 'Tocá el **12** y poné otro número.', 'Jugá. Si te gusta, cambiá también las otras flechas.'],
      block: { type: 'a_changex', caption: 'Tocá este número y cambialo.' },
      concept: 'Coordenadas: moverse es cambiar los números de x y de y.', ask: '¿Qué pasa si ponés un número más grande?',
      built: (p) => scriptsWith(p, 'a_key').some((s) => inside(s).some((b) => STEPS.includes(b.type) && Number.isFinite(numField(b, 'N')) && Math.abs(numField(b, 'N')) !== 12)),
      solve: (p) => { setNumber(firstBlock(p, 'nova', 'a_changex'), 'N', 20); },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Cambiar la meta', sprite: 'nova',
      title: 'Cambiá la meta', text: '¿Con cuántos puntos se gana? **Vos decidís.**',
      how: ['En {nova}, buscá «cuando los puntos lleguen a 10».', 'Cambiá el **10** por otro número.', 'Probá el juego.'],
      block: { type: 'a_points', caption: 'Tocá el 10 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0 && numField(s.hat, 'N') !== 10),
      solve: (p) => { firstBlock(p, 'nova', 'a_points').fields.N = 5; },
    }),
    card({
      id: 'valor', icon: '💰', label: 'Que valga más', sprite: 'estrella',
      title: 'Que valga más puntos', text: 'Hacé que cada estrella sume **2 puntos o más**.',
      how: ['En {estrella}, buscá «sumar 1 a puntos».', 'Cambiá el **1** por un número más grande.', 'Probá el juego.'],
      block: { type: 'a_addscore', caption: 'Tocá el 1 y poné un número más grande.' },
      concept: 'Puntos: un número que el juego recuerda.', ask: '¿Dónde dice cuántos puntos suma?',
      built: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') >= 2),
      solve: (p) => { setNumber(firstBlock(p, 'estrella', 'a_addscore'), 'N', 3); },
    }),
    card({
      id: 'poder', icon: '⚡', label: 'Un poder con espacio', sprite: 'nova',
      title: 'Un poder secreto', text: 'Inventá un poder: que pase algo **al apretar la barra espaciadora**.',
      how: ['En {nova}, agregá otro «al presionar tecla» y elegí **espacio**.', 'Abajo poné el poder: «saltar», «ir a posición aleatoria», lo que quieras.', 'Apretá espacio.'],
      demo: onKey(' ', jump()),
      concept: 'Eventos: cada tecla despierta sus propios bloques.', ask: '¿Qué hace la barra espaciadora y cómo lo programaste?',
      built: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K === ' ').some((s) => s.body.length > 0),
      solve: (p) => addTo(p, 'nova', onKey(' ', jump())),
    }),
    card({
      id: 'meteorito', icon: '☄️', label: 'Cambiar el peligro', sprite: 'meteorito',
      title: 'Cambiá el meteorito', text: '«Deslizar» lleva a {meteorito} de un lado al otro. Cambiá **cuánto tarda** o **por dónde pasa**.',
      how: ['En {meteorito}, buscá «deslizar en 4 segs».', 'Cambiá el **4** (menos segundos es más rápido) o los números de x e y.', 'Tocá Empezar.'],
      block: { type: 'a_glide', caption: 'Tocá el 4: con menos segundos va más rápido.' },
      concept: 'Coordenadas y tiempo: decirle a dónde ir y cuánto tardar.', ask: '¿Por dónde pasa y dónde está escrito?',
      built: (p) => (['T', 'X', 'Y'] as const).some((k) => differs(numbers(p, 'a_glide', k), numbers(base, 'a_glide', k))),
      solve: (p) => { setNumber(firstBlock(p, 'meteorito', 'a_glide'), 'T', 2); },
    }),
    card({
      id: 'mundo', icon: '🌍', label: 'Pasar a otro mundo', sprite: 'nova',
      title: 'El segundo mundo', text: 'Que al llegar a 5 puntos **el juego cambie de lugar**.',
      how: ['En {nova}, poné otro «cuando los puntos lleguen a 5».', 'Abajo, «cambiar escenario a» y **elegí otro lugar**.', 'Jugá hasta llegar a 5.'],
      demo: onPoints(5, backdrop('mar')),
      example: [{ sprite: 'nova', scripts: [onPoints(5, backdrop('mar'))] }],
      concept: 'Condiciones: el juego cambia cuando llegás a cierto puntaje.', ask: '¿Qué tiene que pasar para cambiar de mundo?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'a_backdrop' && b.fields.B !== p.backdrop))),
      solve: (p) => addTo(p, 'nova', onPoints(5, backdrop(p.backdrop === 'nieve' ? 'mar' : 'nieve'))),
    }),
    card({
      id: 'clic', icon: '👆', label: 'Que reaccione al clic', sprite: 'nova',
      title: 'Que reaccione al clic', text: 'Que un personaje **haga algo cuando le hacés clic**.',
      how: ['En {nova}, poné «al hacer clic en este personaje».', 'Abajo, lo que quieras: decir, saltar, un sonido.', 'Hacele clic en el escenario.'],
      demo: onClick(sayFor('¡Hola!', 2)),
      concept: 'Eventos: un clic también despierta bloques.', ask: '¿Qué pasa si le hago clic?',
      built: (p) => scriptsWith(p, 'a_click').some((s) => s.body.length > 0),
      solve: (p) => addTo(p, 'nova', onClick(jump())),
    }),
    card({
      id: 'premio', icon: '🎁', label: 'Sumar un premio', newSprite: true, point: 'add-sprite',
      title: 'Un premio nuevo', text: 'Agregá otro objeto que **también dé puntos** cuando {nova} lo toca.',
      how: ['Tocá **Agregar** y elegí un objeto.', 'Poné «cuando toque a {nova}».', 'Abajo, «sumar … a puntos». Podés mirar cómo lo hace {estrella}.'],
      demo: onTouching('nova', addScore(1), goToRandom()),
      example: [{ sprite: 'Nuevo', scripts: [onTouching('nova', addScore(2), goToRandom())] }],
      concept: 'Reglas: qué pasa cuando dos cosas se tocan.', ask: '¿Qué tiene que tocar para sumar esos puntos?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => count(inside(sc), 'a_addscore') > 0)),
      solve: (p) => addSprite(p, 'coin', onTouching('nova', addScore(1), goToRandom())),
    }),
  ],
});
