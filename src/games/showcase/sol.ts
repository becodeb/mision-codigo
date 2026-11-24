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
    { icon: '⭐', text: 'Tocá la estrella: suma un punto y se escapa.' },
    { icon: '👆', text: 'Tocá también a los personajes.' },
  ],
  pillars: [
    { id: 'estrella', broken: 'Nada suma estrellas cuando lo tocás', ok: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), 'f_star') > 0), restore: { sprite: 'estrella', script: fClick(fRandom(), fStar(), fSound('magia')) } },
  ],
  cards: [
    ...lookCards(base, { hero: 'toby', talker: 'toby', sounder: 'michi', picture: true, sayBlock: 'f_say', newPlace: 'playa', newArt: 'lumi' }),
    card({
      id: 'doble', icon: '⭐', label: 'Que valga más', sprite: 'estrella',
      title: 'Que valga 2 puntos', text: 'Hacé que al tocarla sume **dos estrellas o más** de una vez.',
      how: ['En {estrella}, buscá el bloque de la estrella.', 'Poné **otra estrella abajo**.', 'Tocala y mirá los puntos.'],
      demo: fClick(fRandom(), fStar(), fStar(), fSound('magia')),
      concept: 'Secuencia: las órdenes se cumplen una abajo de la otra.', ask: '¿Por qué ahora suma dos puntos?',
      built: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), 'f_star') >= 2),
      solve: (p) => { spriteOf(p, 'estrella').scripts[0].body.push(fStar()); },
    }),
    card({
      id: 'achicar', icon: '🤏', label: 'Que cambie de tamaño', sprite: 'estrella',
      title: 'Que cambie de tamaño', text: 'Que se **achique** o se **agrande** cuando la tocás. ¡Si se achica, cuesta más atraparla!',
      how: ['En {estrella}, agregá el bloque de **achicar** o el de **agrandar**.', 'Tocala varias veces.'],
      demo: fClick(fRandom(), fStar(), fSound('magia'), fShrink()),
      concept: 'Dificultad: un bloque puede hacer el juego más fácil o más difícil.', ask: '¿Qué le pasa cada vez que la tocás?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'f_grow', 'f_shrink') > 0)),
      solve: (p) => { spriteOf(p, 'estrella').scripts[0].body.push(fShrink()); },
    }),
    card({
      id: 'baile', icon: '🕺', label: 'Inventar un baile', sprite: 'toby',
      title: 'Inventá un baile', text: 'Que alguien haga **tres movimientos seguidos** cuando lo tocás.',
      how: ['En {toby}, abajo de la manito, agregá más movimientos.', 'Probá con un **giro** y otro **salto**.', 'Tocá a {toby} y mirá el baile.'],
      demo: fClick(fJump(), fSpin(), fJump(), fSound('guau')),
      concept: 'Secuencia: el orden de los bloques cambia lo que pasa.', ask: '¿En qué orden se mueve? ¿Dónde lo dice?',
      built: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), ...MOVES) >= 3),
      solve: (p) => { spriteOf(p, 'toby').scripts[1].body.push(fSpin(), fJump()); },
    }),
    card({
      id: 'cara', icon: '😮', label: 'Poner una cara', sprite: 'michi',
      title: 'Que ponga una cara', text: 'Que un personaje **cambie de cara** cuando lo tocás.',
      how: ['En {michi}, abajo de la manito, poné el bloque de la **carita**.', 'Tocá la carita y elegí cuál.', 'Tocá a {michi}.'],
      demo: fClick(fFace('sorpresa'), fSpin(), fSound('miau')),
      concept: 'Eventos: algo pasa cuando alguien toca.', ask: '¿Qué tiene que pasar para que cambie de cara?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => count(inside(sc), 'f_face') > 0)),
      solve: (p) => { spriteOf(p, 'michi').scripts[0].body.push(fFace('sorpresa')); },
    }),
    card({
      id: 'viaje', icon: '🚀', label: 'Viajar al tocarlo', sprite: 'michi',
      title: 'Un viaje', text: 'Que al tocar a alguien **todo cambie de lugar**.',
      how: ['En {michi}, poné el bloque de **cambiar de lugar**.', 'Tocá el dibujito y elegí **otro lugar**.', 'Tocá a {michi}. ¡Viajaste!'],
      demo: fClick(fSpin(), fSound('miau'), fBackdrop('espacio')),
      concept: 'Eventos: un toque puede cambiar todo el juego.', ask: '¿Qué bloque hace el viaje?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'f_backdrop' && b.fields.B !== p.backdrop))),
      solve: (p) => { spriteOf(p, 'michi').scripts[0].body.push(fBackdrop(p.backdrop === 'nieve' ? 'mar' : 'nieve')); },
    }),
    card({
      id: 'amigo', icon: '➕', label: 'Sumar un amigo', newSprite: true, point: 'add-sprite',
      title: 'Sumá un amigo', text: 'Agregá alguien nuevo y **programá qué hace** cuando lo tocan.',
      how: ['Tocá **Agregar** y elegí a alguien.', 'Poné la **manito**, y abajo lo que vos quieras.', 'Tocalo para probar.'],
      demo: fClick(fJump()),
      concept: 'Crear: programar un personaje desde cero.', ask: '¿Qué le programaste al personaje nuevo?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => sc.body.length > 0)),
      solve: (p) => addSprite(p, 'coni', fClick(fJump())),
    }),
  ],
});
