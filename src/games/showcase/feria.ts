/** Equipo Feria: blancos que saltan y cruzan, y una bomba que no hay que tocar. Bloques con dibujos, con vueltas y esperas. */
import { fBackdrop, fClick, fDown, fFlag, fGrow, fHide, fRepeat, fRight, fSay, fShow, fSound, fSpin, fStar, fUp, fWait, project, sprite } from '../../language/ir.ts';
import { blocksForLevel } from '../../language/catalog.ts';
import { addSprite, card, clicksOf, count, differs, firstBlock, inside, lookCards, newSprites, numbers, showcaseGame, spriteOf } from './kit.ts';

const CAUGHT = (sound: string) => fClick(fStar(), fHide(), fSound(sound), fWait(2), fShow());
const BOOM = () => fClick(fSound('explosion'), fSpin());
const CLOSE = () => fFlag(fSay('JUGAR'), fRepeat(9, fWait(3)), fSay('CHAU'));

const base = project('granja', [
  sprite('moneda', 'coin', [fFlag(fRepeat(8, fRight(), fWait(2)), fShow()), CAUGHT('campana')], { x: -210, y: 70, size: 140, name: 'Moneda' }),
  sprite('manzana', 'apple', [fFlag(fRepeat(6, fUp(), fWait(2), fDown(), fWait(1)), fShow()), CAUGHT('magia')], { x: -20, y: -40, size: 140, name: 'Manzana' }),
  sprite('pelota', 'ball', [fFlag(fRepeat(8, fUp(), fWait(1), fDown(), fWait(1)), fShow()), CAUGHT('aplauso')], { x: -170, y: -115, size: 140, name: 'Pelota' }),
  sprite('bomba', 'bomb', [fFlag(fRepeat(6, fUp(), fWait(1), fDown(), fWait(2)), fShow()), BOOM()], { x: 70, y: -115, size: 140, name: 'Bomba' }),
  sprite('pipo', 'pipo', [CLOSE()], { x: 190, y: -125, name: 'Pipo' }),
]);

export const LA_FERIA = showcaseGame({
  id: 'muestra-feria', level: 2, order: 3, title: 'La feria de las pelotas', cover: 'apple',
  pitch: 'Atrapá lo que se mueve, pero no toques la bomba.',
  setup: base,
  toolbox: blocksForLevel(2),
  play: [
    { icon: '🎯', text: 'Tocá lo que se mueve: se esconde y te da una estrella.' },
    { icon: '💣', text: 'No toques la bomba: hace ¡bum! y no suma nada.' },
    { icon: '👋', text: 'Cuando Pipo dice chau, se terminó la feria.' },
  ],
  goal: () => 'Atrapá {pelota}, {manzana} y {moneda} pero no {bomba}',
  pillars: [
    { id: 'atrapar', broken: 'Nada suma estrellas cuando lo tocás', ok: (p) => clicksOf(p, ...p.sprites.map((s) => s.id)).some((s) => count(inside(s), 'f_star') > 0), restore: { sprite: 'pelota', script: CAUGHT('aplauso') } },
    { id: 'mueven', broken: '{manzana} ya no se mueve', ok: (p) => p.sprites.some((s) => s.scripts.some((sc) => sc.hat.type === 'f_flag' && count(inside(sc), 'f_up', 'f_right', 'f_down') > 0)), restore: { sprite: 'manzana', script: fFlag(fRepeat(6, fUp(), fWait(2), fDown(), fWait(1)), fShow()) } },
  ],
  cards: [
    ...lookCards(base, { hero: 'pelota', talker: 'pipo', sounder: 'manzana', picture: true, sayBlock: 'f_say', newPlace: 'playa', newArt: 'heart', soundTap: 'manzana', sayAim: 'Que {pipo} diga otra cosa cuando empieza la feria', soundAim: 'Que al atrapar a {manzana} suene un sonido distinto' }),
    card({
      id: 'ritmo', icon: '⏱️', label: 'Ritmo', sprite: 'pelota',
      title: 'Cambiá el ritmo',
      aim: 'Que {pelota} suba y baje a otro ritmo',
      how: [{ t: 'En el [f_wait] de arriba, cambiá el **1** por otro número', on: 'change' }, { t: 'Tocá **▶** y mirá cómo se mueve {pelota}', on: 'try' }],
      block: { type: 'f_wait', caption: 'Tocá el número del reloj.' },
      concept: 'Dificultad: cambiar un número cambia cómo se juega.', ask: '¿Qué número cambiaste y qué pasó?',
      built: (p) => differs(numbers(p, 'f_wait', 'N'), numbers(base, 'f_wait', 'N')),
      solve: (p) => { firstBlock(p, 'pelota', 'f_wait').fields.N = 4; },
    }),
    card({
      id: 'vueltas', icon: '🔁', label: 'Vueltas', sprite: 'manzana',
      title: 'Que se mueva más o menos veces',
      aim: 'Que {manzana} se mueva más o menos veces',
      how: [{ t: 'En [f_repeat], cambiá el **6** por otro número', on: 'change' }, { t: 'Tocá **▶** y contá cuántas veces se mueve {manzana}', on: 'try' }],
      block: { type: 'f_repeat', caption: 'Tocá el número de las vueltas.' },
      concept: 'Bucles: repetir sin escribir todo de nuevo.', ask: '¿Para qué sirven las vueltas?',
      built: (p) => differs(numbers(p, 'f_repeat', 'N'), numbers(base, 'f_repeat', 'N')),
      solve: (p) => { firstBlock(p, 'manzana', 'f_repeat').fields.N = 3; },
    }),
    card({
      id: 'doble', icon: '⭐', label: 'Más puntos', sprite: 'moneda',
      title: 'Que valga 2 puntos',
      aim: 'Que {moneda} te dé 2 estrellas cuando la atrapás',
      how: [{ t: 'Poné otra [f_star] abajo de la [f_star] de {moneda}', on: 'f_star' }, { t: 'Tocá a {moneda}: ¡ahora suma 2 estrellas!', on: 'try' }], tap: 'moneda',
      demo: fClick(fStar(), fStar(), fHide(), fSound('campana'), fWait(2), fShow()),
      concept: 'Secuencia: las órdenes se cumplen una abajo de la otra.', ask: '¿Por qué ahora suma dos puntos?',
      built: (p) => clicksOf(p, ...p.sprites.map((s) => s.id)).some((s) => count(inside(s), 'f_star') >= 2),
      solve: (p) => { spriteOf(p, 'moneda').scripts[1].body.unshift(fStar()); },
    }),
    card({
      id: 'bum', icon: '💥', label: 'Bomba', sprite: 'bomba',
      title: 'Una bomba cada vez más grande',
      aim: 'Que {bomba} se agrande cada vez que la tocás',
      how: [{ t: 'Poné [f_grow] al final, abajo del [f_spin]', on: 'f_grow' }, { t: 'Tocá a {bomba}: ¡se agranda!', on: 'try' }], tap: 'bomba',
      demo: fClick(fSound('explosion'), fSpin(), fGrow()),
      concept: 'Dificultad: un bloque puede hacer el juego más fácil o más difícil.', ask: '¿Qué le pasa a la bomba cada vez que la tocás?',
      built: (p) => clicksOf(p, 'bomba').some((s) => count(inside(s), 'f_grow', 'f_shrink') > 0),
      solve: (p) => { spriteOf(p, 'bomba').scripts[1].body.push(fGrow()); },
    }),
    card({
      id: 'viaje', icon: '🚀', label: 'Viaje', sprite: 'pelota',
      title: 'Un viaje',
      aim: 'Que al atrapar a {pelota} el juego pase a otro lugar',
      how: [{ t: 'Poné [f_backdrop] abajo del [f_sound], arriba del [f_wait]', on: 'f_backdrop' }, { t: 'En [f_backdrop], elegí un lugar nuevo', on: 'tune' }, { t: 'Tocá a {pelota}: ¡cambia el lugar!', on: 'try' }], tap: 'pelota',
      demo: fClick(fStar(), fHide(), fSound('aplauso'), fBackdrop('espacio'), fWait(2), fShow()),
      tune: { type: 'f_backdrop', field: 'B', when: (b, p) => b.fields.B === p.backdrop },
      concept: 'Eventos: un toque puede cambiar todo el juego.', ask: '¿Qué bloque hace el viaje?',
      built: (p) => p.sprites.some((s) => s.scripts.some((sc) => inside(sc).some((b) => b.type === 'f_backdrop' && b.fields.B !== p.backdrop))),
      solve: (p) => { spriteOf(p, 'pelota').scripts[1].body.splice(3, 0, fBackdrop(p.backdrop === 'nieve' ? 'mar' : 'nieve')); },
    }),
    card({
      id: 'amigo', icon: '➕', label: 'Otro blanco', newSprite: true, point: 'add-sprite',
      title: 'Sumá algo para atrapar',
      aim: 'Que algo nuevo te dé una estrella cuando lo tocás',
      how: [{ t: 'Tocá **+ Agregar** y sumá un personaje', on: 'add' }, { t: 'Traé [f_click] a un lugar vacío', on: 'f_click' }, { t: 'Poné [f_star] abajo de [f_click]', on: 'f_star' }, { t: 'Tocá al personaje nuevo: ¡suma una estrella!', on: 'try' }], tap: 'new',
      demo: fClick(fStar()),
      concept: 'Crear: programar un personaje desde cero.', ask: '¿Qué le programaste al personaje nuevo?',
      built: (p) => newSprites(p, base).some((s) => s.scripts.some((sc) => count(inside(sc), 'f_star') > 0)),
      solve: (p) => addSprite(p, 'coni', fClick(fStar())),
    }),
  ],
});
