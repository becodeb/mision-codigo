/** Browser adapter: plugs sound and speech into the runtime's `Host`. */
import type { Host } from '../runtime/host.ts';
import { playNote, playSfx } from './sfx.ts';
import { hush, speak } from './speech.ts';

export { NOTE_HZ, isSoundEnabled, playNote, playSfx, setSoundEnabled, unlockAudio } from './sfx.ts';
export { hush, speak } from './speech.ts';

/** The audio half of a host. Merge it with the stage renderer's methods: `{ ...audioHost, render, ... }`. */
export const audioHost: Pick<Host, 'speak' | 'cancelSpeech' | 'sfx' | 'note'> = {
  speak: (text, opts) => speak(text, opts),
  cancelSpeech: hush,
  sfx: playSfx,
  note: playNote,
};
