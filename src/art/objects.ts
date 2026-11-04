/**
 * Faceless objects, drawn in the same flat style as the characters: feet at (0, 0), growing toward
 * negative y. Objects ignore the face block. `h` and `r` are the height and collision radius at 100%.
 */

export interface ObjectDef {
  name: string;
  h: number;
  r: number;
  art: () => string;
}

export type ObjectId = 'star' | 'coin' | 'apple' | 'ball' | 'car' | 'rock' | 'treasure' | 'heart' | 'paddle' | 'bolt' | 'cloud' | 'bomb';

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? inner : outer;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return pts.join(' ');
}

export const OBJECTS: Record<ObjectId, ObjectDef> = {
  star: {
    name: 'Estrella', h: 56, r: 26,
    art: () => `<polygon points="${starPoints(0, -29, 28, 12)}" fill="#FFC93C" stroke="#E6A800" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="${starPoints(0, -29, 15, 6.5)}" fill="#FFE07A"/><circle cx="-7" cy="-36" r="2.4" fill="#fff" opacity=".8"/>`,
  },
  coin: {
    name: 'Moneda', h: 44, r: 20,
    art: () => `<circle cx="0" cy="-22" r="21" fill="#E6A800"/><circle cx="0" cy="-22" r="18" fill="#FFC93C"/>
      <circle cx="0" cy="-22" r="12.5" fill="none" stroke="#E6A800" stroke-width="3"/>
      <polygon points="${starPoints(0, -22, 8, 3.4)}" fill="#FFE07A"/><path d="M-12 -33 q4 -5 10 -6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`,
  },
  apple: {
    name: 'Manzana', h: 48, r: 21,
    art: () => `<circle cx="-7" cy="-21" r="15" fill="#F0524F"/><circle cx="7" cy="-21" r="15" fill="#F0524F"/>
      <ellipse cx="0" cy="-17" rx="16" ry="14" fill="#F0524F"/><circle cx="-8" cy="-26" r="4" fill="#FF8A87" opacity=".75"/>
      <path d="M0 -34 q1 -8 5 -12" stroke="#8A5A30" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M3 -38 q10 -10 18 -4 q-8 10 -18 4z" fill="#5CC14F"/>`,
  },
  ball: {
    name: 'Pelota', h: 40, r: 19,
    art: () => `<circle cx="0" cy="-20" r="20" fill="#3D8BFF"/><path d="M-17 -10 Q0 -34 17 -10" stroke="#fff" stroke-width="5" fill="none"/>
      <path d="M-18 -26 Q0 -6 18 -26" stroke="#FFC93C" stroke-width="5" fill="none"/><circle cx="-7" cy="-30" r="3.5" fill="#fff" opacity=".7"/>`,
  },
  car: {
    name: 'Auto', h: 44, r: 40,
    art: () => `<rect x="-40" y="-26" width="80" height="20" rx="8" fill="#F0524F"/>
      <path d="M-24 -26 L-16 -42 H14 L26 -26Z" fill="#D93F3C"/><path d="M-19 -28 L-13 -39 H-1 V-28Z M3 -28 V-39 H12 L21 -28Z" fill="#BFE9FF"/>
      <rect x="30" y="-22" width="8" height="6" rx="3" fill="#FFE07A"/><rect x="-40" y="-22" width="5" height="6" rx="2.5" fill="#FF8A87"/>
      <circle cx="-22" cy="-6" r="9" fill="#241A4D"/><circle cx="22" cy="-6" r="9" fill="#241A4D"/>
      <circle cx="-22" cy="-6" r="4" fill="#C9D1EE"/><circle cx="22" cy="-6" r="4" fill="#C9D1EE"/>`,
  },
  rock: {
    name: 'Piedra', h: 36, r: 24,
    art: () => `<path d="M-26 0 L-22 -18 L-8 -34 L12 -32 L24 -16 L27 0Z" fill="#8F95B2"/>
      <path d="M-8 -34 L12 -32 L24 -16 L4 -20 L-14 -14Z" fill="#B4B9D2"/><path d="M-22 -18 L-14 -14 L-10 0 L-26 0Z" fill="#767B9E"/>
      <circle cx="12" cy="-8" r="2" fill="#767B9E"/>`,
  },
  treasure: {
    name: 'Tesoro', h: 44, r: 28,
    art: () => `<rect x="-28" y="-26" width="56" height="26" rx="4" fill="#A86A33"/>
      <path d="M-28 -26 Q-28 -44 0 -44 Q28 -44 28 -26Z" fill="#C98A4B"/>
      <rect x="-28" y="-28" width="56" height="5" fill="#FFC93C"/><rect x="-19" y="-42" width="6" height="42" fill="#FFC93C" opacity=".95"/><rect x="13" y="-42" width="6" height="42" fill="#FFC93C" opacity=".95"/>
      <rect x="-6" y="-31" width="12" height="13" rx="3" fill="#E6A800"/><circle cx="0" cy="-25" r="2.4" fill="#241A4D"/>
      <circle cx="-5" cy="-42" r="3" fill="#FFE07A"/><circle cx="6" cy="-44" r="2.4" fill="#FF6FA5"/>`,
  },
  heart: {
    name: 'Corazón', h: 44, r: 22,
    art: () => `<path d="M0 -4 C -30 -24 -24 -44 -11 -42 C -4 -41 0 -35 0 -31 C 0 -35 4 -41 11 -42 C 24 -44 30 -24 0 -4Z" fill="#FF4F7B"/>
      <path d="M-15 -36 q3 -4 8 -3" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>`,
  },
  paddle: {
    name: 'Paleta', h: 16, r: 36,
    art: () => `<rect x="-36" y="-16" width="72" height="16" rx="8" fill="#2C74E0"/><rect x="-33" y="-14" width="66" height="7" rx="3.5" fill="#5C9BFF"/>
      <circle cx="-26" cy="-8" r="2.4" fill="#fff" opacity=".8"/><circle cx="26" cy="-8" r="2.4" fill="#fff" opacity=".8"/>`,
  },
  bolt: {
    name: 'Rayo', h: 52, r: 20,
    art: () => `<polygon points="6 -52 -18 -22 -4 -22 -10 0 18 -32 3 -32 14 -52" fill="#FFC93C" stroke="#E6A800" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="4 -46 -9 -26 2 -26" fill="#FFE07A"/>`,
  },
  cloud: {
    name: 'Nube', h: 40, r: 34,
    art: () => `<ellipse cx="0" cy="-12" rx="34" ry="12" fill="#E6EEFF"/><circle cx="-16" cy="-20" r="14" fill="#F4F8FF"/><circle cx="6" cy="-26" r="17" fill="#F4F8FF"/><circle cx="21" cy="-17" r="11" fill="#F4F8FF"/>
      <ellipse cx="0" cy="-8" rx="30" ry="8" fill="#F4F8FF"/><path d="M-26 -6 Q0 0 26 -6" stroke="#C9D8F5" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  },
  bomb: {
    name: 'Bomba', h: 48, r: 22,
    art: () => `<circle cx="0" cy="-21" r="21" fill="#2E2A4A"/><circle cx="-8" cy="-29" r="5" fill="#fff" opacity=".35"/>
      <rect x="-6" y="-46" width="12" height="8" rx="2" fill="#625A8C"/>
      <path d="M2 -46 q8 -6 12 -2" stroke="#8A5A30" stroke-width="3" fill="none" stroke-linecap="round"/>
      <polygon points="${starPoints(16, -50, 7, 3)}" fill="#FFC93C"/><polygon points="${starPoints(16, -50, 3.6, 1.6)}" fill="#FF8A1F"/>`,
  },
};
