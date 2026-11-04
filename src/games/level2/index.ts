import type { GameDefinition } from '../types.ts';
import { bandaParque } from './banda-parque.ts';
import { laCarrera } from './la-carrera.ts';

export const LEVEL_2: GameDefinition[] = [laCarrera, bandaParque];
