/** Extra icons for the picture-tier blocks that the old app did not have. Same flat white-on-colour style as `IMG`. */
import { svgURI } from '../art/icons.ts';

const svg = (viewBox: string, body: string): string => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`);

export const BLOCK_IMG = {
  show: svg('0 0 48 48', '<path d="M3 24s7.5-14 21-14 21 14 21 14-7.5 14-21 14S3 24 3 24z" fill="#fff"/><circle cx="24" cy="24" r="8" fill="#6436C4"/><circle cx="27" cy="21" r="2.6" fill="#fff"/>'),
  hide: svg('0 0 48 48', '<path d="M3 24s7.5-14 21-14 21 14 21 14-7.5 14-21 14S3 24 3 24z" fill="#fff" opacity=".85"/><circle cx="24" cy="24" r="8" fill="#6436C4"/><path d="M8 40L40 8" stroke="#6436C4" stroke-width="6" stroke-linecap="round"/><path d="M8 40L40 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>'),
  note: svg('0 0 48 48', '<path d="M18 36V10l22-5v26" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="13" cy="37" rx="7.5" ry="6" fill="#fff"/><ellipse cx="35" cy="32" rx="7.5" ry="6" fill="#fff"/>'),
  random: svg('0 0 48 48', '<rect x="6" y="6" width="36" height="36" rx="9" fill="#fff" stroke="#1F5DBD" stroke-width="3"/><circle cx="16" cy="16" r="4" fill="#1F5DBD"/><circle cx="32" cy="16" r="4" fill="#1F5DBD"/><circle cx="24" cy="24" r="4" fill="#1F5DBD"/><circle cx="16" cy="32" r="4" fill="#1F5DBD"/><circle cx="32" cy="32" r="4" fill="#1F5DBD"/>'),
  backdrop: svg('0 0 48 48', '<rect x="4" y="7" width="40" height="34" rx="6" fill="#fff"/><circle cx="33" cy="17" r="5" fill="#FFC93C"/><path d="M4 36l12-13 10 10 7-6 11 11v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#6436C4"/>'),
  star: svg('0 0 48 48', '<polygon points="24,3 30,17 45,18 33,28 37,43 24,35 11,43 15,28 3,18 18,17" fill="#FFE07A" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>'),
  send: svg('0 0 48 48', '<rect x="4" y="12" width="32" height="24" rx="4" fill="#fff"/><path d="M4 14l16 12 16-12" fill="none" stroke="#0E8277" stroke-width="3" stroke-linejoin="round"/><path d="M34 24h10M39 18l6 6-6 6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
  recv: svg('0 0 48 48', '<rect x="8" y="12" width="32" height="24" rx="4" fill="#fff"/><path d="M8 14l16 12 16-12" fill="none" stroke="#0E8277" stroke-width="3" stroke-linejoin="round"/>'),
} as const;

export type BlockImgId = keyof typeof BLOCK_IMG;
