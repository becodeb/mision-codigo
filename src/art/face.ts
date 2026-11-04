/** Facial expressions drawn on top of a character, centred on the face origin. */

export interface FaceParams {
  /** Eye offset from the centre. */
  ex?: number;
  ey?: number;
  /** Eye radius. */
  er?: number;
  col?: string;
  /** Mouth offset and half-width. */
  my?: number;
  mw?: number;
  glint?: boolean;
}

export function faceSVG(em: string, o: FaceParams): string {
  const { ex = 9, ey = 0, er = 4.5, col = '#241A4D', my = 10, mw = 6, glint = true } = o;
  const eye = (x: number, k = 1) => `<ellipse cx="${x}" cy="${ey}" rx="${er * k}" ry="${er * 1.35 * k}" fill="${col}"/>` + (glint ? `<circle cx="${x + er * .35}" cy="${ey - er * .45}" r="${er * .38}" fill="#fff"/>` : '');
  const st = `fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round"`;
  switch (em) {
    case 'risa': return `<path d="M${-ex - er} ${ey + 1} Q${-ex} ${ey - er * 1.8} ${-ex + er} ${ey + 1}" ${st}/><path d="M${ex - er} ${ey + 1} Q${ex} ${ey - er * 1.8} ${ex + er} ${ey + 1}" ${st}/><path d="M${-mw - 1} ${my - 2} H${mw + 1} Q${mw + 1} ${my + 8} 0 ${my + 8} Q${-mw - 1} ${my + 8} ${-mw - 1} ${my - 2}Z" fill="${col}"/><path d="M${-mw * .5} ${my + 5} Q0 ${my + 2} ${mw * .5} ${my + 5} Q0 ${my + 8} ${-mw * .5} ${my + 5}Z" fill="#FF7FA8"/>`;
    case 'triste': return eye(-ex) + eye(ex) + `<path d="M${-ex - er} ${ey - er * 1.5} L${-ex + er} ${ey - er * 2.3} M${ex + er} ${ey - er * 1.5} L${ex - er} ${ey - er * 2.3}" ${st}/><path d="M${-mw} ${my + 3} Q0 ${my - 4} ${mw} ${my + 3}" ${st}/><path d="M${ex + er * .8} ${ey + er * 1.6} q2.5 4.5 0 7 q-2.5 -2.5 0 -7z" fill="#5CB8FF"/>`;
    case 'sorpresa': return eye(-ex, 1.25) + eye(ex, 1.25) + `<path d="M${-ex - er} ${ey - er * 2.6} Q${-ex} ${ey - er * 3.2} ${-ex + er} ${ey - er * 2.6} M${ex - er} ${ey - er * 2.6} Q${ex} ${ey - er * 3.2} ${ex + er} ${ey - er * 2.6}" ${st}/><ellipse cx="0" cy="${my + 2}" rx="${mw * .55}" ry="${mw * .75}" fill="${col}"/>`;
    case 'enojo': return eye(-ex) + eye(ex) + `<path d="M${-ex - er - 1} ${ey - er * 2.4} L${-ex + er} ${ey - er * 1.3} M${ex + er + 1} ${ey - er * 2.4} L${ex - er} ${ey - er * 1.3}" ${st}/><path d="M${-mw} ${my + 3} Q0 ${my - 2} ${mw} ${my + 3}" ${st}/>`;
    case 'dormido': return `<path d="M${-ex - er} ${ey} Q${-ex} ${ey + er * 1.3} ${-ex + er} ${ey} M${ex - er} ${ey} Q${ex} ${ey + er * 1.3} ${ex + er} ${ey}" ${st}/><ellipse cx="0" cy="${my + 1}" rx="${mw * .35}" ry="${mw * .45}" fill="${col}"/><text x="${ex + 10}" y="${ey - 12}" font-family="Baloo 2, sans-serif" font-weight="800" font-size="14" fill="#7C4DFF">z</text><text x="${ex + 17}" y="${ey - 22}" font-family="Baloo 2, sans-serif" font-weight="800" font-size="10" fill="#7C4DFF">z</text>`;
    default: return eye(-ex) + eye(ex) + `<path d="M${-mw} ${my - 1} Q0 ${my + 6} ${mw} ${my - 1}" ${st}/>`;
  }
}
