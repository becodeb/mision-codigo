/**
 * Every game the server stores projects for. The server cannot import the catalog, which pulls in the
 * runtime, so a test keeps this list in step with it. A closed list also bounds what an anonymous
 * visitor can write to disk: projects per child times this list.
 */
export const FREE_PROJECT_ID = 'libre';

export const KNOWN_GAME_IDS: ReadonlySet<string> = new Set([
  FREE_PROJECT_ID,
  'presentacion',
  'mi-mascota',
  'paseo-toby',
  'baile-pulpi',
  'la-carrera',
  'banda-parque',
  'chiste-robi',
  'escondidas',
  'caza-pulpi',
  'maneja-nova',
  'quiz',
  'dos-finales',
  'tesoro',
  'chispa',
  'cruza-ciudad',
  'salto',
  'ataja',
  'tres-vidas',
  'contrarreloj',
  'mascota-virtual',
  'rebote',
  'defensa',
  'memoria',
]);
