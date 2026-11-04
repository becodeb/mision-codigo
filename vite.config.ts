import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // The API runs as its own process in development (`npm run start`, port 8301).
    proxy: { '/api': 'http://127.0.0.1:8301' },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
