/**
 * Misiones de la Clase 2, en escalera para cada nivel:
 *   1 y 2 · Construí: desde cero, con manito («Mostrame»).
 *   3     · Completá: parte del juego ya viene armado; el chico lo termina.
 *   4     · Arreglá: el juego viene con errores y hay que encontrarlos.
 * Después queda el «Gran desafío» (un juego de la Clase 1 recortado a unos 10 pasos, en muestra.ts).
 * En los textos, **así** se resalta lo que se pide y «así» un bloque. Cada nivel usa solo ideas de su edad:
 * nada de operadores ni variables; nada de sensores ni mensajes en los niveles chicos.
 */
import { blockInfo, type BlockType } from '../language/catalog.ts';
import {
  addScore, backdrop, bounce, face, fBackdrop, fClick, fFace, fFlag, fGrow, fHide, fJump, fLeft, fNote, fRandom, fRepeat, fRight, fSay,
  fShow, fShrink, fSound, fSpin, fStar, fWait, forever, goToRandom, hide, ifThen, jump, lose, move, moveWithArrows, onClick, onFlag, onKey,
  onPoints, onTouching, point, project, repeat, sayFor, setScore, show, sound, sprite, touching, wait, win,
} from '../language/ir.ts';
import type { Block, Script, SpriteProgram } from '../language/ir.ts';
import type { Game } from '../runtime/testing.ts';
import { appearLater, blocksInList, lethalTargets, numField, refBlocks, refHas, refsOfHat, scriptsOfHat, travelled } from './checks.ts';
import { Pilot, centerOf, touchingNow } from './level4/autopilot.ts';
import type { GameChallenge, GameDefinition, GameStep, StepContext } from './types.ts';

/* ---------- herramientas ---------- */

const MAKE_IT_YOURS: GameChallenge = {
  title: 'Hacelo tuyo',
  text: 'Cambiá lo que quieras: el lugar, los sonidos, las caras, lo que dicen. **¡Que se note que es tuyo!** Después mostráselo a alguien.',
};

/** Hay un script de `hat` en el personaje `id` que ya corrió y tiene esos bloques. */
function has(ctx: StepContext, id: string, hat: BlockType, types: BlockType[], opts: { min?: number; kinds?: number; key?: string; target?: string } = {}): boolean {
  const sp = ctx.program.sprites.find((s) => s.id === id);
  const kind = blockInfo(hat)?.hat;
  if (!sp || !kind || !ctx.stats.ranHatBy(id, kind)) return false;
  return scriptsOfHat(sp, hat).some((sc) => {
    if (opts.key !== undefined && String(sc.hat.fields.K) !== opts.key) return false;
    if (opts.target !== undefined && String(sc.hat.fields.T) !== opts.target) return false;
    const found = blocksInList(sc.body).filter((b) => types.includes(b.type));
    return found.length >= (opts.min ?? 1) && new Set(found.map((b) => b.type)).size >= (opts.kinds ?? 1);
  });
}

/** Hay un script de `hat` en `id` con un `container` (vueltas, por siempre) que adentro tiene todos esos bloques. */
function inside(ctx: StepContext, id: string, hat: BlockType, container: BlockType, types: BlockType[], min = 0): boolean {
  const sp = ctx.program.sprites.find((s) => s.id === id);
  const kind = blockInfo(hat)?.hat;
  if (!sp || !kind || !ctx.stats.ranHatBy(id, kind)) return false;
  return scriptsOfHat(sp, hat).some((sc) =>
    blocksInList(sc.body).some((c) => {
      if (c.type !== container) return false;
      if (min > 0 && !(numField(c, 'N') >= min)) return false;
      const within = blocksInList(c.body).map((b) => b.type);
      return types.every((t) => within.includes(t));
    }),
  );
}

/** Todos los bloques de los scripts de `hat` de un personaje. */
function blocksUnder(ctx: StepContext, id: string, hat: BlockType): Block[] {
  const sp = ctx.program.sprites.find((s) => s.id === id);
  return sp ? scriptsOfHat(sp, hat).flatMap((sc) => blocksInList(sc.body)) : [];
}

/** Se ganó con un «cuando los puntos lleguen a» que tiene «ganar», y todas las metas son al menos `goal`. */
function wonAt(ctx: StepContext, goal: number): boolean {
  const goals = refsOfHat(ctx, 'a_points').filter((r) => refHas(r, ['a_win']));
  return goals.length > 0 && goals.every((r) => numField(r.script.hat, 'N') >= goal) && ctx.stats.won;
}

interface StepSpec extends Omit<GameStep, 'hints'> {
  hints?: string[];
}

type Kind = 'Construí' | 'Completá' | 'Arreglá';

interface MissionSpec {
  id: string;
  level: GameDefinition['level'];
  order: number;
  kind: Kind;
  title: string;
  pitch: string;
  concept: string;
  cover: string;
  backdrop: string;
  /** Los personajes como arrancan: en «Completá» y «Arreglá» ya traen bloques. */
  sprites: SpriteProgram[];
  toolbox: BlockType[];
  steps: StepSpec[];
  challenges: GameChallenge[];
  /** El código terminado de cada personaje; los que no aparecen quedan como arrancan. */
  solved: Record<string, Script[]>;
  play: (game: Game) => void | Promise<void>;
}

function mission(m: MissionSpec): GameDefinition {
  const setup = project(m.backdrop, m.sprites);
  const solution = project(
    m.backdrop,
    m.sprites.map((s) => ({ ...s, scripts: m.solved[s.id] ?? s.scripts })),
  );
  return {
    id: m.id,
    level: m.level,
    class: 2,
    order: m.order,
    kind: 'game',
    title: `Misión ${m.order} · ${m.kind}: ${m.title}`,
    pitch: m.pitch,
    concept: m.concept,
    cover: m.cover,
    setup,
    toolbox: m.toolbox,
    phases: [{ title: `${m.kind}: ${m.title}`, goal: m.pitch, steps: m.steps.map((s) => ({ hints: ['Tocá «Mostrame» o «Necesito una pista».'], ...s })) }],
    challenges: [MAKE_IT_YOURS, ...m.challenges],
    solution: { program: solution, play: m.play },
  };
}

const tapAll = (ids: string[], times = 1, gap = 1500) => (game: Game) => {
  game.flag();
  game.run(300);
  for (let i = 0; i < times; i++) for (const id of ids) {
    game.tap(id);
    game.run(gap);
  }
  game.run(2000);
};

/** Lleva al héroe con las flechas hasta tocar cada objetivo, esquivando los peligros. */
function steerTo(game: Game, hero: string, targets: () => string | null, hazards: string[], until: () => boolean, maxMs = 240_000): void {
  const pilot = new Pilot(game, { hero, speed: 2, hazards });
  let overlap = 0;
  let away = 0;
  game.runUntil(() => {
    if (until() || game.machine.ended) return true;
    const id = targets();
    if (!id) return true;
    overlap = touchingNow(game.sprite(hero), game.sprite(id)) ? overlap + 1 : 0;
    if (overlap > 12) {
      away = 40;
      overlap = 0;
    }
    const to = away > 0 ? { x: 0, y: -60 } : centerOf(game.sprite(id));
    if (away > 0) away--;
    pilot.steer(to.x, to.y);
    return false;
  }, maxMs);
  pilot.release();
}

/** Primero se deja atrapar por `hazard` (para probar que se pierde), después junta hasta `goal` esquivando. */
function loseThenCollect(hero: string, hazard: string, target: () => string | null, hazards: string[], goal: number) {
  return (g: Game) => {
    g.flag();
    g.run(200);
    steerTo(g, hero, () => hazard, [], () => false, 60_000);
    g.run(300);
    g.flag();
    g.run(200);
    steerTo(g, hero, target, hazards, () => (g.machine.score ?? 0) >= goal);
    g.run(1500);
  };
}

const HAPPY = ['feliz', 'risa'];

/* ======================= NIVEL 1 · Sol (1.º y 2.º): tocar y bandera, bloques con dibujos ======================= */

const L1 = [
  mission({
    id: 'm1-circo', level: 1, order: 1, kind: 'Construí', title: 'El circo de Toby', cover: 'toby', backdrop: 'teatro',
    pitch: 'Toby es la estrella del circo. Cuando lo tocás, hace su número.',
    concept: 'Secuencia: al tocar, los bloques pasan en orden.',
    sprites: [sprite('toby', 'toby', [], { x: 0, y: -60, name: 'Toby' })],
    toolbox: ['f_click'],
    steps: [
      { id: 'salta', title: 'Toby salta', text: '¡Empieza la función! Poné **la manito y abajo el salto**. Después tocá a Toby.', explain: 'La manito es un bloque que espera: lo que pongas abajo pasa cuando tocás al personaje.', unlock: ['f_jump'], demoScript: fClick(fJump()), check: (c) => has(c, 'toby', 'f_click', ['f_jump']) },
      { id: 'gira', title: 'Una vuelta', text: 'Después del salto, **que dé una vuelta**: poné el giro abajo del salto.', unlock: ['f_spin'], demoScript: fClick(fJump(), fSpin()), check: (c) => has(c, 'toby', 'f_click', ['f_jump', 'f_spin'], { kinds: 2 }) },
      { id: 'aplausos', title: '¡Aplausos!', text: 'El público aplaude: **poné el sonido y elegí los aplausos**.', unlock: ['f_sound'], demoScript: fClick(fJump(), fSpin(), fSound('aplauso')), check: (c) => has(c, 'toby', 'f_click', ['f_sound']) && c.stats.ran('sound') },
      { id: 'estrella', title: 'Una estrella', text: 'Cada número bien hecho gana una estrella: **ponela al final** y tocá a Toby.', explain: 'La estrella suma un punto. Lo ves arriba del escenario.', unlock: ['f_star', 'f_face'], demoScript: fClick(fJump(), fSpin(), fSound('aplauso'), fStar()), check: (c) => has(c, 'toby', 'f_click', ['f_star']) && c.stats.maxScore >= 1 },
    ],
    challenges: [
      { title: 'Un número más largo', text: 'Hacé que Toby haga **cinco cosas seguidas** cuando lo tocás.' },
      { title: 'Toby se asusta', text: 'Poné **una cara de sorpresa** en el medio del número.' },
    ],
    solved: { toby: [fClick(fJump(), fSpin(), fSound('aplauso'), fStar())] },
    play: tapAll(['toby'], 2),
  }),

  mission({
    id: 'm1-robi-espacio', level: 1, order: 2, kind: 'Construí', title: 'Robi viaja al espacio', cover: 'robi', backdrop: 'ciudad',
    pitch: 'Con la bandera verde, Robi camina, saluda y viaja al espacio.',
    concept: 'Una secuencia que arranca con la bandera verde.',
    sprites: [sprite('robi', 'robi', [], { x: -120, y: -60, name: 'Robi' })],
    toolbox: ['f_flag'],
    steps: [
      { id: 'camina', title: 'Robi camina', text: 'Abajo de la bandera verde, **poné dos flechas a la derecha**. Después tocá «Empezar».', explain: 'La bandera verde es el botón «Empezar»: lo que está abajo pasa cuando empieza el juego.', unlock: ['f_right'], demoScript: fFlag(fRight(), fRight()), check: (c) => has(c, 'robi', 'f_flag', ['f_right'], { min: 2 }) },
      { id: 'saluda', title: 'Robi saluda', text: 'Después de caminar, **Robi dice algo**: poné el globito y elegí qué dice.', unlock: ['f_say'], demoScript: fFlag(fRight(), fRight(), fSay('HOLA')), check: (c) => has(c, 'robi', 'f_flag', ['f_say']) },
      { id: 'viaja', title: '¡Al espacio!', text: 'Ahora Robi viaja: poné **«cambiar de lugar» y elegí el espacio**.', unlock: ['f_backdrop'], demoScript: fFlag(fRight(), fRight(), fSay('HOLA'), fBackdrop('espacio')), check: (c) => has(c, 'robi', 'f_flag', ['f_backdrop']) && c.stats.ran('backdrop') },
      { id: 'festeja', title: 'Robi festeja', text: 'En el espacio, Robi **se pone contento y salta**.', unlock: ['f_face', 'f_jump'], demoScript: fFlag(fRight(), fRight(), fSay('HOLA'), fBackdrop('espacio'), fFace('feliz'), fJump()), check: (c) => has(c, 'robi', 'f_flag', ['f_face', 'f_jump'], { kinds: 2 }) },
    ],
    challenges: [
      { title: 'Ida y vuelta', text: 'Que Robi **vuelva a la ciudad** al final del viaje.' },
      { title: 'Un amigo', text: '**Sumá otro personaje** que también viaje.' },
    ],
    solved: { robi: [fFlag(fRight(), fRight(), fSay('HOLA'), fBackdrop('espacio'), fFace('feliz'), fJump())] },
    play: (g) => {
      g.flag();
      g.run(8000);
    },
  }),

  mission({
    id: 'm1-mar', level: 1, order: 3, kind: 'Completá', title: 'Pulpi y Michi en el mar', cover: 'pulpi', backdrop: 'mar',
    pitch: 'Pulpi ya saluda. Hacé que Michi también tenga lo suyo.',
    concept: 'Dos personajes, cada uno con sus propios bloques.',
    sprites: [
      sprite('pulpi', 'pulpi', [fClick(fSay('HOLA'))], { x: -110, y: -60, name: 'Pulpi' }),
      sprite('michi', 'michi', [], { x: 110, y: -60, name: 'Michi' }),
    ],
    toolbox: ['f_click', 'f_say'],
    steps: [
      { id: 'michi-susto', title: 'Michi se asusta', text: 'Pulpi ya saluda (tocalo y mirá sus bloques). Ahora **elegí a Michi abajo**: cuando lo tocás, **pone cara de sorpresa y dice «¡Qué miedo!»**.', explain: 'Cada personaje tiene sus propios bloques. Abajo, en «Personajes», elegís cuál estás armando.', unlock: ['f_face'], demoSprite: 'michi', demoScript: fClick(fFace('sorpresa'), fSay('MIEDO')), check: (c) => has(c, 'michi', 'f_click', ['f_face']) },
      { id: 'pulpi-crece', title: 'Pulpi crece', text: 'Volvé a Pulpi: **abajo del saludo, que crezca dos veces**.', unlock: ['f_grow', 'f_shrink'], demoSprite: 'pulpi', demoScript: fClick(fSay('HOLA'), fGrow(), fGrow()), check: (c) => has(c, 'pulpi', 'f_click', ['f_grow'], { min: 2 }) },
      { id: 'michi-escapa', title: 'Michi se escapa', text: 'Michi sale nadando: **después del susto, que se mueva dos veces**.', unlock: ['f_left', 'f_right', 'f_up', 'f_down'], demoSprite: 'michi', demoScript: fClick(fFace('sorpresa'), fSay('MIEDO'), fLeft(), fLeft()), check: (c) => has(c, 'michi', 'f_click', ['f_left', 'f_right', 'f_up', 'f_down'], { min: 2 }) },
      { id: 'amigos', title: '¿Amigos?', text: 'Al final de Pulpi, **que pregunte «¿Querés ser mi amigo?»**.', demoSprite: 'pulpi', demoScript: fClick(fSay('HOLA'), fGrow(), fGrow(), fSay('AMIGO')), check: (c) => has(c, 'pulpi', 'f_click', ['f_say'], { min: 2 }) },
    ],
    challenges: [
      { title: 'Se hacen amigos', text: 'Que Michi **vuelva y se ponga contento**.' },
      { title: 'Pulpi se achica', text: 'Que Pulpi **vuelva a su tamaño** al final.' },
    ],
    solved: { pulpi: [fClick(fSay('HOLA'), fGrow(), fGrow(), fSay('AMIGO'))], michi: [fClick(fFace('sorpresa'), fSay('MIEDO'), fLeft(), fLeft())] },
    play: tapAll(['pulpi', 'michi']),
  }),

  mission({
    id: 'm1-arregla', level: 1, order: 4, kind: 'Arreglá', title: 'Las estrellas rotas', cover: 'star', backdrop: 'parque',
    pitch: 'Este juego tiene errores. ¡Encontralos y arreglalos!',
    concept: 'Leer bloques que ya están y cambiar lo que no anda.',
    sprites: [
      sprite('estrella', 'star', [fClick(fSpin())], { x: -140, y: 40, name: 'Estrella' }),
      sprite('manzana', 'apple', [fClick(fShrink(), fShrink(), fShrink())], { x: 0, y: 60, name: 'Manzana' }),
      sprite('michi', 'michi', [fClick(fFace('triste'), fSay('NO'))], { x: 130, y: -70, name: 'Michi' }),
    ],
    toolbox: ['f_click', 'f_spin', 'f_shrink', 'f_face', 'f_say', 'f_star'],
    steps: [
      { id: 'estrella', title: 'La estrella no da estrellas', text: 'Tocá la estrella: gira, pero **no te da ninguna estrella**. Mirá sus bloques y **agregá lo que falta**.', explain: 'Para arreglar algo primero hay que probarlo y mirar qué bloques tiene.', hints: ['Elegí la estrella abajo, en «Personajes».', 'Le falta el bloque de la estrella.'], example: [{ sprite: 'Estrella', scripts: [fClick(fSpin(), fStar())] }], check: (c) => has(c, 'estrella', 'f_click', ['f_star']) && c.stats.maxScore >= 1 },
      { id: 'manzana', title: 'La manzana desaparece', text: 'Tocá la manzana: ¡se achica hasta casi desaparecer! **Sacale los bloques de achicar** y hacé que **dé una estrella con un sonido**.', explain: 'Para sacar un bloque, arrastralo de vuelta a la izquierda.', unlock: ['f_sound'], hints: ['Arrastrá los bloques de achicar hacia la izquierda para borrarlos.', 'Después poné la estrella y un sonido.'], example: [{ sprite: 'Manzana', scripts: [fClick(fStar(), fSound('magia'))] }], check: (c) => has(c, 'manzana', 'f_click', ['f_star']) && !blocksUnder(c, 'manzana', 'f_click').some((b) => b.type === 'f_shrink') },
      { id: 'michi', title: 'Michi está triste', text: 'Michi está triste y dice «¡No!». **Cambiá la cara a feliz** y **que diga algo lindo**.', explain: 'Tocá el dibujito de la cara o del globito para elegir otro.', unlock: ['f_jump'], hints: ['Tocá la carita del bloque y elegí la feliz.', 'Tocá el globito y elegí otra frase.'], example: [{ sprite: 'Michi', scripts: [fClick(fFace('feliz'), fSay('GRACIAS'))] }], check: (c) => {
        const bs = blocksUnder(c, 'michi', 'f_click');
        return c.stats.ranHatBy('michi', 'click') && bs.some((b) => b.type === 'f_face' && HAPPY.includes(String(b.fields.E))) && !bs.some((b) => b.type === 'f_face' && !HAPPY.includes(String(b.fields.E))) && !bs.some((b) => b.type === 'f_say' && b.fields.P === 'NO');
      } },
      { id: 'tres', title: '¡Juntá tres!', text: 'Que **Michi también dé una estrella** y **juntá 3 estrellas** tocando todo.', hints: ['Poné una estrella en Michi.', 'Después tocá la estrella, la manzana y a Michi.'], example: [{ sprite: 'Michi', scripts: [fClick(fFace('feliz'), fSay('GRACIAS'), fStar())] }], check: (c) => has(c, 'michi', 'f_click', ['f_star']) && c.stats.maxScore >= 3 },
    ],
    challenges: [
      { title: 'Doble estrella', text: 'Que la manzana **dé dos estrellas** de una vez.' },
      { title: 'Más cosas', text: '**Sumá otro objeto** que también dé estrellas.' },
    ],
    solved: { estrella: [fClick(fSpin(), fStar())], manzana: [fClick(fStar(), fSound('magia'))], michi: [fClick(fFace('feliz'), fSay('GRACIAS'), fStar())] },
    play: tapAll(['estrella', 'manzana', 'michi']),
  }),
];

/* ======================= NIVEL 2 · Mar (2.º y 3.º): + vueltas, esperas, esconder; sin mensajes ni sensores ======================= */

const L2 = [
  mission({
    id: 'm2-baile', level: 2, order: 1, kind: 'Construí', title: 'Toby bailarín', cover: 'toby', backdrop: 'teatro',
    pitch: 'Toby baila repitiendo sus pasos.',
    concept: 'Repetir: las vueltas hacen lo de adentro varias veces.',
    sprites: [sprite('toby', 'toby', [], { x: 0, y: -60, name: 'Toby' })],
    toolbox: ['f_click'],
    steps: [
      { id: 'vueltas', title: 'Tres saltos', text: 'Poné **las vueltas abajo de la manito y un salto adentro**. Toby salta tres veces.', explain: 'Las vueltas repiten lo que tienen adentro. El número dice cuántas veces.', unlock: ['f_repeat', 'f_jump'], demoScript: fClick(fRepeat(3, fJump())), check: (c) => inside(c, 'toby', 'f_click', 'f_repeat', ['f_jump']) && c.stats.ran('repeat') },
      { id: 'giro', title: 'Salto y giro', text: 'Adentro de las vueltas, después del salto, **poné un giro**.', unlock: ['f_spin'], demoScript: fClick(fRepeat(3, fJump(), fSpin())), check: (c) => inside(c, 'toby', 'f_click', 'f_repeat', ['f_jump', 'f_spin']) },
      { id: 'musica', title: 'Con música', text: 'Que suene **una nota en cada vuelta**: ponela adentro.', unlock: ['f_note'], demoScript: fClick(fRepeat(3, fJump(), fSpin(), fNote('do'))), check: (c) => inside(c, 'toby', 'f_click', 'f_repeat', ['f_note']) && c.stats.count('note') >= 3 },
      { id: 'final', title: 'El final', text: 'Cuando termina de bailar, **afuera de las vueltas: cara feliz y aplausos**.', unlock: ['f_face', 'f_sound'], demoScript: fClick(fRepeat(3, fJump(), fSpin(), fNote('do')), fFace('feliz'), fSound('aplauso')), check: (c) => has(c, 'toby', 'f_click', ['f_face', 'f_sound'], { kinds: 2 }) },
    ],
    challenges: [
      { title: 'Baile largo', text: 'Que las vueltas **repitan 6 veces**.' },
      { title: 'Melodía', text: 'Poné **dos notas distintas** adentro de las vueltas.' },
    ],
    solved: { toby: [fClick(fRepeat(3, fJump(), fSpin(), fNote('do')), fFace('feliz'), fSound('aplauso'))] },
    play: tapAll(['toby'], 1, 6000),
  }),

  mission({
    id: 'm2-magia', level: 2, order: 2, kind: 'Construí', title: 'El truco de magia', cover: 'michi', backdrop: 'teatro',
    pitch: 'Michi es mago: desaparece y aparece en otro lugar.',
    concept: 'Esconder, esperar y mostrar, en orden.',
    sprites: [sprite('michi', 'michi', [], { x: 0, y: -60, name: 'Michi' })],
    toolbox: ['f_click'],
    steps: [
      { id: 'desaparece', title: '¡Desaparece!', text: 'Cuando tocás a Michi, **desaparece**: poné la manito y el bloque de esconder.', unlock: ['f_hide'], demoScript: fClick(fHide()), check: (c) => has(c, 'michi', 'f_click', ['f_hide']) },
      { id: 'vuelve', title: 'Y vuelve', text: 'Después de esconderse, **que espere un poco y vuelva a aparecer**.', explain: 'El reloj espera. Sin espera, Michi desaparece y aparece tan rápido que no lo ves.', unlock: ['f_wait', 'f_show'], demoScript: fClick(fHide(), fWait(1), fShow()), check: (c) => has(c, 'michi', 'f_click', ['f_hide', 'f_wait', 'f_show'], { kinds: 3 }) },
      { id: 'otro-lugar', title: 'En otro lugar', text: 'El truco: que aparezca en otro lugar. **Poné «a cualquier lugar» antes de mostrarlo.**', unlock: ['f_random'], demoScript: fClick(fHide(), fWait(1), fRandom(), fShow()), check: (c) => has(c, 'michi', 'f_click', ['f_random']) && c.stats.ran('move') },
      { id: 'magia', title: 'Con magia', text: '**Que el truco se repita dos veces** con las vueltas, y **al final suene la magia**.', unlock: ['f_repeat', 'f_sound'], demoScript: fClick(fRepeat(2, fHide(), fWait(1), fRandom(), fShow()), fSound('magia')), check: (c) => inside(c, 'michi', 'f_click', 'f_repeat', ['f_hide', 'f_show']) },
    ],
    challenges: [
      { title: 'Mago gigante', text: 'Que Michi **aparezca más grande**.' },
      { title: 'Ayudante', text: '**Sumá otro personaje** que aplauda cuando lo tocás.' },
    ],
    solved: { michi: [fClick(fRepeat(2, fHide(), fWait(1), fRandom(), fShow()), fSound('magia'))] },
    play: tapAll(['michi'], 1, 6000),
  }),

  mission({
    id: 'm2-concierto', level: 2, order: 3, kind: 'Completá', title: 'Pulpi cantante', cover: 'pulpi', backdrop: 'mar',
    pitch: 'Pulpi ya canta tres notas. Terminá su canción.',
    concept: 'Seguir un programa que ya existe: estribillo con vueltas, pausas y final.',
    sprites: [sprite('pulpi', 'pulpi', [fClick(fNote('do'), fNote('mi'), fNote('sol'))], { x: 0, y: -60, name: 'Pulpi' })],
    toolbox: ['f_click', 'f_note'],
    steps: [
      { id: 'estribillo', title: 'El estribillo', text: 'Tocá a Pulpi: ya canta tres notas. **Abajo, agregá unas vueltas con dos notas adentro**: es el estribillo.', explain: 'El estribillo es la parte de la canción que se repite. Las vueltas la repiten por vos.', unlock: ['f_repeat'], demoScript: fClick(fNote('do'), fNote('mi'), fNote('sol'), fRepeat(2, fNote('la'), fNote('sol'))), check: (c) => inside(c, 'pulpi', 'f_click', 'f_repeat', ['f_note']) && c.stats.count('note') >= 5 },
      { id: 'pausa', title: 'Una pausa', text: '**Poné una espera adentro de las vueltas**, así la canción respira.', unlock: ['f_wait'], demoScript: fClick(fNote('do'), fNote('mi'), fNote('sol'), fRepeat(2, fNote('la'), fNote('sol'), fWait(1))), check: (c) => inside(c, 'pulpi', 'f_click', 'f_repeat', ['f_wait']) },
      { id: 'baila', title: 'Pulpi baila', text: 'Al final, Pulpi **se agranda y se achica**, como haciendo una reverencia.', unlock: ['f_grow', 'f_shrink', 'f_jump'], demoScript: fClick(fNote('do'), fNote('mi'), fNote('sol'), fRepeat(2, fNote('la'), fNote('sol'), fWait(1)), fGrow(), fShrink()), check: (c) => has(c, 'pulpi', 'f_click', ['f_grow', 'f_shrink'], { kinds: 2 }) },
      { id: 'aplausos', title: 'El público', text: 'Para cerrar, **que suenen los aplausos**.', unlock: ['f_sound'], demoScript: fClick(fNote('do'), fNote('mi'), fNote('sol'), fRepeat(2, fNote('la'), fNote('sol'), fWait(1)), fGrow(), fShrink(), fSound('aplauso')), check: (c) => has(c, 'pulpi', 'f_click', ['f_sound']) && c.stats.ran('sound') },
    ],
    challenges: [
      { title: 'Tu canción', text: '**Cambiá las notas** para que suene una canción que conozcas.' },
      { title: 'Dúo', text: '**Sumá a Michi** para que cante otra parte.' },
    ],
    solved: { pulpi: [fClick(fNote('do'), fNote('mi'), fNote('sol'), fRepeat(2, fNote('la'), fNote('sol'), fWait(1)), fGrow(), fShrink(), fSound('aplauso'))] },
    play: tapAll(['pulpi'], 1, 9000),
  }),

  mission({
    id: 'm2-arregla', level: 2, order: 4, kind: 'Arreglá', title: 'La carrera desastrosa', cover: 'nova', backdrop: 'parque',
    pitch: 'Nova tendría que correr hasta la meta, pero todo sale mal. ¡Arreglalo!',
    concept: 'Probar, encontrar el error y cambiar un bloque o un número.',
    sprites: [sprite('nova', 'nova', [fFlag(fRepeat(2, fLeft()), fStar(), fSay('NO'))], { x: -160, y: -70, name: 'Nova' })],
    toolbox: ['f_flag', 'f_repeat', 'f_left', 'f_right', 'f_star', 'f_say'],
    steps: [
      { id: 'direccion', title: 'Para el otro lado', text: 'Tocá «Empezar»: Nova corre **para el lado equivocado**. **Cambiá la flecha** de adentro de las vueltas.', explain: 'Para arreglar algo primero hay que probarlo y mirar qué bloques tiene.', hints: ['La meta está a la derecha.', 'Sacá la flecha a la izquierda y poné una a la derecha.'], example: [{ sprite: 'Nova', scripts: [fFlag(fRepeat(2, fRight()), fStar(), fSay('NO'))] }], check: (c) => {
        /* Las primeras vueltas (la ida) van a la derecha; las de la vuelta pueden ir a la izquierda. */
        const first = blocksUnder(c, 'nova', 'f_flag').find((b) => b.type === 'f_repeat');
        const inner = first ? blocksInList(first.body).map((b) => b.type) : [];
        return c.stats.ranHatBy('nova', 'flag') && inner.includes('f_right') && !inner.includes('f_left');
      } },
      { id: 'vueltas', title: 'Un pasito nomás', text: 'Ahora va bien, pero **corre muy poquito**. **Cambiá el número de las vueltas** para que corra 4.', explain: 'El número de las vueltas dice cuántas veces se repite lo de adentro.', hints: ['Tocá el número de las vueltas.', 'Elegí 4.'], example: [{ sprite: 'Nova', scripts: [fFlag(fRepeat(4, fRight()), fStar(), fSay('NO'))] }], check: (c) => inside(c, 'nova', 'f_flag', 'f_repeat', ['f_right'], 4) },
      { id: 'festejo', title: 'Un mal festejo', text: 'Al llegar dice «¡No!». **Cambiá lo que dice** por algo que festeje y **que salte**.', unlock: ['f_jump'], hints: ['Tocá el globito y elegí otra frase.', 'Poné un salto después.'], example: [{ sprite: 'Nova', scripts: [fFlag(fRepeat(4, fRight()), fStar(), fSay('GUAU'), fJump())] }], check: (c) => has(c, 'nova', 'f_flag', ['f_jump']) && !blocksUnder(c, 'nova', 'f_flag').some((b) => b.type === 'f_say' && b.fields.P === 'NO') },
      { id: 'vuelta', title: 'La vuelta', text: '**Agregá la vuelta**: que espere un poco y **vuelva caminando con otras vueltas a la izquierda**.', unlock: ['f_wait'], hints: ['Al final: el reloj y otras vueltas.', 'Adentro, la flecha a la izquierda.'], example: [{ sprite: 'Nova', scripts: [fFlag(fRepeat(4, fRight()), fStar(), fSay('GUAU'), fJump(), fWait(1), fRepeat(4, fLeft()))] }], check: (c) => inside(c, 'nova', 'f_flag', 'f_repeat', ['f_left']) && inside(c, 'nova', 'f_flag', 'f_repeat', ['f_right'], 4) && has(c, 'nova', 'f_flag', ['f_wait']) },
    ],
    challenges: [
      { title: 'Rival', text: '**Sumá a Chispa** para que también corra. ¿Quién llega primero?' },
      { title: 'A los saltitos', text: 'Que **salte en cada paso** de la carrera.' },
    ],
    solved: { nova: [fFlag(fRepeat(4, fRight()), fStar(), fSay('GUAU'), fJump(), fWait(1), fRepeat(4, fLeft()))] },
    play: (g) => {
      g.flag();
      g.run(15000);
    },
  }),
];

/* ======================= NIVEL 3 · Bosque (3.º y 4.º): bloques con texto, teclado, puntos, «cuando toque a»; sin mensajes ======================= */

const L3 = [
  mission({
    id: 'm3-teclado', level: 3, order: 1, kind: 'Construí', title: 'Nova con el teclado', cover: 'nova', backdrop: 'espacio',
    pitch: 'Manejá a Nova con las flechas y la barra espaciadora.',
    concept: 'Eventos de teclado: cada tecla dispara sus bloques.',
    sprites: [sprite('nova', 'nova', [], { x: 0, y: -60, name: 'Nova' })],
    toolbox: ['a_key'],
    steps: [
      { id: 'derecha', title: 'Flecha derecha', text: 'Armá «al presionar tecla flecha derecha» y abajo: **apuntar hacia la derecha y mover 10 pasos**. Probalo con la flecha.', explain: '«Al presionar tecla» espera a que aprietes esa tecla del teclado.', unlock: ['a_point', 'a_move'], demoScript: onKey('ArrowRight', point('90'), move(10)), check: (c) => has(c, 'nova', 'a_key', ['a_move'], { key: 'ArrowRight' }) },
      { id: 'izquierda', title: 'Flecha izquierda', text: '**Otro bloque igual, pero con la flecha izquierda**: apuntar hacia la izquierda y mover.', hints: ['Es otro «al presionar tecla», aparte del de la derecha.', 'Elegí «flecha izquierda» en la tecla y «la izquierda» en apuntar.'], example: [{ sprite: 'Nova', scripts: [onKey('ArrowLeft', point('-90'), move(10))] }], check: (c) => has(c, 'nova', 'a_key', ['a_move'], { key: 'ArrowLeft' }) },
      { id: 'salto', title: 'Saltar con espacio', text: 'Con **la barra espaciadora, Nova salta y hace un sonido**.', unlock: ['a_jump', 'a_sound'], hints: ['Otro «al presionar tecla», con «espacio».'], example: [{ sprite: 'Nova', scripts: [onKey(' ', jump(), sound('boing'))] }], check: (c) => has(c, 'nova', 'a_key', ['a_jump'], { key: ' ' }) },
      { id: 'clic', title: 'Nova habla', text: 'Cuando hacés clic en Nova, **dice algo por 2 segundos y pone cara feliz**.', unlock: ['a_click', 'a_sayfor', 'a_face'], hints: ['Es «al hacer clic en este personaje».'], example: [{ sprite: 'Nova', scripts: [onClick(sayFor('¡Soy Nova!', 2), face('feliz'))] }], check: (c) => has(c, 'nova', 'a_click', ['a_sayfor']) },
    ],
    challenges: [
      { title: 'Arriba y abajo', text: '**Sumá las flechas** de arriba y abajo.' },
      { title: 'Turbo', text: 'Que con espacio Nova **avance 50 pasos** de golpe.' },
    ],
    solved: { nova: [onKey('ArrowRight', point('90'), move(10)), onKey('ArrowLeft', point('-90'), move(10)), onKey(' ', jump(), sound('boing')), onClick(sayFor('¡Soy Nova!', 2), face('feliz'))] },
    play: (g) => {
      g.flag();
      g.hold('ArrowRight', 600).run(300).hold('ArrowLeft', 600).run(300).hold(' ', 300).run(800);
      g.tap('nova');
      g.run(3000);
    },
  }),

  mission({
    id: 'm3-fugaces', level: 3, order: 2, kind: 'Construí', title: 'Estrellas fugaces', cover: 'star', backdrop: 'espacio',
    pitch: 'Hacé clic en la estrella antes de que se escape. ¡Llegá a 5!',
    concept: 'Puntos: sumar, empezar de cero y ganar al llegar a un número.',
    sprites: [sprite('estrella', 'star', [], { x: 60, y: 40, name: 'Estrella' }), sprite('robi', 'robi', [], { x: -160, y: -80, name: 'Robi' })],
    toolbox: ['a_click'],
    steps: [
      { id: 'punto', title: 'Un punto', text: 'Cuando hacés clic en la estrella, **sumá 1 a los puntos**.', explain: 'Los puntos son un número que el juego recuerda. Lo ves arriba del escenario.', unlock: ['a_addscore'], demoSprite: 'estrella', demoScript: onClick(addScore(1)), check: (c) => has(c, 'estrella', 'a_click', ['a_addscore']) && c.stats.maxScore >= 1 },
      { id: 'escapa', title: 'Se escapa', text: 'Después del punto, **la estrella salta a otro lugar**: «ir a posición aleatoria».', explain: 'Aleatorio quiere decir al azar: ni vos sabés dónde va a aparecer.', unlock: ['a_random'], demoSprite: 'estrella', demoScript: onClick(addScore(1), goToRandom()), check: (c) => has(c, 'estrella', 'a_click', ['a_random']) && c.stats.ran('move') },
      { id: 'cero', title: 'Desde cero', text: 'Cada partida empieza con 0 puntos: **con la bandera verde, «fijar puntos a 0»**.', unlock: ['a_flag', 'a_setscore'], demoSprite: 'estrella', demoScript: [onClick(addScore(1), goToRandom()), onFlag(setScore(0))], check: (c) => has(c, 'estrella', 'a_flag', ['a_setscore']) },
      { id: 'ganar', title: '¡Ganaste!', text: 'En Robi: **cuando los puntos lleguen a 5, dice «¡Ganaste!» y ganás**. Jugalo.', explain: '«Cuando los puntos lleguen a» espera hasta ese número y recién ahí hace lo de abajo.', unlock: ['a_points', 'a_sayfor', 'a_win'], hints: ['Elegí a Robi abajo, en «Personajes».', '«Cuando los puntos lleguen a 5», y abajo «¡ganar!».'], example: [{ sprite: 'Robi', scripts: [onPoints(5, sayFor('¡Ganaste!', 1), win())] }], check: (c) => wonAt(c, 3) },
    ],
    challenges: [
      { title: 'Más difícil', text: 'Que la estrella **se achique** cada vez que la atrapás.' },
      { title: 'Robi festeja', text: 'Que Robi **salte y suene** cuando ganás.' },
    ],
    solved: { estrella: [onClick(addScore(1), goToRandom()), onFlag(setScore(0))], robi: [onPoints(5, sayFor('¡Ganaste!', 1), win())] },
    play: (g) => {
      g.flag();
      g.run(300);
      for (let i = 0; i < 6 && !g.machine.ended; i++) {
        g.tap('estrella');
        g.run(400);
      }
      g.run(2000);
    },
  }),

  mission({
    id: 'm3-arquero', level: 3, order: 3, kind: 'Completá', title: 'Toby arquero', cover: 'ball', backdrop: 'parque',
    pitch: 'La pelota ya viene hacia Toby. ¡Hacé que la ataje!',
    concept: 'Leer un programa que ya existe y sumarle reglas con «cuando toque a».',
    sprites: [
      sprite('toby', 'toby', [], { x: -160, y: -90, name: 'Toby' }),
      sprite('pelota', 'ball', [onFlag(point('-90'), repeat(30, move(10)))], { x: 160, y: -90, name: 'Pelota' }),
    ],
    toolbox: ['a_flag', 'a_point', 'a_repeat', 'a_move'],
    steps: [
      { id: 'atajada', title: '¡Atajada!', text: 'Tocá «Empezar» y mirá: la pelota ya viene. **En la pelota: cuando toque a Toby, suma 1 punto, suena y salta a otro lugar.**', explain: '«Cuando toque a» se activa cuando dos personajes se chocan.', unlock: ['a_touching', 'a_addscore', 'a_sound', 'a_random'], demoSprite: 'pelota', demoScript: [onFlag(point('-90'), repeat(30, move(10))), onTouching('toby', addScore(1), sound('boing'), goToRandom())], check: (c) => has(c, 'pelota', 'a_touching', ['a_addscore'], { target: 'toby' }) && c.stats.maxScore >= 1 },
      { id: 'cero', title: 'Desde cero', text: 'En la pelota, en el bloque de la bandera: **que los puntos empiecen en 0**.', unlock: ['a_setscore'], demoSprite: 'pelota', demoScript: [onFlag(setScore(0), point('-90'), repeat(30, move(10))), onTouching('toby', addScore(1), sound('boing'), goToRandom())], check: (c) => refsOfHat(c, 'a_flag').some((r) => refBlocks(r).some((b) => b.type === 'a_setscore' && numField(b, 'N') === 0)) && c.stats.ranHat('flag') },
      { id: 'festeja', title: 'Toby festeja', text: '**En Toby: cuando toque la pelota, pone cara feliz y dice «¡Atajada!».**', unlock: ['a_face', 'a_sayfor'], demoSprite: 'toby', demoScript: onTouching('pelota', face('feliz'), sayFor('¡Atajada!', 1)), check: (c) => has(c, 'toby', 'a_touching', ['a_face', 'a_sayfor'], { target: 'pelota' }) },
      { id: 'salto', title: 'Salto de arquero', text: 'En Toby: **al presionar espacio, salta**.', unlock: ['a_key', 'a_jump'], demoSprite: 'toby', demoScript: [onTouching('pelota', face('feliz'), sayFor('¡Atajada!', 1)), onKey(' ', jump())], check: (c) => has(c, 'toby', 'a_key', ['a_jump'], { key: ' ' }) },
    ],
    challenges: [
      { title: 'Pelota rápida', text: 'Que la pelota **mueva 20 pasos** en vez de 10.' },
      { title: 'Toby se mueve', text: 'Que **Toby se mueva con las flechas**.' },
    ],
    solved: {
      pelota: [onFlag(setScore(0), point('-90'), repeat(30, move(10))), onTouching('toby', addScore(1), sound('boing'), goToRandom())],
      toby: [onTouching('pelota', face('feliz'), sayFor('¡Atajada!', 1)), onKey(' ', jump())],
    },
    play: (g) => {
      g.flag();
      g.run(12000);
      g.hold(' ', 300);
      g.run(1000);
    },
  }),

  mission({
    id: 'm3-arregla', level: 3, order: 4, kind: 'Arreglá', title: 'El cuento roto', cover: 'robi', backdrop: 'castillo',
    pitch: 'Robi quiere contar su aventura, pero el cuento tiene errores. ¡Arreglalo!',
    concept: 'Depurar: probar, encontrar el número o el bloque equivocado y cambiarlo.',
    sprites: [
      sprite('robi', 'robi', [onClick(sayFor('¡Hola! Soy Robi.', 0), backdrop('castillo'), sayFor('¡Llegué al espacio!', 0))], { x: -100, y: -70, name: 'Robi' }),
      sprite('chispa', 'chispa', [onClick(face('enojo'), repeat(0, jump()))], { x: 120, y: -60, name: 'Chispa' }),
    ],
    toolbox: ['a_click', 'a_sayfor', 'a_backdrop', 'a_face', 'a_repeat', 'a_jump'],
    steps: [
      { id: 'lento', title: 'Muy rápido', text: 'Hacé clic en Robi: habla **tan rápido que no se lee**. **Cambiá los segundos** de los dos «decir … por … segundos» a 2.', explain: 'Para arreglar algo primero hay que probarlo y mirar qué bloques tiene.', hints: ['Mirá el último número de cada bloque de decir.', 'Con 0 segundos el globito aparece y desaparece enseguida.'], example: [{ sprite: 'Robi', scripts: [onClick(sayFor('¡Hola! Soy Robi.', 2), backdrop('castillo'), sayFor('¡Llegué al espacio!', 2))] }], check: (c) => {
        const says = blocksUnder(c, 'robi', 'a_click').filter((b) => b.type === 'a_sayfor');
        return c.stats.ranHatBy('robi', 'click') && says.length >= 2 && says.every((b) => numField(b, 'S') >= 1);
      } },
      { id: 'fondo', title: 'No llegó a ningún lado', text: 'Robi dice que llegó al espacio, pero **el fondo no cambia**. **Encontrá el error.**', hints: ['Mirá el bloque de cambiar el fondo.', 'Elegí «espacio» en vez de «castillo».'], example: [{ sprite: 'Robi', scripts: [onClick(sayFor('¡Hola! Soy Robi.', 2), backdrop('espacio'), sayFor('¡Llegué al espacio!', 2))] }], check: (c) => blocksUnder(c, 'robi', 'a_click').some((b) => b.type === 'a_backdrop' && b.fields.B !== 'castillo') && c.stats.ran('backdrop') },
      { id: 'chispa', title: 'Chispa no salta', text: 'Chispa tendría que saltar 3 veces, pero **no salta nunca**. **Encontrá el error.**', hints: ['Mirá el número del bloque «repetir».', 'Repetir 0 veces es no hacerlo nunca.'], example: [{ sprite: 'Chispa', scripts: [onClick(face('enojo'), repeat(3, jump()))] }], check: (c) => inside(c, 'chispa', 'a_click', 'a_repeat', ['a_jump'], 2) },
      { id: 'final', title: 'Final feliz', text: '**Agregale un final al cuento**: Robi espera 1 segundo y se ríe.', unlock: ['a_wait'], hints: ['Al final del bloque de Robi.', '«Esperar 1 segundos» y una cara.'], example: [{ sprite: 'Robi', scripts: [onClick(sayFor('¡Hola! Soy Robi.', 2), backdrop('espacio'), sayFor('¡Llegué al espacio!', 2), wait(1), face('risa'))] }], check: (c) => has(c, 'robi', 'a_click', ['a_wait', 'a_face'], { kinds: 2 }) },
    ],
    challenges: [
      { title: 'Tercera escena', text: 'Que la historia **pase por un tercer lugar**.' },
      { title: 'Se hacen amigos', text: 'Que **Chispa conteste algo** cuando la tocás.' },
    ],
    solved: {
      robi: [onClick(sayFor('¡Hola! Soy Robi.', 2), backdrop('espacio'), sayFor('¡Llegué al espacio!', 2), wait(1), face('risa'))],
      chispa: [onClick(face('enojo'), repeat(3, jump()))],
    },
    play: tapAll(['robi', 'chispa'], 1, 7000),
  }),
];

/* ======================= NIVEL 4 · Volcán (4.º y 5.º): por siempre, flechas, «cuando toque a», ganar y perder ======================= */

const L4 = [
  mission({
    id: 'm4-nave', level: 4, order: 1, kind: 'Construí', title: 'La nave de Nova', cover: 'nova', backdrop: 'espacio',
    pitch: 'Pilotá a Nova por el espacio y juntá 5 estrellas.',
    concept: 'Por siempre, flechas y «cuando toque a».',
    sprites: [sprite('nova', 'nova', [], { x: -150, y: -40, name: 'Nova' }), sprite('estrella', 'star', [], { x: -80, y: -40, name: 'Estrella' })],
    toolbox: ['a_flag'],
    steps: [
      { id: 'pilotear', title: 'A pilotear', text: 'En Nova: **bandera verde, «por siempre» y adentro «mover con las flechas»**. Probalo.', explain: '«Por siempre» repite lo de adentro sin parar, así Nova te escucha las flechas todo el tiempo.', unlock: ['a_forever', 'a_arrows'], demoSprite: 'nova', demoScript: onFlag(forever(moveWithArrows(5))), check: (c) => inside(c, 'nova', 'a_flag', 'a_forever', ['a_arrows']) && travelled(c, 'nova') },
      { id: 'juntar', title: 'Juntar estrellas', text: 'En Nova: **cuando toque la estrella, suma 1 punto y suena la magia**.', explain: '«Cuando toque a» se activa en el momento en que dos personajes se chocan.', unlock: ['a_touching', 'a_addscore', 'a_sound'], demoSprite: 'nova', demoScript: [onFlag(forever(moveWithArrows(5))), onTouching('estrella', addScore(1), sound('magia'))], check: (c) => has(c, 'nova', 'a_touching', ['a_addscore'], { target: 'estrella' }) && c.stats.maxScore >= 1 },
      { id: 'salta', title: 'La estrella salta', text: 'En la estrella: **cuando toque a Nova, «ir a posición aleatoria»**.', explain: 'La estrella también se da cuenta cuando la tocan, igual que Nova.', unlock: ['a_random'], demoSprite: 'estrella', demoScript: onTouching('nova', goToRandom()), check: (c) => has(c, 'estrella', 'a_touching', ['a_random'], { target: 'nova' }) },
      { id: 'ganar', title: 'Misión cumplida', text: 'En Nova: **cuando los puntos lleguen a 5, ganás**. ¡Jugalo!', unlock: ['a_points', 'a_win'], hints: ['«Cuando los puntos lleguen a 5» y abajo «¡ganar!».'], example: [{ sprite: 'Nova', scripts: [onPoints(5, sound('aplauso'), win())] }], check: (c) => wonAt(c, 3) },
    ],
    challenges: [
      { title: 'Un meteorito', text: '**Sumá una roca que rebote** y te haga perder.' },
      { title: 'Nave turbo', text: '**Cambiá la velocidad** de las flechas.' },
    ],
    solved: { nova: [onFlag(forever(moveWithArrows(5))), onTouching('estrella', addScore(1), sound('magia')), onPoints(5, sound('aplauso'), win())], estrella: [onTouching('nova', goToRandom())] },
    play: (g) => {
      g.flag();
      g.run(200);
      steerTo(g, 'nova', () => 'estrella', [], () => (g.machine.score ?? 0) >= 5);
      g.run(1500);
    },
  }),

  mission({
    id: 'm4-tesoro', level: 4, order: 2, kind: 'Construí', title: 'Llegá al tesoro', cover: 'treasure', backdrop: 'ciudad',
    pitch: 'Manejá el auto hasta el tesoro sin chocar la piedra.',
    concept: 'Reglas para ganar y para perder.',
    sprites: [
      sprite('auto', 'car', [], { x: -170, y: -100, name: 'Auto' }),
      sprite('piedra', 'rock', [], { x: -90, y: -100, name: 'Piedra' }),
      sprite('tesoro', 'treasure', [], { x: 170, y: 90, name: 'Tesoro' }),
    ],
    toolbox: ['a_flag'],
    steps: [
      { id: 'manejar', title: 'A manejar', text: 'En el auto: **bandera verde, «por siempre» y «mover con las flechas»**.', explain: '«Por siempre» repite sin parar mientras dura el juego.', unlock: ['a_forever', 'a_arrows'], demoSprite: 'auto', demoScript: onFlag(forever(moveWithArrows(4))), check: (c) => inside(c, 'auto', 'a_flag', 'a_forever', ['a_arrows']) && travelled(c, 'auto') },
      { id: 'choque', title: '¡Cuidado!', text: 'En el auto: **cuando toque la piedra, perdés**. Chocala a propósito para probarlo.', unlock: ['a_touching', 'a_lose', 'a_face'], demoSprite: 'auto', demoScript: [onFlag(forever(moveWithArrows(4))), onTouching('piedra', lose())], check: (c) => has(c, 'auto', 'a_touching', ['a_lose'], { target: 'piedra' }) && c.stats.lost },
      { id: 'tesoro', title: 'El tesoro', text: 'En el auto: **cuando toque el tesoro, suenan aplausos y ganás**. ¡Llegá sin chocar!', unlock: ['a_win', 'a_sound'], hints: ['Es otro «cuando toque a», con el tesoro.', 'Adentro: un sonido y «¡ganar!».'], example: [{ sprite: 'Auto', scripts: [onTouching('tesoro', sound('aplauso'), win())] }], check: (c) => has(c, 'auto', 'a_touching', ['a_win'], { target: 'tesoro' }) && c.stats.won },
      { id: 'patrulla', title: 'La piedra se mueve', text: 'Más difícil: **en la piedra, bandera verde, «por siempre» mover 3 pasos y rebotar**.', unlock: ['a_move', 'a_bounce', 'a_point'], demoSprite: 'piedra', demoScript: onFlag(point('0'), forever(move(3), bounce())), check: (c) => inside(c, 'piedra', 'a_flag', 'a_forever', ['a_move', 'a_bounce']) },
    ],
    challenges: [
      { title: 'Dos piedras', text: '**Sumá otra piedra** que vaya de un lado al otro.' },
      { title: 'Festejo', text: 'Que el auto **diga algo antes de ganar**.' },
    ],
    solved: {
      auto: [onFlag(forever(moveWithArrows(4))), onTouching('piedra', lose()), onTouching('tesoro', sound('aplauso'), win())],
      piedra: [onFlag(point('0'), forever(move(3), bounce()))],
    },
    play: (g) => {
      g.flag();
      g.run(200);
      steerTo(g, 'auto', () => 'piedra', [], () => false, 30_000);
      g.run(300);
      g.flag();
      g.run(200);
      steerTo(g, 'auto', () => 'tesoro', ['piedra'], () => false);
      g.run(1000);
    },
  }),

  mission({
    id: 'm4-limpia', level: 4, order: 3, kind: 'Completá', title: 'Robi limpia el parque', cover: 'robi', backdrop: 'parque',
    pitch: 'Robi ya se mueve y junta una piedra. Terminá el juego.',
    concept: 'Leer lo que ya está, repetirlo en otro personaje y sumar un peligro.',
    sprites: [
      sprite('robi', 'robi', [onFlag(forever(moveWithArrows(4)))], { x: -170, y: -100, name: 'Robi' }),
      sprite('piedra', 'rock', [onTouching('robi', addScore(1), hide())], { x: -90, y: -100, name: 'Piedra' }),
      sprite('piedra2', 'rock', [], { x: 140, y: 70, name: 'Piedra 2' }),
      sprite('toby', 'toby', [], { x: 150, y: -60, size: 70, name: 'Toby' }),
    ],
    toolbox: ['a_flag', 'a_forever', 'a_arrows', 'a_touching', 'a_addscore', 'a_hide'],
    steps: [
      { id: 'otra', title: 'La otra piedra', text: 'Mirá los bloques de la Piedra. **Hacé lo mismo en la Piedra 2.**', explain: 'Un personaje escondido no se ve y ya no se puede tocar: queda «juntado».', demoSprite: 'piedra2', demoScript: onTouching('robi', addScore(1), hide()), check: (c) => has(c, 'piedra2', 'a_touching', ['a_hide'], { target: 'robi' }) },
      { id: 'perro', title: 'Un perro travieso', text: 'En Toby: **bandera verde, «por siempre» mover 3 pasos y rebotar**.', unlock: ['a_move', 'a_bounce'], demoSprite: 'toby', demoScript: onFlag(forever(move(3), bounce())), check: (c) => inside(c, 'toby', 'a_flag', 'a_forever', ['a_move', 'a_bounce']) },
      { id: 'cuidado', title: '¡Cuidado con Toby!', text: 'En Robi: **cuando toque a Toby, perdés**. Dejate atrapar para probarlo.', unlock: ['a_lose', 'a_face'], demoSprite: 'robi', demoScript: [onFlag(forever(moveWithArrows(4))), onTouching('toby', face('triste'), lose())], check: (c) => has(c, 'robi', 'a_touching', ['a_lose'], { target: 'toby' }) && c.stats.lost },
      { id: 'ganar', title: '¡Parque limpio!', text: 'En Robi: **cuando los puntos lleguen a 2, ganás**. Juntá las dos piedras esquivando a Toby.', unlock: ['a_points', 'a_win', 'a_sound'], hints: ['«Cuando los puntos lleguen a 2» y «¡ganar!».'], example: [{ sprite: 'Robi', scripts: [onPoints(2, sound('aplauso'), win())] }], check: (c) => wonAt(c, 2) },
    ],
    challenges: [
      { title: 'Más basura', text: '**Sumá una tercera piedra** y cambiá la meta a 3.' },
      { title: 'Toby rápido', text: 'Que Toby **mueva 5 pasos** en vez de 3.' },
    ],
    solved: {
      robi: [onFlag(forever(moveWithArrows(4))), onTouching('toby', face('triste'), lose()), onPoints(2, sound('aplauso'), win())],
      piedra2: [onTouching('robi', addScore(1), hide())],
      toby: [onFlag(forever(move(3), bounce()))],
    },
    play: (g) => loseThenCollect('robi', 'toby', () => (g.sprite('piedra').visible ? 'piedra' : g.sprite('piedra2').visible ? 'piedra2' : null), ['toby'], 2)(g),
  }),

  mission({
    id: 'm4-arregla', level: 4, order: 4, kind: 'Arreglá', title: 'Chispa está al revés', cover: 'chispa', backdrop: 'castillo',
    pitch: 'Este juego de esquivar está lleno de errores. ¡Arreglalo y ganalo!',
    concept: 'Depurar reglas: qué hace perder, qué da puntos y qué se repite.',
    sprites: [
      sprite('michi', 'michi', [onFlag(moveWithArrows(5)), onTouching('moneda', lose()), onTouching('chispa', addScore(1))], { x: -180, y: -120, size: 80, name: 'Michi' }),
      sprite('chispa', 'chispa', [onFlag(forever(move(3)))], { x: -200, y: -30, size: 80, name: 'Chispa' }),
      sprite('moneda', 'coin', [onTouching('michi', goToRandom())], { x: 120, y: 30, size: 130, name: 'Moneda' }),
    ],
    toolbox: ['a_flag', 'a_forever', 'a_arrows', 'a_move', 'a_bounce', 'a_touching', 'a_lose', 'a_addscore', 'a_random'],
    steps: [
      { id: 'mover', title: 'Michi se queda quieto', text: 'Tocá «Empezar» y usá las flechas: **Michi se mueve una sola vez**. **Arreglá su movimiento.**', explain: 'Para arreglar algo primero hay que probarlo y mirar qué bloques tiene.', hints: ['¿Qué bloque hace que algo se repita sin parar?', 'Poné «mover con las flechas» adentro de un «por siempre».'], example: [{ sprite: 'Michi', scripts: [onFlag(forever(moveWithArrows(5)))] }], check: (c) => inside(c, 'michi', 'a_flag', 'a_forever', ['a_arrows']) && travelled(c, 'michi') },
      { id: 'rebote', title: 'Chispa se escapa', text: 'Chispa **se va de la pantalla y no vuelve**. **Hacé que rebote.**', hints: ['Mirá lo que tiene Chispa adentro del «por siempre».', 'Le falta «rebotar si toca un borde».'], example: [{ sprite: 'Chispa', scripts: [onFlag(forever(move(3), bounce()))] }], check: (c) => inside(c, 'chispa', 'a_flag', 'a_forever', ['a_move', 'a_bounce']) },
      { id: 'reves', title: '¡Al revés!', text: '**La moneda te hace perder y Chispa te da puntos.** Arreglá los dos «cuando toque a» de Michi.', hints: ['Cambiá qué personaje elige cada «cuando toque a».', 'Con la moneda: sumar 1. Con Chispa: perder.'], example: [{ sprite: 'Michi', scripts: [onTouching('moneda', addScore(1)), onTouching('chispa', lose())] }], check: (c) => {
        const m = c.program.sprites.find((s) => s.id === 'michi');
        if (!m) return false;
        const at = (t: string) => scriptsOfHat(m, 'a_touching').filter((sc) => String(sc.hat.fields.T) === t).flatMap((sc) => blocksInList(sc.body).map((b) => b.type));
        return at('chispa').includes('a_lose') && !at('chispa').includes('a_addscore') && at('moneda').includes('a_addscore') && !at('moneda').includes('a_lose') && c.stats.maxScore >= 1;
      } },
      { id: 'ganar', title: 'Ahora sí, ganá', text: '**Cuando los puntos lleguen a 5, ganás.** ¡Jugalo hasta ganar!', unlock: ['a_points', 'a_win', 'a_sound'], hints: ['«Cuando los puntos lleguen a 5» en Michi, con «¡ganar!».'], example: [{ sprite: 'Michi', scripts: [onPoints(5, sound('aplauso'), win())] }], check: (c) => wonAt(c, 4) },
    ],
    challenges: [
      { title: 'Chispa más rápida', text: 'Que Chispa **mueva 5 pasos**.' },
      { title: 'Festejo', text: 'Que **suene algo** cada vez que juntás una moneda.' },
    ],
    solved: {
      michi: [onFlag(forever(moveWithArrows(5))), onTouching('moneda', addScore(1)), onTouching('chispa', lose()), onPoints(5, sound('aplauso'), win())],
      chispa: [onFlag(forever(move(3), bounce()))],
    },
    play: (g) => {
      g.flag();
      g.run(200);
      steerTo(g, 'michi', () => 'moneda', ['chispa'], () => (g.machine.score ?? 0) >= 5);
      g.run(1500);
    },
  }),
];

/* ======================= NIVEL 5 · Galaxia (6.º y 7.º): misiones más largas, fases y «si … entonces» ======================= */

const L5 = [
  mission({
    id: 'm5-nave', level: 5, order: 1, kind: 'Construí', title: 'Nova y el meteorito', cover: 'nova', backdrop: 'espacio',
    pitch: 'Juntá 5 estrellas con Nova mientras un meteorito rebota por el espacio.',
    concept: 'Por siempre, «cuando toque a», ganar y perder en un mismo juego.',
    sprites: [
      sprite('nova', 'nova', [], { x: -150, y: -40, name: 'Nova' }),
      sprite('estrella', 'star', [], { x: -80, y: -40, name: 'Estrella' }),
      sprite('roca', 'rock', [], { x: 100, y: 90, name: 'Meteorito' }),
    ],
    toolbox: ['a_flag'],
    steps: [
      { id: 'pilotear', title: 'A pilotear', text: 'En Nova: **bandera verde, «por siempre» y «mover con las flechas»**.', explain: '«Por siempre» repite sin parar, así Nova te escucha las flechas todo el tiempo.', unlock: ['a_forever', 'a_arrows'], demoSprite: 'nova', demoScript: onFlag(forever(moveWithArrows(5))), check: (c) => inside(c, 'nova', 'a_flag', 'a_forever', ['a_arrows']) && travelled(c, 'nova') },
      { id: 'juntar', title: 'Juntar estrellas', text: 'En Nova: **cuando toque la estrella, suma 1 punto**.', unlock: ['a_touching', 'a_addscore', 'a_sound'], demoSprite: 'nova', demoScript: [onFlag(forever(moveWithArrows(5))), onTouching('estrella', addScore(1), sound('magia'))], check: (c) => has(c, 'nova', 'a_touching', ['a_addscore'], { target: 'estrella' }) && c.stats.maxScore >= 1 },
      { id: 'salta', title: 'La estrella salta', text: 'En la estrella: **cuando toque a Nova, ir a posición aleatoria**.', unlock: ['a_random'], demoSprite: 'estrella', demoScript: onTouching('nova', goToRandom()), check: (c) => has(c, 'estrella', 'a_touching', ['a_random'], { target: 'nova' }) },
      { id: 'meteorito', title: 'El meteorito', text: 'En el meteorito: **apuntar hacia abajo y, por siempre, mover 3 pasos y rebotar**.', explain: '«Apuntar hacia» cambia para dónde avanza.', unlock: ['a_move', 'a_bounce', 'a_point'], demoSprite: 'roca', demoScript: onFlag(point('180'), forever(move(3), bounce())), check: (c) => inside(c, 'roca', 'a_flag', 'a_forever', ['a_move', 'a_bounce']) },
      { id: 'choque', title: '¡Impacto!', text: 'En Nova: **cuando toque el meteorito, cara triste y perdés**. Probalo.', unlock: ['a_lose', 'a_face'], hints: ['Otro «cuando toque a» en Nova.'], example: [{ sprite: 'Nova', scripts: [onTouching('roca', face('triste'), lose())] }], check: (c) => has(c, 'nova', 'a_touching', ['a_lose'], { target: 'roca' }) && c.stats.lost },
      { id: 'ganar', title: 'Misión cumplida', text: '**Con 5 estrellas, ganás.** Jugalo esquivando el meteorito.', unlock: ['a_points', 'a_win'], hints: ['«Cuando los puntos lleguen a 5» y «¡ganar!».'], example: [{ sprite: 'Nova', scripts: [onPoints(5, sound('aplauso'), win())] }], check: (c) => wonAt(c, 4) },
    ],
    challenges: [
      { title: 'Lluvia de meteoritos', text: '**Sumá un segundo meteorito** que vaya de costado.' },
      { title: 'Nivel 2', text: 'A los 3 puntos, **que cambie el fondo**.' },
    ],
    solved: {
      nova: [onFlag(forever(moveWithArrows(5))), onTouching('estrella', addScore(1), sound('magia')), onTouching('roca', face('triste'), lose()), onPoints(5, sound('aplauso'), win())],
      estrella: [onTouching('nova', goToRandom())],
      roca: [onFlag(point('180'), forever(move(3), bounce()))],
    },
    play: loseThenCollect('nova', 'roca', () => 'estrella', ['roca'], 5),
  }),

  mission({
    id: 'm5-fases', level: 5, order: 2, kind: 'Construí', title: 'El tesoro en dos fases', cover: 'treasure', backdrop: 'ciudad',
    pitch: 'Juntá monedas. A los 3 puntos el juego cambia: otro lugar y aparece un guardián.',
    concept: 'Fases: el juego cambia cuando los puntos llegan a un número.',
    sprites: [
      sprite('auto', 'car', [], { x: -170, y: -100, name: 'Auto' }),
      sprite('moneda', 'coin', [], { x: -100, y: -100, size: 120, name: 'Moneda' }),
      sprite('guardian', 'chispa', [], { x: 120, y: 60, size: 70, name: 'Guardián' }),
    ],
    toolbox: ['a_flag'],
    steps: [
      { id: 'manejar', title: 'A manejar', text: 'En el auto: **bandera, «por siempre» y «mover con las flechas»**.', unlock: ['a_forever', 'a_arrows'], demoSprite: 'auto', demoScript: onFlag(forever(moveWithArrows(4))), check: (c) => inside(c, 'auto', 'a_flag', 'a_forever', ['a_arrows']) && travelled(c, 'auto') },
      { id: 'monedas', title: 'Monedas', text: 'En el auto: **cuando toque la moneda, suma 1**. En la moneda: **cuando toque el auto, va a otro lugar**.', unlock: ['a_touching', 'a_addscore', 'a_random'], demoSprite: 'auto', demoScript: [onFlag(forever(moveWithArrows(4))), onTouching('moneda', addScore(1))], hints: ['Son dos bloques: uno en el auto y otro en la moneda.'], check: (c) => has(c, 'auto', 'a_touching', ['a_addscore'], { target: 'moneda' }) && c.stats.maxScore >= 1 },
      { id: 'escondido', title: 'Un guardián escondido', text: 'En el guardián: **con la bandera, «esconder»**. Al principio no está.', explain: 'Un personaje escondido no se ve y no puede tocar a nadie.', unlock: ['a_hide', 'a_show'], demoSprite: 'guardian', demoScript: onFlag(hide()), check: (c) => has(c, 'guardian', 'a_flag', ['a_hide']) },
      { id: 'fase2', title: '¡Fase 2!', text: 'En el guardián: **cuando los puntos lleguen a 3, mostrar y, por siempre, mover y rebotar**.', explain: '«Cuando los puntos lleguen a» es el cambio de fase: espera ese número y recién ahí arranca.', unlock: ['a_points', 'a_move', 'a_bounce'], hints: ['Es un bloque «cuando los puntos lleguen a 3».', 'Adentro: «mostrar» y un «por siempre» con mover y rebotar.'], example: [{ sprite: 'Guardián', scripts: [onFlag(hide()), onPoints(3, show(), forever(move(3), bounce()))] }], check: (c) => appearLater(c).some((s) => s.id === 'guardian') },
      { id: 'lugar', title: 'Otro lugar', text: 'En el auto: **cuando los puntos lleguen a 3, cambia el fondo** a otro lugar.', unlock: ['a_backdrop'], hints: ['Otro «cuando los puntos lleguen a 3», en el auto.'], example: [{ sprite: 'Auto', scripts: [onPoints(3, backdrop('castillo'))] }], check: (c) => refsOfHat(c, 'a_points').some((r) => refHas(r, ['a_backdrop'])) && c.stats.ran('backdrop') },
      { id: 'final', title: 'Perder y ganar', text: 'En el auto: **si toca al guardián, perdés**; y **con 6 puntos, ganás**. ¡Jugalo!', unlock: ['a_lose', 'a_win'], hints: ['Un «cuando toque a» con el guardián y «¡perder!».', 'Un «cuando los puntos lleguen a 6» con «¡ganar!».'], example: [{ sprite: 'Auto', scripts: [onTouching('guardian', lose()), onPoints(6, win())] }], check: (c) => lethalTargets(c).has('guardian') && wonAt(c, 5) },
    ],
    challenges: [
      { title: 'Fase 3', text: 'A los 5 puntos, **que el guardián vaya más rápido**.' },
      { title: 'Festejo', text: 'Que suene algo **en cada cambio de fase**.' },
    ],
    solved: {
      auto: [onFlag(forever(moveWithArrows(4))), onTouching('moneda', addScore(1)), onPoints(3, backdrop('castillo')), onTouching('guardian', lose()), onPoints(6, win())],
      moneda: [onTouching('auto', goToRandom())],
      guardian: [onFlag(hide()), onPoints(3, show(), forever(move(3), bounce()))],
    },
    play: (g) => {
      g.flag();
      g.run(200);
      steerTo(g, 'auto', () => 'moneda', ['guardian'], () => (g.machine.score ?? 0) >= 6);
      g.run(1500);
    },
  }),

  mission({
    id: 'm5-si', level: 5, order: 3, kind: 'Completá', title: 'Si… entonces', cover: 'bomb', backdrop: 'castillo',
    pitch: 'Nova ya se mueve y la bomba ya rebota. Agregá las reglas con «si … entonces».',
    concept: 'Condicionales: adentro del «por siempre», «si … entonces» pregunta todo el tiempo.',
    sprites: [
      sprite('nova', 'nova', [onFlag(forever(moveWithArrows(5)))], { x: -160, y: -100, name: 'Nova' }),
      sprite('bomba', 'bomb', [onFlag(point('-90'), forever(move(4), bounce()))], { x: -60, y: -100, name: 'Bomba' }),
      sprite('estrella', 'star', [], { x: 150, y: 80, name: 'Estrella' }),
    ],
    toolbox: ['a_flag', 'a_forever', 'a_arrows', 'a_move', 'a_bounce', 'a_point'],
    steps: [
      { id: 'si-bomba', title: 'Si toca la bomba…', text: 'Adentro del «por siempre» de Nova, **agregá «si … entonces» con «¿tocando bomba?» y adentro «¡perder!»**.', explain: '«Si … entonces» hace lo de adentro solo cuando la respuesta es sí. Dentro de «por siempre», pregunta todo el tiempo.', unlock: ['a_if', 'v_touching', 'a_lose'], demoSprite: 'nova', demoScript: onFlag(forever(moveWithArrows(5), ifThen(touching('bomba'), lose()))), check: (c) => lethalTargets(c).has('bomba') && c.stats.lost },
      { id: 'si-estrella', title: 'Si toca la estrella…', text: '**Otro «si … entonces»** en el mismo «por siempre»: **si toca la estrella, suma 1 punto**.', unlock: ['a_addscore'], hints: ['Abajo del primer «si», otro «si».', '«¿Tocando estrella?» y adentro «sumar 1 a puntos».'], example: [{ sprite: 'Nova', scripts: [onFlag(forever(moveWithArrows(5), ifThen(touching('bomba'), lose()), ifThen(touching('estrella'), addScore(1))))] }], check: (c) => c.program.sprites.some((s) => s.scripts.some((sc) => blocksInList(sc.body).some((b) => b.type === 'a_if' && b.inputs.C?.type === 'v_touching' && b.inputs.C.fields.T === 'estrella' && blocksInList(b.body).some((x) => x.type === 'a_addscore')))) && c.stats.maxScore >= 1 },
      { id: 'salta', title: 'La estrella salta', text: 'En la estrella: **cuando toque a Nova, ir a posición aleatoria**. Si no, ¡suma puntos sin parar!', unlock: ['a_touching', 'a_random'], hints: ['Es «cuando toque a Nova» en la estrella.'], example: [{ sprite: 'Estrella', scripts: [onTouching('nova', goToRandom())] }], check: (c) => has(c, 'estrella', 'a_touching', ['a_random'], { target: 'nova' }) },
      { id: 'fondo', title: 'Fase 2', text: '**Cuando los puntos lleguen a 5, cambia el fondo.**', unlock: ['a_points', 'a_backdrop'], hints: ['«Cuando los puntos lleguen a 5» en cualquier personaje.'], example: [{ sprite: 'Nova', scripts: [onPoints(5, backdrop('espacio'))] }], check: (c) => refsOfHat(c, 'a_points').some((r) => refHas(r, ['a_backdrop'])) && c.stats.ran('backdrop') },
      { id: 'ganar', title: 'La meta', text: '**Con 10 puntos, ganás.** ¡Jugalo!', unlock: ['a_win', 'a_sound'], hints: ['«Cuando los puntos lleguen a 10» y «¡ganar!».'], example: [{ sprite: 'Nova', scripts: [onPoints(10, sound('aplauso'), win())] }], check: (c) => wonAt(c, 8) },
    ],
    challenges: [
      { title: 'Si no…', text: 'Probá **«si … entonces … si no»** para que Nova ponga cara feliz cuando no toca nada.' },
      { title: 'Dos bombas', text: '**Sumá otra bomba** y otra regla.' },
    ],
    solved: {
      nova: [onFlag(forever(moveWithArrows(5), ifThen(touching('bomba'), lose()), ifThen(touching('estrella'), addScore(1)))), onPoints(5, backdrop('espacio')), onPoints(10, sound('aplauso'), win())],
      estrella: [onTouching('nova', goToRandom())],
    },
    play: loseThenCollect('nova', 'bomba', () => 'estrella', ['bomba'], 10),
  }),

  mission({
    id: 'm5-arregla', level: 5, order: 4, kind: 'Arreglá', title: 'Dos dragones rotos', cover: 'chispa', backdrop: 'castillo',
    pitch: 'Un juego casi terminado con cuatro errores. Encontralos uno por uno.',
    concept: 'Depurar un juego completo: fases, reglas y metas.',
    sprites: [
      sprite('michi', 'michi', [onFlag(forever(moveWithArrows(5))), onTouching('chispa', lose()), onTouching('moneda', addScore(1)), onPoints(3, win())], { x: -180, y: -120, size: 80, name: 'Michi' }),
      sprite('chispa', 'chispa', [onFlag(forever(move(3), bounce()))], { x: -200, y: -30, size: 80, name: 'Chispa' }),
      sprite('moneda', 'coin', [onTouching('michi', goToRandom())], { x: 120, y: 30, size: 130, name: 'Moneda' }),
      sprite('chispita', 'chispa', [onFlag(point('0'), forever(move(3), bounce()))], { x: 100, y: -150, size: 60, name: 'Chispita' }),
    ],
    toolbox: ['a_flag', 'a_forever', 'a_arrows', 'a_move', 'a_bounce', 'a_point', 'a_touching', 'a_lose', 'a_addscore', 'a_random', 'a_points', 'a_win'],
    steps: [
      { id: 'aparece', title: 'Aparece antes de tiempo', text: 'Chispita (el dragón chico) **tendría que aparecer recién a los 5 puntos**, pero está desde el principio. **Arreglalo.**', explain: 'Para arreglar algo primero hay que probarlo y mirar qué bloques tiene.', unlock: ['a_hide', 'a_show'], hints: ['Con la bandera: «esconder».', 'Su patrulla tiene que arrancar con «cuando los puntos lleguen a 5» y «mostrar».'], example: [{ sprite: 'Chispita', scripts: [onFlag(hide(), point('0')), onPoints(5, show(), forever(move(3), bounce()))] }], check: (c) => appearLater(c).some((s) => s.id === 'chispita') },
      { id: 'inofensivo', title: 'Un dragón que no hace nada', text: 'Si te toca Chispita, **no pasa nada**. **Encontrá qué falta.**', hints: ['Fijate qué tiene Michi con Chispa.', 'Falta otro «cuando toque a» con Chispita.'], example: [{ sprite: 'Michi', scripts: [onTouching('chispita', lose())] }], check: (c) => lethalTargets(c).has('chispita') },
      { id: 'meta', title: 'Demasiado fácil', text: '**Se gana con 3 monedas: es muy fácil.** Cambiá la meta a 10.', hints: ['Buscá el «cuando los puntos lleguen a» que tiene «¡ganar!».'], example: [{ sprite: 'Michi', scripts: [onPoints(10, win())] }], check: (c) => {
        const goals = refsOfHat(c, 'a_points').filter((r) => refHas(r, ['a_win']));
        return goals.length > 0 && goals.every((r) => numField(r.script.hat, 'N') >= 8);
      } },
      { id: 'ganar', title: 'Probalo de verdad', text: '**Jugalo y ganá**, esquivando a los dos dragones.', hints: ['Si te cuesta, hacé más lentos a los dragones.'], check: (c) => wonAt(c, 8) },
    ],
    challenges: [
      { title: 'Fase 3', text: 'A los 8 puntos, **que cambie el fondo**.' },
      { title: 'Tu error', text: '**Escondé un error** en tu juego y pedile a un compañero que lo encuentre.' },
    ],
    solved: {
      michi: [onFlag(forever(moveWithArrows(5))), onTouching('chispa', lose()), onTouching('chispita', lose()), onTouching('moneda', addScore(1)), onPoints(10, win())],
      chispita: [onFlag(hide(), point('0')), onPoints(5, show(), forever(move(3), bounce()))],
    },
    play: (g) => {
      g.flag();
      g.run(200);
      steerTo(g, 'michi', () => 'moneda', ['chispa', 'chispita'], () => (g.machine.score ?? 0) >= 10);
      g.run(1500);
    },
  }),
];

export const MISIONES: GameDefinition[] = [...L1, ...L2, ...L3, ...L4, ...L5];
