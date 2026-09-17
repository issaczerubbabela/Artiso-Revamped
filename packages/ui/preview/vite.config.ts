import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  server: { port: 4400 },
  build: { outDir: '../dist-preview', emptyOutDir: true },
});
