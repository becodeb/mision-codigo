import type { SaveStatus } from './autosave.ts';

const MESSAGES: Partial<Record<SaveStatus, string>> = {
  offline: 'Guardado en esta compu, sin conexión',
  rejected: 'No se pudo guardar en el servidor. Tu trabajo sigue en esta compu.',
  signedout: 'Se cerró tu sesión. Tu trabajo está guardado en esta compu: salí y elegí tu nombre otra vez.',
};

/** A small unobtrusive notice. Shows nothing while saving works. */
export function SaveNotice({ status }: { status: SaveStatus }) {
  const message = MESSAGES[status];
  if (!message) return null;
  return (
    <p className="w-notice" role="status">
      {message}
    </p>
  );
}
