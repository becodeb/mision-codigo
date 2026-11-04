import type { Script } from '../language/ir.ts';
import type { FaceId } from '../language/options.ts';

/** What the runtime needs to know about a character or object. `src/art` provides the real table. */
export interface ArtMetrics {
  kind: 'character' | 'object';
  /** Height and collision radius at 100% size. */
  h: number;
  r: number;
  pitch: number;
  rate: number;
}

export type ArtTable = Readonly<Record<string, ArtMetrics>>;

export interface Bubble {
  text: string;
  kind: 'say' | 'think';
  /** Identity of the utterance, so a later bubble is not cleared by an earlier timer. */
  token: object;
}

/** A sprite on the stage: an original from the program or a clone. */
export interface SpriteInstance {
  /** Unique: the sprite id for originals, `sprite#n` for clones. */
  id: string;
  /** Id of the sprite in the program. */
  spriteId: string;
  name: string;
  artId: string;
  art: ArtMetrics;
  isClone: boolean;
  scripts: readonly Script[];
  /** Position of the feet on the stage: x in -240..240, y in -180..180, y up. */
  x: number;
  y: number;
  /** Degrees clockwise from up. */
  dir: number;
  /** -1 mirrors the drawing. */
  flip: 1 | -1;
  /** Percent. */
  size: number;
  face: FaceId | string;
  visible: boolean;
  bubble: Bubble | null;
  /** Animation offsets: jump height, walking bob, spin angle. They also move the hitbox where noted. */
  jy: number;
  bob: number;
  rot: number;
}
