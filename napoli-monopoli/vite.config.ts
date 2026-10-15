import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
