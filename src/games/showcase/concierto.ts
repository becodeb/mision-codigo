/** Equipo Concierto: cuatro músicos que tocan y bailan al mismo tiempo, y un rayo que cambia el escenario. Bloques con dibujos. */
import { fBackdrop, fClick, fFace, fFlag, fJump, fNote, fSay, fSound, fSpin, fStar, project, sprite } from '../../language/ir.ts';
import type { BlockType } from '../../language/catalog.ts';
import { addSprite, card, clicksOf, count, inside, lookCards, newSprites, showcaseGame, spriteOf } from './kit.ts';

const BAND = ['robi', 'michi', 'toby', 'pulpi'];
const MOVES: BlockType[] = ['f_jump', 'f_spin', 'f_left', 'f_right', 'f_up', 'f_down', 'f_grow', 'f_shrink'];

const base = project('teatro', [
  sprite('robi', 'robi', [fFlag(fSay('HOLA')), fClick(fStar(), fNote('do'), fNote('mi'), fNote('sol')), fClick(fJump(), fJump())], { x: -165, y: -125, size: 75, name: 'Robi' }),
  sprite('michi', 'michi', [fClick(fStar(), fNote('re'), fNote('fa'), fNote('la')), fClick(fSpin())], { x: -55, y: -125, name: 'Michi' }),
  sprite('toby', 'toby', [fClick(fStar(), fNote('mi'), fNote('sol'), fNote('si')), fClick(fJump(), fSpin())], { x: 55, y: -125, name: 'Toby' }),
  sprite('pulpi', 'pulpi', [fClick(fStar(), fNote('sol'), fNote('mi'), fNote('do')), fClick(fSpin(), fSpin())], { x: 165, y: -125, name: 'Pulpi' }),
  sprite('luces', 'bolt', [fClick(fBackdrop('espacio'), fSpin(), fSound('magia'))], { x: 0, y: 45, size: 160, name: 'Luces' }),
]);

export const EL_CONCIERTO = showcaseGame({
  id: 'muestra-concierto', level: 1, order: 3, title: 'El concierto', cover: 'robi',
  pitch: 'Cada músico toca su canción y baila. ¡Armá tu concierto!',
  setup: base,
  toolbox: ['f_flag', 'f_click', 'f_say', 'f_text', 'f_right', 'f_left', 'f_up', 'f_down', 'f_jump', 'f_spin', 'f_face', 'f_grow', 'f_shrink', 'f_sound', 'f_backdrop', 'f_star', 'f_note'],
  play: [
    { icon: '🎵', text: 'Cada músico toca sus notas cuando lo tocás.' },
    { icon: '🎶', text: 'Tocalos en el orden que quieras: así armás tu canción.' },
    { icon: '💡', text: 'Las luces cambian el escenario. Para volver, tocá Empezar.' },
  ],
  goal: () => 'Tocá una canción con {robi}, {michi}, {toby} y {pulpi}',
  pillars: [
    { id: 'musica', broken: '{robi} ya no toca notas', ok: (p) => clicksOf(p, ...p.sprites.map((s) => s.id)).some((s) => count(inside(s), 'f_note') > 0), restore: { sprite: 'robi', script: fClick(fStar(), fNote('do'), fNote('mi'), fNote('sol')) } },
    { id: 'baile', broken: '{michi} ya no baila', ok: (p) => clicksOf(p, ...p.sprites.map((s) => s.id)).some((s) => count(inside(s), ...MOVES) > 0), restore: { sprite: 'michi', script: fClick(fSpin()) } },
  ],
  cards: [
    ...lookCards(base, { hero: 'michi', talker: 'robi', sounder: 'luces', picture: true, sayBlock: 'f_say', newPlace: 'ciudad', newArt: 'lumi', soundTap: 'luces' }),
    card({
      id: 'componer', icon: '🎵', label: 'Componer', sprite: 'robi',
      title: 'Componé una canción más larga',
      how: [{ t: 'Poné dos [f_note]', on: 'f_note' }, { t: 'Tocá a {robi}', on: 'try' }], tap: 'robi',
      demo: fClick(fStar(), fNote('do'), fNote('mi'), fNote('sol'), fNote('mi'), fNote('do')),
      concept: 'Secuencia: las notas suenan una atrás de la otra.', ask: '¿En qué orden suenan las notas?',
      built: (p) => clicksOf(p, ...BAND).some((s) => count(inside(s), 'f_note') >= 5),
      solve: (p) => { spriteOf(p, 'robi').scripts[1].body.push(fNote('mi'), fNote('do')); },
    }),
    card({
      id: 'coreo', icon: '💃', label: 'Coreografía', sprite: 'michi',
      title: 'Inventá una coreografía',
      how: [{ t: 'Poné [f_jump]', on: 'f_jump' }, { t: 'Poné otra [f_spin]', on: 'f_spin' }, { t: 'Tocá a {michi}', on: 'try' }], tap: 'michi',
      demo: fClick(fSpin(), fJump(), fSpin()),
      concept: 'Eventos: un clic puede empezar dos cosas a la vez.', ask: '¿Qué hace {michi} mientras toca?',
      built: (p) => clicksOf(p, ...BAND).some((s) => count(inside(s), ...MOVES) >= 3),
      solve: (p) => { spriteOf(p, 'michi').scripts[1].body.push(fJump(), fSpin()); },
    }),
    card({
      id: 'cara', icon: '😮', label: 'Cara', sprite: 'toby',
      title: 'Que ponga una cara',
      how: [{ t: 'Poné [f_face]', on: 'f_face' }, { t: 'Tocá a {toby}', on: 'try' }], tap: 'toby',
      demo: fClick(fFace('risa'), fJump(), fSpin()),
      concept: 'Eventos: algo pasa cuando alguien toca.', ask: '¿Qué tiene que pasar para que cambie de cara?',
      built: (p) => clicksOf(p, ...BAND).some((s) => count(inside(s), 'f_face') > 0),
      solve: (p) => { spriteOf(p, 'toby').scripts[1].body.push(fFace('risa')); },
    }),
    card({
      id: 'tambor', icon: '🥁', label: 'Tambor', sprite: 'pulpi',
      title: 'Sumá un sonido',
      how: [{ t: 'Poné [f_sound]', on: 'f_sound' }, { t: 'Tocá a {pulpi}', on: 'try' }], tap: 'pulpi',
      demo: fClick(fStar(), fNote('sol'), fNote('mi'), fNote('do'), fSound('tambor')),
      concept: 'Datos: un sonido y una nota se mezclan en la misma canción.', ask: '¿Cuándo suena el tambor?',
      built: (p) => clicksOf(p, ...BAND).some((s) => count(inside(s), 'f_sound') > 0),
      solve: (p) => { spriteOf(p, 'pulpi').scripts[0].body.push(fSound('tambor')); },
    }),
    card({
      id: 'escena', icon: '🌟', label: 'Escena', sprite: 'toby',
      title: 'Que cambie el escenario',
      how: [{ t: 'Poné [f_backdrop]', on: 'f_backdrop' }, { t: 'Elegí otro lugar', on: 'tune' }, { t: 'Tocá a {toby}', on: 'try' }], tap: 'toby',
      demo: fClick(fStar(), fNote('mi'), fNote('sol'), fNote('si'), fBackdrop('castillo')),
      tune: { type: 'f_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Eventos: un toque puede cambiar todo el juego.', ask: '¿Qué bloque cambia el escenario?',
      built: (p) => clicksOf(p, ...BAND).some((s) => inside(s).some((b) => b.type === 'f_backdrop' && b.fields.B !== p.backdrop)),
      solve: (p) => { spriteOf(p, 'toby').scripts[0].body.push(fBackdrop(p.backdrop === 'castillo' ? 'nieve' : 'castillo')); },
    }),
    card({
      id: 'musico', icon: '➕', label: 'Músico', newSprite: true, point: 'add-sprite',
      title: 'Sumá un músico',
      how: [{ t: 'Tocá **+ Agregar**', on: 'add' }, { t: 'Poné [f_click]', on: 'f_click' }, { t: 'Poné [f_note]', on: 'f_note' }, { t: 'Tocalo', on: 'try' }], tap: 'new',
      demo: fClick(fNote('sol')),
      concept: 'Crear: programar un personaje desde cero.', ask: '¿Qué notas le programaste al músico nuevo?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => count(inside(sc), 'f_note') > 0)),
      solve: (p) => addSprite(p, 'coni', fClick(fNote('sol'))),
    }),
  ],
});
