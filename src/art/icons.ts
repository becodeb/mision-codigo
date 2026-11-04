/** Block icons (data URIs for Blockly `field_image`) and UI icons (inline SVG strings). */

export const svgURI = (s: string): string => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);

const I = (p: string) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;

export const ICON = {
  home: I('<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'),
  sound: I('<path class="f" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2"/>'),
  mute: I('<path class="f" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>'),
  stop: I('<rect class="f" x="6" y="6" width="12" height="12" rx="2.5"/>'),
  full: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  eye: I('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  next: I('<path d="M5 12h13M13 6l6 6-6 6"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  guide: I('<path d="M4 5h11a5 5 0 0 1 5 5v9H9a5 5 0 0 1-5-5z"/><path d="M8 10h8M8 14h5"/>'),
  free: I('<path d="M5 19l4-1 10-10-3-3L6 15z"/><path d="M14 7l3 3"/>'),
  code: I('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>'),
  flagw: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="2.6" height="18" rx="1.3" fill="#fff"/><path d="M7.6 4.6c4-2.4 7 2 12-.4v9c-5 2.4-8-2-12 .4z" fill="#fff"/></svg>',
};

export const IMG = {
  flag: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="10" y="5" width="5" height="39" rx="2.5" fill="#5A4410"/><path d="M15 8c8-5 15 4 25-1v19c-10 5-17-4-25 1z" fill="#2DB34A" stroke="#1B7A30" stroke-width="2.5" stroke-linejoin="round"/></svg>'),
  tap: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 72"><circle cx="22" cy="12" r="10" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/><path d="M22 10c3.3 0 6 2.7 6 6v18.5l2.6-1.3c3-1.4 6.4-.2 7.6 2.6l.6 1.4 1.8-.8c3-1.3 6.3.1 7.4 3l.5 1.2c3-1 6.3.9 6.8 4l.7 4.4c1.4 9-2.6 17.2-10.5 21.4l-1.7.9c-2.9 1.5-6.1 2.3-9.4 2.3h-3.8c-6.5 0-12.5-3.4-15.8-9l-8-13.4c-1.6-2.7-.8-6.2 1.9-7.8 2.4-1.5 5.6-.9 7.3 1.4l2.9 4V16c0-3.3 2.7-6 6-6z" fill="#fff" stroke="#7A5600" stroke-width="3" stroke-linejoin="round"/></svg>'),
  say: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M6 8h36a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H22l-10 8v-8H6a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="#fff"/><circle cx="15" cy="21" r="3" fill="#7A52E0"/><circle cx="24" cy="21" r="3" fill="#7A52E0"/><circle cx="33" cy="21" r="3" fill="#7A52E0"/></svg>'),
  write: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M6 8h36a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H22l-10 8v-8H6a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="#fff"/><path d="M14 26l2-6 12-12 4 4-12 12z" fill="#FFC93C" stroke="#7A52E0" stroke-width="2" stroke-linejoin="round"/></svg>'),
  right: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M6 18h20V8l18 16-18 16V30H6z" fill="#fff" stroke="#1F5DBD" stroke-width="2.5" stroke-linejoin="round"/></svg>'),
  left: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M42 18H22V8L4 24l18 16V30h20z" fill="#fff" stroke="#1F5DBD" stroke-width="2.5" stroke-linejoin="round"/></svg>'),
  up: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M18 42V22H8L24 4l16 18H30v20z" fill="#fff" stroke="#1F5DBD" stroke-width="2.5" stroke-linejoin="round"/></svg>'),
  down: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M18 6v20H8l16 18 16-18H30V6z" fill="#fff" stroke="#1F5DBD" stroke-width="2.5" stroke-linejoin="round"/></svg>'),
  jump: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M7 37C9 13 32 7 38 27" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M30 26l15-2-6 14z" fill="#fff"/></svg>'),
  spin: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M24 24m-3 0a3 3 0 1 1 6 0a8 8 0 1 1-16 0a13 13 0 1 1 26 0a18 18 0 0 1-4 11" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg>'),
  grow: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="20" cy="20" r="13" fill="none" stroke="#fff" stroke-width="5"/><path d="M30 30l11 11M14 20h12M20 14v12" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>'),
  shrink: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="20" cy="20" r="13" fill="none" stroke="#fff" stroke-width="5"/><path d="M30 30l11 11M14 20h12" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>'),
  face: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="#FFD84D" stroke="#fff" stroke-width="3"/><circle cx="17" cy="20" r="3" fill="#241A4D"/><circle cx="31" cy="20" r="3" fill="#241A4D"/><path d="M15 29q9 8 18 0" fill="none" stroke="#241A4D" stroke-width="3" stroke-linecap="round"/></svg>'),
  speaker: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M7 18h8l11-9v30l-11-9H7z" fill="#fff"/><path d="M32 17a9 9 0 0 1 0 14M37 12a16 16 0 0 1 0 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>'),
  clock: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="26" r="17" fill="#fff"/><path d="M24 15v12l7 5" fill="none" stroke="#C25F00" stroke-width="4" stroke-linecap="round"/><rect x="19" y="3" width="10" height="5" rx="2" fill="#fff"/></svg>'),
  loop: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M38 25a14 14 0 1 1-6-11.5" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M26 7l14 3-5 13z" fill="#fff"/></svg>'),
  flagS: svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="5" y="2.5" width="2.6" height="19" rx="1.3" fill="#5A4410"/><path d="M7.6 4c4-2.4 7 2 12-.4v9.4c-5 2.4-8-2-12 .4z" fill="#2DB34A" stroke="#1B7A30" stroke-width="1.2"/></svg>'),
};
