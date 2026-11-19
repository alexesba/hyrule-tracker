import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Renderer (UI) build. The Electron main/preload are bundled by scripts/build-electron.mjs.
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  // /api goes to the app's local network server, so http://localhost:5183 in a browser is the second screen with hot reload.
  server: { port: 5183, strictPort: true, proxy: {
    // The server refuses an Origin that doesn't match its Host; this proxy is the only caller, so drop it.
    '/api': { target: 'http://127.0.0.1:5184', configure: proxy => proxy.on('proxyReq', req => req.removeHeader('origin')) },
  } },
});
