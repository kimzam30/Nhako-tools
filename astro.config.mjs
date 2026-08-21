// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const COI_HEADERS = {
  // ffmpeg.wasm needs SharedArrayBuffer, which needs cross-origin isolation.
  // Mirrored in vercel.json for production — changing one without the other
  // silently breaks every media tool.
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  site: 'https://tools.nhako.com',
  output: 'static',
  // preact/compat, not React: the islands use only useState/useEffect/
  // useRef/useCallback/useMemo, and this is the page the brief calls the
  // product. Measured saving is recorded in TASKS.md.
  integrations: [preact({ compat: true }), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: { headers: COI_HEADERS },
    preview: { headers: COI_HEADERS },
    optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
    worker: { format: 'es' },
  },
});
