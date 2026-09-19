import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { FFMPEG_BASE, ORT_BASE, QPDF_BASE, LIBHEIF_BASE, TESSERACT_BASE, TESSDATA_BASE, LIBREOFFICE_BASE } from './scripts/versions.mjs';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __FFMPEG_BASE__: JSON.stringify(FFMPEG_BASE),
    __ORT_BASE__: JSON.stringify(ORT_BASE),
      __QPDF_BASE__: JSON.stringify(QPDF_BASE),
      __LIBHEIF_BASE__: JSON.stringify(LIBHEIF_BASE),
      __TESSERACT_BASE__: JSON.stringify(TESSERACT_BASE),
      __TESSDATA_BASE__: JSON.stringify(TESSDATA_BASE),
      __LIBREOFFICE_BASE__: JSON.stringify(LIBREOFFICE_BASE),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
