import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // Electron loads the production UI through file://, so every generated asset
  // URL must be relative to dist/index.html rather than rooted at `/`.
  base: './',
  build: { rollupOptions: { input: { editor: resolve(__dirname, 'index.html'), exampleGame: resolve(__dirname, 'example-game.html') } } },
});
