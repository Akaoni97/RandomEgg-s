import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' => la build funziona anche aperta da file system o impacchettata con Tauri
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, open: true },
  test: { environment: 'node' },
} as any);
