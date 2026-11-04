import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './workshop/workshop.css';
import { Boundary } from './workshop/Boundary.tsx';
import { WorkshopApp } from './workshop/WorkshopApp.tsx';

// Two screens, told apart by the path. The server falls back to index.html for any path without a file extension.
const TeacherApp = lazy(() => import('./teacher/TeacherApp.tsx').then((module) => ({ default: module.TeacherApp })));

const isTeacherRoute = /^\/docente(\/|$)/.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <Boundary>
    {isTeacherRoute ? (
      <Suspense fallback={<p className="w-status">Cargando…</p>}>
        <TeacherApp />
      </Suspense>
    ) : (
      <WorkshopApp />
    )}
  </Boundary>,
);
