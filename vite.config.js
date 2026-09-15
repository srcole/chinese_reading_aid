import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: { app: 'index.html', speechCheck: 'speech-check.html' } } },
});
