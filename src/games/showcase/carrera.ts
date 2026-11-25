/** Equipo Carrera: dos corredores y un tesoro en la meta. Bloques con dibujos, un clic por paso. */
import { fBackdrop, fClick, fFace, fFlag, fJump, fRight, fSay, fSound, fSpin, fStar, project, sprite } from '../../language/ir.ts';
import { addSprite, card, clicksOf, count, inside, lookCards, newSprites, showcaseGame, spriteOf } from './kit.ts';

const RACERS = ['tomi', 'coni'];
const STEP = (sound: string) => fClick(fStar(), fRight(), fSound(sound));
const FINISH = () => fClick(fStar(), fJump(), fSound('fanfarria'));

const base = project('ciudad', [
  sprite('tesoro', 'treasure', [FINISH()], { x: 190, y: -130, size: 160, name: 'Tesoro' }),
  sprite('tomi', 'tomi', [fFlag(fSay('JUGAR')), STEP('silbato')], { x: -205, y: -78, size: 65, name: 'Tomi' }),
  sprite('coni', 'coni', [STEP('boing')], { x: -205, y: -160, size: 65, name: 'Coni' }),
]);

export const LA_GRAN_CARRERA = showcaseGame({
  id: 'muestra-carrera', level: 1, order: 2, title: 'La gran carrera', cover: 'tomi', hands: RACERS,
  pitch: 'Cada clic hace avanzar a tu corredor. ¡Llegá primero al tesoro!',
  setup: base,
  toolbox: ['f_flag', 'f_click', 'f_say', 'f_text', 'f_right', 'f_left', 'f_up', 'f_down', 'f_jump', 'f_spin', 'f_face', 'f_grow', 'f_shrink', 'f_sound', 'f_backdrop', 'f_star'],
  play: [
    { icon: '🏃', text: 'Cada vez que tocás a tu corredor, da un paso.' },
    { icon: '🏆', text: '¡Llegá al tesoro y tocalo para festejar!' },
    { icon: '👫', text: 'Se puede jugar de a dos: cada uno con su corredor.' },
  ],
  goal: () => 'Llevá a {tomi} o a {coni} hasta {tesoro}',
  pillars: [
    { id: 'avanzan', broken: '{tomi} ya no avanza', ok: (p) => clicksOf(p, ...p.sprites.map((s) => s.id)).some((s) => count(inside(s), 'f_right') > 0), restore: { sprite: 'tomi', script: STEP('silbato') } },
    { id: 'meta', broken: 'Nada pasa cuando tocás {tesoro}', ok: (p) => clicksOf(p, 'tesoro').some((s) => count(inside(s), 'f_star') > 0), restore: { sprite: 'tesoro', script: FINISH() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'tomi', talker: 'tomi', sounder: 'coni', picture: true, sayBlock: 'f_say', newPlace: 'playa', newArt: 'lumi', soundTap: 'coni', sayAim: 'Que {tomi} diga otra cosa cuando empieza el juego', soundAim: 'Que al tocar a {coni} suene un sonido distinto' }),
    card({
      id: 'rapido', icon: '⚡', label: 'Más rápido', sprite: 'tomi',
      title: 'Que dé pasos más largos',
      aim: 'Que {tomi} avance más lejos con cada clic',
      how: [{ t: 'Poné otro [f_right] abajo del [f_right] de {tomi}', on: 'f_right' }, { t: 'Tocá a {tomi}: ¡avanza más con cada toque!', on: 'try' }], tap: 'tomi',
      demo: fClick(fStar(), fRight(), fRight(), fSound('silbato')),
      concept: 'Secuencia: las órdenes se cumplen una abajo de la otra.', ask: '¿Por qué ahora avanza más con cada clic?',
      built: (p) => clicksOf(p, ...RACERS).some((s) => count(inside(s), 'f_right') >= 2),
      solve: (p) => { spriteOf(p, 'tomi').scripts[1].body.push(fRight()); },
    }),
    card({
      id: 'salto', icon: '🦘', label: 'Salto', sprite: 'coni',
      title: 'Un salto en el camino',
      aim: 'Que {coni} salte en cada paso que da',
      how: [{ t: 'Poné [f_jump] abajo de [f_right]', on: 'f_jump' }, { t: 'Tocá a {coni}: ¡avanza y salta!', on: 'try' }], tap: 'coni',
      demo: fClick(fStar(), fRight(), fJump(), fSound('boing')),
      concept: 'Secuencia: el orden de los bloques cambia lo que pasa.', ask: '¿Cuándo salta: antes o después de avanzar?',
      built: (p) => clicksOf(p, ...RACERS).some((s) => count(inside(s), 'f_jump') > 0),
      solve: (p) => { spriteOf(p, 'coni').scripts[0].body.push(fJump()); },
    }),
    card({
      id: 'giro', icon: '🌀', label: 'Giro', sprite: 'tomi',
      title: 'Una vuelta en cada paso',
      aim: 'Que {tomi} dé una vuelta en cada paso',
      how: [{ t: 'Poné [f_spin] abajo de [f_right]', on: 'f_spin' }, { t: 'Tocá a {tomi}: ¡avanza y gira!', on: 'try' }], tap: 'tomi',
      demo: fClick(fStar(), fRight(), fSpin(), fSound('silbato')),
      concept: 'Eventos: un clic puede hacer varias cosas, una tras otra.', ask: '¿Qué hace el corredor cuando lo tocás?',
      built: (p) => clicksOf(p, ...RACERS).some((s) => count(inside(s), 'f_spin') > 0),
      solve: (p) => { spriteOf(p, 'tomi').scripts[1].body.push(fSpin()); },
    }),
    card({
      id: 'cara', icon: '😮', label: 'Cara', sprite: 'coni',
      title: 'Que ponga una cara',
      aim: 'Que {coni} ponga una cara cuando avanza',
      how: [{ t: 'Poné [f_face] abajo de [f_right]', on: 'f_face' }, { t: 'Tocá a {coni} y mirá qué cara pone', on: 'try' }], tap: 'coni',
      demo: fClick(fStar(), fRight(), fFace('sorpresa'), fSound('boing')),
      concept: 'Eventos: algo pasa cuando alguien toca.', ask: '¿Qué tiene que pasar para que cambie de cara?',
      built: (p) => clicksOf(p, ...RACERS).some((s) => count(inside(s), 'f_face') > 0),
      solve: (p) => { spriteOf(p, 'coni').scripts[0].body.push(fFace('sorpresa')); },
    }),
    card({
      id: 'fiesta', icon: '🎊', label: 'Fiesta', sprite: 'tesoro',
      title: 'Una fiesta en la meta',
      aim: 'Que al tocar a {tesoro} el juego pase a otro lugar, como una fiesta',
      how: [{ t: 'Poné [f_backdrop] al final, abajo de todos los bloques', on: 'f_backdrop' }, { t: 'En [f_backdrop], elegí un lugar nuevo', on: 'tune' }, { t: 'Tocá a {tesoro}: ¡empieza la fiesta!', on: 'try' }], tap: 'tesoro',
      demo: fClick(fStar(), fSound('fanfarria'), fJump(), fBackdrop('castillo')),
      tune: { type: 'f_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Eventos: un toque puede cambiar todo el juego.', ask: '¿Qué bloque cambia el lugar de la fiesta?',
      built: (p) => clicksOf(p, 'tesoro').some((s) => inside(s).some((b) => b.type === 'f_backdrop' && b.fields.B !== p.backdrop)),
      solve: (p) => { spriteOf(p, 'tesoro').scripts[0].body.push(fBackdrop(p.backdrop === 'castillo' ? 'nieve' : 'castillo')); },
    }),
    card({
      id: 'amigo', icon: '➕', label: 'Corredor', newSprite: true, point: 'add-sprite',
      title: 'Sumá otro corredor',
      aim: 'Que un corredor nuevo avance cuando lo tocás',
      how: [{ t: 'Tocá **+ Agregar** y sumá un personaje', on: 'add' }, { t: 'Traé [f_click] a un lugar vacío', on: 'f_click' }, { t: 'Poné [f_right] abajo de [f_click]', on: 'f_right' }, { t: 'Tocá al corredor nuevo: ¡avanza!', on: 'try' }], tap: 'new',
      demo: fClick(fRight()),
      concept: 'Crear: programar un personaje desde cero.', ask: '¿Qué le programaste al corredor nuevo?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => count(inside(sc), 'f_right') > 0)),
      solve: (p) => addSprite(p, 'pipo', fClick(fRight())),
    }),
  ],
});
