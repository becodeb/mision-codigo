import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;
  className?: string;
  onClose: () => void;
  /** Hides the close button for modals the child must answer. */
  closable?: boolean;
}

/** One dialog for every question the studio asks: sprite picker, new variable, finish. Never the browser's `prompt`. */
export function Modal({ title, children, className = '', onClose, closable = true }: ModalProps) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && closable) onClose();
    };
    window.addEventListener('keydown', key);
    const first = card.current?.querySelector<HTMLElement>('input, .primary, .mc-pick');
    first?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', key);
  }, [closable, onClose]);
  return (
    <div className="mc-modal" onPointerDown={(e) => { if (closable && e.target === e.currentTarget) onClose(); }}>
      <div ref={card} className={`mc-modal-card ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
