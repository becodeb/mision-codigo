/**
 * Texto de las consignas con resaltado: **lo que se pide** va en un recuadro de color y «nombre de bloque» en
 * negrita de color. La voz lee el mismo texto sin las marcas.
 */
import type { ReactNode } from 'react';

/** El texto sin las marcas, para leerlo en voz alta. */
export function plain(text: string): string {
  return text.replace(/\*\*/g, '');
}

/** Parte el texto en trozos: normal, pedido (**…**) y bloque («…»). */
export function richParts(text: string): { kind: 'text' | 'ask' | 'block'; value: string }[] {
  const out: { kind: 'text' | 'ask' | 'block'; value: string }[] = [];
  const re = /\*\*(.+?)\*\*|«([^»]+)»/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { kind: 'ask', value: m[1] } : { kind: 'block', value: `«${m[2]}»` });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

function inline(value: string, key: string): ReactNode {
  /* Dentro de un pedido también puede haber nombres de bloque. */
  return richParts(value).map((p, i) =>
    p.kind === 'block' ? <b key={`${key}-${i}`} className="mc-block-name">{p.value}</b> : <span key={`${key}-${i}`}>{p.value}</span>,
  );
}

export function Rich({ text }: { text: string }) {
  return (
    <>
      {richParts(text).map((p, i) =>
        p.kind === 'ask' ? (
          <mark key={i} className="mc-pide">{inline(p.value, String(i))}</mark>
        ) : p.kind === 'block' ? (
          <b key={i} className="mc-block-name">{p.value}</b>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}
