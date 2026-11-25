/**
 * Piezas comunes de los juegos de la muestra. El juego ya viene armado; cada tarjeta es una cosa para cambiar,
 * en cualquier orden. Una tarjeta se completa sola cuando el proyecto ya tiene ese cambio, lo haya hecho con el
 * tutorial o por su cuenta: por eso los controles comparan con el juego original y miran todo el proyecto.
 */
import type { BlockType } from '../../language/catalog.ts';
import type { Block, ProjectProgram, Script, SpriteProgram } from '../../language/ir.ts';
import { blocksInList, blocksOfProject, blocksOfSprite, numField, scriptsOfHat } from '../checks.ts';
import type { GameDefinition, GameStep, Pillar, StepCard, StepContext } from '../types.ts';

type P = ProjectProgram;

/* ---------- mirar el proyecto ---------- */

export const blocksOf = (p: P, ...types: BlockType[]): Block[] => blocksOfProject(p).filter((b) => types.includes(b.type));

/** Los scripts de un evento, en cualquier personaje. */
export const scriptsWith = (p: P, hat: BlockType, where: (hat: Block) => boolean = () => true): Script[] =>
  p.sprites.flatMap((s) => scriptsOfHat(s, hat)).filter((sc) => where(sc.hat));

export const inside = (sc: Script): Block[] => blocksInList(sc.body);

/** The «al hacer clic» scripts of the sprites with those ids. */
export const clicksOf = (p: P, ...ids: string[]): Script[] => p.sprites.filter((s) => ids.includes(s.id)).flatMap((s) => scriptsOfHat(s, 'f_click'));

export const count = (list: readonly Block[], ...types: BlockType[]): number => list.filter((b) => types.includes(b.type)).length;

/** Algún valor aparece más veces que en el original: se cambió uno o se agregó otro. */
export function differs(now: readonly (string | number)[], before: readonly (string | number)[]): boolean {
  const left = before.map(String);
  for (const v of now.map(String)) {
    const i = left.indexOf(v);
    if (i < 0) return true;
    left.splice(i, 1);
  }
  return false;
}

const saidBy = (b: Block): string => String(b.fields.P ?? b.fields.T ?? b.inputs.T?.fields.V ?? '');
const SAY: BlockType[] = ['f_say', 'f_text', 'a_say', 'a_sayfor', 'a_thinkfor'];
const SOUND: BlockType[] = ['f_sound', 'f_note', 'a_sound', 'a_note'];

export const says = (p: P): string[] => blocksOf(p, ...SAY).map(saidBy).filter((t) => t.trim() !== '');
export const sounds = (p: P): string[] => blocksOf(p, ...SOUND).map((b) => String(b.fields.S));
export const numbers = (p: P, type: BlockType, key: string): number[] => blocksOf(p, type).map((b) => numField(b, key)).filter(Number.isFinite);

/** «**10** » when a «cuando los puntos…» script wins at 10, or nothing: the goal line follows what the child changed. */
export function winMark(p: P): string {
  const sc = scriptsWith(p, 'a_points').find((s) => count(inside(s), 'a_win') > 0);
  const n = sc ? numField(sc.hat, 'N') : NaN;
  return Number.isFinite(n) ? `**${n}** ` : '';
}

export const newSprites = (p: P, base: P): SpriteProgram[] => p.sprites.filter((s) => !base.sprites.some((b) => b.id === s.id));

/* ---------- cambiar el proyecto (para las pruebas) ---------- */

export const spriteOf = (p: P, id: string): SpriteProgram => p.sprites.find((s) => s.id === id)!;

/** El primer bloque de ese tipo del personaje. */
export const firstBlock = (p: P, id: string, type: BlockType, where: (b: Block) => boolean = () => true): Block =>
  blocksOfSprite(spriteOf(p, id)).find((b) => b.type === type && where(b))!;

export function setNumber(b: Block, key: string, value: number): void {
  if (b.fields[key] !== undefined) b.fields[key] = value;
  else b.inputs[key].fields.V = value;
}

export const addTo = (p: P, id: string, ...scripts: Script[]): void => { spriteOf(p, id).scripts.push(...scripts); };

export const addSprite = (p: P, art: string, ...scripts: Script[]): void => {
  p.sprites.push({ id: 's1', art, name: 'Nuevo', x: 0, y: 0, scripts });
};

/* ---------- tarjetas ---------- */

interface CardSpec extends Omit<StepCard, 'kind'> {
  id: string;
  kind?: StepCard['kind'];
  title: string;
  demo?: GameStep['demoScript'];
  example?: GameStep['example'];
  point?: string;
  /** Los cambios de apariencia se ven en el momento: no hace falta jugar. */
  instant?: boolean;
}

export function card(c: CardSpec): GameStep {
  const { id, title, demo, example, point, instant, kind = 'code', ...rest } = c;
  return {
    id, title, text: c.how.map((h) => h.t).join(' '), hints: [], example, point,
    demoScript: demo,
    demoSprite: c.newSprite ? undefined : c.sprite,
    card: { ...rest, kind },
    check: (ctx: StepContext) => c.built(ctx.program) && (instant === true || ctx.ui.tried === true),
  };
}

interface LookOptions {
  hero: string;
  talker: string;
  sounder: string;
  picture: boolean;
  sayBlock: BlockType;
  newPlace: string;
  newArt: string;
  /** The sound plays when this sprite is tapped; otherwise the child plays to hear it. */
  soundTap?: string;
}

/** Las cuatro tarjetas de apariencia, iguales en todos los juegos. */
export function lookCards(base: P, o: LookOptions): GameStep[] {
  const soundBlock: BlockType = o.picture ? 'f_sound' : 'a_sound';
  return [
    card({
      id: 'fondo', icon: '🖼️', label: 'Fondo', kind: 'look', instant: true, point: 'backdrops',
      title: 'Cambiá el fondo',
      how: [{ t: 'Tocá **🖼️ Fondo**', on: 'point' }, { t: 'Elegí otro', on: 'modal' }],
      concept: 'Diseño: elegir dónde pasa el juego.', ask: '¿Por qué elegiste ese lugar?',
      built: (p) => p.backdrop !== base.backdrop,
      solve: (p) => { p.backdrop = o.newPlace; },
    }),
    card({
      id: 'personaje', icon: '🎭', label: 'Personaje', kind: 'look', instant: true, point: 'costume', sprite: o.hero,
      title: 'Cambiá un personaje',
      how: [{ t: 'Tocá **🎭 Cambiar**', on: 'point' }, { t: 'Elegí otro', on: 'modal' }],
      concept: 'El programa y el dibujo son cosas distintas: cambia uno y el otro sigue funcionando.', ask: '¿Por qué sigue haciendo lo mismo si cambió el dibujo?',
      built: (p) => base.sprites.some((s) => p.sprites.some((x) => x.id === s.id && x.art !== s.art)),
      solve: (p) => { spriteOf(p, o.hero).art = o.newArt; },
    }),
    card({
      id: 'frase', icon: '💬', label: 'Qué dice', kind: 'look', sprite: o.talker,
      title: 'Que diga lo que vos quieras',
      how: [{ t: o.picture ? 'Cambiá [f_say]' : 'Cambiá [a_sayfor]', on: 'change' }, { t: 'Probá **▶**', on: 'try' }],
      block: { type: o.sayBlock, caption: o.picture ? 'Tocá el globito y elegí otra frase.' : 'Tocá el texto y escribí otra cosa.' },
      concept: 'Datos: lo que el programa dice se puede cambiar.', ask: '¿En qué bloque cambiaste lo que dice?',
      built: (p) => differs(says(p), says(base)),
      solve: (p) => {
        const b = firstBlock(p, o.talker, o.sayBlock);
        if (b.fields.P !== undefined) b.fields.P = 'CUMPLE';
        else b.inputs.T.fields.V = '¡Este juego es mío!';
      },
    }),
    card({
      id: 'sonido', icon: '🔊', label: 'Sonido', kind: 'look', sprite: o.sounder,
      title: 'Cambiá un sonido',
      how: [{ t: o.picture ? 'Cambiá [f_sound]' : 'Cambiá [a_sound]', on: 'change' }, { t: o.soundTap ? `Tocá a {${o.soundTap}}` : 'Probá **▶**', on: 'try' }], tap: o.soundTap,
      block: { type: soundBlock, caption: 'Tocá el sonido y elegí otro.' },
      concept: 'Datos: cada sonido suena cuando el programa llega a ese bloque.', ask: '¿Cuándo suena ese sonido?',
      built: (p) => differs(sounds(p), sounds(base)),
      solve: (p) => { firstBlock(p, o.sounder, soundBlock).fields.S = 'rugido'; },
    }),
  ];
}

interface ShowcaseSpec {
  id: string;
  level: GameDefinition['level'];
  title: string;
  pitch: string;
  cover: string;
  setup: P;
  toolbox: BlockType[];
  /** Position among the games of its level; the first one is the entry game. */
  order?: number;
  tapAll?: true;
  play: NonNullable<GameDefinition['showcase']>['play'];
  goal: NonNullable<GameDefinition['showcase']>['goal'];
  pillars: Pillar[];
  cards: GameStep[];
}

export function showcaseGame(s: ShowcaseSpec): GameDefinition {
  return {
    id: s.id, level: s.level, class: 2, order: s.order ?? 1, kind: 'game', title: s.title, pitch: s.pitch, concept: 'Cambiar un juego que ya funciona.', cover: s.cover,
    setup: s.setup, toolbox: s.toolbox,
    phases: [{ title: s.title, goal: s.pitch, steps: s.cards }],
    challenges: [],
    solution: { program: s.setup, play: () => undefined },
    showcase: { play: s.play, goal: s.goal, tapAll: s.tapAll, cast: s.setup.sprites.map((x) => x.id), pillars: s.pillars },
  };
}
