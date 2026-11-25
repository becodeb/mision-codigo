/** A step drawn with pictures: words, buttons, blocks as they look in the toolbox, and sprites with their face. */
import { blockImage } from '../language/blocks.ts';
import type { BlockType } from '../language/catalog.ts';
import { BLOCK_SPECS } from '../language/spec.ts';
import { blocklyThemes } from '../language/themes.ts';
import { ArtFace } from './drawn.tsx';
import { chipLabel, isBlockType, parseHow } from './chips.ts';
import type { StudioSession } from './session.ts';

/** A sprite's drawing as the child has it now (they can swap it), falling back to the game's own. */
export const SpriteFace = ({ session, id }: { session: StudioSession; id: string }) => (
  <ArtFace art={session.doc.sprites.find((s) => s.id === id)?.art ?? session.game?.setup.sprites.find((s) => s.id === id)?.art} />
);

export function How({ session, text }: { session: StudioSession; text: string }) {
  return (
    <>
      {parseHow(text).map((p, i) => {
        if (p.kind === 'text') return <span key={i}>{p.value}</span>;
        if (p.kind === 'button') return <span key={i} className={`how-btn${p.value === '▶' ? ' go' : ''}`}>{p.value}</span>;
        if (p.kind === 'sprite') return <span key={i} className="how-spr"><SpriteFace session={session} id={p.value} /><span className="nm">{session.named(`{${p.value}}`)}</span></span>;
        if (!isBlockType(p.value)) return null;
        const type = p.value as BlockType;
        const spec = BLOCK_SPECS[type];
        const img = session.tier === 'picture' ? blockImage(type) : null;
        const styles = (session.tier === 'picture' ? blocklyThemes().picture : blocklyThemes().text).blockStyles as Record<string, { colourPrimary: string } | undefined>;
        return (
          <span key={i} className={`how-block${spec.shape === 'hat' ? ' hat' : ''}${spec.shape === 'value' ? ' value' : ''}`} style={{ background: styles[spec.style]?.colourPrimary }}>
            {img ? <img src={img} alt={chipLabel(type)} /> : chipLabel(type)}
          </span>
        );
      })}
    </>
  );
}
