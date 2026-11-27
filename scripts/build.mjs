import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

async function runBuild() {
  // Clean dist directory
  fs.rmSync(distDir, { recursive: true, force: true });

  // 1. Build popup + background service worker (ES module)
  await build({
    root: rootDir,
    base: './',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    build: {
      outDir: distDir,
      emptyOutDir: true,
      target: 'es2022',
      rollupOptions: {
        input: {
          popup: path.resolve(rootDir, 'popup.html'),
          'service-worker': path.resolve(rootDir, 'src/background/service-worker.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'service-worker') {
              return 'service-worker.js';
            }
            return 'assets/[name]-[hash].js';
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  });

  // 2. Build content script as a self-contained IIFE for chrome.scripting.executeScript
  await build({
    root: rootDir,
    configFile: false,
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    build: {
      outDir: distDir,
      emptyOutDir: false,
      target: 'es2022',
      lib: {
        entry: path.resolve(rootDir, 'src/content/content-script.ts'),
        name: 'PageMindContent',
        formats: ['iife'],
        fileName: () => 'content-script.js',
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
  });

  console.log('PageMind extension built successfully into dist/');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});

