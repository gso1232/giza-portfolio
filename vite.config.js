import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// the site: the room (index.html) and the site inside its laptop (inside.html)
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { index: resolve(import.meta.dirname, 'index.html'), inside: resolve(import.meta.dirname, 'inside.html') } },
  },
});
