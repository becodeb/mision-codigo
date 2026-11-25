/** Los juegos de la muestra: varios por equipo, ya armados, para que cada chico elija y lo haga suyo. */
import type { LevelId } from '../../shared/levels.ts';
import type { GameDefinition } from '../types.ts';
import { NOVA_EN_EL_ESPACIO } from './bosque.ts';
import { REACCION_EN_CADENA } from './cadena.ts';
import { EL_CAMINO_DE_PIEDRAS } from './camino.ts';
import { LA_GRAN_CARRERA } from './carrera.ts';
import { EL_CONCIERTO } from './concierto.ts';
import { EL_CONCURSO_DE_ROBI } from './concurso.ts';
import { LA_FERIA } from './feria.ts';
import { VUELO_DE_CHISPA } from './galaxia.ts';
import { CUIDA_EL_TESORO } from './guardian.ts';
import { NOCHE_DE_BOO } from './mar.ts';
import { SALTA_SIN_PARAR } from './salto.ts';
import { ESTRELLA_FUGITIVA } from './sol.ts';
import { LLUVIA_DE_MANZANAS } from './volcan.ts';

/** To add a game: a file here, its export in this list and its id in `shared/gameIds.ts`. Its `order` sets its place in the level. */
export const SHOWCASE: GameDefinition[] = [
  ESTRELLA_FUGITIVA, LA_GRAN_CARRERA, EL_CONCIERTO,
  NOCHE_DE_BOO, REACCION_EN_CADENA, LA_FERIA,
  NOVA_EN_EL_ESPACIO, EL_CAMINO_DE_PIEDRAS, EL_CONCURSO_DE_ROBI,
  LLUVIA_DE_MANZANAS, SALTA_SIN_PARAR, CUIDA_EL_TESORO,
  VUELO_DE_CHISPA,
];

/** The games of a level, entry game first: by `order`, then in the order of `SHOWCASE`. */
export const showcasesFor = (level: LevelId): GameDefinition[] =>
  SHOWCASE.filter((g) => g.level === level).sort((a, b) => a.order - b.order);

/** The entry game of a level: where a child goes the first time. */
export const showcaseFor = (level: LevelId): GameDefinition => showcasesFor(level)[0];
