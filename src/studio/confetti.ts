/** A burst of confetti over the whole page. Browser only; does nothing when the child prefers reduced motion. */

const COLOURS = ['#FF6FA5', '#FFC93C', '#3D8BFF', '#5CC14F', '#FF9A3C', '#8E5CF7'];

export function confetti(): void {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'mc-confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  cv.width = w * dpr;
  cv.height = h * dpr;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  if (!ctx) {
    cv.remove();
    return;
  }
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 150 }, () => ({
    x: w / 2 + (Math.random() - 0.5) * 200, y: h * 0.35, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4,
    r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: COLOURS[Math.floor(Math.random() * COLOURS.length)],
  }));
  const t0 = performance.now();
  const frame = (now: number): void => {
    const t = now - t0;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - t / 2600);
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (t < 2600) requestAnimationFrame(frame);
    else cv.remove();
  };
  requestAnimationFrame(frame);
}
