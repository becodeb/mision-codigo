/**
 * Los pasos de una tarjeta se escriben con marcas y se muestran con dibujos: `[f_star]` es el bloque tal como se ve en
 * la caja, `{boo}` es el personaje con su cara y `**▶**` es un botón de la pantalla. Un chico que no lee sigue los
 * dibujos; la voz dice las mismas cosas con palabras.
 */
import { blockInfo, type BlockType } from '../language/catalog.ts';
import { blockLabel } from './demoPlan.ts';

export type HowPart = { kind: 'text' | 'button' | 'block' | 'sprite'; value: string };

export function parseHow(text: string): HowPart[] {
  const out: HowPart[] = [];
  const re = /\*\*(.+?)\*\*|\[(\w+)\]|\{(\w+)\}/g;
  let last = 0;
  const plain = (value: string): void => { if (value.trim()) out.push({ kind: 'text', value: value.trim() }); };
  for (let m = re.exec(text); m; m = re.exec(text)) {
    plain(text.slice(last, m.index));
    if (m[1] !== undefined) out.push({ kind: 'button', value: m[1] });
    else if (m[2] !== undefined) out.push({ kind: 'block', value: m[2] });
    else out.push({ kind: 'sprite', value: m[3] });
    last = m.index + m[0].length;
  }
  plain(text.slice(last));
  return out;
}

/** Short names for the chips of text blocks: the whole sentence of the block does not fit in a step. */
const SHORT: Partial<Record<BlockType, string>> = {
  a_key: 'al presionar tecla', a_points: 'cuando los puntos…', a_touching: 'cuando toque a…', a_click: 'al hacer clic', a_backdrop: 'cambiar escenario', a_changevar: 'sumar a…',
  a_ifelse: 'si… si no', a_if: 'si…', a_setsize: 'fijar tamaño', v_gt: '>', v_score: 'puntos', v_random: 'número al azar', v_answer: 'respuesta', v_key: '¿tecla presionada?', a_ask: 'preguntar',
  a_sayfor: 'decir', a_addscore: 'sumar a puntos', a_random: 'posición aleatoria',
};

export const chipLabel = (type: string): string => SHORT[type as BlockType] ?? blockLabel(type) ?? type;

/** How the voice names a picture block. */
const SPOKEN: Partial<Record<BlockType, string>> = {
  f_star: 'la estrella', f_shrink: 'achicar', f_spin: 'el giro', f_jump: 'el salto', f_face: 'la carita', f_backdrop: 'cambiar de lugar', f_click: 'la manito', f_wait: 'el reloj',
  f_repeat: 'las vueltas', f_note: 'la nota', f_send: 'mandar el sobre', f_recv: 'llega el sobre', f_say: 'la frase', f_sound: 'el sonido',
};

/** The step in words, for the voice. */
export function sayHow(text: string, nameOf: (id: string) => string): string {
  return parseHow(text)
    .map((p) => (p.kind === 'sprite' ? nameOf(p.value) : p.kind === 'block' ? (SPOKEN[p.value as BlockType] ?? chipLabel(p.value)) : p.kind === 'button' && p.value === '▶' ? 'Empezar' : p.value.replace(/^[^\p{L}\d-]+/u, '')))
    .join(' ');
}

export const isBlockType = (value: string): boolean => blockInfo(value) !== undefined;
