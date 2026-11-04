import type { GameDefinition } from '../types.ts';
import { chispa } from './chispa.ts';
import { tesoro } from './tesoro.ts';

export const LEVEL_4: GameDefinition[] = [tesoro, chispa];
