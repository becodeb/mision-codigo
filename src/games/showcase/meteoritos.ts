/**
 * Equipo Meteoritos: Nova se mueve a los costados y dispara para romper los meteoritos que caen. Los disparos y los
 * meteoritos son clones: el original de cada uno queda escondido y cada clon hace su camino y se borra al terminar.
 * Bloques con texto: variables, clones, operadores y preguntar. Los meteoritos caen en cuatro carriles, y Nova empieza
 * entre dos: quedarse quieta no es peligroso, pero tampoco rompe nada.
 */
import {
  addScore, answer, ask, backdrop, changeVar, changeX, changeY, createClone, deleteClone, face, forever, goTo, goToSprite, hide, join, lt, lose, mul, onCloneStart, onFlag, onKey, onPoints, onTouching,
  posY, project, randomBetween, repeat, repeatUntil, sayFor, setScore, setVar, show, sound, sprite, sub, variable, wait, waitUntil, win,
} from '../../language/ir.ts';
import type { Block, ProjectProgram } from '../../language/ir.ts';
import { blocksForLevel } from '../../language/catalog.ts';
import { numField } from '../checks.ts';
import { addTo, blocksOf, card, count, differs, firstBlock, inside, lookCards, numbers, scriptsWith, setNumber, showcaseGame, winMark } from './kit.ts';

/** Four lanes: -150, -50, 50 and 150. */
const LANE = () => sub(mul(randomBetween(0, 3), 100), 150);
const SHOOT = () => onKey(' ', createClone('bala'));
const FLIGHT = () => onCloneStart(goToSprite('nova'), changeY(70), show(), repeat(22, changeY(10)), deleteClone());
const BREAK_ROCK = () => onTouching('meteorito', deleteClone());
const RAIN = () => onFlag(hide(), forever(createClone(), wait(1.5)));
const FALL = () => onCloneStart(goTo(LANE(), 150), show(), repeatUntil(lt(posY(), -150), changeY(-4)), deleteClone());
const SHOT = () => onTouching('bala', addScore(1), sound('magia'), deleteClone());
const HIT = () => onTouching('nova', changeVar('vidas', -1), sound('explosion'), deleteClone());
const WIN = () => onPoints(15, sound('fanfarria'), win());
const DEAD = () => onFlag(waitUntil(lt(variable('vidas'), 1)), lose());
const SETUP = () => onFlag(setVar('vidas', 3), setScore(0), sayFor('¡A defender la Tierra!', 2));

const base = project('espacio', [
  sprite('meteorito', 'rock', [RAIN(), FALL(), SHOT(), HIT()], { x: 0, y: 100, size: 110, visible: false, name: 'Meteoritos' }),
  sprite('bala', 'bolt', [FLIGHT(), BREAK_ROCK()], { x: 0, y: -110, size: 90, visible: false, name: 'Disparo' }),
  sprite('nova', 'nova', [
    onKey('ArrowLeft', changeX(-12)),
    onKey('ArrowRight', changeX(12)),
    SHOOT(),
    SETUP(),
    DEAD(),
    onTouching('meteorito', face('triste'), wait(1), face('feliz')),
    WIN(),
  ], { x: 0, y: -150, size: 70, name: 'Nova' }),
], { variables: ['vidas'] });

const setOf = (p: ProjectProgram, name: string): Block[] => blocksOf(p, 'a_setvar').filter((b) => b.fields.NAME === name);
/** The value of a «fijar»: in the editor the literal can be a text or a number. */
const valueOf = (b: Block): number => Number(b.inputs.V?.fields.V ?? NaN);
/** The numbers a block takes in one sprite. */
const of = (p: ProjectProgram, id: string): ProjectProgram => ({ ...p, sprites: p.sprites.filter((s) => s.id === id) });
const dropsOf = (p: ProjectProgram): number[] => numbers(of(p, 'meteorito'), 'a_changey', 'N');

export const LLUVIA_DE_METEORITOS = showcaseGame({
  id: 'muestra-meteoritos', level: 5, order: 3, title: 'Lluvia de meteoritos', cover: 'rock',
  pitch: 'Movete con las flechas y disparale a los meteoritos con la barra espaciadora.',
  setup: base,
  toolbox: blocksForLevel(5),
  play: [
    { icon: '⌨️', text: 'Las flechas mueven a Nova a un lado y al otro.' },
    { icon: '☄️', text: 'La barra espaciadora dispara: cada meteorito roto es un punto.' },
    { icon: '❤️', text: 'Si un meteorito te toca, perdés una vida. Tenés 3.' },
  ],
  goal: (p) => `Disparale a ${winMark(p)}{meteorito}`,
  pillars: [
    { id: 'izquierda', broken: '{nova} ya no va a la izquierda', ok: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K === 'ArrowLeft').some((s) => s.body.length > 0), restore: { sprite: 'nova', script: onKey('ArrowLeft', changeX(-12)) } },
    { id: 'derecha', broken: '{nova} ya no va a la derecha', ok: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K === 'ArrowRight').some((s) => s.body.length > 0), restore: { sprite: 'nova', script: onKey('ArrowRight', changeX(12)) } },
    { id: 'disparar', broken: '{nova} ya no dispara con la barra espaciadora', ok: (p) => scriptsWith(p, 'a_key', (h) => h.fields.K === ' ').some((s) => count(inside(s), 'a_clone') > 0), restore: { sprite: 'nova', script: SHOOT() } },
    { id: 'vuelo', broken: 'Los disparos ya no salen volando', ok: (p) => scriptsWith(p, 'a_clonestart').some((s) => count(inside(s), 'a_changey') > 0 && numField(inside(s).find((b) => b.type === 'a_changey')!, 'N') > 0), restore: { sprite: 'bala', script: FLIGHT() } },
    { id: 'lluvia', broken: 'Ya no caen meteoritos', ok: (p) => scriptsWith(p, 'a_flag').some((s) => count(inside(s), 'a_clone') > 0 && count(inside(s), 'a_forever') > 0), restore: { sprite: 'meteorito', script: RAIN() } },
    { id: 'caen', broken: 'Los meteoritos ya no caen', ok: (p) => scriptsWith(p, 'a_clonestart').some((s) => inside(s).some((b) => b.type === 'a_changey' && numField(b, 'N') < 0)), restore: { sprite: 'meteorito', script: FALL() } },
    { id: 'romper', broken: 'Los disparos ya no rompen meteoritos', ok: (p) => scriptsWith(p, 'a_touching').some((s) => inside(s).some((b) => b.type === 'a_addscore' && numField(b, 'N') > 0)), restore: { sprite: 'meteorito', script: SHOT() } },
    { id: 'vidas', broken: 'Falta decir cuántas vidas hay al empezar', ok: (p) => setOf(p, 'vidas').length > 0, restore: { sprite: 'nova', script: onFlag(setVar('vidas', 3)) } },
    { id: 'golpe', broken: 'Los meteoritos ya no te sacan vidas', ok: (p) => blocksOf(p, 'a_changevar').some((b) => b.fields.NAME === 'vidas' && valueOf(b) < 0), restore: { sprite: 'meteorito', script: HIT() } },
    { id: 'perder', broken: 'Sin vidas ya no se pierde', ok: (p) => scriptsWith(p, 'a_flag').some((s) => count(inside(s), 'a_lose') > 0), restore: { sprite: 'nova', script: DEAD() } },
    { id: 'ganar', broken: 'Ya no se puede ganar', ok: (p) => p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'a_win') > 0)), restore: { sprite: 'nova', script: WIN() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'nova', talker: 'nova', sounder: 'meteorito', picture: false, sayBlock: 'a_sayfor', newPlace: 'nieve', newArt: 'pulpi', sayAim: 'Que {nova} diga otra cosa cuando empieza el juego', soundAim: 'Que suene otro sonido cuando le das a un {meteorito}', soundTry: 'Tocá **▶** y disparale a un {meteorito}: ¡suena distinto!' }),
    card({
      id: 'velocidad', icon: '💨', label: 'Velocidad', sprite: 'nova',
      title: 'Cambiá la velocidad de Nova',
      aim: 'Que {nova} se mueva más rápido hacia la izquierda',
      how: [{ t: 'En [a_changex] de la flecha izquierda, cambiá el **-12** por **-18**', on: 'change' }, { t: 'Tocá **▶** y mové a {nova} a la izquierda: ¡mirá qué rápido va!', on: 'try' }],
      block: { type: 'a_changex', caption: 'Tocá este número y cambialo.', where: (b) => numField(b, 'N') === -12 },
      concept: 'Coordenadas: moverse es cambiar los números de x y de y.', ask: '¿Qué pasa si ponés un número más grande?',
      built: (p) => scriptsWith(p, 'a_key').some((s) => inside(s).some((b) => b.type === 'a_changex' && Number.isFinite(numField(b, 'N')) && Math.abs(numField(b, 'N')) !== 12)),
      solve: (p) => { setNumber(firstBlock(p, 'nova', 'a_changex'), 'N', 18); },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Meta', sprite: 'nova',
      title: 'Cambiá la meta',
      aim: 'Que se gane rompiendo más o menos meteoritos',
      how: [{ t: 'En [a_points], cambiá el **15** por otro número', on: 'change' }, { t: 'Tocá **▶** y disparale a los meteoritos hasta ganar', on: 'try' }],
      block: { type: 'a_points', caption: 'Tocá el 15 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => scriptsWith(p, 'a_points').some((s) => count(inside(s), 'a_win') > 0 && numField(s.hat, 'N') !== 15),
      solve: (p) => { firstBlock(p, 'nova', 'a_points').fields.N = 8; },
    }),
    card({
      id: 'vidas', icon: '❤️', label: 'Vidas', sprite: 'nova',
      title: 'Cambiá las vidas',
      aim: 'Que empieces con más o menos vidas',
      how: [{ t: 'En el [a_setvar] que dice vidas, cambiá el **3** por otro número', on: 'change' }, { t: 'Tocá **▶** y mirá cuántas vidas tenés al empezar', on: 'try' }],
      block: { type: 'a_setvar', caption: 'Tocá el 3 y poné otra cantidad de vidas.', where: (b) => b.fields.NAME === 'vidas' },
      concept: 'Variables: un número con nombre que el programa recuerda y cambia.', ask: '¿Qué es una variable en tu juego?',
      built: (p) => setOf(p, 'vidas').some((b) => valueOf(b) !== 3),
      solve: (p) => { setOf(p, 'vidas')[0].inputs.V.fields.V = '6'; },
    }),
    card({
      id: 'caida', icon: '☄️', label: 'Caída', sprite: 'meteorito',
      title: 'Cambiá cuánto cae cada meteorito',
      aim: 'Que los {meteorito} caigan más rápido o más lento',
      how: [{ t: 'En [a_changey], cambiá el **-4** por otro número', on: 'change' }, { t: 'Tocá **▶** y mirá cómo caen los {meteorito}', on: 'try' }],
      block: { type: 'a_changey', caption: 'Tocá el -4 y cambialo. El menos es para abajo.' },
      concept: 'Coordenadas: bajar es restarle a la y.', ask: '¿Por qué el número tiene un menos?',
      built: (p) => differs(dropsOf(p), dropsOf(base)),
      solve: (p) => { setNumber(firstBlock(p, 'meteorito', 'a_changey'), 'N', -7); },
    }),
    card({
      id: 'ritmo', icon: '⏱️', label: 'Ritmo', sprite: 'meteorito',
      title: 'Que caigan más seguido',
      aim: 'Que los {meteorito} caigan más seguido',
      how: [{ t: 'En [a_wait], cambiá el **1.5** por un número más chico', on: 'change' }, { t: 'Tocá **▶** y mirá cada cuánto cae uno nuevo', on: 'try' }],
      block: { type: 'a_wait', caption: 'Tocá el 1.5: con menos segundos caen más seguido.' },
      concept: 'Bucles: «por siempre» repite, y la espera marca el ritmo.', ask: '¿Cada cuánto aparece un meteorito nuevo?',
      built: (p) => differs(numbers(of(p, 'meteorito'), 'a_wait', 'N'), numbers(of(base, 'meteorito'), 'a_wait', 'N')),
      solve: (p) => { setNumber(firstBlock(p, 'meteorito', 'a_wait'), 'N', 0.7); },
    }),
    card({
      id: 'carriles', icon: '🎲', label: 'Carriles', sprite: 'meteorito',
      title: 'Que caigan en otros lugares',
      aim: 'Que los {meteorito} caigan en otros lugares de arriba',
      how: [{ t: 'En [v_random], cambiá el **3** por otro número', on: 'change' }, { t: 'Tocá **▶** y mirá por dónde caen los {meteorito}', on: 'try' }],
      block: { type: 'v_random', caption: 'Tocá el 3: la computadora elige al azar entre 0 y ese número.' },
      concept: 'Azar: el juego es distinto cada vez.', ask: '¿Qué cosa decide la computadora al azar?',
      built: (p) => blocksOf(of(p, 'meteorito'), 'v_random').some((b) => numField(b, 'B') !== 3),
      solve: (p) => { firstBlock(p, 'meteorito', 'v_random').inputs.B.fields.V = 2; },
    }),
    card({
      id: 'nombre', icon: '🙋', label: 'Tu nombre', sprite: 'nova',
      title: 'Que te pregunte el nombre',
      aim: 'Que {nova} te pregunte cómo te llamás y te salude',
      how: [{ t: 'Poné [a_ask] abajo del [a_setscore], arriba del [a_sayfor]', on: 'a_ask' }, { t: 'Poné [v_answer] en el hueco de [a_sayfor], donde está el texto', on: 'v_answer' }, { t: 'Tocá **▶**, escribí tu nombre y leé cómo te saluda {nova}', on: 'try' }],
      demo: onFlag(ask('¿Cómo te llamás?'), sayFor('¡Hola!', 2)),
      example: [{ sprite: 'nova', scripts: [onFlag(ask('¿Cómo te llamás?'), sayFor(join('¡Hola, ', answer()), 2))] }],
      values: [{ type: 'v_answer', into: 'a_sayfor', input: 'T' }],
      concept: 'Entrada y salida: el programa pregunta y usa la respuesta.', ask: '¿Dónde queda guardado lo que escribís?',
      built: (p) => blocksOf(p, 'a_ask').length > 0 && blocksOf(p, 'v_answer').length > 0,
      solve: (p) => addTo(p, 'nova', onFlag(ask('¿Cómo te llamás?'), sayFor(join('¡Hola, ', answer()), 2))),
    }),
    card({
      id: 'mundo', icon: '🌍', label: 'Otro mundo', sprite: 'nova',
      title: 'El segundo mundo',
      aim: 'Que el juego pase a otro lugar cuando llegás a 5 puntos',
      how: [{ t: 'Traé [a_points] a un lugar vacío de {nova}', on: 'a_points' }, { t: 'Poné [a_backdrop] abajo de [a_points]', on: 'a_backdrop' }, { t: 'En [a_backdrop], elegí un lugar nuevo', on: 'tune' }, { t: 'Tocá **▶** y rompé 5 meteoritos: ¡cambia el lugar!', on: 'try' }],
      demo: onPoints(5, backdrop('mar')),
      example: [{ sprite: 'nova', scripts: [onPoints(5, backdrop('mar'))] }],
      tune: { type: 'a_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Condiciones: el juego cambia cuando llegás a cierto puntaje.', ask: '¿Qué tiene que pasar para cambiar de mundo?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'a_backdrop' && b.fields.B !== p.backdrop))),
      solve: (p) => addTo(p, 'nova', onPoints(5, backdrop(p.backdrop === 'nieve' ? 'mar' : 'nieve'))),
    }),
  ],
});
