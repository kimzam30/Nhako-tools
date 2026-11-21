// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { FFMPEG_BASE, ORT_BASE, QPDF_BASE, LIBHEIF_BASE, TESSERACT_BASE, TESSDATA_BASE, LIBREOFFICE_BASE } from './scripts/versions.mjs';

const COI_HEADERS = {
  // ffmpeg.wasm needs SharedArrayBuffer, which needs cross-origin isolation.
  // Mirrored in vercel.json for production. Changing one without the other
  // silently breaks every media tool.
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  site: 'https://tools.nhako.com',
  output: 'static',
  // One URL per page. The sitemap used to list /pdf/merge/ while the
  // canonical tag said /pdf/merge, and both answered 200: two URLs for every
  // page in Google's eyes. vercel.json redirects the slashed form.
  trailingSlash: 'never',
  // preact/compat, not React: the islands use only useState/useEffect/
  // useRef/useCallback/useMemo, and this is the page the brief calls the
  // product. Measured saving is recorded in TASKS.md.
  integrations: [
    preact({ compat: true }),
    // English at the root, Malay under /ms: the sitemap cross-links each pair
    // with xhtml:link hreflang, matching the <link rel="alternate"> tags.
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', ms: 'ms' } },
      // The teleprompter's phone remote is useless without a room code, and
      // the favourites page is empty until a browser fills it. Both are
      // marked noindex; keep them out of the sitemap too.
      // The offline page is only ever served by the service worker.
      filter: (page) => !page.endsWith('/media/teleprompter/remote') && !page.endsWith('/favourites') && !page.endsWith('/offline'),
    }),
    // With trailingSlash 'never' the sitemap plugin rewrites the home page's
    // <loc> to the bare origin after any `serialize`, while its canonical and
    // hreflang say https://tools.nhako.com/. Same URL to a crawler, but make
    // the sitemap say exactly what the canonical says. Runs after sitemap().
    {
      name: 'sitemap-home-slash',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          const { readdir, readFile, writeFile } = await import('node:fs/promises');
          const root = new URL('.', dir);
          for (const f of await readdir(root)) {
            if (!/^sitemap-\d+\.xml$/.test(f)) continue;
            const file = new URL(f, root);
            const xml = await readFile(file, 'utf8');
            const fixed = xml.replace('<loc>https://tools.nhako.com</loc>', '<loc>https://tools.nhako.com/</loc>');
            if (fixed !== xml) await writeFile(file, fixed);
          }
        },
      },
    },
  ],
  vite: {
    plugins: [tailwindcss()],
    server: { headers: COI_HEADERS },
    preview: { headers: COI_HEADERS },
    optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
    worker: { format: 'es' },
    // Versioned vendor paths, see scripts/versions.mjs.
    define: {
      __FFMPEG_BASE__: JSON.stringify(FFMPEG_BASE),
      __ORT_BASE__: JSON.stringify(ORT_BASE),
      __QPDF_BASE__: JSON.stringify(QPDF_BASE),
      __LIBHEIF_BASE__: JSON.stringify(LIBHEIF_BASE),
      __TESSERACT_BASE__: JSON.stringify(TESSERACT_BASE),
      __TESSDATA_BASE__: JSON.stringify(TESSDATA_BASE),
      __LIBREOFFICE_BASE__: JSON.stringify(LIBREOFFICE_BASE),
    },
  },
});
