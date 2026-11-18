/** Synthesized sound effects and notes (Web Audio). Browser only: the runtime reaches it through a Host. */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export const isSoundEnabled = (): boolean => enabled;

/** Creates or resumes the audio context; call it from a user gesture so the browser allows sound. */
export function unlockAudio(): AudioContext | null {
  if (!ctx) {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

interface ToneOptions {
  type?: OscillatorType;
  vol?: number;
  /** Seconds from now. */
  at?: number;
  /** Frequency to glide to. */
  slide?: number | null;
}

function tone(freq: number, dur: number, { type = 'sine', vol = 0.15, at = 0, slide = null }: ToneOptions = {}): void {
  const c = unlockAudio();
  if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

function noise(dur: number, { vol = 0.2, freq = 900, at = 0, type = 'lowpass' as BiquadFilterType } = {}): void {
  const c = unlockAudio();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  s.buffer = buf;
  f.type = type;
  f.frequency.value = freq;
  g.gain.value = vol;
  s.connect(f).connect(g).connect(c.destination);
  s.start(c.currentTime + at);
}

const SFX: Record<string, () => void> = {
  pop() { tone(700, 0.07, { vol: 0.1, slide: 1100 }); },
  tick() { tone(1200, 0.04, { type: 'square', vol: 0.04 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, { type: 'triangle', vol: 0.14, at: i * 0.11 })); },
  step() { tone(520, 0.06, { type: 'triangle', vol: 0.08 }); },
  jump() { tone(320, 0.24, { vol: 0.14, slide: 820 }); },
  miau() {
    const c = unlockAudio();
    if (!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    f.type = 'lowpass';
    f.frequency.value = 1800;
    o.frequency.setValueAtTime(480, t0);
    o.frequency.exponentialRampToValueAtTime(880, t0 + 0.14);
    o.frequency.exponentialRampToValueAtTime(420, t0 + 0.45);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    o.connect(f).connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + 0.55);
  },
  guau() { [0, 0.28].forEach((at) => { noise(0.12, { vol: 0.35, freq: 900, at }); tone(320, 0.14, { type: 'square', vol: 0.08, at, slide: 180 }); }); },
  aplauso() { for (let i = 0; i < 16; i++) noise(0.05, { vol: 0.25, freq: 2500, at: i * 0.07 + Math.random() * 0.04, type: 'highpass' }); },
  tambor() { tone(140, 0.3, { vol: 0.3, slide: 50 }); noise(0.08, { vol: 0.2, freq: 400 }); tone(140, 0.3, { vol: 0.25, slide: 50, at: 0.3 }); },
  magia() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.09, at: i * 0.07 })); },
  boing() { tone(180, 0.4, { vol: 0.16, slide: 640 }); },
  bip() { [0, 0.12, 0.24].forEach((at, i) => tone([880, 660, 990][i], 0.08, { type: 'square', vol: 0.05, at })); },
  risa() { [0, .17, .34, .51].forEach((at, i) => { tone(560 - i * 35, .12, { type: 'sawtooth', vol: .05, at, slide: 400 - i * 25 }); noise(.07, { vol: .05, freq: 1800, at }); }); },
  campana() { [880, 1320, 2210].forEach((f, i) => tone(f, 1.5 - i * .35, { vol: .11 / (i + 1) })); },
  silbato() {
    const c = unlockAudio(); if (!c) return;
    const t0 = c.currentTime, o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.frequency.value = 2100; l.frequency.value = 28; lg.gain.value = 140; l.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.07, t0 + .03); g.gain.setValueAtTime(.07, t0 + .45); g.gain.exponentialRampToValueAtTime(.0001, t0 + .56);
    o.connect(g).connect(c.destination); o.start(t0); l.start(t0); o.stop(t0 + .6); l.stop(t0 + .6);
  },
  rugido() { noise(.9, { vol: .45, freq: 480 }); tone(95, .9, { type: 'sawtooth', vol: .1, slide: 55 }); },
  pajaros() { [0, .11, .48, .6, .72].forEach(at => tone(2300, .08, { vol: .07, at, slide: 3500 })); },
  fanfarria() { [[523, 0, .11], [523, .13, .11], [523, .26, .11], [659, .39, .2], [784, .62, .5]].forEach(([f, at, d]) => tone(f, d, { type: 'sawtooth', vol: .06, at })); },
  explosion() { noise(1.3, { vol: .6, freq: 650 }); tone(70, 1, { vol: .2, slide: 30 }); },
  beso() { noise(.05, { vol: .3, freq: 3000, type: 'highpass' }); tone(900, .14, { vol: .06, slide: 1600, at: .03 }); },
};

/** Plays a named effect (`pop`, `step`, `miau`, ...). Unknown names are ignored. */
export function playSfx(name: string): void {
  if (!enabled) return;
  try {
    SFX[name]?.();
  } catch { /* sound must never break a story */ }
}

/** C major from do to si, one octave above middle C. */
export const NOTE_HZ: Record<string, number> = { do: 523.25, re: 587.33, mi: 659.25, fa: 698.46, sol: 783.99, la: 880, si: 987.77 };

export function playNote(name: string): void {
  if (!enabled) return;
  const hz = NOTE_HZ[name];
  if (!hz) return;
  try {
    tone(hz, 0.45, { type: 'triangle', vol: 0.16 });
  } catch { /* ignore */ }
}
