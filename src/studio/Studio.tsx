import type { StudioProps } from './contract.ts';

/** Placeholder until the studio task replaces this file. */
export function Studio({ game, onExit }: StudioProps) {
  return <button onClick={onExit}>{game ? game.title : 'Proyecto libre'}</button>;
}
