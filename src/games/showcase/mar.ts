/** Equipo Mar: Boo aparece y desaparece. Bloques con dibujos, con vueltas, esperas y mensajes. */
import { fClick, fFlag, fHide, fJump, fNote, fRandom, fRecv, fRepeat, fSay, fSend, fShow, fSound, fSpin, fStar, fWait, project, sprite } from '../../language/ir.ts';
import { blocksForLevel, type BlockType } from '../../language/catalog.ts';
import { addSprite, addTo, blocksOf, card, count, differs, firstBlock, inside, lookCards, newSprites, numbers, scriptsWith, showcaseGame, spriteOf } from './kit.ts';

const DANCE: BlockType[] = ['f_jump', 'f_spin', 'f_left', 'f_right', 'f_up', 'f_down', 'f_grow', 'f_shrink'];
const GHOST = () => fFlag(fRepeat(9, fRandom(), fShow(), fWait(2), fHide(), fWait(1)), fShow(), fSay('CHAU'));
const CAUGHT = () => fClick(fStar(), fHide(), fSound('risa'));

const base = project('castillo', [
  sprite('robi', 'robi', [fFlag(fSay('JUGAR')), fClick(fRepeat(2, fNote('do'), fNote('mi'), fNote('sol')))], { x: -175, y: -125, size: 85, name: 'Robi' }),
  sprite('coni', 'coni', [fClick(fJump(), fSound('boing'))], { x: 175, y: -125, size: 85, name: 'Coni', flip: -1 }),
  sprite('boo', 'boo', [GHOST(), CAUGHT()], { x: 0, y: -30, name: 'Boo' }),
]);

export const NOCHE_DE_BOO = showcaseGame({
  id: 'muestra-boo', level: 2, title: 'La noche de Boo', cover: 'boo',
  pitch: 'Boo aparece y se esconde. ¡Tocá a Boo antes de que desaparezca!',
  setup: base,
  toolbox: blocksForLevel(2),
  play: [
    { icon: '👻', text: 'Boo aparece en cualquier lado. ¡Atrapalo antes de que se esconda!' },
    { icon: '⭐', text: 'Cada vez que lo lográs, ganás una estrella.' },
  ],
  goal: () => 'Atrapá a {boo} antes de que se esconda',
  pillars: [
    { id: 'aparece', broken: '{boo} ya no aparece y desaparece', ok: (p) => scriptsWith(p, 'f_flag').some((s) => count(inside(s), 'f_show', 'f_random') > 0), restore: { sprite: 'boo', script: GHOST() } },
    { id: 'estrella', broken: 'Nada suma estrellas cuando lo tocás', ok: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), 'f_star') > 0), restore: { sprite: 'boo', script: CAUGHT() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'boo', talker: 'robi', sounder: 'boo', picture: true, sayBlock: 'f_say', newPlace: 'selva', newArt: 'pulpi' }),
    card({
      id: 'velocidad', icon: '⏱️', label: 'Velocidad', sprite: 'boo',
      title: 'Cambiá la velocidad',
      how: [{ t: 'Cambiá el [f_wait]', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'f_wait', caption: 'Tocá el número del reloj.' },
      concept: 'Dificultad: cambiar un número cambia cómo se juega.', ask: '¿Qué número cambiaste y qué pasó?',
      built: (p) => differs(numbers(p, 'f_wait', 'N'), numbers(base, 'f_wait', 'N')),
      solve: (p) => { firstBlock(p, 'boo', 'f_wait').fields.N = 1; },
    }),
    card({
      id: 'vueltas', icon: '🔁', label: 'Vueltas', sprite: 'boo',
      title: 'Que aparezca más o menos veces',
      how: [{ t: 'Cambiá las [f_repeat]', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: 'f_repeat', caption: 'Tocá el número de las vueltas.' },
      concept: 'Bucles: repetir sin escribir todo de nuevo.', ask: '¿Para qué sirven las vueltas?',
      built: (p) => blocksOf(p, 'f_repeat').some((r) => count(r.body, 'f_random', 'f_show', 'f_hide') > 0 && r.fields.N !== 9),
      solve: (p) => { firstBlock(p, 'boo', 'f_repeat').fields.N = 5; },
    }),
    card({
      id: 'doble', icon: '⭐', label: 'Más puntos', sprite: 'boo',
      title: 'Que valga 2 puntos',
      how: [{ t: 'Poné otra [f_star]', on: 'f_star' }, { t: 'Probá **▶**', on: 'try' }],
      demo: fClick(fStar(), fStar(), fHide(), fSound('risa')),
      concept: 'Secuencia: las órdenes se cumplen una abajo de la otra.', ask: '¿Por qué ahora suma dos puntos?',
      built: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), 'f_star') >= 2),
      solve: (p) => { spriteOf(p, 'boo').scripts[1].body.unshift(fStar()); },
    }),
    card({
      id: 'cancion', icon: '🎵', label: 'Canción', sprite: 'robi',
      title: 'Componé una canción',
      how: [{ t: 'Poné dos [f_note]', on: 'f_note' }, { t: 'Tocá a {robi}', on: 'try' }], tap: 'robi',
      demo: fClick(fRepeat(2, fNote('do'), fNote('mi'), fNote('sol'), fNote('la'), fNote('sol'))),
      concept: 'Bucles: una melodía corta que se repite.', ask: '¿Qué parte de la canción se repite?',
      built: (p) => blocksOf(p, 'f_note').length >= 5,
      solve: (p) => { spriteOf(p, 'robi').scripts[1].body[0].body.push(fNote('la'), fNote('sol')); },
    }),
    card({
      id: 'baile', icon: '🕺', label: 'Baile', sprite: 'coni',
      title: 'Un baile que se repite',
      how: [{ t: 'Poné [f_repeat]', on: 'f_repeat' }, { t: 'Adentro [f_spin]', on: 'f_spin' }, { t: 'Tocá a {coni}', on: 'try' }], tap: 'coni',
      demo: fClick(fJump(), fSound('boing'), fRepeat(2, fSpin())),
      concept: 'Bucles: repetir sin escribir todo de nuevo.', ask: '¿Cuántas veces repite el movimiento? ¿Dónde lo dice?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'f_repeat' && count(b.body, ...DANCE) > 0))),
      solve: (p) => { spriteOf(p, 'coni').scripts[0].body.push(fRepeat(2, fSpin())); },
    }),
    card({
      id: 'mensaje', icon: '✉️', label: 'Mensaje', sprite: 'boo',
      title: 'Un mensaje secreto',
      how: [{ t: '{boo} [f_send]', on: 'f_send' }, { t: '{coni} [f_recv]', on: 'f_recv' }, { t: 'Poné [f_jump]', on: 'f_jump' }, { t: 'Probá **▶**', on: 'try' }],
      demo: fClick(fStar(), fHide(), fSound('risa'), fSend('red')),
      example: [{ sprite: 'boo', scripts: [fClick(fStar(), fHide(), fSound('risa'), fSend('red'))] }, { sprite: 'coni', scripts: [fRecv('red', fJump(), fSound('aplauso'))] }],
      concept: 'Mensajes: los personajes se avisan cosas entre ellos.', ask: '¿Cómo se entera el otro personaje?',
      built: (p) => scriptsWith(p, 'f_recv').some((s) => s.body.length > 0 && blocksOf(p, 'f_send').some((b) => b.fields.C === s.hat.fields.C)),
      solve: (p) => { spriteOf(p, 'boo').scripts[1].body.push(fSend('red')); addTo(p, 'coni', fRecv('red', fJump())); },
    }),
    card({
      id: 'amigo', icon: '➕', label: 'Amigo', newSprite: true, point: 'add-sprite',
      title: 'Sumá un personaje',
      how: [{ t: 'Tocá **+ Agregar**', on: 'add' }, { t: 'Poné [f_click]', on: 'f_click' }, { t: 'Poné [f_jump]', on: 'f_jump' }, { t: 'Tocalo', on: 'try' }], tap: 'new',
      demo: fClick(fJump()),
      concept: 'Crear: programar un personaje desde cero.', ask: '¿Qué le programaste al personaje nuevo?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => sc.body.length > 0)),
      solve: (p) => addSprite(p, 'pipo', fClick(fJump())),
    }),
  ],
});
