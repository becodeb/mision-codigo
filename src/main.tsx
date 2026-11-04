import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './workshop/workshop.css';
import { Boundary } from './workshop/Boundary.tsx';
import { WorkshopApp } from './workshop/WorkshopApp.tsx';

createRoot(document.getElementById('root')!).render(
  <Boundary>
    <WorkshopApp />
  </Boundary>,
);
