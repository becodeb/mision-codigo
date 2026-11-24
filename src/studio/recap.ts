/**
 * El resumen «Cómo lo programé», sacado del proyecto tal como está: qué cambió el chico, qué ideas de programación usa
 * su juego, un programa de verdad para mirar y preguntas para explicarlo. Sin DOM. Dice «usa» de lo que el juego trae
 * y «cambió» solo de lo que el chico hizo.
 */
import type { BlockType } from '../language/catalog.ts';
import type { Block, ProjectProgram, Script } from '../language/ir.ts';
import { blocksInList, blocksOfProject } from '../games/checks.ts';
import type { GameDefinition, GameStep } from '../games/types.ts';

export interface Recap {
  blocks: number;
  scripts: number;
  sprites: number;
  changed: { icon: string; label: string; concept: string }[];
  ideas: { icon: string; name: string; text: string }[];
  questions: string[];
  /** A program the child changed or wrote. `null` when every program is as the game came. */
  own: { spriteId: string; name: string; art: string; script: Script } | null;
}

const IDEAS: { icon: string; name: string; text: string; types: BlockType[] }[] = [
  { icon: '🖐️', name: 'Eventos', text: 'El programa espera algo (un toque, una tecla, la bandera) para hacer lo suyo.', types: ['f_click', 'f_flag', 'f_recv', 'a_click', 'a_flag', 'a_key', 'a_recv', 'a_clonestart'] },
  { icon: '🔁', name: 'Bucles', text: 'Repetir instrucciones sin escribirlas de nuevo.', types: ['f_repeat', 'a_repeat', 'a_forever', 'a_repeatuntil'] },
  { icon: '❓', name: 'Condiciones', text: 'Hacer algo solo cuando se cumple una regla.', types: ['a_if', 'a_ifelse', 'a_waituntil', 'a_repeatuntil', 'a_points', 'a_touching'] },
  { icon: '🔢', name: 'Puntos y variables', text: 'Números que el programa recuerda y cambia mientras se juega.', types: ['f_star', 'a_addscore', 'a_setscore', 'a_setvar', 'a_changevar'] },
  { icon: '📍', name: 'Coordenadas', text: 'Ubicar y mover cosas con números de x y de y.', types: ['a_changex', 'a_changey', 'a_goto', 'a_glide', 'a_setx', 'a_sety', 'v_x', 'v_y'] },
  { icon: '✉️', name: 'Mensajes', text: 'Los personajes se avisan cosas para coordinarse.', types: ['f_send', 'a_send'] },
  { icon: '🎲', name: 'Azar', text: 'La computadora elige, y cada partida es distinta.', types: ['f_random', 'a_random', 'v_random'] },
  { icon: '👯', name: 'Clones', text: 'Crear copias de un personaje mientras el juego corre.', types: ['a_clone'] },
];

/** A script without the editor's ids, to tell whether it is still the original. */
const bare = (script: Script): string => JSON.stringify(script, (key, value: unknown) => (key === 'id' ? undefined : value));

const sizeOf = (script: Script): number => blocksInList(script.body).length;

export function recapOf(game: GameDefinition, program: ProjectProgram, done: readonly GameStep[]): Recap {
  const all: Block[] = blocksOfProject(program).filter((b) => b.type !== 'v_num' && b.type !== 'v_text');
  const types = new Set<string>(all.map((b) => b.type));
  const scripts = program.sprites.flatMap((s) => s.scripts.filter((sc) => sc.body.length > 0).map((script) => ({ spriteId: s.id, name: s.name, art: s.art, script })));
  const originals = new Set(game.setup.sprites.flatMap((s) => s.scripts.map((sc) => `${s.id}:${comparable(sc)}`)));
  const own = scripts.filter((x) => !originals.has(`${x.spriteId}:${comparable(x.script)}`)).sort((a, b) => sizeOf(b.script) - sizeOf(a.script))[0] ?? null;

  const ideas = IDEAS.filter((i) => i.types.some((t) => types.has(t))).map(({ icon, name, text }) => ({ icon, name, text }));
  if (scripts.some((x) => x.script.body.length >= 2)) ideas.unshift({ icon: '📋', name: 'Secuencias', text: 'Dar las órdenes en el orden justo, una abajo de la otra.' });

  const code = done.filter((s) => s.card!.kind === 'code');
  const look = done.filter((s) => s.card!.kind === 'look');
  const questions = [...code, ...look].map((s) => s.card!.ask).filter((q, i, list) => list.indexOf(q) === i).slice(0, 3);
  for (const q of ['¿Qué pasa cuando tocás «Empezar»? ¿En qué bloque está?', '¿Qué fue lo más difícil de tu juego?', '¿Qué le cambiarías si tuvieras más tiempo?']) if (questions.length < 3) questions.push(q);

  return {
    blocks: all.length,
    scripts: scripts.length,
    sprites: program.sprites.length,
    changed: [...code, ...look].map((s) => ({ icon: s.card!.icon, label: s.card!.label, concept: s.card!.concept })),
    ideas,
    questions,
    own,
  };
}

/** Numbers typed in the editor can come back as text and the other way around: compare them as text. */
function comparable(script: Script): string {
  return bare(script).replace(/:(-?\d+(?:\.\d+)?)(?=[,}])/g, ':"$1"');
}
