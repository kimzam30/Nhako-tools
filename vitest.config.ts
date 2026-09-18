import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { FFMPEG_BASE, ORT_BASE } from './scripts/versions.mjs';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __FFMPEG_BASE__: JSON.stringify(FFMPEG_BASE),
    __ORT_BASE__: JSON.stringify(ORT_BASE),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
