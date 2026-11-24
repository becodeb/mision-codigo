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
    { icon: '👻', text: 'Boo aparece en cualquier lado. ¡Tocá antes de que se esconda!' },
    { icon: '⭐', text: 'Cada vez que lo lográs, ganás una estrella.' },
  ],
  pillars: [
    { id: 'aparece', broken: '{boo} ya no aparece y desaparece', ok: (p) => scriptsWith(p, 'f_flag').some((s) => count(inside(s), 'f_show', 'f_random') > 0), restore: { sprite: 'boo', script: GHOST() } },
    { id: 'estrella', broken: 'Nada suma estrellas cuando lo tocás', ok: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), 'f_star') > 0), restore: { sprite: 'boo', script: CAUGHT() } },
  ],
  cards: [
    ...lookCards(base, { hero: 'boo', talker: 'robi', sounder: 'boo', picture: true, sayBlock: 'f_say', newPlace: 'selva', newArt: 'pulpi' }),
    card({
      id: 'velocidad', icon: '⏱️', label: 'Más rápido o lento', sprite: 'boo',
      title: 'Cambiá la velocidad', text: '¿Más fácil o más difícil? Cambiá **cuánto espera** {boo} antes de esconderse.',
      how: ['En {boo}, buscá el **reloj** que está adentro de las vueltas.', 'Tocá el **número** para cambiarlo.', 'Tocá Empezar y probá.'],
      block: { type: 'f_wait', caption: 'Tocá el número del reloj.' },
      concept: 'Dificultad: cambiar un número cambia cómo se juega.', ask: '¿Qué número cambiaste y qué pasó?',
      built: (p) => differs(numbers(p, 'f_wait', 'N'), numbers(base, 'f_wait', 'N')),
      solve: (p) => { firstBlock(p, 'boo', 'f_wait').fields.N = 1; },
    }),
    card({
      id: 'vueltas', icon: '🔁', label: 'Cuántas vueltas', sprite: 'boo',
      title: 'Que aparezca más o menos veces', text: 'Las **vueltas** repiten lo que tienen adentro. Cambiá cuántas veces aparece {boo}.',
      how: ['En {boo}, buscá el bloque de las **flechitas que giran**.', 'Tocá el **número**.', 'Jugá de nuevo.'],
      block: { type: 'f_repeat', caption: 'Tocá el número de las vueltas.' },
      concept: 'Bucles: repetir sin escribir todo de nuevo.', ask: '¿Para qué sirven las vueltas?',
      built: (p) => blocksOf(p, 'f_repeat').some((r) => count(r.body, 'f_random', 'f_show', 'f_hide') > 0 && r.fields.N !== 9),
      solve: (p) => { firstBlock(p, 'boo', 'f_repeat').fields.N = 5; },
    }),
    card({
      id: 'doble', icon: '⭐', label: 'Que valga más', sprite: 'boo',
      title: 'Que valga 2 puntos', text: 'Hacé que {boo} dé **dos estrellas o más** de una vez.',
      how: ['En {boo}, abajo de la manito, buscá la estrella.', 'Poné **otra estrella abajo**.', 'Jugá y mirá los puntos.'],
      demo: fClick(fStar(), fStar(), fHide(), fSound('risa')),
      concept: 'Secuencia: las órdenes se cumplen una abajo de la otra.', ask: '¿Por qué ahora suma dos puntos?',
      built: (p) => scriptsWith(p, 'f_click').some((s) => count(inside(s), 'f_star') >= 2),
      solve: (p) => { spriteOf(p, 'boo').scripts[1].body.unshift(fStar()); },
    }),
    card({
      id: 'cancion', icon: '🎵', label: 'Componer una canción', sprite: 'robi',
      title: 'Componé una canción', text: 'Cambiá la canción de {robi}: usá **cinco notas o más**.',
      how: ['En {robi}, buscá las notas que están adentro de las vueltas.', 'Agregá **más notas** y cambialas.', 'Tocá a {robi} para escucharla.'],
      demo: fClick(fRepeat(2, fNote('do'), fNote('mi'), fNote('sol'), fNote('la'), fNote('sol'))),
      concept: 'Bucles: una melodía corta que se repite.', ask: '¿Qué parte de la canción se repite?',
      built: (p) => blocksOf(p, 'f_note').length >= 5,
      solve: (p) => { spriteOf(p, 'robi').scripts[1].body[0].body.push(fNote('la'), fNote('sol')); },
    }),
    card({
      id: 'baile', icon: '🕺', label: 'Un baile que se repite', sprite: 'coni',
      title: 'Un baile que se repite', text: 'Que alguien **repita un movimiento** con las vueltas.',
      how: ['En {coni}, poné las **vueltas** abajo de la manito.', 'Adentro, poné un **salto** o un **giro**.', 'Tocá a {coni}.'],
      demo: fClick(fJump(), fSound('boing'), fRepeat(2, fSpin())),
      concept: 'Bucles: repetir sin escribir todo de nuevo.', ask: '¿Cuántas veces repite el movimiento? ¿Dónde lo dice?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'f_repeat' && count(b.body, ...DANCE) > 0))),
      solve: (p) => { spriteOf(p, 'coni').scripts[0].body.push(fRepeat(2, fSpin())); },
    }),
    card({
      id: 'mensaje', icon: '✉️', label: 'Mandar un mensaje', sprite: 'boo',
      title: 'Un mensaje secreto', text: 'Que al atrapar a {boo} **otro personaje se entere y festeje**.',
      how: ['En {boo}, abajo de la manito, poné **mandar el sobre**.', 'Elegí a {coni} y poné **cuando llega el sobre** del mismo color.', 'Abajo, poné cómo festeja. ¡Probalo!'],
      demo: fClick(fStar(), fHide(), fSound('risa'), fSend('red')),
      example: [{ sprite: 'boo', scripts: [fClick(fStar(), fHide(), fSound('risa'), fSend('red'))] }, { sprite: 'coni', scripts: [fRecv('red', fJump(), fSound('aplauso'))] }],
      concept: 'Mensajes: los personajes se avisan cosas entre ellos.', ask: '¿Cómo se entera el otro personaje?',
      built: (p) => scriptsWith(p, 'f_recv').some((s) => s.body.length > 0 && blocksOf(p, 'f_send').some((b) => b.fields.C === s.hat.fields.C)),
      solve: (p) => { spriteOf(p, 'boo').scripts[1].body.push(fSend('red')); addTo(p, 'coni', fRecv('red', fJump())); },
    }),
    card({
      id: 'amigo', icon: '➕', label: 'Sumar un personaje', newSprite: true, point: 'add-sprite',
      title: 'Sumá un personaje', text: 'Agregá alguien nuevo y **programá qué hace**.',
      how: ['Tocá **Agregar** y elegí a alguien.', 'Poné la **manito** o la **bandera**, y abajo lo que quieras.', 'Probalo.'],
      demo: fClick(fJump()),
      concept: 'Crear: programar un personaje desde cero.', ask: '¿Qué le programaste al personaje nuevo?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => sc.body.length > 0)),
      solve: (p) => addSprite(p, 'pipo', fClick(fJump())),
    }),
  ],
});
