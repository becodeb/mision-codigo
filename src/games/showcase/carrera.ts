/** Equipo Carrera: dos corredores y un tesoro en la meta. Bloques con dibujos, un clic por paso. */
import { fBackdrop, fClick, fFace, fFlag, fJump, fRight, fSay, fSound, fSpin, fStar, project, sprite } from '../../language/ir.ts';
import { addSprite, card, clicksOf, count, inside, lookCards, newSprites, showcaseGame, spriteOf } from './kit.ts';

const RACERS = ['tomi', 'coni'];
const STEP = (sound: string) => fClick(fStar(), fRight(), fSound(sound));
const FINISH = () => fClick(fStar(), fJump(), fSound('fanfarria'));

const base = project('parque', [
  sprite('tesoro', 'treasure', [FINISH()], { x: 190, y: -96, size: 160, name: 'Tesoro' }),
  sprite('tomi', 'tomi', [fFlag(fSay('JUGAR')), STEP('silbato')], { x: -205, y: -55, size: 65, name: 'Tomi' }),
  sprite('coni', 'coni', [STEP('boing')], { x: -205, y: -140, size: 65, name: 'Coni' }),
]);

export const LA_GRAN_CARRERA = showcaseGame({
  id: 'muestra-carrera', level: 1, order: 2, title: 'La gran carrera', cover: 'tomi',
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
    ...lookCards(base, { hero: 'tomi', talker: 'tomi', sounder: 'coni', picture: true, sayBlock: 'f_say', newPlace: 'playa', newArt: 'lumi', soundTap: 'coni' }),
    card({
      id: 'rapido', icon: '⚡', label: 'Más rápido', sprite: 'tomi',
      title: 'Que dé pasos más largos',
      how: [{ t: 'Poné otra [f_right]', on: 'f_right' }, { t: 'Tocá a {tomi}', on: 'try' }], tap: 'tomi',
      demo: fClick(fStar(), fRight(), fRight(), fSound('silbato')),
      concept: 'Secuencia: las órdenes se cumplen una abajo de la otra.', ask: '¿Por qué ahora avanza más con cada clic?',
      built: (p) => clicksOf(p, ...RACERS).some((s) => count(inside(s), 'f_right') >= 2),
      solve: (p) => { spriteOf(p, 'tomi').scripts[1].body.push(fRight()); },
    }),
    card({
      id: 'salto', icon: '🦘', label: 'Salto', sprite: 'coni',
      title: 'Un salto en el camino',
      how: [{ t: 'Poné [f_jump]', on: 'f_jump' }, { t: 'Tocá a {coni}', on: 'try' }], tap: 'coni',
      demo: fClick(fStar(), fRight(), fJump(), fSound('boing')),
      concept: 'Secuencia: el orden de los bloques cambia lo que pasa.', ask: '¿Cuándo salta: antes o después de avanzar?',
      built: (p) => clicksOf(p, ...RACERS).some((s) => count(inside(s), 'f_jump') > 0),
      solve: (p) => { spriteOf(p, 'coni').scripts[0].body.push(fJump()); },
    }),
    card({
      id: 'giro', icon: '🌀', label: 'Giro', sprite: 'tomi',
      title: 'Una vuelta en cada paso',
      how: [{ t: 'Poné [f_spin]', on: 'f_spin' }, { t: 'Tocá a {tomi}', on: 'try' }], tap: 'tomi',
      demo: fClick(fStar(), fRight(), fSpin(), fSound('silbato')),
      concept: 'Eventos: un clic puede hacer varias cosas, una tras otra.', ask: '¿Qué hace {tomi} cuando lo tocás?',
      built: (p) => clicksOf(p, ...RACERS).some((s) => count(inside(s), 'f_spin') > 0),
      solve: (p) => { spriteOf(p, 'tomi').scripts[1].body.push(fSpin()); },
    }),
    card({
      id: 'cara', icon: '😮', label: 'Cara', sprite: 'coni',
      title: 'Que ponga una cara',
      how: [{ t: 'Poné [f_face]', on: 'f_face' }, { t: 'Tocá a {coni}', on: 'try' }], tap: 'coni',
      demo: fClick(fStar(), fRight(), fFace('sorpresa'), fSound('boing')),
      concept: 'Eventos: algo pasa cuando alguien toca.', ask: '¿Qué tiene que pasar para que cambie de cara?',
      built: (p) => clicksOf(p, ...RACERS).some((s) => count(inside(s), 'f_face') > 0),
      solve: (p) => { spriteOf(p, 'coni').scripts[0].body.push(fFace('sorpresa')); },
    }),
    card({
      id: 'fiesta', icon: '🎊', label: 'Fiesta', sprite: 'tesoro',
      title: 'Una fiesta en la meta',
      how: [{ t: 'Poné [f_backdrop]', on: 'f_backdrop' }, { t: 'Elegí otro lugar', on: 'tune' }, { t: 'Tocá a {tesoro}', on: 'try' }], tap: 'tesoro',
      demo: fClick(fStar(), fSound('fanfarria'), fJump(), fBackdrop('castillo')),
      tune: { type: 'f_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Eventos: un toque puede cambiar todo el juego.', ask: '¿Qué bloque cambia el lugar de la fiesta?',
      built: (p) => clicksOf(p, 'tesoro').some((s) => inside(s).some((b) => b.type === 'f_backdrop' && b.fields.B !== p.backdrop)),
      solve: (p) => { spriteOf(p, 'tesoro').scripts[0].body.push(fBackdrop(p.backdrop === 'castillo' ? 'nieve' : 'castillo')); },
    }),
    card({
      id: 'amigo', icon: '➕', label: 'Corredor', newSprite: true, point: 'add-sprite',
      title: 'Sumá otro corredor',
      how: [{ t: 'Tocá **+ Agregar**', on: 'add' }, { t: 'Poné [f_click]', on: 'f_click' }, { t: 'Poné [f_right]', on: 'f_right' }, { t: 'Tocalo', on: 'try' }], tap: 'new',
      demo: fClick(fRight()),
      concept: 'Crear: programar un personaje desde cero.', ask: '¿Qué le programaste al corredor nuevo?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => count(inside(sc), 'f_right') > 0)),
      solve: (p) => addSprite(p, 'pipo', fClick(fRight())),
    }),
  ],
});
