/** The six backdrops, drawn on a 480 x 360 canvas. `svg(prefix)` namespaces gradient ids so several can coexist. */
import { mulberry32 } from '../shared/random.ts';

export type BackdropId = 'parque' | 'espacio' | 'mar' | 'castillo' | 'ciudad' | 'teatro';

export interface BackdropDef {
  name: string;
  svg: (idPrefix: string) => string;
}

function stars(seed: number, n: number, h = 360): string { const r = mulberry32(seed); let s = ''; for (let k = 0; k < n; k++) s += `<circle cx="${(r() * 480).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(r() * 1.4 + .3).toFixed(2)}" fill="#fff" opacity="${(r() * .6 + .3).toFixed(2)}"${k % 7 === 0 ? ' class="tw"' : ''}/>`; return s; }
export const BACKDROPS: Record<BackdropId, BackdropDef> = {
  parque: { name: 'Parque', svg: (p) => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CCBFF"/><stop offset="1" stop-color="#D4F1FF"/></linearGradient></defs>
    <rect width="480" height="360" fill="url(#${p}a)"/>
    <circle cx="410" cy="62" r="40" fill="#FFD84D" opacity=".25"/><circle cx="410" cy="62" r="28" fill="#FFD84D"/>
    <g fill="#fff"><ellipse cx="110" cy="66" rx="38" ry="14"/><ellipse cx="132" cy="56" rx="22" ry="15"/><ellipse cx="290" cy="44" rx="28" ry="10"/><ellipse cx="304" cy="38" rx="16" ry="10"/></g>
    <path d="M0 220 C 80 170 170 180 250 214 S 400 180 480 200 V360 H0Z" fill="#A7E28C"/>
    <path d="M0 240 C 110 214 200 222 300 238 S 420 222 480 230 V360 H0Z" fill="#86D06B"/>
    <rect y="255" width="480" height="105" fill="#6CC551"/>
    <path d="M170 360 C 210 310 280 290 330 256 H362 C 330 292 270 318 252 360Z" fill="#EBD7A6"/>
    <rect x="62" y="150" width="16" height="110" rx="6" fill="#8A5A30"/><circle cx="70" cy="138" r="42" fill="#3FA34D"/><circle cx="42" cy="160" r="28" fill="#4CB65A"/><circle cx="98" cy="158" r="30" fill="#4CB65A"/>
    <circle cx="56" cy="130" r="5" fill="#FF5A5A"/><circle cx="88" cy="146" r="5" fill="#FF5A5A"/><circle cx="72" cy="112" r="5" fill="#FF5A5A"/>
    ${[[30, 300, '#FF6FA5'], [420, 290, '#FFC93C'], [446, 318, '#B45CFF'], [130, 330, '#FFC93C'], [390, 336, '#FF6FA5']].map(([x, y, c]) => `<g transform="translate(${x} ${y})"><path d="M0 0v14" stroke="#3A9A3A" stroke-width="3"/><circle r="6" fill="${c}"/><circle r="2.4" fill="#fff"/></g>`).join('')}` },
  espacio: { name: 'Espacio', svg: (p) => `<defs><radialGradient id="${p}a" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2A3594" stop-opacity=".8"/><stop offset="1" stop-color="#2A3594" stop-opacity="0"/></radialGradient><radialGradient id="${p}b" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFB27A"/><stop offset=".6" stop-color="#E5603F"/><stop offset="1" stop-color="#8C2C3E"/></radialGradient></defs>
    <rect width="480" height="360" fill="#0B1035"/><ellipse cx="150" cy="90" rx="300" ry="200" fill="url(#${p}a)"/>${stars(11, 90, 270)}
    <g transform="translate(380 88)"><ellipse rx="72" ry="15" fill="none" stroke="#FFD2A6" stroke-width="5" opacity=".5" transform="rotate(-16)"/><circle r="44" fill="url(#${p}b)"/><path d="M-72 0 A72 15 0 0 0 72 0" fill="none" stroke="#FFD2A6" stroke-width="5" transform="rotate(-16)"/></g>
    <circle cx="90" cy="70" r="16" fill="#C9CCE0"/><circle cx="85" cy="66" r="4" fill="#A9ADC6"/>
    <path d="M0 262 Q120 244 240 258 T480 250 V360 H0Z" fill="#8A8FB0"/><path d="M0 290 Q160 276 300 290 T480 284 V360 H0Z" fill="#767B9E"/>
    <ellipse cx="90" cy="300" rx="26" ry="7" fill="#62678A"/><ellipse cx="330" cy="318" rx="34" ry="8" fill="#62678A"/><ellipse cx="420" cy="272" rx="16" ry="4" fill="#62678A"/>` },
  mar: { name: 'Fondo del mar', svg: (p) => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4CC4F0"/><stop offset="1" stop-color="#0E5A9C"/></linearGradient></defs>
    <rect width="480" height="360" fill="url(#${p}a)"/>
    <path d="M60 0 L120 0 L60 260 L10 260Z M220 0 L270 0 L240 260 L190 260Z M360 0 L420 0 L410 260 L350 260Z" fill="#fff" opacity=".07"/>
    ${[[60, 200, 6], [76, 160, 4], [70, 120, 7], [400, 180, 5], [420, 130, 8], [300, 90, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>`).join('')}
    <g transform="translate(330 120)"><ellipse rx="18" ry="10" fill="#FF9A3C"/><path d="M16 0 l12 -9 v18z" fill="#FF9A3C"/><circle cx="-8" cy="-2" r="2.5" fill="#241A4D"/></g>
    <g transform="translate(140 80) scale(-.8 .8)"><ellipse rx="18" ry="10" fill="#FFC93C"/><path d="M16 0 l12 -9 v18z" fill="#FFC93C"/><circle cx="-8" cy="-2" r="2.5" fill="#241A4D"/></g>
    <path d="M0 272 Q120 254 240 268 T480 262 V360 H0Z" fill="#F1D9A0"/>
    ${[30, 50, 440, 460].map((x, i) => `<path d="M${x} 280 q${i % 2 ? 14 : -14} -30 0 -60 q${i % 2 ? -14 : 14} -30 0 -60" stroke="#3FA34D" stroke-width="8" fill="none" stroke-linecap="round"/>`).join('')}
    <path d="M200 310 q10 -14 20 0 z" fill="#FF8FB0"/><circle cx="300" cy="320" r="7" fill="#FFB27A"/><path d="M380 300 l6 -12 l6 12 l-12 -6 h12z" fill="#FF6FA5"/>` },
  castillo: { name: 'Castillo', svg: (p) => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B2A7A"/><stop offset="1" stop-color="#F29BB1"/></linearGradient></defs>
    <rect width="480" height="360" fill="url(#${p}a)"/>${stars(5, 30, 140)}
    <circle cx="80" cy="70" r="34" fill="#FFF3C4" opacity=".2"/><circle cx="80" cy="70" r="24" fill="#FFF3C4"/>
    <g fill="#2E2266"><rect x="170" y="120" width="140" height="140"/><rect x="150" y="90" width="40" height="170"/><rect x="290" y="90" width="40" height="170"/><rect x="220" y="70" width="40" height="80"/>
      <path d="M146 90 L170 50 L194 90Z M286 90 L310 50 L334 90Z M216 70 L240 30 L264 70Z"/>
      ${[170, 190, 210, 230, 250, 270, 290].map(x => `<rect x="${x}" y="110" width="12" height="12"/>`).join('')}</g>
    <g fill="#FFD86B"><rect x="162" y="130" width="12" height="18" rx="6"/><rect x="302" y="130" width="12" height="18" rx="6"/><rect x="234" y="96" width="12" height="18" rx="6"/><path d="M222 260 v-40 a18 18 0 0 1 36 0 v40z"/></g>
    <path d="M240 40 v-16 l16 6 l-16 6" fill="#FF6FA5" stroke="#2E2266" stroke-width="2"/>
    <path d="M0 268 Q240 238 480 268 V360 H0Z" fill="#3F7A4F"/><path d="M0 300 Q240 282 480 300 V360 H0Z" fill="#356A44"/>` },
  ciudad: { name: 'Ciudad', svg: (p) => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6A4FC2"/><stop offset="1" stop-color="#FFB27A"/></linearGradient></defs>
    <rect width="480" height="360" fill="url(#${p}a)"/><circle cx="380" cy="200" r="34" fill="#FFD86B" opacity=".9"/>
    ${([[0, 120, 70, '#3D3470'], [70, 160, 60, '#4A3F86'], [130, 90, 80, '#3D3470'], [210, 140, 60, '#52479A'], [270, 110, 70, '#3D3470'], [340, 170, 60, '#4A3F86'], [400, 100, 80, '#3D3470']] as [number, number, number, string][]).map(([x, y, w, c]) => {
      let win = ''; for (let yy = y + 14; yy < 260; yy += 24) for (let xx = x + 10; xx < x + w - 10; xx += 18) win += `<rect x="${xx}" y="${yy}" width="9" height="12" rx="2" fill="${(xx * 7 + yy) % 3 ? '#FFD86B' : '#2A2456'}"/>`;
      return `<rect x="${x}" y="${y}" width="${w}" height="${280 - y}" fill="${c}"/>${win}`;
    }).join('')}
    <rect y="272" width="480" height="88" fill="#8C8AA8"/><rect y="272" width="480" height="8" fill="#A9A7C2"/>
    <path d="M0 322 H480" stroke="#fff" stroke-width="4" stroke-dasharray="26 18" opacity=".6"/>
    <rect x="96" y="190" width="6" height="84" fill="#2A2456"/><circle cx="99" cy="188" r="10" fill="#FFE59A"/>` },
  teatro: { name: 'Teatro', svg: (p) => `<defs><radialGradient id="${p}a" cx="50%" cy="100%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="480" height="360" fill="#5E1730"/>
    <rect y="262" width="480" height="98" fill="#B9773E"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M0 ${278 + i * 16} H480" stroke="#9C5E2C" stroke-width="2"/>`).join('')}
    <ellipse cx="240" cy="300" rx="200" ry="60" fill="url(#${p}a)"/>
    <path d="M0 0 H96 C 76 120 106 220 66 300 L0 300Z" fill="#D6334E"/><path d="M30 0 C 26 120 40 220 20 300 M60 0 C 54 120 70 220 46 300" stroke="#A82640" stroke-width="5" fill="none"/>
    <path d="M480 0 H384 C 404 120 374 220 414 300 L480 300Z" fill="#D6334E"/><path d="M450 0 C 454 120 440 220 460 300 M420 0 C 426 120 410 220 434 300" stroke="#A82640" stroke-width="5" fill="none"/>
    <path d="M0 0 H480 V34 ${Array.from({ length: 12 }, (_, i) => `Q${470 - i * 40} 56 ${460 - i * 40} 34`).join(' ')} Q10 56 0 34Z" fill="#C42A45"/><path d="M0 30 H480" stroke="#FFC93C" stroke-width="4"/>` },
};
