/** Los juegos de la muestra: uno por equipo, ya armados, para que cada chico lo haga suyo. */
import type { LevelId } from '../../shared/levels.ts';
import type { GameDefinition } from '../types.ts';
import { NOVA_EN_EL_ESPACIO } from './bosque.ts';
import { VUELO_DE_CHISPA } from './galaxia.ts';
import { NOCHE_DE_BOO } from './mar.ts';
import { ESTRELLA_FUGITIVA } from './sol.ts';
import { LLUVIA_DE_MANZANAS } from './volcan.ts';

export const SHOWCASE: GameDefinition[] = [ESTRELLA_FUGITIVA, NOCHE_DE_BOO, NOVA_EN_EL_ESPACIO, LLUVIA_DE_MANZANAS, VUELO_DE_CHISPA];

export const showcaseFor = (level: LevelId): GameDefinition => SHOWCASE.find((g) => g.level === level)!;
