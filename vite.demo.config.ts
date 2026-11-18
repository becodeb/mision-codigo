// Versión para mirar, sin servidor: `npm run build:demo` deja una página estática en dist-demo/.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    rollupOptions: { input: 'demo.html' },
  },
});
