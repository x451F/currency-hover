import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const outDir = process.env['EXTENSION_OUT_DIR'] ?? 'dist/chrome';

export default defineConfig({
  base: './',
  build: {
    target: 'es2017',
    outDir,
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
