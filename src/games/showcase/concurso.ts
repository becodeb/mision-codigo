/**
 * Equipo Concurso: Robi pregunta y el chico toca la respuesta. Bloques con texto: clics, mensajes y puntos.
 * Sin condicionales, cada pregunta tiene sus dos personajes: aparecen cuando llega su mensaje y se esconden cuando
 * se pasa a la siguiente. Un personaje escondido no recibe clics, y el que acierta se esconde antes de sumar:
 * no hay forma de sumar con una respuesta de otra pregunta, ni dos veces con la misma.
 */
import { addScore, face, hide, jump, onClick, onFlag, onPoints, onReceive, project, say, sayFor, send, setScore, show, sound, sprite, wait, win } from '../../language/ir.ts';
import type { Block, ProjectProgram, Script } from '../../language/ir.ts';
import { blocksForLevel, type BlockType } from '../../language/catalog.ts';
import { numField } from '../checks.ts';
import { addSprite, blocksOf, card, count, differs, firstBlock, inside, lookCards, newSprites, scriptsOfSprite, scriptsWith, showcaseGame, spriteOf, winMark } from './kit.ts';

interface Round {
  question: string;
  /** Left and right character: who they are, what they say and which one is right. */
  options: [{ id: string; art: string; text: string }, { id: string; art: string; text: string }];
  right: 0 | 1;
  /** The message that brings this round: none for the first one. */
  from?: string;
  /** The message that sends the next one. */
  next?: string;
}

const ROUNDS: Round[] = [
  { question: '¿Cuántas patas tiene una araña?', options: [{ id: 'a1', art: 'toby', text: 'Seis' }, { id: 'b1', art: 'michi', text: 'Ocho' }], right: 1, next: 'p2' },
  { question: '¿Qué planeta está más cerca del Sol?', options: [{ id: 'a2', art: 'pulpi', text: 'Mercurio' }, { id: 'b2', art: 'lumi', text: 'Marte' }], right: 0, from: 'p2', next: 'p3' },
  { question: '¿Cuál es el océano más grande?', options: [{ id: 'a3', art: 'coni', text: 'Atlántico' }, { id: 'b3', art: 'pipo', text: 'Pacífico' }], right: 1, from: 'p3' },
];
const SLOT = [{ x: 50, y: -110 }, { x: 165, y: -110 }];
const ANSWERS = ROUNDS.flatMap((r) => r.options.map((o) => o.id));
const WRONG = ROUNDS.map((r) => r.options[r.right === 0 ? 1 : 0].id);
const RIGHT = ROUNDS.map((r) => r.options[r.right].id);
const FINAL: BlockType[] = ['a_say', 'a_sayfor', 'a_thinkfor'];
const CHEER: BlockType[] = ['a_jump', 'a_face', 'a_changesize', 'a_setsize', 'a_note'];

const GOOD = (next?: string): Script => onClick(hide(), addScore(1), sound('campana'), ...(next ? [send(next)] : []));
const BAD = (): Script => onClick(sound('bip'), face('triste'), wait(1), face('feliz'));
/** What the character says when its question starts, and where it goes away. */
const appear = (r: Round, text: string): Script[] => [
  ...(r.from ? [onReceive(r.from, show(), say(text))] : [onFlag(say(text))]),
  ...(r.next ? [onReceive(r.next, hide())] : []),
];

const robi = sprite('robi', 'robi', [
  onFlag(setScore(0), say(ROUNDS[0].question)),
  ...ROUNDS.filter((r) => r.from).map((r) => onReceive(r.from!, say(r.question))),
  onPoints(3, sound('fanfarria'), win()),
], { x: -130, y: -110, size: 90, name: 'Robi' });

const answers = ROUNDS.flatMap((r) => r.options.map((o, i) => sprite(o.id, o.art, [
  ...appear(r, o.text),
  i === r.right ? GOOD(r.next) : BAD(),
], { x: SLOT[i].x, y: SLOT[i].y, size: 90, visible: !r.from, name: `${o.art[0].toUpperCase()}${o.art.slice(1)}` })));

const base = project('teatro', [robi, ...answers]);

const textsOf = (p: ProjectProgram, ids: string[]): string[] =>
  ids.flatMap((id) => blocksOf({ ...p, sprites: p.sprites.filter((s) => s.id === id) }, 'a_say').map((b: Block) => String(b.inputs.T?.fields.V ?? '')));
const wins = (p: ProjectProgram): Script[] => scriptsWith(p, 'a_points').filter((s) => count(inside(s), 'a_win') > 0);

export const EL_CONCURSO_DE_ROBI = showcaseGame({
  id: 'muestra-concurso', level: 3, order: 3, title: 'El concurso de Robi', cover: 'robi', tapAll: true,
  pitch: 'Robi pregunta, vos tocás la respuesta. Después hacé tus propias preguntas.',
  setup: base,
  toolbox: blocksForLevel(3),
  play: [
    { icon: '❓', text: 'Robi hace una pregunta.' },
    { icon: '👆', text: 'Tocá al personaje que tiene la respuesta correcta.' },
    { icon: '🏆', text: 'Si respondés bien las 3 preguntas, ganás.' },
  ],
  goal: (p) => `Respondé bien las ${winMark(p)}preguntas de {robi}`,
  pillars: [
    { id: 'preguntas', broken: '{robi} ya no hace preguntas', ok: (p) => scriptsOfSprite(p, 'robi').some((s) => s.hat.type === 'a_flag' && count(inside(s), 'a_say') > 0), restore: { sprite: 'robi', script: onFlag(say(ROUNDS[0].question)) } },
    { id: 'sumar', broken: 'Acertar ya no suma puntos', ok: (p) => blocksOf(p, 'a_addscore').some((b) => numField(b, 'N') > 0), restore: { sprite: RIGHT[0], script: GOOD(ROUNDS[0].next) } },
    { id: 'siguiente', broken: 'Al acertar ya no viene la pregunta que sigue', ok: (p) => blocksOf(p, 'a_send').length > 0, restore: { sprite: RIGHT[0], script: GOOD(ROUNDS[0].next) } },
    { id: 'ganar', broken: 'Ya no se puede ganar', ok: (p) => wins(p).length > 0, restore: { sprite: 'robi', script: onPoints(3, sound('fanfarria'), win()) } },
  ],
  cards: [
    ...lookCards(base, {
      hero: 'a1', talker: 'robi', sounder: RIGHT[0], picture: false, sayBlock: 'a_say', newPlace: 'aula', newArt: 'juli',
      sayAim: 'Que {robi} empiece el juego diciendo otra cosa', soundAim: 'Que suene otro sonido cuando acertás la primera pregunta',
      soundTry: 'Tocá **▶** y acertá la primera pregunta: ¡suena distinto!',
    }),
    card({
      id: 'pregunta', icon: '❓', label: 'Pregunta', sprite: 'robi',
      title: 'Cambiá la pregunta',
      aim: 'Que {robi} haga tu propia pregunta',
      how: [{ t: 'En [a_say] de {robi}, escribí tu pregunta', on: 'change' }, { t: 'Tocá **▶** y leé la pregunta de {robi}', on: 'try' }],
      block: { type: 'a_say', caption: 'Tocá el texto y escribí tu pregunta.' },
      concept: 'Datos: lo que el programa dice se puede cambiar.', ask: '¿Qué pregunta pusiste y quién tiene la respuesta?',
      built: (p) => differs(textsOf(p, ['robi']), textsOf(base, ['robi'])),
      solve: (p) => { firstBlock(p, 'robi', 'a_say').inputs.T.fields.V = '¿Cuántos días tiene una semana?'; },
    }),
    card({
      id: 'respuestas', icon: '🔤', label: 'Respuestas', sprite: RIGHT[0],
      title: 'Cambiá las respuestas',
      aim: 'Que la primera pregunta tenga otras respuestas',
      how: [{ t: 'En [a_say], escribí otra respuesta para {b1}', on: 'change' }, { t: 'Tocá **▶** y leé las respuestas de la primera pregunta', on: 'try' }],
      block: { type: 'a_say', caption: 'Tocá el texto y escribí otra respuesta.' },
      concept: 'Datos: cada personaje dice lo que le escribís.', ask: '¿Quién dice la respuesta correcta?',
      built: (p) => differs(textsOf(p, ANSWERS), textsOf(base, ANSWERS)),
      solve: (p) => { firstBlock(p, RIGHT[0], 'a_say').inputs.T.fields.V = 'Siete'; },
    }),
    card({
      id: 'festejo', icon: '🎉', label: 'Festejo', sprite: 'robi',
      title: 'Un festejo para el ganador',
      aim: 'Que {robi} salte de alegría cuando ganás',
      how: [{ t: 'Poné [a_jump] abajo del [a_sound], arriba del [a_win]', on: 'a_jump' }, { t: 'Tocá **▶** y respondé bien todo: ¡{robi} salta!', on: 'try' }],
      demo: onPoints(3, sound('fanfarria'), jump(), win()),
      concept: 'Secuencia: las órdenes se cumplen una abajo de la otra.', ask: '¿Qué hace Robi cuando ganás?',
      built: (p) => wins(p).some((s) => count(inside(s), ...CHEER) > 0),
      solve: (p) => { spriteOf(p, 'robi').scripts.find((s) => s.hat.type === 'a_points')!.body.splice(1, 0, jump()); },
    }),
    card({
      id: 'final', icon: '📣', label: 'Mensaje final', sprite: 'robi',
      title: 'Un mensaje para el final',
      aim: 'Que {robi} felicite al ganador con un mensaje',
      how: [{ t: 'Poné [a_sayfor] abajo del [a_sound], arriba del [a_win]', on: 'a_sayfor' }, { t: 'Tocá **▶** y respondé bien todo: leé el mensaje de {robi}', on: 'try' }],
      demo: onPoints(3, sound('fanfarria'), sayFor('¡Sos un genio!', 2), win()),
      concept: 'Datos: lo que el programa dice se puede cambiar.', ask: '¿Qué le dice Robi al ganador?',
      built: (p) => wins(p).some((s) => count(inside(s), ...FINAL) > 0),
      solve: (p) => { spriteOf(p, 'robi').scripts.find((s) => s.hat.type === 'a_points')!.body.splice(1, 0, sayFor('¡Sos un genio!', 2)); },
    }),
    card({
      id: 'pista', icon: '💡', label: 'Pista', newSprite: true, point: 'add-sprite',
      title: 'Una pista para ayudar',
      aim: 'Que un personaje nuevo dé una pista cuando lo tocás',
      how: [{ t: 'Tocá **+ Agregar** y sumá un personaje', on: 'add' }, { t: 'Traé [a_click] a un lugar vacío', on: 'a_click' }, { t: 'Poné [a_sayfor] abajo de [a_click]', on: 'a_sayfor' }, { t: 'Tocá al personaje nuevo y leé la pista', on: 'try' }], tap: 'new',
      demo: onClick(sayFor('¡Pensá en los bichos!', 2)),
      concept: 'Eventos: un clic también despierta bloques.', ask: '¿Qué pasa cuando le hacés clic a tu pista?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => sc.hat.type === 'a_click' && count(inside(sc), 'a_say', 'a_sayfor', 'a_thinkfor') > 0)),
      solve: (p) => addSprite(p, 'star', onClick(sayFor('¡Pensá en los bichos!', 2))),
    }),
    card({
      id: 'error', icon: '😕', label: 'Error', sprite: WRONG[0],
      title: 'Cambiá el sonido del error',
      aim: 'Que suene otro sonido cuando una respuesta está mal',
      how: [{ t: 'En [a_sound], elegí otro sonido para {a1}', on: 'change' }, { t: 'Tocá a {a1} y escuchá el sonido nuevo', on: 'try' }], tap: 'a1',
      block: { type: 'a_sound', caption: 'Tocá el sonido y elegí otro.' },
      concept: 'Datos: cada sonido suena cuando el programa llega a ese bloque.', ask: '¿Cuándo suena ese sonido?',
      built: (p) => WRONG.some((id) => blocksOf({ ...p, sprites: p.sprites.filter((s) => s.id === id) }, 'a_sound').some((b) => b.fields.S !== 'bip')),
      solve: (p) => { firstBlock(p, WRONG[0], 'a_sound').fields.S = 'rugido'; },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Meta', sprite: 'robi',
      title: 'Cambiá cuántas hay que acertar',
      aim: 'Que se gane con más o menos respuestas bien',
      how: [{ t: 'En [a_points], cambiá el **3** por otro número', on: 'change' }, { t: 'Tocá **▶** y respondé bien hasta ganar', on: 'try' }],
      block: { type: 'a_points', caption: 'Tocá el 3 y poné otro número.' },
      concept: 'Condiciones: algo pasa recién cuando se llega a un número.', ask: '¿Cómo sabe el juego que ganaste?',
      built: (p) => wins(p).some((s) => numField(s.hat, 'N') !== 3),
      solve: (p) => { firstBlock(p, 'robi', 'a_points').fields.N = 2; },
    }),
  ],
});
