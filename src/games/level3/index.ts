import type { GameDefinition } from '../types.ts';
import { cazaPulpi } from './caza-pulpi.ts';
import { manejaNova } from './maneja-nova.ts';

export const LEVEL_3: GameDefinition[] = [cazaPulpi, manejaNova];
