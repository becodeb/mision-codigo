import type { GameDefinition } from '../types.ts';
import { miMascota } from './mi-mascota.ts';
import { presentacion } from './presentacion.ts';

export const LEVEL_1: GameDefinition[] = [presentacion, miMascota];
