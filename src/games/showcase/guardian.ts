/**
 * Equipo Guardián: bombas y rayos vuelan hacia el tesoro y hay que espantarlos con un clic antes de que lleguen.
 * Bloques con texto: «por siempre», deslizar, esconder, clic y «cuando toque a». Cada uno hace su vuelo solo: el clic
 * lo esconde hasta que le toque volver, así que no hay forma de sumar con uno que ya se fue.
 */
import {
  addScore, backdrop, forever, glide, goTo, goToRandom, hide, lose, onClick, onFlag, onPoints, onTouching, project, sayFor, setScore, show, sound, sprite, wait, win,
} from '../../language/ir.ts';
import type { Script } from '../../language/ir.ts';
import { blocksForLevel } from '../../language/catalog.ts';
import { numField } from '../checks.ts';
import { addSprite, blocksOf, card, count, differs, firstBlock, inside, lookCards, newSprites, numbers, scriptsWith, setNumber, showcaseGame, spriteOf, winMark } from './kit.ts';

/** Where the treasure stands: everything flies to this feet position. */
const HOME = { x: 0, y: -30 };
/** Each one comes from its own edge, at its own time, and takes about as long to arrive. */
const FOES: { id: string; art: string; name: string; x: number; y: number; start: number; secs: number }[] = [
  { id: 'bomba', art: 'bomb', name: 'Bomba', x: -225, y: -30, start: 1, secs: 3.4 },
  { id: 'rayo', art: 'bolt', name: 'Rayo', x: 0, y: 120, start: 2.2, secs: 2.8 },
  { id: 'bomba2', art: 'bomb', name: 'Bomba 2', x: 225, y: -30, start: 3.4, secs: 3.4 },
  { id: 'rayo2', art: 'bolt', name: 'Rayo 2', x: 0, y: -170, start: 4.6, secs: 2.4 },
];
const FLY = (f: (typeof FOES)[number]): Script =>
  onFlag(hide(), wait(f.start), forever(goTo(f.x, f.y), show(), glide(f.secs, HOME.x, HOME.y), hide(), wait(1.5)));
const SWAT = (): Script => onClick(addScore(1), sound('magia'), hide());
const ARRIVE = (): Script => onTouching('tesoro', addScore(-1), sound('explosion'), hide());
const WIN = (): Script => onPoints(15, sound('fanfarria'), win());

const base = project('ciudad', [
  sprite('tesoro', 'treasure', [onFlag(setScore(0), sayFor('¡Cuidame!', 2)), WIN()], { x: HOME.x, y: HOME.y, size: 130, name: 'Tesoro' }),
  ...FOES.map((f) => sprite(f.id, f.art, [FLY(f), SWAT(), ARRIVE()], { x: f.x, y: f.y, size: f.art === 'bomb' ? 150 : 130, name: f.name })),
]);

export const CUIDA_EL_TESORO = showcaseGame({
  id: 'muestra-guardian', level: 4, order: 3, title: 'Cuidá el tesoro', cover: 'treasure',
  pitch: 'Espantá con un clic lo que vuela hacia el tesoro antes de que llegue.',
  setup: base,
  toolbox: blocksForLevel(4),
  play: [
    { icon: '👆', text: 'Hacé clic en lo que vuela hacia el tesoro: se va y te da un punto.' },
    { icon: '💥', text: 'Si llega al tesoro, perdés un punto.' },
    { icon: '🏆', text: 'Con 15 puntos, ganás.' },
  ],
  goal: (p) => `Espantá ${winMark(p) ? `${winMark(p)}veces ` : ''}a {bomba} y a {rayo}`,
  pillars: [
    { id: 'vuelan', broken: '{bomba} ya no vuela hacia el tesoro', ok: (p) => p.sprites.some((s) => s.id !== 'tesoro' && s.scripts.some((sc) => sc.hat.type === 'a_flag' && count(inside(sc), 'a_glide') > 0)), restore: { sprite: 'bomba', script: FLY(FOES[0]) } },
    { id: 'espantar', broken: 'Hacer clic ya no suma puntos', ok: (p) => p.sprites.some((s) => s.id !== 'tesoro' && s.scripts.some((sc) => sc.hat.type === 'a_click' && inside(sc).some((b) => b.type === 'a_addscore' && numField(b, 'N') > 0))), restore: { sprite: 'bomba', script: SWAT() } },
    { id: 'llegar', broken: 'Cuando llegan al tesoro ya no pasa nada', ok: (p) => scriptsWith(p, 'a_touching').some((s) => count(inside(s), 'a_addscore') > 0), restore: { sprite: 'bomba', script: ARRIVE() } },
    { id: 'ganar', broken: 'Ya no se puede ganar', ok: (p) => blocksOf(p, 'a_win').length > 0 && p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'a_win') > 0)), restore: { sprite: 'tesoro', script: WIN() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'bomba', talker: 'tesoro', sounder: 'bomba', picture: false, sayBlock: 'a_sayfor', newPlace: 'espacio', newArt: 'rock', sayAim: 'Que {tesoro} diga otra cosa cuando empieza el juego', soundAim: 'Que suene otro sonido cuando espantás a {bomba}', soundTry: 'Tocá **▶** y hacé clic en {bomba}: ¡suena distinto!' }),
    card({
      id: 'velocidad', icon: '💨', label: 'Velocidad', sprite: 'bomba',
      title: 'Cambiá cuánto tardan en llegar',
      aim: 'Que {bomba} llegue al tesoro más rápido o más lento',
      how: [{ t: 'En [a_glide], cambiá el **3.4** por otro número', on: 'change' }, { t: 'Tocá **▶** y mirá cuánto tarda {bomba} en llegar', on: 'try' }],
      block: { type: 'a_glide', caption: 'Tocá los segundos: con menos llegan más rápido.' },
      concept: 'Dificultad: cambiar un número cambia cómo se juega.', ask: '¿Qué número cambiaste y qué pasó?',
      built: (p) => differs(numbers(p, 'a_glide', 'T'), numbers(base, 'a_glide', 'T')),
      solve: (p) => { setNumber(firstBlock(p, 'bomba', 'a_glide'), 'T', 2); },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Meta', sprite: 'tesoro',
      title: 'Cambiá la meta',
      aim: 'Que se gane con más o menos puntos',
      how: [{ t: 'En [a_points], cambiá el **15** por otro número', on: 'change' }, { t: 'Tocá **▶** y espantá todo hasta ganar', on: 'try' }],
      block: { type: 'a_points', caption: 'Tocá el 15 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0 && numField(s.hat, 'N') !== 15),
      solve: (p) => { firstBlock(p, 'tesoro', 'a_points').fields.N = 8; },
    }),
    card({
      id: 'valor', icon: '💰', label: 'Más puntos', sprite: 'bomba',
      title: 'Que espantar valga más',
      aim: 'Que cada vez que espantás a {bomba} ganes más puntos',
      how: [{ t: 'En el [a_addscore] de [a_click], cambiá el **1** por uno más grande', on: 'change' }, { t: 'Tocá **▶** y hacé clic en {bomba}: ¡suma más!', on: 'try' }],
      block: { type: 'a_addscore', caption: 'Tocá el 1 y poné un número más grande.', where: (b) => numField(b, 'N') > 0 },
      concept: 'Puntos: un número que el juego recuerda.', ask: '¿Dónde dice cuántos puntos da cada clic?',
      built: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') >= 2),
      solve: (p) => { setNumber(firstBlock(p, 'bomba', 'a_addscore', (b) => numField(b, 'N') > 0), 'N', 2); },
    }),
    card({
      id: 'castigo', icon: '💔', label: 'Castigo', sprite: 'bomba',
      title: 'Que duela más cuando llegan',
      aim: 'Que {bomba} te saque más puntos si llega al tesoro',
      how: [{ t: 'En el [a_addscore] de [a_touching], cambiá el **-1** por **-3**', on: 'change' }, { t: 'Tocá **▶** y dejá que {bomba} llegue: ¡resta más!', on: 'try' }],
      block: { type: 'a_addscore', caption: 'Tocá el -1 y poné un número más chico, como -3.', where: (b) => numField(b, 'N') < 0 },
      concept: 'Puntos: un número negativo resta.', ask: '¿Por qué el número tiene un menos?',
      built: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') <= -2),
      solve: (p) => { setNumber(firstBlock(p, 'bomba', 'a_addscore', (b) => numField(b, 'N') < 0), 'N', -3); },
    }),
    card({
      id: 'perder', icon: '💥', label: 'Perder', sprite: 'bomba',
      title: 'Que perdás si llega al tesoro',
      aim: 'Que el juego se pierda si {bomba} llega al tesoro',
      how: [{ t: 'Poné [a_lose] abajo del [a_hide], al final', on: 'a_lose' }, { t: 'Tocá **▶** y dejá que {bomba} llegue: ¡perdés!', on: 'try' }],
      demo: onTouching('tesoro', addScore(-1), sound('explosion'), hide(), lose()),
      concept: 'Reglas: qué pasa cuando dos cosas se tocan.', ask: '¿Cuándo se pierde y dónde está escrito?',
      built: (p) => scriptsWith(p, 'a_touching').some((sc) => count(inside(sc), 'a_lose') > 0),
      solve: (p) => { spriteOf(p, 'bomba').scripts.find((s) => s.hat.type === 'a_touching')!.body.push(lose()); },
    }),
    card({
      id: 'mundo', icon: '🌍', label: 'Nivel 2', sprite: 'tesoro',
      title: 'El segundo nivel',
      aim: 'Que el juego pase a otro lugar cuando llegás a 5 puntos',
      how: [{ t: 'Traé [a_points] a un lugar vacío de {tesoro}', on: 'a_points' }, { t: 'Poné [a_backdrop] abajo de [a_points]', on: 'a_backdrop' }, { t: 'En [a_backdrop], elegí un lugar nuevo', on: 'tune' }, { t: 'Tocá **▶** y espantá 5 veces: ¡cambia el lugar!', on: 'try' }],
      demo: onPoints(5, backdrop('espacio')),
      example: [{ sprite: 'tesoro', scripts: [onPoints(5, backdrop('espacio'))] }],
      tune: { type: 'a_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Condiciones: el juego cambia cuando llegás a cierto puntaje.', ask: '¿Qué tiene que pasar para cambiar de nivel?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'a_backdrop' && b.fields.B !== p.backdrop))),
      solve: (p) => { spriteOf(p, 'tesoro').scripts.push(onPoints(5, backdrop(p.backdrop === 'espacio' ? 'nieve' : 'espacio'))); },
    }),
    card({
      id: 'premio', icon: '⭐', label: 'Premio', newSprite: true, point: 'add-sprite',
      title: 'Un premio que aparece por todos lados',
      aim: 'Que un premio nuevo salte por todos lados y dé puntos al tocarlo',
      how: [{ t: 'Tocá **+ Agregar** y sumá un personaje', on: 'add' }, { t: 'Poné [a_forever] abajo de [a_flag]', on: 'a_forever' }, { t: 'Poné [a_random] adentro de [a_forever]', on: 'a_random' }, { t: 'Poné [a_wait] abajo de [a_random]', on: 'a_wait' }, { t: 'Traé [a_click] a un lugar vacío', on: 'a_click' }, { t: 'Poné [a_addscore] abajo de [a_click]', on: 'a_addscore' }, { t: 'Tocá al premio nuevo mientras salta: ¡suma puntos!', on: 'try' }], tap: 'new',
      demo: [onFlag(forever(goToRandom(), wait(1))), onClick(addScore(3), sound('campana'))],
      concept: 'Bucles: «por siempre» repite mientras dura el juego.', ask: '¿Qué hace «por siempre» con tu premio?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => count(inside(sc), 'a_forever') > 0) && s.scripts.some((sc) => sc.hat.type === 'a_click' && count(inside(sc), 'a_addscore') > 0)),
      solve: (p) => addSprite(p, 'star', onFlag(forever(goToRandom(), wait(1))), onClick(addScore(3))),
    }),
  ],
});
