/** One catalog for everything that can be a sprite: the six characters and the twelve objects. */
import { BACKDROPS } from './backdrops.ts';
import { CHARACTERS, characterArt, type CharacterId } from './characters.ts';
import { faceSVG } from './face.ts';
import { OBJECTS, type ObjectId } from './objects.ts';

export { BACKDROPS, CHARACTERS, OBJECTS, characterArt, faceSVG };
export type { CharacterId, ObjectId };
export type { BackdropId } from './backdrops.ts';
export { IMG, ICON, svgURI } from './icons.ts';
export { robiSVG } from './robi.ts';

export type ArtId = CharacterId | ObjectId;

export interface ArtDef {
  id: ArtId;
  kind: 'character' | 'object';
  name: string;
  /** Height and collision radius at 100% size. */
  h: number;
  r: number;
  pitch: number;
  rate: number;
  /** Sound played when the sprite joins the stage. */
  sound: string;
  /** Whether the face block changes the drawing. */
  hasFace: boolean;
  /** SVG markup with the feet at (0, 0). `expression` is ignored by objects. */
  svg: (expression?: string) => string;
}

export const ART: Record<ArtId, ArtDef> = {
  ...(Object.fromEntries(
    (Object.keys(CHARACTERS) as CharacterId[]).map((id) => {
      const c = CHARACTERS[id];
      const def: ArtDef = {
        id, kind: 'character', name: c.name, h: c.h, r: c.r, pitch: c.pitch, rate: c.rate, sound: c.sound, hasFace: true,
        svg: (expression = 'feliz') => characterArt(id, expression),
      };
      return [id, def];
    }),
  ) as Record<CharacterId, ArtDef>),
  ...(Object.fromEntries(
    (Object.keys(OBJECTS) as ObjectId[]).map((id) => {
      const o = OBJECTS[id];
      const def: ArtDef = { id, kind: 'object', name: o.name, h: o.h, r: o.r, pitch: 1, rate: 1, sound: 'pop', hasFace: false, svg: () => o.art() };
      return [id, def];
    }),
  ) as Record<ObjectId, ArtDef>),
};

/** Thumbnail viewBox markup for pickers. */
export const artThumb = (id: ArtId, expression = 'feliz'): string =>
  `<svg viewBox="-60 -134 120 140" aria-hidden="true">${ART[id].svg(expression)}</svg>`;
