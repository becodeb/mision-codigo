/** Equipo Sol: atrapar una estrella que se escapa. Bloques con dibujos. */
import { fBackdrop, fClick, fFace, fFlag, fJump, fRandom, fSay, fShrink, fSound, fSpin, fStar, project, sprite } from '../../language/ir.ts';
import type { BlockType } from '../../language/catalog.ts';
import { addSprite, card, count, inside, lookCards, newSprites, scriptsWith, showcaseGame, spriteOf } from './kit.ts';

const MOVES: BlockType[] = ['f_jump', 'f_spin', 'f_left', 'f_right', 'f_up', 'f_down', 'f_grow', 'f_shrink', 'f_random'];

const base = project('parque', [
  sprite('toby', 'toby', [fFlag(fSay('JUGAR')), fClick(fJump(), fSound('guau'))], { x: -165, y: -115, name: 'Toby' }),
  sprite('michi', 'michi', [fClick(fSpin(), fSound('miau'))], { x: 165, y: -115, name: 'Michi', flip: -1 }),
  sprite('estrella', 'star', [fClick(fRandom(), fStar(), fSound('magia'))], { x: 20, y: 10, size: 120, name: 'Estrella' }),
]);

export const ESTRELLA_FUGITIVA = showcaseGame({
  id: 'muestra-estrella', level: 1, title: 'La estrella que se escapa', cover: 'star',
  pitch: 'Tocá la estrella antes de que se vaya a otro lado.',
  setup: base,
  toolbox: ['f_flag', 'f_click', 'f_say', 'f_text', 'f_right', 'f_left', 'f_up', 'f_down', 'f_jump', 'f_spin', 'f_face', 'f_grow', 'f_shrink', 'f_sound', 'f_backdrop', 'f_star', 'f_random'],
  play: [
    { icon: '⭐', text: 'Cada vez que la atrapás sumás un punto y se escapa.' },
    { icon: '👆', text: 'Probá también con los personajes.' },
  ],
  goal: () => 'Atrapá a {estrella} todas las veces que puedas',
  pillars: [
    { id: 'estrella', broken: 'Nada suma estrellas cuando lo tocás', ok: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), 'f_star') > 0), restore: { sprite: 'estrella', script: fClick(fRandom(), fStar(), fSound('magia')) } },
  ],
  cards: [
    ...lookCards(base, { hero: 'toby', talker: 'toby', sounder: 'michi', picture: true, sayBlock: 'f_say', newPlace: 'playa', newArt: 'lumi', soundTap: 'michi' }),
    card({
      id: 'doble', icon: '⭐', label: 'Más puntos', sprite: 'estrella',
      title: 'Que valga 2 puntos',
      how: [{ t: 'Poné otra [f_star]', on: 'f_star' }, { t: 'Tocá a {estrella}', on: 'try' }], tap: 'estrella',
      demo: fClick(fRandom(), fStar(), fStar(), fSound('magia')),
      concept: 'Secuencia: las órdenes se cumplen una abajo de la otra.', ask: '¿Por qué ahora suma dos puntos?',
      built: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), 'f_star') >= 2),
      solve: (p) => { spriteOf(p, 'estrella').scripts[0].body.push(fStar()); },
    }),
    card({
      id: 'achicar', icon: '🤏', label: 'Tamaño', sprite: 'estrella',
      title: 'Que cambie de tamaño',
      how: [{ t: 'Poné [f_shrink]', on: 'f_shrink' }, { t: 'Tocá a {estrella}', on: 'try' }], tap: 'estrella',
      demo: fClick(fRandom(), fStar(), fSound('magia'), fShrink()),
      concept: 'Dificultad: un bloque puede hacer el juego más fácil o más difícil.', ask: '¿Qué le pasa cada vez que la tocás?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'f_grow', 'f_shrink') > 0)),
      solve: (p) => { spriteOf(p, 'estrella').scripts[0].body.push(fShrink()); },
    }),
    card({
      id: 'baile', icon: '🕺', label: 'Baile', sprite: 'toby',
      title: 'Inventá un baile',
      how: [{ t: 'Poné [f_spin]', on: 'f_spin' }, { t: 'Poné [f_jump]', on: 'f_jump' }, { t: 'Tocá a {toby}', on: 'try' }], tap: 'toby',
      demo: fClick(fJump(), fSpin(), fJump(), fSound('guau')),
      concept: 'Secuencia: el orden de los bloques cambia lo que pasa.', ask: '¿En qué orden se mueve? ¿Dónde lo dice?',
      built: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), ...MOVES) >= 3),
      solve: (p) => { spriteOf(p, 'toby').scripts[1].body.push(fSpin(), fJump()); },
    }),
    card({
      id: 'cara', icon: '😮', label: 'Cara', sprite: 'michi',
      title: 'Que ponga una cara',
      how: [{ t: 'Poné [f_face]', on: 'f_face' }, { t: 'Tocá a {michi}', on: 'try' }], tap: 'michi',
      demo: fClick(fFace('sorpresa'), fSpin(), fSound('miau')),
      concept: 'Eventos: algo pasa cuando alguien toca.', ask: '¿Qué tiene que pasar para que cambie de cara?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'f_face') > 0)),
      solve: (p) => { spriteOf(p, 'michi').scripts[0].body.push(fFace('sorpresa')); },
    }),
    card({
      id: 'viaje', icon: '🚀', label: 'Viaje', sprite: 'michi',
      title: 'Un viaje',
      how: [{ t: 'Poné [f_backdrop]', on: 'f_backdrop' }, { t: 'Elegí otro lugar', on: 'tune' }, { t: 'Tocá a {michi}', on: 'try' }], tap: 'michi',
      demo: fClick(fSpin(), fSound('miau'), fBackdrop('espacio')),
      tune: { type: 'f_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Eventos: un toque puede cambiar todo el juego.', ask: '¿Qué bloque hace el viaje?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'f_backdrop' && b.fields.B !== p.backdrop))),
      solve: (p) => { spriteOf(p, 'michi').scripts[0].body.push(fBackdrop(p.backdrop === 'nieve' ? 'mar' : 'nieve')); },
    }),
    card({
      id: 'amigo', icon: '➕', label: 'Amigo', newSprite: true, point: 'add-sprite',
      title: 'Sumá un amigo',
      how: [{ t: 'Tocá **+ Agregar**', on: 'add' }, { t: 'Poné [f_click]', on: 'f_click' }, { t: 'Poné [f_jump]', on: 'f_jump' }, { t: 'Tocalo', on: 'try' }], tap: 'new',
      demo: fClick(fJump()),
      concept: 'Crear: programar un personaje desde cero.', ask: '¿Qué le programaste al personaje nuevo?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => sc.body.length > 0)),
      solve: (p) => addSprite(p, 'coni', fClick(fJump())),
    }),
  ],
});
