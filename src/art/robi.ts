/** Robi the guide mascot (UI element with talking classes `.robi`, `.eye`, `.mouth`). */

export function robiSVG(): string {
  return `<svg class="robi" viewBox="0 0 120 130" aria-hidden="true">
    <line x1="60" y1="10" x2="60" y2="26" stroke="#5E5689" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="10" r="7" fill="#FF6FA5"/>
    <rect x="4" y="48" width="12" height="24" rx="6" fill="#2BA5A8"/><rect x="104" y="48" width="12" height="24" rx="6" fill="#2BA5A8"/>
    <rect x="38" y="96" width="44" height="28" rx="11" fill="#3CC6C9"/><circle cx="60" cy="110" r="6" fill="#FFC93C"/>
    <rect x="14" y="24" width="92" height="74" rx="26" fill="#3CC6C9"/><rect x="25" y="36" width="70" height="48" rx="17" fill="#1D2457"/>
    <ellipse class="eye" cx="45" cy="56" rx="7" ry="9" fill="#7CF6FF"/><ellipse class="eye" cx="75" cy="56" rx="7" ry="9" fill="#7CF6FF"/>
    <path class="mouth" d="M50 71q10 6 20 0" stroke="#7CF6FF" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
}
