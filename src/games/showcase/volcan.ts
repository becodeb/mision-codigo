/** Equipo Volcán: atajar manzanas que caen. «Por siempre», «si», puntos, perder. */
import {
  addScore, backdrop, changeY, face, forever, goToRandom, hide, ifThen, keyPressed, lose, moveWithArrows, onFlag, onPoints, onTouching, project, repeat, sayFor, setScore, setSize, show, sound,
  sprite, wait, win,
} from '../../language/ir.ts';
import type { Block } from '../../language/ir.ts';
import { blocksForLevel, type BlockType } from '../../language/catalog.ts';
import { blocksInList, numField } from '../checks.ts';
import { addSprite, addTo, blocksOf, card, count, firstBlock, inside, lookCards, newSprites, scriptsWith, setNumber, showcaseGame, spriteOf } from './kit.ts';

/** Aparece arriba, en un lugar al azar, y baja de a poquito. */
const fall = (times: number, speed: number): Block[] => [hide(), goToRandom(), changeY(400), show(), repeat(times, changeY(-speed))];
const TRAVEL: BlockType[] = ['a_changey', 'a_changex', 'a_move', 'a_glide', 'a_random', 'a_goto'];
const CATCH = () => onTouching('coni', addScore(1), sound('campana'), hide());
const WIN = () => onPoints(10, sound('fanfarria'), win());

const base = project('granja', [
  sprite('manzana', 'apple', [onFlag(forever(...fall(60, 5))), CATCH()], { x: -60, y: 100, name: 'Manzana' }),
  sprite('bomba', 'bomb', [onFlag(forever(...fall(75, 4), wait(2))), onTouching('coni', addScore(-1), sound('explosion'), hide())], { x: 90, y: 100, name: 'Bomba' }),
  sprite('coni', 'coni', [
    onFlag(setScore(0), forever(moveWithArrows(8))),
    onFlag(sayFor('¡Qué hambre!', 2)),
    onTouching('bomba', face('sorpresa'), wait(1), face('feliz')),
    WIN(),
  ], { x: 0, y: -150, size: 85, name: 'Coni' }),
]);

/** Números con los que cae algo: «cambiar y» con un número negativo. */
const drops = (list: readonly Block[]): number[] => list.map((b) => numField(b, 'N')).filter((n) => n < 0);

export const LLUVIA_DE_MANZANAS = showcaseGame({
  id: 'muestra-manzanas', level: 4, title: 'Lluvia de manzanas', cover: 'apple',
  pitch: 'Atajá 10 manzanas y esquivá las bombas.',
  setup: base,
  toolbox: blocksForLevel(4),
  play: [
    { icon: '⌨️', text: 'Movete con las flechas del teclado.' },
    { icon: '🍎', text: 'Atajá 10 manzanas para ganar.' },
    { icon: '💣', text: 'Cada bomba te saca un punto.' },
  ],
  pillars: [
    { id: 'mover', broken: '{coni} ya no se mueve con las flechas', ok: (p) => blocksOf(p, 'a_forever').some((b) => count(blocksInList(b.body), 'a_arrows') > 0) || scriptsWith(p, 'a_key').some((s) => count(inside(s), ...TRAVEL) > 0), restore: { sprite: 'coni', script: onFlag(forever(moveWithArrows(8))) } },
    { id: 'caer', broken: '{manzana} ya no cae', ok: (p) => p.sprites.some((s) => s.id !== 'coni' && s.id !== 'bomba' && s.scripts.some((sc) => sc.hat.type === 'a_flag' && count(inside(sc), ...TRAVEL) > 0)), restore: { sprite: 'manzana', script: onFlag(forever(...fall(60, 5))) } },
    { id: 'sumar', broken: 'Ya no se suman puntos', ok: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') > 0), restore: { sprite: 'manzana', script: CATCH() } },
    { id: 'ganar', broken: 'Ya no se puede ganar', ok: (p) => blocksOf(p, 'a_win').length > 0 && p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'a_win') > 0)), restore: { sprite: 'coni', script: WIN() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'coni', talker: 'coni', sounder: 'manzana', picture: false, sayBlock: 'a_sayfor', newPlace: 'selva', newArt: 'pipo' }),
    card({
      id: 'velocidad', icon: '💨', label: 'Más rápido', sprite: 'coni',
      title: 'Cambiá la velocidad', text: 'El número de «mover con las flechas» es la **velocidad** de {coni}.',
      how: ['En {coni}, buscá «mover con las flechas, velocidad 8».', 'Cambiá el **8**.', 'Tocá Empezar y probá.'],
      block: { type: 'a_arrows', caption: 'Tocá el 8 y poné otra velocidad.' },
      concept: 'Dificultad: cambiar un número cambia cómo se juega.', ask: '¿Qué número cambiaste y qué pasó?',
      built: (p) => blocksOf(p, 'a_arrows').some((b) => numField(b, 'N') !== 8),
      solve: (p) => { setNumber(firstBlock(p, 'coni', 'a_arrows'), 'N', 12); },
    }),
    card({
      id: 'caida', icon: '🍎', label: 'Cómo cae', sprite: 'manzana',
      title: 'Cambiá cómo cae', text: '«Cambiar y en -5» baja a {manzana} de a poquito. **Con otro número cae más rápido o más lento.**',
      how: ['En {manzana}, buscá «cambiar y en -5».', 'Cambiá el **5** y dejale el menos: el menos es para abajo.', 'Tocá Empezar.'],
      block: { type: 'a_changey', caption: 'Tocá el -5 y cambialo. El menos es para abajo.', where: (b) => numField(b, 'N') < 0 },
      concept: 'Coordenadas: bajar es restarle a la y.', ask: '¿Por qué el número tiene un menos?',
      built: (p) => drops(blocksOf(p, 'a_changey')).some((n) => n !== -5 && n !== -4),
      solve: (p) => { setNumber(firstBlock(p, 'manzana', 'a_changey', (b) => numField(b, 'N') < 0), 'N', -8); },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Cambiar la meta', sprite: 'coni',
      title: 'Cambiá la meta', text: '¿Con cuántos puntos se gana? **Vos decidís.**',
      how: ['En {coni}, buscá «cuando los puntos lleguen a 10».', 'Cambiá el **10**.', 'Probá el juego.'],
      block: { type: 'a_points', caption: 'Tocá el 10 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0 && numField(s.hat, 'N') !== 10),
      solve: (p) => { firstBlock(p, 'coni', 'a_points').fields.N = 5; },
    }),
    card({
      id: 'peligro', icon: '💣', label: 'Bombas peligrosas', sprite: 'bomba',
      title: 'Que la bomba te haga perder', text: 'Ahora {bomba} saca un punto. Hacé que **si te toca, perdés**.',
      how: ['En {bomba}, buscá «cuando toque a {coni}».', 'Agregá «¡perder!» abajo de los otros.', 'Probalo: dejate tocar.'],
      demo: onTouching('coni', addScore(-1), sound('explosion'), hide(), lose()),
      concept: 'Reglas: qué pasa cuando dos cosas se tocan.', ask: '¿Cuándo se pierde y dónde está escrito?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'a_lose') > 0)),
      solve: (p) => { spriteOf(p, 'bomba').scripts[1].body.push(lose()); },
    }),
    card({
      id: 'fase', icon: '🌍', label: 'Pasar de nivel', sprite: 'coni',
      title: 'El segundo nivel', text: 'Que al llegar a 5 puntos **algo cambie**: el fondo, el tamaño, un sonido.',
      how: ['En {coni}, poné otro «cuando los puntos lleguen a 5».', 'Abajo, por ejemplo, «cambiar escenario a».', 'Jugá hasta llegar a 5.'],
      demo: onPoints(5, backdrop('selva')),
      example: [{ sprite: 'coni', scripts: [onPoints(5, backdrop('selva'), setSize(130))] }],
      concept: 'Condiciones: el juego cambia cuando llegás a cierto puntaje.', ask: '¿Qué cambia en el segundo nivel?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => s.body.length > 0 && count(inside(s), 'a_win') === 0),
      solve: (p) => addTo(p, 'coni', onPoints(5, backdrop('selva'))),
    }),
    card({
      id: 'si', icon: '❓', label: 'Usar «si… entonces»', sprite: 'coni',
      title: 'Si pasa esto, entonces…', text: 'Que {coni} haga algo **solo si** pasa algo. Por ejemplo: si apretás espacio, se agranda.',
      how: ['En {coni}, poné un «si … entonces» adentro del «por siempre».', 'En el hueco poné una pregunta de **Sensores**, como «¿tecla espacio presionada?».', 'Adentro poné qué hace. ¡Probalo!'],
      demo: onFlag(setScore(0), forever(moveWithArrows(8), ifThen(keyPressed(' '), setSize(150)))),
      example: [{ sprite: 'coni', scripts: [onFlag(forever(moveWithArrows(8), ifThen(keyPressed(' '), setSize(150))))] }],
      concept: 'Condicionales: hacer algo solo si se cumple una condición.', ask: '¿Cuál es la pregunta que se hace el programa?',
      built: (p) => blocksOf(p, 'a_if').some((b) => !!b.inputs.C && b.body.length > 0),
      solve: (p) => { spriteOf(p, 'coni').scripts[0].body[1].body.push(ifThen(keyPressed(' '), setSize(150))); },
    }),
    card({
      id: 'otra', icon: '➕', label: 'Que caiga otra cosa', newSprite: true, point: 'add-sprite',
      title: 'Que se mueva otra cosa', text: 'Agregá otro objeto que **se mueva por siempre**.',
      how: ['Tocá **Agregar** y elegí qué cae.', 'Poné la bandera, «por siempre», y adentro cómo se mueve. Mirá los bloques de {manzana} para copiarlos.', 'Tocá Empezar.'],
      demo: onFlag(forever(goToRandom(), wait(1))),
      example: [{ sprite: 'Nuevo', scripts: [onFlag(forever(...fall(60, 5))), onTouching('coni', addScore(2), hide())] }],
      concept: 'Bucles: «por siempre» repite mientras dura el juego.', ask: '¿Qué hace «por siempre»?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'a_forever' && count(blocksInList(b.body), ...TRAVEL) > 0))),
      solve: (p) => addSprite(p, 'star', onFlag(forever(goToRandom(), wait(1)))),
    }),
  ],
});
