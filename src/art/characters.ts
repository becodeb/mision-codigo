/**
 * The six characters. Every drawing has its feet at (0, 0) and grows toward negative y, so the sprite
 * position is the point on the ground. `h` is the height and `r` the collision radius at 100% size.
 */
import { faceSVG, type FaceParams } from './face.ts';

export interface CharacterDef {
  name: string;
  what: string;
  h: number;
  r: number;
  /** Speech pitch and rate. */
  pitch: number;
  rate: number;
  /** Sound played when the character joins the stage. */
  sound: string;
  face: FaceParams;
  /** Drawing; the argument is the face markup, placed inside `<g class="face">`. */
  art: (face: string) => string;
}

export type CharacterId = 'michi' | 'toby' | 'robi' | 'chispa' | 'nova' | 'pulpi';

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  michi: {
    name: 'Michi', what: 'gata', h: 92, r: 38, pitch: 1.55, rate: 1, sound: 'miau',
    face: { ex: 9, ey: -2, er: 4.2, my: 11, mw: 5 },
    art: (f) => `<path d="M-24 -26 C -48 -32 -50 -60 -34 -68" fill="none" stroke="#E9802A" stroke-width="10" stroke-linecap="round"/>
      <rect x="-24" y="-14" width="11" height="16" rx="5.5" fill="#E9802A"/><rect x="6" y="-14" width="11" height="16" rx="5.5" fill="#E9802A"/>
      <ellipse cx="-4" cy="-26" rx="29" ry="21" fill="#FF9A3C"/><ellipse cx="3" cy="-20" rx="15" ry="11" fill="#FFE3C4"/>
      <g transform="translate(14 -57)">
        <path d="M-21 -8 L-17 -37 L-1 -20Z" fill="#FF9A3C"/><path d="M21 -8 L17 -37 L1 -20Z" fill="#FF9A3C"/>
        <path d="M-16 -12 L-14.5 -29 L-6 -19Z" fill="#FFB8C9"/><path d="M16 -12 L14.5 -29 L6 -19Z" fill="#FFB8C9"/>
        <circle r="25" fill="#FF9A3C"/>
        <path d="M-7 -24 l2 8 M0 -25 v9 M7 -24 l-2 8" stroke="#E07320" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="-15" cy="8" r="4.5" fill="#FF7FA8" opacity=".55"/><circle cx="15" cy="8" r="4.5" fill="#FF7FA8" opacity=".55"/>
        <path d="M-2.5 4 h5 l-2.5 3z" fill="#E0567F"/>
        <path d="M-12 5 h-12 M-12 8.5 l-11 3 M12 5 h12 M12 8.5 l11 3" stroke="#241A4D" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>
        <g class="face">${f}</g>
      </g>`,
  },
  toby: {
    name: 'Toby', what: 'perro', h: 90, r: 38, pitch: .9, rate: 1, sound: 'guau',
    face: { ex: 9, ey: -6, er: 4, my: 13, mw: 5 },
    art: (f) => `<path d="M-26 -30 q-18 -10 -14 -30" stroke="#A86A33" stroke-width="8" fill="none" stroke-linecap="round"/>
      <rect x="-24" y="-14" width="11" height="16" rx="5.5" fill="#A86A33"/><rect x="6" y="-14" width="11" height="16" rx="5.5" fill="#A86A33"/>
      <ellipse cx="-4" cy="-27" rx="28" ry="20" fill="#C98A4B"/><ellipse cx="3" cy="-21" rx="14" ry="10" fill="#F2D3AE"/>
      <g transform="translate(14 -58)">
        <ellipse cx="-22" cy="2" rx="9" ry="18" fill="#7A4A22" transform="rotate(18 -22 2)"/><ellipse cx="22" cy="2" rx="9" ry="18" fill="#7A4A22" transform="rotate(-18 22 2)"/>
        <circle r="24" fill="#C98A4B"/>
        <circle cx="10" cy="-9" r="8.5" fill="#A86A33" opacity=".75"/>
        <ellipse cx="0" cy="10" rx="13" ry="10" fill="#F2D3AE"/>
        <ellipse cx="0" cy="4" rx="5" ry="3.6" fill="#241A4D"/>
        <g class="face">${f}</g>
      </g>`,
  },
  robi: {
    name: 'Robi', what: 'robot', h: 122, r: 40, pitch: .55, rate: .9, sound: 'bip',
    face: { ex: 11, ey: -4, er: 5, my: 8, mw: 7, col: '#7CF6FF', glint: false },
    art: (f) => `<rect x="-16" y="-14" width="10" height="14" rx="4" fill="#2BA5A8"/><rect x="6" y="-14" width="10" height="14" rx="4" fill="#2BA5A8"/>
      <rect x="-34" y="-42" width="10" height="24" rx="5" fill="#2BA5A8"/><rect x="24" y="-42" width="10" height="24" rx="5" fill="#2BA5A8"/>
      <rect x="-24" y="-46" width="48" height="36" rx="12" fill="#3CC6C9"/><circle cx="0" cy="-28" r="6" fill="#FFC93C"/>
      <g transform="translate(0 -76)">
        <line x1="0" y1="-30" x2="0" y2="-40" stroke="#5E5689" stroke-width="4" stroke-linecap="round"/><circle cy="-43" r="6" fill="#FF6FA5"/>
        <rect x="-43" y="-10" width="10" height="20" rx="5" fill="#2BA5A8"/><rect x="33" y="-10" width="10" height="20" rx="5" fill="#2BA5A8"/>
        <rect x="-36" y="-30" width="72" height="56" rx="20" fill="#3CC6C9"/>
        <rect x="-28" y="-22" width="56" height="40" rx="13" fill="#1D2457"/>
        <g class="face">${f}</g>
      </g>`,
  },
  chispa: {
    name: 'Chispa', what: 'dragona', h: 96, r: 40, pitch: 1.25, rate: 1, sound: 'magia',
    face: { ex: 8, ey: -6, er: 4.4, my: 12, mw: 5 },
    art: (f) => `<path d="M-24 -18 C -46 -14 -52 -30 -44 -40" stroke="#4BAF41" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M-44 -38 l-10 -8 l13 -3 z" fill="#FF6FA5"/>
      <path d="M-8 -48 C -40 -86 -50 -54 -34 -44 C -40 -38 -28 -34 -18 -40 Z" fill="#B45CFF"/>
      <rect x="-22" y="-14" width="11" height="16" rx="5.5" fill="#4BAF41"/><rect x="6" y="-14" width="11" height="16" rx="5.5" fill="#4BAF41"/>
      <path d="M-25 -36 l-8 -5 l8 -5z M-20 -48 l-4 -9 l9 1z" fill="#FF6FA5"/>
      <ellipse cx="-2" cy="-28" rx="26" ry="23" fill="#5CC14F"/><ellipse cx="4" cy="-24" rx="15" ry="16" fill="#FFE07A"/>
      <path d="M-4 -30 h14 M-4 -22 h15 M-2 -14 h11" stroke="#E6C454" stroke-width="2" stroke-linecap="round"/>
      <g transform="translate(14 -62)">
        <path d="M-13 -17 l-5 -15 l12 9z M7 -20 l7 -14 l2 15z" fill="#FFE07A"/>
        <circle r="23" fill="#5CC14F"/>
        <ellipse cx="11" cy="9" rx="14" ry="10" fill="#7BD86C"/><circle cx="14" cy="6" r="1.8" fill="#2E7A2A"/><circle cx="20" cy="6" r="1.8" fill="#2E7A2A"/>
        <g class="face">${f}</g>
      </g>`,
  },
  nova: {
    name: 'Nova', what: 'astronauta', h: 112, r: 40, pitch: 1.15, rate: 1, sound: 'boing',
    face: { ex: 6, ey: 0, er: 2.8, my: 8, mw: 4 },
    art: (f) => `<rect x="-30" y="-58" width="16" height="34" rx="6" fill="#C9D1EE" stroke="#8C97C6" stroke-width="2"/>
      <rect x="-16" y="-18" width="13" height="18" rx="5" fill="#F3F5FF" stroke="#8C97C6" stroke-width="2"/><rect x="4" y="-18" width="13" height="18" rx="5" fill="#F3F5FF" stroke="#8C97C6" stroke-width="2"/>
      <rect x="-17" y="-6" width="15" height="7" rx="3" fill="#FF8A3D"/><rect x="3" y="-6" width="15" height="7" rx="3" fill="#FF8A3D"/>
      <rect x="-32" y="-50" width="12" height="26" rx="6" fill="#F3F5FF" stroke="#8C97C6" stroke-width="2"/><rect x="20" y="-50" width="12" height="26" rx="6" fill="#F3F5FF" stroke="#8C97C6" stroke-width="2"/>
      <rect x="-22" y="-54" width="44" height="40" rx="14" fill="#F7F8FF" stroke="#8C97C6" stroke-width="2.5"/>
      <rect x="-10" y="-44" width="20" height="13" rx="3" fill="#5CF0FF"/><circle cx="-4" cy="-37" r="2" fill="#FF6FA5"/><circle cx="4" cy="-37" r="2" fill="#FFC93C"/>
      <g transform="translate(0 -80)">
        <line x1="17" y1="-20" x2="24" y2="-32" stroke="#8C97C6" stroke-width="3"/><circle cx="24" cy="-34" r="4.5" fill="#FF6FA5"/>
        <circle r="28" fill="#F7F8FF" stroke="#8C97C6" stroke-width="2.5"/>
        <circle r="21" fill="#BFE9FF"/>
        <circle cy="2" r="16" fill="#FFD7B5"/>
        <path d="M-16 -2 q16 -19 32 0 q-6 -7 -16 -6 q-10 -1 -16 6z" fill="#6B3E26"/>
        <circle cx="-9" cy="7" r="2.8" fill="#FF9AA8" opacity=".6"/><circle cx="9" cy="7" r="2.8" fill="#FF9AA8" opacity=".6"/>
        <g class="face">${f}</g>
        <path d="M9 -17 a19 19 0 0 1 10 10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>
      </g>`,
  },
  pulpi: {
    name: 'Pulpi', what: 'pulpo', h: 92, r: 38, pitch: 1.45, rate: 1.05, sound: 'boing',
    face: { ex: 11, ey: -4, er: 5, my: 10, mw: 7 },
    art: (f) => `${[-24, -12, 0, 12, 24].map((x, i) => `<path d="M${x} -30 q${i % 2 ? 7 : -7} 12 0 22 q${i % 2 ? -6 : 6} 7 ${i % 2 ? 4 : -4} 9" stroke="#9B4FE8" stroke-width="10" fill="none" stroke-linecap="round"/>`).join('')}
      <ellipse cx="0" cy="-56" rx="34" ry="32" fill="#B86BFF"/>
      <circle cx="-19" cy="-74" r="5" fill="#9B4FE8"/><circle cx="16" cy="-80" r="4" fill="#9B4FE8"/><circle cx="24" cy="-62" r="3" fill="#9B4FE8"/>
      <g transform="translate(0 -50)"><circle cx="-18" cy="6" r="5" fill="#FF7FA8" opacity=".55"/><circle cx="18" cy="6" r="5" fill="#FF7FA8" opacity=".55"/><g class="face">${f}</g></g>`,
  },
};

export const characterArt = (id: CharacterId, expression = 'feliz'): string => {
  const c = CHARACTERS[id];
  return c.art(faceSVG(expression, c.face));
};
