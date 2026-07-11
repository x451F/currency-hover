import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const outDir = process.env['EXTENSION_OUT_DIR'] ?? 'dist/chrome';

export default defineConfig({
  base: './',
  build: {
    target: 'es2017',
    outDir,
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/background/index.ts'),
      formats: ['iife'],
      name: 'CurrencyHoverBackground',
      fileName: () => 'background.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'background.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
