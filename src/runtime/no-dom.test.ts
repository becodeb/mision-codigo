import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The runtime and the language run on Node, in a worker, in tests: no browser globals may sneak in. */
const FORBIDDEN = /\b(document|window|navigator|localStorage|sessionStorage|requestAnimationFrame|cancelAnimationFrame|speechSynthesis|AudioContext|HTMLElement|matchMedia|performance)\b/;

function sources(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(dir, f));
}

const stripComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('no browser access outside the adapters', () => {
  for (const dir of ['src/runtime', 'src/language', 'src/shared']) {
    it(`${dir} uses no DOM, audio or storage globals`, () => {
      const files = sources(dir);
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const code = stripComments(readFileSync(file, 'utf8'));
        const hit = FORBIDDEN.exec(code);
        expect(hit, `${file} mentions ${hit?.[0]}`).toBeNull();
      }
    });
  }

  it('the runtime never imports the audio adapter', () => {
    for (const file of sources('src/runtime')) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"]\.\.\/audio/);
    }
  });
});
