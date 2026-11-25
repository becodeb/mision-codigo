/** Equipo Cadena: un clic en la pelota y los personajes se avisan con sobres, uno tras otro. Bloques con dibujos, con mensajes. */
import { fClick, fFlag, fJump, fNote, fRecv, fRepeat, fSay, fSend, fSound, fSpin, fStar, fWait, fBackdrop, project, sprite } from '../../language/ir.ts';
import { blocksForLevel, type BlockType } from '../../language/catalog.ts';
import { addSprite, blocksOf, card, count, inside, lookCards, newSprites, scriptsWith, showcaseGame, spriteOf } from './kit.ts';

const DANCE: BlockType[] = ['f_jump', 'f_spin', 'f_left', 'f_right', 'f_up', 'f_down', 'f_grow', 'f_shrink'];
const START = () => fClick(fSpin(), fSend('red'), fSound('tambor'));

const base = project('parque', [
  sprite('pelota', 'ball', [START()], { x: -180, y: -125, size: 150, name: 'Pelota' }),
  sprite('toby', 'toby', [fFlag(fSay('JUGAR')), fRecv('red', fJump(), fSend('blue'), fSound('guau'))], { x: -65, y: -125, name: 'Toby' }),
  sprite('pulpi', 'pulpi', [fRecv('blue', fSpin(), fSend('yellow'), fSound('magia'))], { x: 50, y: -125, name: 'Pulpi' }),
  sprite('estrella', 'star', [fRecv('yellow', fSpin(), fStar(), fSound('fanfarria'))], { x: 170, y: -115, size: 130, name: 'Estrella' }),
]);

/** Hats that listen to an envelope colour more than once, in different sprites. */
const sharedColour = (p: typeof base): boolean => {
  const heard = scriptsWith(p, 'f_recv', () => true).filter((s) => s.body.length > 0).map((s) => String(s.hat.fields.C));
  return heard.some((c, i) => heard.indexOf(c) !== i);
};

export const REACCION_EN_CADENA = showcaseGame({
  id: 'muestra-cadena', level: 2, order: 2, title: 'Reacción en cadena', cover: 'ball',
  pitch: 'La pelota avisa a Toby, Toby a Pulpi y Pulpi a la estrella. ¡Una cadena!',
  setup: base,
  toolbox: blocksForLevel(2),
  play: [
    { icon: '⚽', text: 'Tocá la pelota: rueda y le manda un sobre a Toby.' },
    { icon: '✉️', text: 'Cada uno hace lo suyo y le manda un sobre al que sigue.' },
    { icon: '⭐', text: 'Al final la estrella gana un punto.' },
  ],
  goal: () => 'Empezá la cadena con {pelota}',
  pillars: [
    { id: 'empieza', broken: '{pelota} ya no manda el sobre', ok: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), 'f_send') > 0), restore: { sprite: 'pelota', script: START() } },
    { id: 'final', broken: 'Nadie suma la estrella al final', ok: (p) => scriptsWith(p, 'f_recv').some((s) => count(inside(s), 'f_star') > 0), restore: { sprite: 'estrella', script: fRecv('yellow', fSpin(), fStar(), fSound('fanfarria')) } },
  ],
  cards: [
    ...lookCards(base, { hero: 'estrella', talker: 'toby', sounder: 'pelota', picture: true, sayBlock: 'f_say', newPlace: 'selva', newArt: 'heart', soundTap: 'pelota' }),
    card({
      id: 'eslabon', icon: '➕', label: 'Eslabón', newSprite: true, point: 'add-sprite',
      title: 'Sumá un eslabón más',
      how: [{ t: 'Tocá **+ Agregar**', on: 'add' }, { t: 'Poné [f_recv]', on: 'f_recv' }, { t: 'Poné [f_jump]', on: 'f_jump' }, { t: 'Tocá a {pelota}', on: 'try' }], tap: 'pelota',
      demo: fRecv('red', fJump()),
      concept: 'Mensajes: un personaje nuevo puede enterarse de lo que pasa.', ask: '¿Cómo se entera el personaje nuevo?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => sc.hat.type === 'f_recv' && sc.body.length > 0)),
      solve: (p) => addSprite(p, 'pipo', fRecv('yellow', fJump())),
    }),
    card({
      id: 'esperar', icon: '⏱️', label: 'Esperar', sprite: 'toby',
      title: 'Que Toby se tome su tiempo',
      how: [{ t: 'Poné [f_wait]', on: 'f_wait' }, { t: 'Tocá a {pelota}', on: 'try' }], tap: 'pelota',
      demo: fRecv('red', fWait(1), fJump(), fSend('blue'), fSound('guau')),
      concept: 'Tiempo: una espera hace que cada cosa pase en su momento.', ask: '¿Qué cambió en la cadena cuando agregaste la espera?',
      built: (p) => scriptsWith(p, 'f_recv').some((s) => count(inside(s), 'f_wait') > 0),
      solve: (p) => { spriteOf(p, 'toby').scripts[1].body.unshift(fWait(1)); },
    }),
    card({
      id: 'vueltas', icon: '🔁', label: 'Vueltas', sprite: 'pulpi',
      title: 'Un baile que se repite',
      how: [{ t: 'Poné [f_repeat]', on: 'f_repeat' }, { t: 'Adentro [f_spin]', on: 'f_spin' }, { t: 'Tocá a {pelota}', on: 'try' }], tap: 'pelota',
      demo: fRecv('blue', fRepeat(2, fSpin()), fSend('yellow'), fSound('magia')),
      concept: 'Bucles: repetir sin escribir todo de nuevo.', ask: '¿Cuántas vueltas da? ¿Dónde lo dice?',
      built: (p) => blocksOf(p, 'f_repeat').some((b) => count(b.body, ...DANCE) > 0),
      solve: (p) => { spriteOf(p, 'pulpi').scripts[0].body.push(fRepeat(2, fSpin())); },
    }),
    card({
      id: 'mismo', icon: '📨', label: 'Mismo sobre', sprite: 'pelota',
      title: 'Que {pelota} también escuche el último sobre',
      how: [{ t: 'Poné [f_recv]', on: 'f_recv' }, { t: 'Elegí el sobre amarillo', on: 'tune' }, { t: 'Poné [f_jump]', on: 'f_jump' }, { t: 'Tocá a {pelota}', on: 'try' }], tap: 'pelota',
      demo: fRecv('yellow', fJump()),
      tune: { type: 'f_recv', field: 'C', when: (b) => b.fields.C !== 'yellow' },
      concept: 'Mensajes: un mismo aviso lo pueden escuchar varios a la vez.', ask: '¿Quiénes se enteran del mismo sobre?',
      built: (p) => sharedColour(p),
      solve: (p) => { spriteOf(p, 'pelota').scripts.push(fRecv('yellow', fJump())); },
    }),
    card({
      id: 'final', icon: '🎆', label: 'Gran final', sprite: 'estrella',
      title: 'Un gran final',
      how: [{ t: 'Poné [f_backdrop]', on: 'f_backdrop' }, { t: 'Elegí otro lugar', on: 'tune' }, { t: 'Tocá a {pelota}', on: 'try' }], tap: 'pelota',
      demo: fRecv('yellow', fSpin(), fStar(), fSound('fanfarria'), fBackdrop('espacio')),
      tune: { type: 'f_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Eventos: el último mensaje puede cambiar todo el juego.', ask: '¿Qué hace el último de la cadena?',
      built: (p) => scriptsWith(p, 'f_recv').some((s) => inside(s).some((b) => b.type === 'f_backdrop' && b.fields.B !== p.backdrop)),
      solve: (p) => { spriteOf(p, 'estrella').scripts[0].body.push(fBackdrop(p.backdrop === 'nieve' ? 'mar' : 'nieve')); },
    }),
    card({
      id: 'musica', icon: '🎵', label: 'Música', sprite: 'pulpi',
      title: 'Que Pulpi toque una melodía',
      how: [{ t: 'Poné dos [f_note]', on: 'f_note' }, { t: 'Tocá a {pelota}', on: 'try' }], tap: 'pelota',
      demo: fRecv('blue', fSpin(), fSend('yellow'), fNote('do'), fNote('sol'), fSound('magia')),
      concept: 'Secuencia: las notas suenan una atrás de la otra.', ask: '¿Qué suena primero y qué suena después?',
      built: (p) => blocksOf(p, 'f_note').length >= 2,
      solve: (p) => { spriteOf(p, 'pulpi').scripts[0].body.splice(2, 0, fNote('do'), fNote('sol')); },
    }),
  ],
});
