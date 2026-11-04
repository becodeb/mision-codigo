/** Spanish text to speech through the browser. Browser only. */
import { cleanSpeech } from '../runtime/values.ts';
import { isSoundEnabled } from './sfx.ts';

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): void {
  if (!canSpeak) return;
  const vs = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang));
  voice = vs.find((v) => /es[-_]AR/i.test(v.lang)) ?? vs.find((v) => /es[-_](419|MX|US|CO|CL|UY)/i.test(v.lang)) ?? vs[0] ?? null;
}

if (canSpeak) {
  pickVoice();
  try {
    speechSynthesis.addEventListener('voiceschanged', pickVoice);
  } catch { /* old API */ }
}

export interface SpeakOptions {
  pitch?: number;
  rate?: number;
  /** Cut off whatever is being said first. */
  cancel?: boolean;
}

/** Speaks and resolves true when finished, false when there is nothing to say or no way to say it. */
export function speak(text: string, { pitch = 1.1, rate = 0.95, cancel = false }: SpeakOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const clean = cleanSpeech(text);
    if (!isSoundEnabled() || !canSpeak || !clean) return resolve(false);
    if (cancel) {
      try {
        speechSynthesis.cancel();
      } catch { /* ignore */ }
    }
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = voice ? voice.lang : 'es-AR';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = pitch;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(true);
    };
    u.onend = finish;
    u.onerror = finish;
    /* Some engines never fire `end`; give up after a generous estimate. */
    setTimeout(finish, 3500 + clean.length * 110);
    try {
      speechSynthesis.speak(u);
    } catch {
      finish();
    }
  });
}

/** Stops speaking right away. */
export function hush(): void {
  try {
    if (canSpeak) speechSynthesis.cancel();
  } catch { /* ignore */ }
}
