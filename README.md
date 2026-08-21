# Nhako Tools

22 utilities for PDFs, media, images and code, all of which run on your device.

**Live at [tools.nhako.com](https://tools.nhako.com)**

![Astro](https://img.shields.io/badge/Astro_5-BC52EE?style=flat-square&logo=astro&logoColor=white)
![Preact](https://img.shields.io/badge/Preact-673AB8?style=flat-square&logo=preact&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/github/license/kimzam30/Nhako-tools?style=flat-square)

---

## Why it exists

Most online tools upload your file, process it on a server, and send it back. That
means an upload wait, a queue, a size cap, usually a daily limit, and often an
account before you can download the result.

None of that is necessary any more, because browsers can do this work directly. So there
is no upload step here. That makes the tools faster, and it happens to make them
private, because a file that is never sent anywhere cannot leak.

You do not have to take that on trust. Open your network tab and run any tool:
your file never appears in it.

---

## Tools

### PDF `/pdf/*`

| Tool | What it does |
|---|---|
| [Merge](https://tools.nhako.com/pdf/merge) | Combine several PDFs into one, losslessly |
| [Split](https://tools.nhako.com/pdf/split) | Extract pages or a page range into a ZIP |
| [Compress](https://tools.nhako.com/pdf/compress) | Lossless repacking, or aggressive image re-encoding |
| [PDF to JPG](https://tools.nhako.com/pdf/to-image) | Render pages to JPG or PNG at up to 216 dpi |
| [PDF to text](https://tools.nhako.com/pdf/to-text) | Extract the embedded text layer |
| [Rotate](https://tools.nhako.com/pdf/rotate) | Fix orientation without re-rendering |
| [Watermark](https://tools.nhako.com/pdf/watermark) | Stamp text across every page |

### Media `/media/*`

| Tool | What it does |
|---|---|
| [Compress video](https://tools.nhako.com/media/compress-video) | Encode to a target file size via ffmpeg.wasm |
| [Extract audio](https://tools.nhako.com/media/extract-audio) | Pull the audio track out as MP3 |
| [Audio to text](https://tools.nhako.com/media/transcribe) | Whisper `tiny.en`, running on your device |

### Image `/image/*`

| Tool | What it does |
|---|---|
| [Compress](https://tools.nhako.com/image/compress) | Re-encode JPG, PNG and WebP at a chosen quality |
| [Convert](https://tools.nhako.com/image/convert) | Move between JPG, PNG, WebP and AVIF |
| [Resize](https://tools.nhako.com/image/resize) | Scale to exact dimensions, aspect ratio preserved |

### Developer `/dev/*`

| Tool | What it does |
|---|---|
| [JSON](https://tools.nhako.com/dev/json) | Format, validate, sort and minify, with syntax highlighting |
| [JWT](https://tools.nhako.com/dev/jwt) | Decode header and payload; timestamps rendered as dates |
| [Base64](https://tools.nhako.com/dev/base64) | Encode and decode, full UTF-8, URL-safe alphabet |
| [Word count](https://tools.nhako.com/dev/word-count) | Live word, character, sentence and reading-time counts |
| [Hash](https://tools.nhako.com/dev/hash) | SHA-1/256/384/512 via Web Crypto |
| [UUID](https://tools.nhako.com/dev/uuid) | Bulk v4 UUIDs from the platform CSPRNG |
| [QR code](https://tools.nhako.com/dev/qr) | Encodes your text directly, with no tracking redirect |
| [Text diff](https://tools.nhako.com/dev/diff) | Compare by line, word or character |
| [CSS shadow](https://tools.nhako.com/dev/css-shadow) | Build `box-shadow` with a live preview |

---

## Honest limits

Things this project does **not** do, stated here rather than discovered later:

- **`Compress PDF` in lossless mode often saves only a few percent.** That is the real
  ceiling for structural compression. Strong mode genuinely shrinks scans, but it
  rasterises the pages, so text stops being selectable. Both modes say so in the UI.
- **`PDF to text` returns nothing for scanned documents.** They have no text layer, and
  there is no OCR here.
- **`Audio to text` is English-only and noticeably less accurate than the cloud models.**
  It is Whisper `tiny.en`, chosen because it fits in a browser.
- **`Hash` does not offer MD5.** Web Crypto deliberately omits it.
- **Video compression runs at roughly real-time or slower**, and single-pass encoding
  lands near the target size rather than exactly on it.
- **File size is bounded by your device's memory.** No upload cap, but no server's RAM
  either.

---

## Privacy, precisely

No backend, no database, no analytics, no cookies, no account. One `localStorage`
entry records your theme preference.

What the browser does request:

- The page, its JavaScript, and the self-hosted fonts, all from this domain.
- For the media tools, the ffmpeg WebAssembly core (~31 MB), also from this domain,
  cached after first use.
- For `Audio to text` only, the Whisper weights (~39 MB) from the Hugging Face CDN on
  first use, then cached. This is the one third-party request, and it is a download
  of the model, never an upload of your audio.

---

## Architecture

`src/tools/registry.ts` is the single source of truth. Routes, page metadata, the
homepage grid, the command palette and the sitemap are all derived from it, and
Astro's `getStaticPaths()` generates one prerendered page per entry. A tool that is
not in the registry has no page; a duplicate id fails the test suite.

Tool metadata is deliberately separate from tool implementations
(`src/tools/loaders.ts`), so enumerating tools at build time does not pull `pdf-lib`,
`ffmpeg` or `transformers.js` into the graph. Each implementation dynamic-imports its
own dependencies, which is why:

| Page | JS transferred (raw) |
|---|---|
| Homepage | **0 KB**. The nav, theme toggle and ⌘K palette are vanilla |
| `/about`, `/privacy` | **0 KB** |
| Any tool page | **32 KB** |

Nothing heavy loads until the tool that needs it actually runs. Islands use
`preact/compat` rather than React: the same 22 tool pages cost 202 KB on React 19
and 32 KB on Preact, measured identically, and the tool page is the product.

CPU-bound tools (`pdf/merge`, `split`, `rotate`, `watermark`, `to-text`) run in a
Web Worker so a large document no longer freezes the tab. Tools needing a canvas,
ffmpeg or an AudioContext stay on the main thread, and the worker path falls back
to inline if a worker cannot start.

| Layer | Choice |
|---|---|
| Framework | Astro 5, static output |
| Islands | Preact (compat), only where interaction lives |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4, CSS-variable tokens |
| PDF | `pdf-lib`, `pdf.js` |
| Media | `ffmpeg.wasm` (self-hosted) |
| Transcription | `transformers.js` (Whisper `tiny.en`) |
| Offline | Service worker, app shell precached, big binaries cached on use |
| Tests | Vitest + Playwright + axe-core |
| Hosting | Vercel |

---

## Local development

```bash
git clone https://github.com/kimzam30/Nhako-tools.git
cd Nhako-tools
npm install
npm run dev
```

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Serve the build with production headers |
| `npm run typecheck` | `astro check` + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest, 114 unit tests |
| `npm run test:e2e` | Playwright, 30 tests (16 functional, 14 accessibility) |
| `npm run vendor` | Copy ffmpeg core into `public/vendor` (runs automatically) |
| `npm run icons` | Rasterise `public/favicon.svg` into the PNG icon sizes |

> **Cross-origin isolation.** `ffmpeg.wasm` needs `SharedArrayBuffer`, which needs the
> COOP/COEP headers set in `astro.config.mjs` (dev), `scripts/preview.mjs` (preview)
> and `vercel.json` (production). Serving the build with a plain static server without
> those headers breaks every media tool. Astro's own `astro preview` does not set them,
> which is why `npm run preview` uses a small custom server instead.

### Tests worth knowing about

- `src/styles/tokens.test.ts` parses `tokens.css` and asserts every foreground and
  background pair meets WCAG AA. A colour cannot be changed without it being rechecked.
- `src/tools/registry.test.ts` validates the registry against `vercel.json`, so a
  legacy redirect pointing at a tool that no longer exists fails the build.
- `src/tools/media/bitrate.test.ts` covers the size-targeting arithmetic across a
  range of audio bitrates.
- `e2e/a11y.spec.ts` runs axe-core over six pages in both themes. It caught a real
  ARIA bug (an `<a>` nested inside `<li role="option">` in the command palette).
  It is not a substitute for a real screen reader, which is still outstanding.

Lighthouse scores 100 across performance, accessibility, best practices and SEO on
the homepage and both tool-page types, with 0 ms blocking time and 0 layout shift.
That was measured against localhost, so the paint timings are optimistic.

---

## Design

`public/favicon.svg` is the single source for the mark: a geometric N whose stems
and diagonal share one 3.6u width on a 32u grid, dark on brand pink at 9.23:1, so it
stays legible at 16 px. `npm run icons` rasterises every other size from it.

The visual system and the reasoning behind it live in
[`.design/nhako-tools-rebuild/`](.design/nhako-tools-rebuild/), covering the brief,
information architecture, and screenshots.

`#FF91E7` is the Nhako brand accent. It is pale, so it cannot carry text on a light
background (white on it is 2.01:1, well under the 4.5:1 AA threshold). It is kept as
the identity colour, and deepened variants are derived for interactive elements. The
token test enforces this.

---

## License

MIT. See [LICENSE](LICENSE).
