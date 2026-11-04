import { useEffect, useRef } from 'react';
import { POLL_INTERVAL_MS, createPoller } from './poll.ts';

/**
 * Calls `task` about every 10 seconds while the component is mounted and the page is visible,
 * and right away when the window gets focus, the tab becomes visible or the network returns.
 * Errors are swallowed on purpose: a poll must never show anything to a child.
 * The task must ignore its own result when the component is gone.
 */
export function usePolling(task: () => Promise<unknown>, { intervalMs = POLL_INTERVAL_MS }: { intervalMs?: number } = {}): void {
  const latest = useRef(task);
  useEffect(() => {
    latest.current = task;
  });

  useEffect(() => {
    const poller = createPoller(() => latest.current(), {
      intervalMs,
      isVisible: () => document.visibilityState !== 'hidden',
    });
    const poke = () => poller.poke();
    window.addEventListener('focus', poke);
    window.addEventListener('online', poke);
    document.addEventListener('visibilitychange', poke);
    poller.start();
    return () => {
      poller.stop();
      window.removeEventListener('focus', poke);
      window.removeEventListener('online', poke);
      document.removeEventListener('visibilitychange', poke);
    };
  }, [intervalMs]);
}
