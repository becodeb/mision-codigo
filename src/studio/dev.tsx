/**
 * Development harness, opened at /studio-dev.html?game=<id>&level=<n>. It mounts the real Studio with a
 * save kept in memory (and in sessionStorage, so a reload shows the restore) and two demo games defined
 * here, one per block tier, because the catalog is still being written. Not part of the production build.
 */
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import { createRoot } from 'react-dom/client';
import { GAMES } from '../games/catalog.ts';
import { countBlocks, hasBlock, spriteCount } from '../games/checks.ts';
import type { GameDefinition } from '../games/types.ts';
import * as b from '../language/ir.ts';
import type { GameProgress } from '../shared/api.ts';
import { isLevelId, type LevelId } from '../shared/levels.ts';
import { Studio } from './Studio.tsx';

const pictureGame: GameDefinition = {
  id: 'demo-picture',
  level: 1,
  class: 1,
  order: 1,
  kind: 'story',
  title: 'La gran presentación (demo)',
  pitch: 'Un héroe que se presenta',
  concept: 'Secuencia',
  cover: 'toby',
  setup: b.project('parque', [b.sprite('toby', 'toby', [], { x: -120, name: 'Toby' })]),
  toolbox: ['f_flag', 'f_say', 'f_text'],
  phases: [
    {
      title: 'El héroe aparece',
      goal: 'Toby se presenta con un saludo.',
      steps: [
        { id: 'p1-say', title: 'Que Toby salude', text: 'Arrastrá un bloque de decir debajo de la bandera y apretá Empezar.', hints: [], demoScript: b.fFlag(b.fSay('HOLA')), check: (ctx) => ctx.stats.ran('say') },
        {
          id: 'p1-walk', title: 'Que camine', text: 'Ahora Toby tiene que caminar hacia un costado.', unlock: ['f_right', 'f_left'], demoScript: b.fFlag(b.fSay('HOLA'), b.fRight()), hints: [],
          check: (ctx) => ctx.stats.ran('move'),
        },
      ],
    },
    {
      title: 'Un amigo',
      goal: 'Aparece un amigo y los dos se mueven.',
      steps: [
        { id: 'p2-friend', title: 'Sumá un amigo', text: 'Elegí otro personaje en la lista de personajes.', point: 'add-sprite', hints: ['Tocá el botón Agregar, abajo a la derecha.'], check: (ctx) => spriteCount(ctx) >= 2 },
        {
          id: 'p2-jump', title: 'Que alguien salte', text: 'Hacé que un personaje salte antes de hablar.', unlock: ['f_jump', 'f_spin'],
          hints: ['Buscá el bloque con la flecha curva.', 'Poné el salto antes del decir.'],
          example: [{ sprite: 'toby', scripts: [b.fFlag(b.fRight(), b.fJump(), b.fSay('HOLA'))] }],
          check: (ctx) => hasBlock(ctx, 'f_jump'),
        },
      ],
    },
    {
      title: 'Un lugar nuevo',
      goal: 'Viajan a otro lugar.',
      steps: [
        { id: 'p3-run', title: 'Probalo', text: 'Apretá la bandera para ver tu historia.', point: 'flag', hints: ['La bandera verde está arriba, a la derecha.'], check: (ctx) => ctx.stats.count('move') >= 2 && countBlocks(ctx, 'f_say') >= 1 },
      ],
    },
  ],
  challenges: [
    { title: 'Un final con baile', text: 'Inventá cómo termina la presentación.' },
    { title: 'Tres amigos', text: 'Sumá a todos los personajes que quieras.' },
    { title: 'Cambio de escena', text: 'Hacé que la historia pase en dos lugares.' },
  ],
  solution: { program: b.project('parque', []), play: () => {} },
};

const textGame: GameDefinition = {
  id: 'demo-text',
  level: 4,
  class: 1,
  order: 1,
  kind: 'game',
  title: 'Atrapá la estrella (demo)',
  pitch: 'Mové a Nova y juntá puntos',
  concept: 'Bucle y reglas',
  cover: 'nova',
  setup: b.project('espacio', [
    b.sprite('nova', 'nova', [b.onFlag(b.forever(b.moveWithArrows(4)))], { x: -150, name: 'Nova' }),
    b.sprite('estrella', 'star', [], { x: 150, y: -110, name: 'Estrella' }),
  ]),
  toolbox: ['a_flag', 'a_key', 'a_move', 'a_changex', 'a_say', 'a_sayfor', 'a_forever', 'a_arrows', 'a_wait'],
  phases: [
    {
      title: 'Moverse',
      goal: 'Nova se mueve con las flechas.',
      steps: [
        {
          id: 't1-move', title: 'Mové a Nova', text: 'Apretá Empezar y mové a Nova con las flechas del teclado.', hints: ['En una tablet, usá los botones de la pantalla.'],
          check: (ctx) => ctx.stats.ran('arrows') && (ctx.machine.instances[0]?.x ?? -150) > -140,
        },
      ],
    },
    {
      title: 'Puntos',
      goal: 'Tocar la estrella da un punto.',
      steps: [
        {
          id: 't2-score', title: 'Un punto por estrella', text: 'En la estrella: cuando toque a Nova, sumá 1 punto y escondela.',
          unlock: ['a_touching', 'a_addscore', 'a_hide', 'v_score', 'a_if', 'v_touching', 'a_setscore'],
          hints: ['Usá «cuando toque a» de Eventos.', 'Después de sumar, escondé la estrella.'],
          example: [{ sprite: 'estrella', scripts: [b.onTouching('nova', b.addScore(1), b.hide())] }],
          check: (ctx) => ctx.stats.maxScore >= 1,
        },
      ],
    },
    {
      title: 'Ganar',
      goal: 'Con un punto se gana.',
      steps: [
        {
          id: 't3-win', title: 'Ganá el juego', text: 'Cuando los puntos lleguen a 1, ganás.', unlock: ['a_points', 'a_win', 'a_lose'],
          hints: ['«cuando los puntos lleguen a» está en Eventos.'], check: (ctx) => ctx.stats.won,
        },
      ],
    },
  ],
  challenges: [
    { title: 'Más estrellas', text: 'Hacé que haya tres estrellas para juntar.' },
    { title: 'Un enemigo', text: 'Sumá un personaje que te haga perder.' },
    { title: 'Tu propio fondo', text: 'Cambiá el escenario cuando ganás.' },
  ],
  solution: { program: b.project('espacio', []), play: () => {} },
};

const params = new URLSearchParams(location.search);
/* ?crash=1 lets the browser check make a render fail on demand: set window.__boom = true, then interact. */
if (params.has('crash')) {
  const phase = pictureGame.phases[0];
  const title = phase.title;
  Object.defineProperty(phase, 'title', { get: () => { if ((window as unknown as { __boom?: boolean }).__boom) throw new Error('boom'); return title; } });
}
const wanted = params.get('game') ?? 'demo-picture';
const game: GameDefinition | null = wanted === 'free' ? null : ([pictureGame, textGame, ...GAMES].find((g) => g.id === wanted) ?? pictureGame);
const lvl = Number(params.get('level'));
const level: LevelId = isLevelId(lvl) ? lvl : (game?.level ?? 1);

interface Saved { project: unknown; progress: GameProgress }
const key = `studio-dev:${wanted}:${level}`;
if (params.has('fresh')) {
  sessionStorage.removeItem(key);
  params.delete('fresh');
  history.replaceState(null, '', `?${params.toString()}`);
}
let initial: Saved | null = null;
try {
  const raw = sessionStorage.getItem(key);
  if (raw) initial = JSON.parse(raw) as Saved;
} catch { /* start fresh */ }

const saves: Saved[] = [];
(window as unknown as { __studio: unknown }).__studio = { saves, key };

const nextGame = game === pictureGame ? textGame : null;

createRoot(document.getElementById('root')!).render(
  <Studio
    game={game}
    level={level}
    initial={initial}
    onSave={(project, progress) => {
      saves.push({ project, progress });
      try { sessionStorage.setItem(key, JSON.stringify({ project, progress })); } catch { /* storage full or blocked */ }
    }}
    onExit={() => { document.body.insertAdjacentHTML('beforeend', '<p id="exited" style="position:fixed;top:0;left:0;background:#fff;padding:8px">onExit</p>'); }}
    next={nextGame ? { title: nextGame.title, open: () => { location.search = `?game=${nextGame.id}`; } } : null}
  />,
);
