/**
 * Equipo Fábrica: se junta una moneda por clic, se compran ayudantes que juntan solos y se mejora el clic.
 * Bloques con texto: variables, «si… si no», operadores, esperar hasta, azar y preguntar.
 * Las tres variables se ven arriba a la izquierda, así que los personajes quedan abajo y a la derecha.
 */
import {
  answer, ask, backdrop, changeVar, forever, gt, ifElse, join, onClick, onFlag, project, randomBetween, say, sayFor, setVar, sound, sprite, variable, wait, waitUntil, win,
} from '../../language/ir.ts';
import type { Block, ProjectProgram, Script } from '../../language/ir.ts';
import { blocksForLevel } from '../../language/catalog.ts';
import { addTo, blocksOf, card, count, firstBlock, inside, lookCards, scriptsWith, showcaseGame } from './kit.ts';

const LIMIT = 199;
const BUY = () => onClick(ifElse(gt(variable('monedas'), 19), [changeVar('monedas', -20), changeVar('ayudantes', 1), sound('aplauso')], [sound('bip')]));
const UPGRADE = () => onClick(ifElse(gt(variable('monedas'), 49), [changeVar('monedas', -50), changeVar('porClic', 1), sound('magia')], [sound('bip')]));
const TAP = () => onClick(changeVar('monedas', variable('porClic')), sound('campana'));
const SETUP = () => onFlag(setVar('monedas', 0), setVar('porClic', 1), setVar('ayudantes', 0));
const PAY = () => onFlag(forever(wait(1), changeVar('monedas', variable('ayudantes'))));
const WIN = () => onFlag(waitUntil(gt(variable('monedas'), LIMIT)), sound('fanfarria'), win());

const base = project('aula', [
  sprite('moneda', 'coin', [SETUP(), WIN(), TAP()], { x: -110, y: -100, size: 200, name: 'Monedas' }),
  sprite('robi', 'robi', [onFlag(sayFor('¡Soy tu ayudante!', 2), say('Ayudante: 20')), BUY(), PAY()], { x: 20, y: -120, size: 90, name: 'Robi' }),
  sprite('estrella', 'star', [onFlag(say('Mejora: 50')), UPGRADE()], { x: 175, y: -110, size: 130, name: 'Estrella' }),
], { variables: ['monedas', 'porClic', 'ayudantes'] });

const setOf = (p: ProjectProgram, name: string): Block[] => blocksOf(p, 'a_setvar').filter((b) => b.fields.NAME === name);
const valueOf = (b: Block): number => Number(b.inputs.V?.fields.V ?? NaN);
const changesOf = (p: ProjectProgram, name: string): Block[] => blocksOf(p, 'a_changevar').filter((b) => b.fields.NAME === name);

/** The numbers «monedas > N» waits for before the game is won. */
const limits = (p: ProjectProgram): number[] =>
  scriptsWith(p, 'a_flag').filter((s) => count(inside(s), 'a_win') > 0)
    .flatMap((s) => s.body.filter((b) => b.type === 'a_waituntil' && b.inputs.C?.type === 'v_gt' && b.inputs.C.inputs.A?.type === 'v_var'))
    .map((b) => Number(b.inputs.C.inputs.B?.fields.V)).filter(Number.isFinite);

/** «**200** » when the game is won by having more than 199, or nothing: the goal follows what the child changed. */
const target = (p: ProjectProgram): string => (limits(p).length ? `**${limits(p)[0] + 1}** ` : '');

const mundo = (to: string): Script => onFlag(waitUntil(gt(variable('monedas'), 10)), backdrop(to));

export const LA_FABRICA_DE_MONEDAS = showcaseGame({
  id: 'muestra-fabrica', level: 5, order: 2, title: 'La fábrica de monedas', cover: 'coin',
  pitch: 'Juntá monedas, comprá ayudantes que juntan solos y mejorá tu clic.',
  setup: base,
  toolbox: blocksForLevel(5),
  play: [
    { icon: '🪙', text: 'Cada vez que tocás la moneda, sumás monedas.' },
    { icon: '🤖', text: 'Robi cuesta 20: después junta una moneda por segundo.' },
    { icon: '⭐', text: 'La estrella cuesta 50: cada clic en la moneda vale más.' },
  ],
  goal: (p) => `Juntá ${target(p)}{moneda}`,
  pillars: [
    { id: 'variables', broken: 'Falta decir con cuántas monedas, ayudantes y valor por clic se empieza', ok: (p) => ['monedas', 'porClic', 'ayudantes'].every((v) => setOf(p, v).length > 0), restore: { sprite: 'moneda', script: SETUP() } },
    { id: 'clic', broken: 'Tocar {moneda} ya no suma monedas', ok: (p) => scriptsWith(p, 'a_click').some((s) => inside(s).some((b) => b.type === 'a_changevar' && b.fields.NAME === 'monedas' && (b.inputs.V?.type === 'v_var' || valueOf(b) > 0))), restore: { sprite: 'moneda', script: TAP() } },
    { id: 'comprar', broken: 'Tocar a {robi} ya no compra ayudantes', ok: (p) => changesOf(p, 'ayudantes').some((b) => Number(b.inputs.V?.fields.V) > 0), restore: { sprite: 'robi', script: BUY() } },
    { id: 'pagan', broken: 'Los ayudantes ya no juntan monedas', ok: (p) => scriptsWith(p, 'a_flag').some((s) => count(inside(s), 'a_forever') > 0 && inside(s).some((b) => b.type === 'a_changevar' && b.fields.NAME === 'monedas')), restore: { sprite: 'robi', script: PAY() } },
    { id: 'ganar', broken: 'Ya no se puede ganar', ok: (p) => blocksOf(p, 'a_win').length > 0, restore: { sprite: 'moneda', script: WIN() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'moneda', talker: 'robi', sounder: 'moneda', picture: false, sayBlock: 'a_sayfor', newPlace: 'castillo', newArt: 'apple', soundTap: 'moneda', soundWhere: (b) => b.fields.S === 'campana', sayAim: 'Que {robi} diga otra cosa cuando empieza el juego', soundAim: 'Que suene otro sonido cada vez que tocás a {moneda}' }),
    card({
      id: 'clic', icon: '👆', label: 'Más por clic', sprite: 'moneda',
      title: 'Que cada clic valga más al empezar',
      aim: 'Que cada clic en {moneda} sume más monedas',
      how: [{ t: 'En el [a_setvar] que dice porClic, cambiá el **1** por un número más grande', on: 'change' }, { t: 'Tocá **▶**, después tocá a {moneda}: ¡cada clic suma más!', on: 'try' }],
      block: { type: 'a_setvar', caption: 'Tocá el 1 y poné otro número.', where: (b) => b.fields.NAME === 'porClic' },
      concept: 'Variables: un número con nombre que el programa recuerda y cambia.', ask: '¿Qué variable cambiaste y qué pasó con cada clic?',
      built: (p) => setOf(p, 'porClic').some((b) => valueOf(b) !== 1),
      solve: (p) => { setOf(p, 'porClic')[0].inputs.V.fields.V = '3'; },
    }),
    card({
      id: 'meta', icon: '🏁', label: 'Meta', sprite: 'moneda',
      title: 'Cambiá cuántas monedas hay que juntar',
      aim: 'Que se gane con más o menos monedas',
      how: [{ t: 'Cambiá el **199** del [a_waituntil] por otro número', on: 'change' }, { t: 'Tocá **▶** y juntá monedas hasta ganar', on: 'try' }],
      block: { type: 'v_num', caption: 'Tocá el 199: se gana cuando hay más monedas que ese número.', where: (b) => Number(b.fields.V) === LIMIT },
      concept: 'Operadores: comparar dos números dice si algo se cumple.', ask: '¿Qué compara el juego para saber que ganaste?',
      built: (p) => limits(p).some((n) => n !== LIMIT),
      solve: (p) => { firstBlock(p, 'moneda', 'a_waituntil').inputs.C.inputs.B.fields.V = 99; },
    }),
    card({
      id: 'ayudantes', icon: '🤖', label: 'Ayudantes', sprite: 'moneda',
      title: 'Empezar con ayudantes',
      aim: 'Que empieces con ayudantes que juntan monedas solos',
      how: [{ t: 'En el [a_setvar] que dice ayudantes, cambiá el **0** por **2**', on: 'change' }, { t: 'Tocá **▶** y mirá cómo suben las monedas sin tocar nada', on: 'try' }],
      block: { type: 'a_setvar', caption: 'Tocá el 0 y poné cuántos ayudantes hay al empezar.', where: (b) => b.fields.NAME === 'ayudantes' },
      concept: 'Variables: el valor con el que empieza cambia todo lo que sigue.', ask: '¿Qué pasa con las monedas si empezás con más ayudantes?',
      built: (p) => setOf(p, 'ayudantes').some((b) => valueOf(b) !== 0),
      solve: (p) => { setOf(p, 'ayudantes')[0].inputs.V.fields.V = '2'; },
    }),
    card({
      id: 'mejora', icon: '⭐', label: 'Mejora', sprite: 'estrella',
      title: 'Una mejora más grande',
      aim: 'Que comprar la {estrella} mejore tu clic más que antes',
      how: [{ t: 'En el [a_changevar] que dice porClic, cambiá el **1** por uno más grande', on: 'change' }, { t: 'Tocá **▶**, juntá 50 monedas y tocá a {estrella}: ¡cada clic vale más!', on: 'try' }],
      block: { type: 'a_changevar', caption: 'Tocá el 1 y poné cuánto sube cada clic.', where: (b) => b.fields.NAME === 'porClic' },
      concept: 'Variables: sumarle a una variable la hace crecer.', ask: '¿Cuánto vale ahora cada clic después de comprar la mejora?',
      built: (p) => changesOf(p, 'porClic').some((b) => valueOf(b) >= 2),
      solve: (p) => { changesOf(p, 'porClic')[0].inputs.V.fields.V = 3; },
    }),
    card({
      id: 'azar', icon: '🎲', label: 'Azar', sprite: 'robi',
      title: 'Que paguen cuando quieran',
      aim: 'Que los ayudantes de {robi} paguen en tiempos distintos',
      how: [{ t: 'Poné [v_random] en el hueco de [a_wait], donde está el **1**', on: 'v_random' }, { t: 'Tocá **▶**, juntá 20 monedas y tocá a {robi}: ¡mirá cuándo suben!', on: 'try' }],
      demo: PAY(),
      example: [{ sprite: 'robi', scripts: [onFlag(forever(wait(randomBetween(1, 3)), changeVar('monedas', variable('ayudantes'))))] }],
      values: [{ type: 'v_random', into: 'a_wait', input: 'N' }],
      concept: 'Azar: el juego es distinto cada vez.', ask: '¿Qué cosa decide la computadora al azar?',
      built: (p) => blocksOf(p, 'v_random').length > blocksOf(base, 'v_random').length,
      solve: (p) => { firstBlock(p, 'robi', 'a_wait').inputs.N = randomBetween(1, 3); },
    }),
    card({
      id: 'nombre', icon: '🙋', label: 'Tu nombre', sprite: 'robi',
      title: 'Que te pregunte el nombre',
      aim: 'Que {robi} te pregunte cómo te llamás y te salude',
      how: [{ t: 'Poné [a_ask] arriba del [a_sayfor], justo abajo de [a_flag]', on: 'a_ask' }, { t: 'Poné [v_answer] en el hueco de [a_sayfor], donde está el texto', on: 'v_answer' }, { t: 'Tocá **▶**, escribí tu nombre y leé cómo te saluda {robi}', on: 'try' }],
      demo: onFlag(ask('¿Cómo te llamás?'), sayFor('¡Hola!', 2)),
      example: [{ sprite: 'robi', scripts: [onFlag(ask('¿Cómo te llamás?'), sayFor(join('¡Hola, ', answer()), 2))] }],
      values: [{ type: 'v_answer', into: 'a_sayfor', input: 'T' }],
      concept: 'Entrada y salida: el programa pregunta y usa la respuesta.', ask: '¿Dónde queda guardado lo que escribís?',
      built: (p) => blocksOf(p, 'a_ask').length > 0 && blocksOf(p, 'v_answer').length > 0,
      solve: (p) => addTo(p, 'robi', onFlag(ask('¿Cómo te llamás?'), sayFor(join('¡Hola, ', answer()), 2))),
    }),
    card({
      id: 'mundo', icon: '🌍', label: 'Otro mundo', sprite: 'estrella',
      title: 'El segundo mundo',
      aim: 'Que el juego pase a otro lugar cuando tengas más de 10 monedas',
      how: [{ t: 'Poné [a_waituntil] abajo del [a_say]', on: 'a_waituntil' }, { t: 'Poné [a_backdrop] abajo de [a_waituntil]', on: 'a_backdrop' }, { t: 'En [a_backdrop], elegí un lugar nuevo', on: 'tune' }, { t: 'Poné [v_gt] en el hueco de [a_waituntil]', on: 'v_gt' }, { t: 'Poné [v_var] a la izquierda del [v_gt]', on: 'v_var' }, { t: 'Tocá **▶** y juntá 11 monedas: ¡cambia el lugar!', on: 'try' }],
      demo: mundo('castillo'),
      example: [{ sprite: 'estrella', scripts: [mundo('castillo')] }],
      tune: { type: 'a_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      values: [{ type: 'v_gt', into: 'a_waituntil', input: 'C' }, { type: 'v_var', into: 'v_gt', input: 'A' }],
      concept: 'Condiciones: el juego cambia cuando una variable llega a cierto valor.', ask: '¿Qué tiene que pasar para cambiar de mundo?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'a_backdrop' && b.fields.B !== p.backdrop) && inside(sc).some((b) => b.type === 'a_waituntil' && b.inputs.C?.type === 'v_gt' && b.inputs.C.inputs.A?.type === 'v_var'))),
      solve: (p) => addTo(p, 'estrella', mundo(p.backdrop === 'nieve' ? 'mar' : 'nieve')),
    }),
  ],
});
