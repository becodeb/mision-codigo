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
