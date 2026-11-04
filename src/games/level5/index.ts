import type { GameDefinition } from '../types.ts';
import { contrarreloj } from './contrarreloj.ts';
import { mascotaVirtual } from './mascota-virtual.ts';
import { tresVidas } from './tres-vidas.ts';

export const LEVEL_5: GameDefinition[] = [tresVidas, contrarreloj, mascotaVirtual];
