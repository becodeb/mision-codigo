import { robiSVG } from '../art/index.ts';

/** Robi, the workshop mascot. The markup is our own static SVG. */
export function Robi({ className = '' }: { className?: string }) {
  return <span className={`robi-wrap ${className}`} dangerouslySetInnerHTML={{ __html: robiSVG() }} />;
}
