import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import { createRoot } from 'react-dom/client';

function App() {
  return <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800 }}>Misión Código</p>;
}

createRoot(document.getElementById('root')!).render(<App />);
