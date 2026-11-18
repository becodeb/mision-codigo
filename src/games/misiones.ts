/**
 * Misiones cortas (Clase 2): cuatro por nivel, de 4 pasos y unos 10–15 minutos cada una. Cada misión es un
 * proyecto nuevo con otros personajes, así un error no se arrastra y los chicos sienten que avanzan. Ninguna
 * usa sobres, operadores, variables ni coordenadas. El primer paso de cada misión tiene manito («Mostrame»).
 */
import { blockInfo, type BlockType } from '../language/catalog.ts';
import {
  addScore, backdrop, bounce, face, fBackdrop, fClick, fFace, fFlag, fGrow, fHide, fJump, fLeft, fNote, fRandom, fRepeat, fRight, fSay,
  fShow, fShrink, fSound, fSpin, fStar, fWait, forever, goToRandom, hide, jump, lose, move, moveWithArrows, onClick, onFlag, onKey, onPoints,
  onTouching, point, project, repeat, sayFor, setScore, sound, sprite, wait, win,
} from '../language/ir.ts';
import type { Script, SpriteProgram } from '../language/ir.ts';
import type { Game } from '../runtime/testing.ts';
import { blocksInList, nestedIn, refHas, refsOfHat, scriptsOfHat, travelled } from './checks.ts';
import { Pilot, centerOf, touchingNow } from './level4/autopilot.ts';
import type { GameChallenge, GameDefinition, GameStep, StepContext } from './types.ts';

/* ---------- herramientas ---------- */

const MAKE_IT_YOURS: GameChallenge = {
  title: 'Hacelo tuyo',
  text: 'Cambiá lo que quieras: el lugar, los sonidos, las caras, lo que dicen. ¡Que se note que es tuyo! Después mostráselo a alguien.',
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
function inside(ctx: StepContext, id: string, hat: BlockType, container: BlockType, types: BlockType[]): boolean {
  const sp = ctx.program.sprites.find((s) => s.id === id);
  const kind = blockInfo(hat)?.hat;
  if (!sp || !kind || !ctx.stats.ranHatBy(id, kind)) return false;
  return scriptsOfHat(sp, hat).some((sc) => {
    const within = nestedIn(sc.body, container).map((b) => b.type);
    return types.every((t) => within.includes(t));
  });
}

interface StepSpec extends Omit<GameStep, 'hints'> {
  hints?: string[];
}

interface MissionSpec {
  id: string;
  level: GameDefinition['level'];
  order: number;
  title: string;
  pitch: string;
  concept: string;
  cover: string;
  backdrop: string;
  sprites: SpriteProgram[];
  toolbox: BlockType[];
  steps: StepSpec[];
  challenges: GameChallenge[];
  /** Los mismos personajes, con el código terminado. */
  solved: Record<string, Script[]>;
  play: (game: Game) => void | Promise<void>;
}

function mission(m: MissionSpec): GameDefinition {
  const setup = project(m.backdrop, m.sprites);
  const solution = project(
    m.backdrop,
    m.sprites.map((s) => ({ ...s, scripts: m.solved[s.id] ?? [] })),
  );
  return {
    id: m.id,
    level: m.level,
    class: 2,
    order: m.order,
    kind: 'game',
    title: `Misión ${m.order}: ${m.title}`,
    pitch: m.pitch,
    concept: m.concept,
    cover: m.cover,
    setup,
    toolbox: m.toolbox,
    phases: [{ title: m.title, goal: m.pitch, steps: m.steps.map((s) => ({ hints: ['Tocá «Mostrame» o «Necesito una pista».'], ...s })) }],
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
function steerTo(game: Game, hero: string, targets: () => string | null, hazards: string[], until: () => boolean, maxMs = 180_000): void {
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

/* ======================= NIVEL 1 · Sol (1.º y 2.º) ======================= */

const L1_CIRCO = mission({
  id: 'm1-circo', level: 1, order: 1, title: 'El circo de Toby', cover: 'toby', backdrop: 'teatro',
  pitch: 'Toby es la estrella del circo. Cuando lo tocás, hace su número.',
  concept: 'Secuencia: al tocar, los bloques pasan en orden.',
  sprites: [sprite('toby', 'toby', [], { x: 0, y: -60, name: 'Toby' })],
  toolbox: ['f_click'],
  steps: [
    { id: 'salta', title: 'Toby salta', text: '¡Empieza la función! Poné la manito y abajo el salto. Después tocá a Toby.', explain: 'La manito es un bloque que espera: lo que pongas abajo pasa cuando tocás al personaje.', unlock: ['f_jump'], demoScript: fClick(fJump()), check: (c) => has(c, 'toby', 'f_click', ['f_jump']) },
    { id: 'gira', title: 'Una vuelta', text: 'Después del salto, que dé una vuelta. Poné el giro abajo del salto y tocalo.', unlock: ['f_spin'], demoScript: fClick(fJump(), fSpin()), check: (c) => has(c, 'toby', 'f_click', ['f_jump', 'f_spin'], { kinds: 2 }) },
    { id: 'aplausos', title: '¡Aplausos!', text: 'El público aplaude. Poné el sonido y elegí los aplausos.', unlock: ['f_sound'], demoScript: fClick(fJump(), fSpin(), fSound('aplauso')), check: (c) => has(c, 'toby', 'f_click', ['f_sound']) && c.stats.ran('sound') },
    { id: 'estrella', title: 'Una estrella', text: 'Cada número bien hecho gana una estrella. Ponela al final y tocá a Toby.', explain: 'La estrella suma un punto. Lo ves arriba del escenario.', unlock: ['f_star', 'f_face'], demoScript: fClick(fJump(), fSpin(), fSound('aplauso'), fStar()), check: (c) => has(c, 'toby', 'f_click', ['f_star']) && c.stats.maxScore >= 1 },
  ],
  challenges: [
    { title: 'Un número más largo', text: 'Hacé que Toby haga cinco cosas seguidas cuando lo tocás.' },
    { title: 'Toby se asusta', text: 'Poné una cara de sorpresa en el medio del número.' },
  ],
  solved: { toby: [fClick(fJump(), fSpin(), fSound('aplauso'), fStar())] },
  play: tapAll(['toby'], 2),
});

const L1_ROBI = mission({
  id: 'm1-robi-espacio', level: 1, order: 2, title: 'Robi viaja al espacio', cover: 'robi', backdrop: 'ciudad',
  pitch: 'Con la bandera verde, Robi camina, saluda y viaja al espacio.',
  concept: 'Secuencia que arranca con la bandera verde.',
  sprites: [sprite('robi', 'robi', [], { x: -120, y: -60, name: 'Robi' })],
  toolbox: ['f_flag'],
  steps: [
    { id: 'camina', title: 'Robi camina', text: 'Abajo de la bandera verde, poné dos flechas a la derecha. Después tocá «Empezar».', explain: 'La bandera verde es el botón «Empezar»: lo que está abajo pasa cuando empieza el juego.', unlock: ['f_right'], demoScript: fFlag(fRight(), fRight()), check: (c) => has(c, 'robi', 'f_flag', ['f_right'], { min: 2 }) },
    { id: 'saluda', title: 'Robi saluda', text: 'Después de caminar, Robi dice algo. Poné el globito y elegí qué dice.', unlock: ['f_say'], demoScript: fFlag(fRight(), fRight(), fSay('HOLA')), check: (c) => has(c, 'robi', 'f_flag', ['f_say']) },
    { id: 'viaja', title: '¡Al espacio!', text: 'Ahora Robi viaja: poné «cambiar de lugar» y elegí el espacio.', unlock: ['f_backdrop'], demoScript: fFlag(fRight(), fRight(), fSay('HOLA'), fBackdrop('espacio')), check: (c) => has(c, 'robi', 'f_flag', ['f_backdrop']) && c.stats.ran('backdrop') },
    { id: 'festeja', title: 'Robi festeja', text: 'En el espacio, Robi se pone contento y salta.', unlock: ['f_face', 'f_jump'], demoScript: fFlag(fRight(), fRight(), fSay('HOLA'), fBackdrop('espacio'), fFace('feliz'), fJump()), check: (c) => has(c, 'robi', 'f_flag', ['f_face', 'f_jump'], { kinds: 2 }) },
  ],
  challenges: [
    { title: 'Ida y vuelta', text: 'Que Robi vuelva a la ciudad al final del viaje.' },
    { title: 'Un amigo', text: 'Sumá otro personaje que también viaje.' },
  ],
  solved: { robi: [fFlag(fRight(), fRight(), fSay('HOLA'), fBackdrop('espacio'), fFace('feliz'), fJump())] },
  play: (g) => {
    g.flag();
    g.run(8000);
  },
});

const L1_MAR = mission({
  id: 'm1-mar', level: 1, order: 3, title: 'Pulpi y Michi en el mar', cover: 'pulpi', backdrop: 'mar',
  pitch: 'Pulpi quiere ser amigo de Michi, pero Michi se asusta.',
  concept: 'Dos personajes, cada uno con sus propios bloques.',
  sprites: [sprite('pulpi', 'pulpi', [], { x: -110, y: -60, name: 'Pulpi' }), sprite('michi', 'michi', [], { x: 110, y: -60, name: 'Michi' })],
  toolbox: ['f_click'],
  steps: [
    { id: 'pulpi-hola', title: 'Pulpi saluda', text: 'Cuando tocás a Pulpi, dice «¡Hola!». Poné la manito y el globito.', explain: 'Cada personaje tiene sus propios bloques. Mirá abajo, en «Personajes», cuál está elegido.', unlock: ['f_say'], demoSprite: 'pulpi', demoScript: fClick(fSay('HOLA')), check: (c) => has(c, 'pulpi', 'f_click', ['f_say']) },
    { id: 'michi-susto', title: 'Michi se asusta', text: 'Elegí a Michi abajo. Cuando lo tocás, pone cara de sorpresa y dice «¡Qué miedo!».', unlock: ['f_face'], demoSprite: 'michi', demoScript: fClick(fFace('sorpresa'), fSay('MIEDO')), check: (c) => has(c, 'michi', 'f_click', ['f_face']) },
    { id: 'pulpi-crece', title: 'Pulpi crece', text: 'Pulpi se pone grande para jugar: que crezca dos veces cuando lo tocás.', unlock: ['f_grow', 'f_shrink'], demoSprite: 'pulpi', demoScript: fClick(fSay('HOLA'), fGrow(), fGrow()), check: (c) => has(c, 'pulpi', 'f_click', ['f_grow'], { min: 2 }) },
    { id: 'michi-escapa', title: 'Michi se escapa', text: 'Michi sale nadando: después del susto, que se mueva dos veces.', unlock: ['f_left', 'f_right', 'f_up', 'f_down'], demoSprite: 'michi', demoScript: fClick(fFace('sorpresa'), fSay('MIEDO'), fLeft(), fLeft()), check: (c) => has(c, 'michi', 'f_click', ['f_left', 'f_right', 'f_up', 'f_down'], { min: 2 }) },
  ],
  challenges: [
    { title: 'Se hacen amigos', text: 'Que Michi diga «¿Querés ser mi amigo?» y se ponga contento.' },
    { title: 'Pulpi se achica', text: 'Que Pulpi vuelva a su tamaño cuando lo tocás otra vez.' },
  ],
  solved: { pulpi: [fClick(fSay('HOLA'), fGrow(), fGrow())], michi: [fClick(fFace('sorpresa'), fSay('MIEDO'), fLeft(), fLeft())] },
  play: tapAll(['pulpi', 'michi']),
});

const L1_ESTRELLAS = mission({
  id: 'm1-estrellas', level: 1, order: 4, title: 'Juntá estrellas', cover: 'star', backdrop: 'parque',
  pitch: 'Cada cosa que tocás te da una estrella. ¡Juntá un montón!',
  concept: 'Lo mismo en varios personajes: tocar y sumar.',
  sprites: [
    sprite('estrella', 'star', [], { x: -140, y: 40, name: 'Estrella' }),
    sprite('manzana', 'apple', [], { x: 0, y: 60, name: 'Manzana' }),
    sprite('michi', 'michi', [], { x: 130, y: -70, name: 'Michi' }),
  ],
  toolbox: ['f_click'],
  steps: [
    { id: 'estrella', title: 'Tocá la estrella', text: 'Cuando tocás la estrella, ganás una estrella. Poné la manito y la estrella.', explain: 'La estrella suma un punto. Lo ves arriba del escenario.', unlock: ['f_star'], demoSprite: 'estrella', demoScript: fClick(fStar()), check: (c) => has(c, 'estrella', 'f_click', ['f_star']) && c.stats.maxScore >= 1 },
    { id: 'brilla', title: 'Que brille', text: 'Que la estrella gire cuando la tocás.', unlock: ['f_spin'], demoSprite: 'estrella', demoScript: fClick(fStar(), fSpin()), check: (c) => has(c, 'estrella', 'f_click', ['f_spin']) },
    { id: 'manzana', title: 'La manzana también', text: 'Elegí la manzana abajo: cuando la tocás, también da una estrella y hace un sonido.', unlock: ['f_sound'], demoSprite: 'manzana', demoScript: fClick(fStar(), fSound('magia')), check: (c) => has(c, 'manzana', 'f_click', ['f_star']) },
    { id: 'michi', title: 'Michi festeja', text: 'Elegí a Michi: cuando lo tocás, se pone feliz, salta y da otra estrella. Juntá 3 estrellas.', unlock: ['f_face', 'f_jump'], demoSprite: 'michi', demoScript: fClick(fFace('feliz'), fJump(), fStar()), check: (c) => has(c, 'michi', 'f_click', ['f_face', 'f_jump'], { kinds: 2 }) && c.stats.maxScore >= 3 },
  ],
  challenges: [
    { title: 'Doble estrella', text: 'Que la manzana dé dos estrellas de una vez.' },
    { title: 'Más cosas', text: 'Sumá otro objeto que también dé estrellas.' },
  ],
  solved: { estrella: [fClick(fStar(), fSpin())], manzana: [fClick(fStar(), fSound('magia'))], michi: [fClick(fFace('feliz'), fJump(), fStar())] },
  play: tapAll(['estrella', 'manzana', 'michi']),
});

/* ======================= NIVEL 2 · Mar (2.º y 3.º) ======================= */

const L2_BAILE = mission({
  id: 'm2-baile', level: 2, order: 1, title: 'Toby bailarín', cover: 'toby', backdrop: 'teatro',
  pitch: 'Toby baila repitiendo sus pasos.',
  concept: 'Repetir: las vueltas hacen lo de adentro varias veces.',
  sprites: [sprite('toby', 'toby', [], { x: 0, y: -60, name: 'Toby' })],
  toolbox: ['f_click'],
  steps: [
    { id: 'vueltas', title: 'Tres saltos', text: 'Poné las vueltas abajo de la manito y un salto adentro. Toby salta tres veces.', explain: 'Las vueltas repiten lo que tienen adentro. El número dice cuántas veces.', unlock: ['f_repeat', 'f_jump'], demoScript: fClick(fRepeat(3, fJump())), check: (c) => inside(c, 'toby', 'f_click', 'f_repeat', ['f_jump']) && c.stats.ran('repeat') },
    { id: 'giro', title: 'Salto y giro', text: 'Adentro de las vueltas, después del salto, poné un giro.', unlock: ['f_spin'], demoScript: fClick(fRepeat(3, fJump(), fSpin())), check: (c) => inside(c, 'toby', 'f_click', 'f_repeat', ['f_jump', 'f_spin']) },
    { id: 'musica', title: 'Con música', text: 'Que suene una nota en cada vuelta: ponela adentro.', unlock: ['f_note'], demoScript: fClick(fRepeat(3, fJump(), fSpin(), fNote('do'))), check: (c) => inside(c, 'toby', 'f_click', 'f_repeat', ['f_note']) && c.stats.count('note') >= 3 },
    { id: 'final', title: 'El final', text: 'Cuando termina de bailar, afuera de las vueltas: cara feliz y aplausos.', unlock: ['f_face', 'f_sound'], demoScript: fClick(fRepeat(3, fJump(), fSpin(), fNote('do')), fFace('feliz'), fSound('aplauso')), check: (c) => has(c, 'toby', 'f_click', ['f_face', 'f_sound'], { kinds: 2 }) },
  ],
  challenges: [
    { title: 'Baile largo', text: 'Que las vueltas repitan 6 veces.' },
    { title: 'Melodía', text: 'Poné dos notas distintas adentro de las vueltas.' },
  ],
  solved: { toby: [fClick(fRepeat(3, fJump(), fSpin(), fNote('do')), fFace('feliz'), fSound('aplauso'))] },
  play: tapAll(['toby'], 1, 6000),
});

const L2_MAGIA = mission({
  id: 'm2-magia', level: 2, order: 2, title: 'El truco de magia', cover: 'michi', backdrop: 'teatro',
  pitch: 'Michi es mago: desaparece y aparece en otro lugar.',
  concept: 'Esconder, esperar y mostrar, en orden.',
  sprites: [sprite('michi', 'michi', [], { x: 0, y: -60, name: 'Michi' })],
  toolbox: ['f_click'],
  steps: [
    { id: 'desaparece', title: '¡Desaparece!', text: 'Cuando tocás a Michi, desaparece. Poné la manito y el bloque de esconder.', unlock: ['f_hide'], demoScript: fClick(fHide()), check: (c) => has(c, 'michi', 'f_click', ['f_hide']) },
    { id: 'vuelve', title: 'Y vuelve', text: 'Después de esconderse, que espere un poco y vuelva a aparecer.', explain: 'El reloj espera. Sin espera, Michi desaparece y aparece tan rápido que no lo ves.', unlock: ['f_wait', 'f_show'], demoScript: fClick(fHide(), fWait(1), fShow()), check: (c) => has(c, 'michi', 'f_click', ['f_hide', 'f_wait', 'f_show'], { kinds: 3 }) },
    { id: 'otro-lugar', title: 'En otro lugar', text: 'El truco: que aparezca en otro lugar. Poné «a cualquier lugar» antes de mostrarlo.', unlock: ['f_random'], demoScript: fClick(fHide(), fWait(1), fRandom(), fShow()), check: (c) => has(c, 'michi', 'f_click', ['f_random']) && c.stats.ran('move') },
    { id: 'magia', title: 'Con magia', text: 'Que el truco se repita dos veces con las vueltas, y al final suene la magia.', unlock: ['f_repeat', 'f_sound'], demoScript: fClick(fRepeat(2, fHide(), fWait(1), fRandom(), fShow()), fSound('magia')), check: (c) => inside(c, 'michi', 'f_click', 'f_repeat', ['f_hide', 'f_show']) },
  ],
  challenges: [
    { title: 'Mago gigante', text: 'Que Michi aparezca más grande.' },
    { title: 'Ayudante', text: 'Sumá otro personaje que aplauda cuando lo tocás.' },
  ],
  solved: { michi: [fClick(fRepeat(2, fHide(), fWait(1), fRandom(), fShow()), fSound('magia'))] },
  play: tapAll(['michi'], 1, 6000),
});

const L2_CONCIERTO = mission({
  id: 'm2-concierto', level: 2, order: 3, title: 'Pulpi cantante', cover: 'pulpi', backdrop: 'mar',
  pitch: 'Pulpi canta una canción con estribillo.',
  concept: 'Notas en orden y un estribillo que se repite.',
  sprites: [sprite('pulpi', 'pulpi', [], { x: 0, y: -60, name: 'Pulpi' })],
  toolbox: ['f_click'],
  steps: [
    { id: 'notas', title: 'Tres notas', text: 'Cuando tocás a Pulpi, canta tres notas. Tocá el dibujito de cada nota para cambiarla.', unlock: ['f_note'], demoScript: fClick(fNote('do'), fNote('mi'), fNote('sol')), check: (c) => has(c, 'pulpi', 'f_click', ['f_note'], { min: 3 }) },
    { id: 'estribillo', title: 'El estribillo', text: 'Después, el estribillo: unas vueltas con dos notas adentro.', explain: 'El estribillo es la parte de la canción que se repite. Las vueltas la repiten por vos.', unlock: ['f_repeat'], demoScript: fClick(fNote('do'), fNote('mi'), fNote('sol'), fRepeat(2, fNote('la'), fNote('sol'))), check: (c) => inside(c, 'pulpi', 'f_click', 'f_repeat', ['f_note']) && c.stats.count('note') >= 5 },
    { id: 'pausa', title: 'Una pausa', text: 'Poné una espera adentro de las vueltas, así la canción respira.', unlock: ['f_wait'], demoScript: fClick(fNote('do'), fNote('mi'), fNote('sol'), fRepeat(2, fNote('la'), fNote('sol'), fWait(1))), check: (c) => inside(c, 'pulpi', 'f_click', 'f_repeat', ['f_wait']) },
    { id: 'baila', title: 'Pulpi baila', text: 'Al final, Pulpi se agranda y se achica, como haciendo una reverencia.', unlock: ['f_grow', 'f_shrink', 'f_jump'], demoScript: fClick(fNote('do'), fNote('mi'), fNote('sol'), fRepeat(2, fNote('la'), fNote('sol'), fWait(1)), fGrow(), fShrink()), check: (c) => has(c, 'pulpi', 'f_click', ['f_grow', 'f_shrink'], { kinds: 2 }) },
  ],
  challenges: [
    { title: 'Tu canción', text: 'Cambiá las notas para que suene una canción que conozcas.' },
    { title: 'Dúo', text: 'Sumá a Michi para que cante otra parte.' },
  ],
  solved: { pulpi: [fClick(fNote('do'), fNote('mi'), fNote('sol'), fRepeat(2, fNote('la'), fNote('sol'), fWait(1)), fGrow(), fShrink())] },
  play: tapAll(['pulpi'], 1, 8000),
});

const L2_CARRERA = mission({
  id: 'm2-carrera', level: 2, order: 4, title: 'La carrera de Nova', cover: 'nova', backdrop: 'parque',
  pitch: 'Nova corre hasta la meta, festeja y vuelve.',
  concept: 'Vueltas que arrancan con la bandera verde.',
  sprites: [sprite('nova', 'nova', [], { x: -160, y: -70, name: 'Nova' })],
  toolbox: ['f_flag'],
  steps: [
    { id: 'corre', title: 'Nova corre', text: 'Con la bandera verde, unas vueltas con una flecha a la derecha adentro. Tocá «Empezar».', explain: 'Con las vueltas no hace falta poner la flecha muchas veces.', unlock: ['f_repeat', 'f_right'], demoScript: fFlag(fRepeat(4, fRight())), check: (c) => inside(c, 'nova', 'f_flag', 'f_repeat', ['f_right']) && c.stats.ran('move') },
    { id: 'saltitos', title: 'A los saltitos', text: 'Que en cada vuelta también salte.', unlock: ['f_jump'], demoScript: fFlag(fRepeat(4, fRight(), fJump())), check: (c) => inside(c, 'nova', 'f_flag', 'f_repeat', ['f_right', 'f_jump']) },
    { id: 'meta', title: '¡Llegó!', text: 'Cuando termina de correr, afuera de las vueltas: dice «¡Guau!» y gana una estrella.', unlock: ['f_say', 'f_star'], demoScript: fFlag(fRepeat(4, fRight(), fJump()), fSay('GUAU'), fStar()), check: (c) => has(c, 'nova', 'f_flag', ['f_star']) && c.stats.maxScore >= 1 },
    { id: 'vuelve', title: 'La vuelta', text: 'Espera un poco y vuelve caminando: otras vueltas con la flecha a la izquierda.', unlock: ['f_wait', 'f_left'], demoScript: fFlag(fRepeat(4, fRight(), fJump()), fSay('GUAU'), fStar(), fWait(1), fRepeat(4, fLeft())), check: (c) => inside(c, 'nova', 'f_flag', 'f_repeat', ['f_left']) },
  ],
  challenges: [
    { title: 'Rival', text: 'Sumá a Chispa para que también corra. ¿Quién llega primero?' },
    { title: 'Carrera larga', text: 'Que corra 6 vueltas en vez de 4.' },
  ],
  solved: { nova: [fFlag(fRepeat(4, fRight(), fJump()), fSay('GUAU'), fStar(), fWait(1), fRepeat(4, fLeft()))] },
  play: (g) => {
    g.flag();
    g.run(15000);
  },
});

/* ======================= NIVEL 3 · Bosque (3.º y 4.º) ======================= */

const L3_TECLADO = mission({
  id: 'm3-teclado', level: 3, order: 1, title: 'Nova con el teclado', cover: 'nova', backdrop: 'espacio',
  pitch: 'Manejá a Nova con las flechas y la barra espaciadora.',
  concept: 'Eventos de teclado: cada tecla dispara sus bloques.',
  sprites: [sprite('nova', 'nova', [], { x: 0, y: -60, name: 'Nova' })],
  toolbox: ['a_key'],
  steps: [
    { id: 'derecha', title: 'Flecha derecha', text: 'Armá «al presionar tecla flecha derecha» y abajo: apuntar hacia la derecha y mover 10 pasos. Probalo con la flecha.', explain: '«Al presionar tecla» espera a que aprietes esa tecla del teclado.', unlock: ['a_point', 'a_move'], demoScript: onKey('ArrowRight', point('90'), move(10)), check: (c) => has(c, 'nova', 'a_key', ['a_move'], { key: 'ArrowRight' }) },
    { id: 'izquierda', title: 'Flecha izquierda', text: 'Otro bloque igual, pero con la flecha izquierda: apuntar hacia la izquierda y mover.', hints: ['Es otro «al presionar tecla», aparte del de la derecha.', 'Elegí «flecha izquierda» en la tecla y «la izquierda» en apuntar.'], example: [{ sprite: 'Nova', scripts: [onKey('ArrowLeft', point('-90'), move(10))] }], check: (c) => has(c, 'nova', 'a_key', ['a_move'], { key: 'ArrowLeft' }) },
    { id: 'salto', title: 'Saltar con espacio', text: 'Con la barra espaciadora, Nova salta y hace un sonido.', unlock: ['a_jump', 'a_sound'], hints: ['Otro «al presionar tecla», con «espacio».'], example: [{ sprite: 'Nova', scripts: [onKey(' ', jump(), sound('boing'))] }], check: (c) => has(c, 'nova', 'a_key', ['a_jump'], { key: ' ' }) },
    { id: 'clic', title: 'Nova habla', text: 'Cuando hacés clic en Nova, dice algo por 2 segundos y pone cara feliz.', unlock: ['a_click', 'a_sayfor', 'a_face'], hints: ['Es «al hacer clic en este personaje».'], example: [{ sprite: 'Nova', scripts: [onClick(sayFor('¡Soy Nova!', 2), face('feliz'))] }], check: (c) => has(c, 'nova', 'a_click', ['a_sayfor']) },
  ],
  challenges: [
    { title: 'Arriba y abajo', text: 'Sumá las flechas de arriba y abajo.' },
    { title: 'Turbo', text: 'Que con espacio Nova avance 50 pasos de golpe.' },
  ],
  solved: { nova: [onKey('ArrowRight', point('90'), move(10)), onKey('ArrowLeft', point('-90'), move(10)), onKey(' ', jump(), sound('boing')), onClick(sayFor('¡Soy Nova!', 2), face('feliz'))] },
  play: (g) => {
    g.flag();
    g.hold('ArrowRight', 600).run(300).hold('ArrowLeft', 600).run(300).hold(' ', 300).run(800);
    g.tap('nova');
    g.run(3000);
  },
});

const L3_FUGACES = mission({
  id: 'm3-fugaces', level: 3, order: 2, title: 'Estrellas fugaces', cover: 'star', backdrop: 'espacio',
  pitch: 'Hacé clic en la estrella antes de que se escape. ¡Llegá a 5!',
  concept: 'Puntos: sumar, empezar de cero y ganar al llegar a un número.',
  sprites: [sprite('estrella', 'star', [], { x: 60, y: 40, name: 'Estrella' }), sprite('robi', 'robi', [], { x: -160, y: -80, name: 'Robi' })],
  toolbox: ['a_click'],
  steps: [
    { id: 'punto', title: 'Un punto', text: 'Cuando hacés clic en la estrella, sumá 1 a los puntos.', explain: 'Los puntos son un número que el juego recuerda. Lo ves arriba del escenario.', unlock: ['a_addscore'], demoSprite: 'estrella', demoScript: onClick(addScore(1)), check: (c) => has(c, 'estrella', 'a_click', ['a_addscore']) && c.stats.maxScore >= 1 },
    { id: 'escapa', title: 'Se escapa', text: 'Después del punto, la estrella salta a otro lugar: «ir a posición aleatoria».', explain: 'Aleatorio quiere decir al azar: ni vos sabés dónde va a aparecer.', unlock: ['a_random'], demoSprite: 'estrella', demoScript: onClick(addScore(1), goToRandom()), check: (c) => has(c, 'estrella', 'a_click', ['a_random']) && c.stats.ran('move') },
    { id: 'cero', title: 'Desde cero', text: 'Cada partida empieza con 0 puntos: con la bandera verde, «fijar puntos a 0».', unlock: ['a_flag', 'a_setscore'], demoSprite: 'estrella', demoScript: [onClick(addScore(1), goToRandom()), onFlag(setScore(0))], check: (c) => has(c, 'estrella', 'a_flag', ['a_setscore']) },
    { id: 'ganar', title: '¡Ganaste!', text: 'En Robi: cuando los puntos lleguen a 5, dice «¡Ganaste!» y ganás. Jugalo.', explain: '«Cuando los puntos lleguen a» espera hasta ese número y recién ahí hace lo de abajo.', unlock: ['a_points', 'a_sayfor', 'a_win'], hints: ['Elegí a Robi abajo, en «Personajes».', '«Cuando los puntos lleguen a 5», y abajo «¡ganar!».'], example: [{ sprite: 'Robi', scripts: [onPoints(5, sayFor('¡Ganaste!', 1), win())] }], check: (c) => refsOfHat(c, 'a_points').some((r) => refHas(r, ['a_win'])) && c.stats.won },
  ],
  challenges: [
    { title: 'Más difícil', text: 'Que la estrella se achique cada vez que la atrapás.' },
    { title: 'Una trampa', text: 'Sumá una bomba que, si la tocás, te hace perder.' },
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
});

const L3_ARQUERO = mission({
  id: 'm3-arquero', level: 3, order: 3, title: 'Toby arquero', cover: 'ball', backdrop: 'parque',
  pitch: 'La pelota va hacia Toby. ¡Que la ataje!',
  concept: 'Repetir un movimiento y reaccionar cuando dos personajes se tocan.',
  sprites: [sprite('toby', 'toby', [], { x: -160, y: -90, name: 'Toby' }), sprite('pelota', 'ball', [], { x: 160, y: -90, name: 'Pelota' })],
  toolbox: ['a_flag'],
  steps: [
    { id: 'patea', title: 'La pelota viene', text: 'En la pelota: con la bandera, apuntar a la izquierda y repetir 30 veces «mover 10 pasos».', explain: '«Repetir» hace lo de adentro muchas veces: así la pelota avanza de a poquito.', unlock: ['a_point', 'a_repeat', 'a_move'], demoSprite: 'pelota', demoScript: onFlag(point('-90'), repeat(30, move(10))), check: (c) => inside(c, 'pelota', 'a_flag', 'a_repeat', ['a_move']) },
    { id: 'atajada', title: '¡Atajada!', text: 'En la pelota: cuando toque a Toby, suma 1 punto, suena y salta a otro lugar.', explain: '«Cuando toque a» se activa cuando dos personajes se chocan.', unlock: ['a_touching', 'a_addscore', 'a_sound', 'a_random'], demoSprite: 'pelota', demoScript: [onFlag(point('-90'), repeat(30, move(10))), onTouching('toby', addScore(1), sound('boing'), goToRandom())], check: (c) => has(c, 'pelota', 'a_touching', ['a_addscore'], { target: 'toby' }) && c.stats.maxScore >= 1 },
    { id: 'festeja', title: 'Toby festeja', text: 'En Toby: cuando toque la pelota, pone cara feliz y dice «¡Atajada!».', unlock: ['a_face', 'a_sayfor'], demoSprite: 'toby', demoScript: onTouching('pelota', face('feliz'), sayFor('¡Atajada!', 1)), check: (c) => has(c, 'toby', 'a_touching', ['a_face', 'a_sayfor'], { target: 'pelota' }) },
    { id: 'salto', title: 'Salto de arquero', text: 'En Toby: al presionar espacio, salta.', unlock: ['a_key', 'a_jump'], demoSprite: 'toby', demoScript: [onTouching('pelota', face('feliz'), sayFor('¡Atajada!', 1)), onKey(' ', jump())], check: (c) => has(c, 'toby', 'a_key', ['a_jump'], { key: ' ' }) },
  ],
  challenges: [
    { title: 'Pelota rápida', text: 'Que la pelota mueva 20 pasos en vez de 10.' },
    { title: 'Toby se mueve', text: 'Que Toby se mueva con las flechas.' },
  ],
  solved: {
    pelota: [onFlag(point('-90'), repeat(30, move(10))), onTouching('toby', addScore(1), sound('boing'), goToRandom())],
    toby: [onTouching('pelota', face('feliz'), sayFor('¡Atajada!', 1)), onKey(' ', jump())],
  },
  play: (g) => {
    g.flag();
    g.run(12000);
    g.hold(' ', 300);
    g.run(1000);
  },
});

const L3_CUENTO = mission({
  id: 'm3-cuento', level: 3, order: 4, title: 'El cuento de Robi', cover: 'robi', backdrop: 'castillo',
  pitch: 'Robi cuenta una aventura que pasa en varios lugares.',
  concept: 'Una historia en orden, con esperas y cambios de escena.',
  sprites: [sprite('robi', 'robi', [], { x: -100, y: -70, name: 'Robi' }), sprite('chispa', 'chispa', [], { x: 120, y: -60, name: 'Chispa' })],
  toolbox: ['a_click'],
  steps: [
    { id: 'presenta', title: 'Robi se presenta', text: 'Cuando hacés clic en Robi, dice «¡Hola! Soy Robi.» por 2 segundos. Escribí lo que quieras.', unlock: ['a_sayfor'], demoSprite: 'robi', demoScript: onClick(sayFor('¡Hola! Soy Robi.', 2)), check: (c) => has(c, 'robi', 'a_click', ['a_sayfor']) },
    { id: 'viaje', title: 'Cambia la escena', text: 'Después, el fondo cambia y Robi cuenta dónde llegó.', unlock: ['a_backdrop'], demoSprite: 'robi', demoScript: onClick(sayFor('¡Hola! Soy Robi.', 2), backdrop('espacio'), sayFor('¡Llegué al espacio!', 2)), check: (c) => has(c, 'robi', 'a_click', ['a_backdrop']) && c.stats.ran('backdrop') },
    { id: 'chispa', title: 'Aparece Chispa', text: 'Cuando hacés clic en Chispa, se enoja, ruge y salta 3 veces con «repetir».', unlock: ['a_face', 'a_sound', 'a_repeat', 'a_jump'], demoSprite: 'chispa', demoScript: onClick(face('enojo'), sound('tambor'), repeat(3, jump())), check: (c) => inside(c, 'chispa', 'a_click', 'a_repeat', ['a_jump']) },
    { id: 'final', title: 'Final feliz', text: 'En Robi, al final del cuento: espera 1 segundo y se ríe.', unlock: ['a_wait'], demoSprite: 'robi', demoScript: onClick(sayFor('¡Hola! Soy Robi.', 2), backdrop('espacio'), sayFor('¡Llegué al espacio!', 2), wait(1), face('risa')), check: (c) => has(c, 'robi', 'a_click', ['a_wait', 'a_face'], { kinds: 2 }) },
  ],
  challenges: [
    { title: 'Tercera escena', text: 'Que la historia pase por un tercer lugar.' },
    { title: 'Se hacen amigos', text: 'Que Chispa conteste algo cuando la tocás.' },
  ],
  solved: {
    robi: [onClick(sayFor('¡Hola! Soy Robi.', 2), backdrop('espacio'), sayFor('¡Llegué al espacio!', 2), wait(1), face('risa'))],
    chispa: [onClick(face('enojo'), sound('tambor'), repeat(3, jump()))],
  },
  play: tapAll(['robi', 'chispa'], 1, 7000),
});

/* ======================= NIVEL 4 · Volcán (4.º y 5.º) — también nivel 5 ======================= */

function l4Missions(level: 4 | 5): GameDefinition[] {
  const p = level === 4 ? 'm4' : 'm5';
  const nave = mission({
    id: `${p}-nave`, level, order: 1, title: 'La nave de Nova', cover: 'nova', backdrop: 'espacio',
    pitch: 'Pilotá a Nova por el espacio y juntá 5 estrellas.',
    concept: 'Por siempre, flechas y «cuando toque a».',
    sprites: [sprite('nova', 'nova', [], { x: -150, y: -40, name: 'Nova' }), sprite('estrella', 'star', [], { x: -80, y: -40, name: 'Estrella' })],
    toolbox: ['a_flag'],
    steps: [
      { id: 'pilotear', title: 'A pilotear', text: 'En Nova: bandera verde, «por siempre» y adentro «mover con las flechas». Probalo.', explain: '«Por siempre» repite lo de adentro sin parar, así Nova te escucha las flechas todo el tiempo.', unlock: ['a_forever', 'a_arrows'], demoSprite: 'nova', demoScript: onFlag(forever(moveWithArrows(5))), check: (c) => inside(c, 'nova', 'a_flag', 'a_forever', ['a_arrows']) && travelled(c, 'nova') },
      { id: 'juntar', title: 'Juntar estrellas', text: 'En Nova: cuando toque la estrella, suma 1 punto y suena la magia.', explain: '«Cuando toque a» se activa en el momento en que dos personajes se chocan.', unlock: ['a_touching', 'a_addscore', 'a_sound'], demoSprite: 'nova', demoScript: [onFlag(forever(moveWithArrows(5))), onTouching('estrella', addScore(1), sound('magia'))], check: (c) => has(c, 'nova', 'a_touching', ['a_addscore'], { target: 'estrella' }) && c.stats.maxScore >= 1 },
      { id: 'salta', title: 'La estrella salta', text: 'En la estrella: cuando toque a Nova, «ir a posición aleatoria».', explain: 'La estrella también se da cuenta cuando la tocan, igual que Nova.', unlock: ['a_random'], demoSprite: 'estrella', demoScript: onTouching('nova', goToRandom()), check: (c) => has(c, 'estrella', 'a_touching', ['a_random'], { target: 'nova' }) },
      { id: 'ganar', title: 'Misión cumplida', text: 'En Nova: cuando los puntos lleguen a 5, ganás. ¡Jugalo!', unlock: ['a_points', 'a_win'], hints: ['«Cuando los puntos lleguen a 5» y abajo «¡ganar!».'], example: [{ sprite: 'Nova', scripts: [onPoints(5, sound('aplauso'), win())] }], check: (c) => refsOfHat(c, 'a_points').some((r) => refHas(r, ['a_win'])) && c.stats.won },
    ],
    challenges: [
      { title: 'Un meteorito', text: 'Sumá una roca que rebote y te haga perder.' },
      { title: 'Nave turbo', text: 'Cambiá la velocidad de las flechas.' },
    ],
    solved: { nova: [onFlag(forever(moveWithArrows(5))), onTouching('estrella', addScore(1), sound('magia')), onPoints(5, sound('aplauso'), win())], estrella: [onTouching('nova', goToRandom())] },
    play: (g) => {
      g.flag();
      g.run(200);
      steerTo(g, 'nova', () => 'estrella', [], () => (g.machine.score ?? 0) >= 5);
      g.run(1500);
    },
  });

  const tesoro = mission({
    id: `${p}-tesoro`, level, order: 2, title: 'Llegá al tesoro', cover: 'treasure', backdrop: 'ciudad',
    pitch: 'Manejá el auto hasta el tesoro sin chocar la piedra.',
    concept: 'Reglas para ganar y para perder.',
    sprites: [
      sprite('auto', 'car', [], { x: -170, y: -100, name: 'Auto' }),
      sprite('piedra', 'rock', [], { x: -90, y: -100, name: 'Piedra' }),
      sprite('tesoro', 'treasure', [], { x: 170, y: 90, name: 'Tesoro' }),
    ],
    toolbox: ['a_flag'],
    steps: [
      { id: 'manejar', title: 'A manejar', text: 'En el auto: bandera verde, «por siempre» y «mover con las flechas».', explain: '«Por siempre» repite sin parar mientras dura el juego.', unlock: ['a_forever', 'a_arrows'], demoSprite: 'auto', demoScript: onFlag(forever(moveWithArrows(4))), check: (c) => inside(c, 'auto', 'a_flag', 'a_forever', ['a_arrows']) && travelled(c, 'auto') },
      { id: 'choque', title: '¡Cuidado!', text: 'En el auto: cuando toque la piedra, perdés. Chocala a propósito para probarlo.', unlock: ['a_touching', 'a_lose', 'a_face'], demoSprite: 'auto', demoScript: [onFlag(forever(moveWithArrows(4))), onTouching('piedra', lose())], check: (c) => has(c, 'auto', 'a_touching', ['a_lose'], { target: 'piedra' }) && c.stats.lost },
      { id: 'tesoro', title: 'El tesoro', text: 'En el auto: cuando toque el tesoro, suenan aplausos y ganás. ¡Llegá sin chocar!', unlock: ['a_win', 'a_sound'], hints: ['Es otro «cuando toque a», con el tesoro.', 'Adentro: un sonido y «¡ganar!».'], example: [{ sprite: 'Auto', scripts: [onTouching('tesoro', sound('aplauso'), win())] }], check: (c) => has(c, 'auto', 'a_touching', ['a_win'], { target: 'tesoro' }) && c.stats.won },
      { id: 'patrulla', title: 'La piedra se mueve', text: 'Más difícil: en la piedra, bandera verde, «por siempre» mover 3 pasos y rebotar.', unlock: ['a_move', 'a_bounce', 'a_point'], demoSprite: 'piedra', demoScript: onFlag(point('0'), forever(move(3), bounce())), check: (c) => inside(c, 'piedra', 'a_flag', 'a_forever', ['a_move', 'a_bounce']) },
    ],
    challenges: [
      { title: 'Dos piedras', text: 'Sumá otra piedra que vaya de un lado al otro.' },
      { title: 'Festejo', text: 'Que el auto diga algo antes de ganar.' },
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
  });

  const limpia = mission({
    id: `${p}-limpia`, level, order: 3, title: 'Robi limpia el parque', cover: 'robi', backdrop: 'parque',
    pitch: 'Robi junta las piedras del parque. Cuando están todas, ganás.',
    concept: 'Cada objeto con su propia regla, y ganar al juntar todo.',
    sprites: [
      sprite('robi', 'robi', [], { x: -170, y: -100, name: 'Robi' }),
      sprite('piedra', 'rock', [], { x: -90, y: -100, name: 'Piedra' }),
      sprite('piedra2', 'rock', [], { x: 140, y: 70, name: 'Piedra 2' }),
    ],
    toolbox: ['a_flag'],
    steps: [
      { id: 'mover', title: 'Robi se mueve', text: 'En Robi: bandera verde, «por siempre» y «mover con las flechas».', unlock: ['a_forever', 'a_arrows'], demoSprite: 'robi', demoScript: onFlag(forever(moveWithArrows(4))), check: (c) => inside(c, 'robi', 'a_flag', 'a_forever', ['a_arrows']) && travelled(c, 'robi') },
      { id: 'junta', title: 'Juntar una piedra', text: 'En la piedra: cuando toque a Robi, suma 1 punto y se esconde.', explain: 'Un personaje escondido no se ve y ya no se puede tocar: queda «juntado».', unlock: ['a_touching', 'a_addscore', 'a_hide'], demoSprite: 'piedra', demoScript: onTouching('robi', addScore(1), hide()), check: (c) => has(c, 'piedra', 'a_touching', ['a_addscore', 'a_hide'], { kinds: 2, target: 'robi' }) && c.stats.maxScore >= 1 },
      { id: 'otra', title: 'La otra piedra', text: 'Hacé lo mismo en la Piedra 2. Fijate qué hiciste en la primera.', hints: ['Elegí «Piedra 2» abajo, en «Personajes».'], example: [{ sprite: 'Piedra 2', scripts: [onTouching('robi', addScore(1), hide())] }], check: (c) => has(c, 'piedra2', 'a_touching', ['a_hide'], { target: 'robi' }) },
      { id: 'ganar', title: '¡Parque limpio!', text: 'En Robi: cuando los puntos lleguen a 2, ganás. Juntá las dos piedras.', unlock: ['a_points', 'a_win', 'a_sound'], hints: ['«Cuando los puntos lleguen a 2» y «¡ganar!».'], example: [{ sprite: 'Robi', scripts: [onPoints(2, sound('aplauso'), win())] }], check: (c) => refsOfHat(c, 'a_points').some((r) => refHas(r, ['a_win'])) && c.stats.won },
    ],
    challenges: [
      { title: 'Más basura', text: 'Sumá una tercera piedra y cambiá la meta a 3.' },
      { title: 'Un perro travieso', text: 'Sumá a Toby rebotando: si te toca, perdés.' },
    ],
    solved: {
      robi: [onFlag(forever(moveWithArrows(4))), onPoints(2, sound('aplauso'), win())],
      piedra: [onTouching('robi', addScore(1), hide())],
      piedra2: [onTouching('robi', addScore(1), hide())],
    },
    play: (g) => {
      g.flag();
      g.run(200);
      steerTo(g, 'robi', () => (g.sprite('piedra').visible ? 'piedra' : g.sprite('piedra2').visible ? 'piedra2' : null), [], () => (g.machine.score ?? 0) >= 2);
      g.run(1500);
    },
  });
  return [nave, tesoro, limpia];
}

export const MISIONES: GameDefinition[] = [
  L1_CIRCO, L1_ROBI, L1_MAR, L1_ESTRELLAS,
  L2_BAILE, L2_MAGIA, L2_CONCIERTO, L2_CARRERA,
  L3_TECLADO, L3_FUGACES, L3_ARQUERO, L3_CUENTO,
  ...l4Missions(4),
  ...l4Missions(5),
];
