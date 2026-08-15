import { defineConfig } from 'vite';

export default defineConfig({
  // Electron loads the production UI through file://, so every generated asset
  // URL must be relative to dist/index.html rather than rooted at `/`.
  base: './',
});
