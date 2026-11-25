/** A program drawn with the real, read-only blocks. Used by «Así queda» and by «Cómo lo programé». */
import { useEffect, useRef } from 'react';
import type { GameStep } from '../games/types.ts';
import type { StudioSession } from './session.ts';
import { mountExample } from './workspace.ts';

export type Scripts = NonNullable<GameStep['example']>[number]['scripts'];

export function Blocks({ session, scripts, scale }: { session: StudioSession; scripts: Scripts; scale?: number }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    try {
      return mountExample(host.current, session.tier, scripts, scale);
    } catch (e) {
      console.warn('Example failed', e);
      return undefined;
    }
  }, [session, scripts, scale]);
  return <div className="mc-example-ws" ref={host} data-point="example" />;
}
