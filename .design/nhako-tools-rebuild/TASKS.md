# Tasks — Nhako Tools rebuild

Derived from `DESIGN_BRIEF.md` and `INFORMATION_ARCHITECTURE.md`.
Status as of 2026-08-21, branch `rebuild/astro`.

## Done

### Foundation
- [x] Astro 5 + TypeScript strict + Tailwind v4 scaffold, replacing the Vite SPA
- [x] Vitest, Playwright, ESLint (typescript-eslint + astro) wired and passing
- [x] `src/tools/registry.ts` as single source of truth; routes via `getStaticPaths()`
- [x] Metadata/implementation split (`loaders.ts`) so build-time enumeration stays light
- [x] Self-hosted ffmpeg core via `scripts/vendor-ffmpeg.mjs` (was fetched from unpkg)
- [x] Custom preview server so COOP/COEP match production locally

### Design system
- [x] `tokens.css` — Precision Instrument philosophy, light + dark
- [x] Pink ramp derived from `#FF91E7` with AA-passing interactive variants
- [x] Instrument Sans + JetBrains Mono, self-hosted via Fontsource
- [x] Contrast enforced by `tokens.test.ts`, which parses the CSS directly

### Tools — all 22
- [x] PDF: merge, split, compress (two honest modes), to-image, to-text, rotate, watermark
- [x] Media: compress-video (corrected bitrate maths), extract-audio, transcribe
- [x] Image: compress, convert, resize — all zero-dependency canvas work
- [x] Dev: json, jwt, base64, word-count, hash, uuid, qr, diff, css-shadow

### UI
- [x] `BaseLayout` with per-tool title/meta/canonical/OG/JSON-LD, sitemap, robots
- [x] Blocking inline theme script — no flash, works on every page
- [x] Homepage directory, search-first, filtering works with JS disabled
- [x] Tool page template: tool above the fold, prose and honest limits below
- [x] `FileToolRunner` — runs on drop, no Run button, elapsed time on completion
- [x] `TextToolPane` — live output, real JSON syntax highlighting, stats row
- [x] Vanilla `⌘K` command palette and theme toggle (no React in the global nav)
- [x] 301 redirects for all 13 legacy URLs, validated by test

### Bugs from the old build, fixed and regression-tested
- [x] Keyboard users could not open the file picker (`<div onClick>`)
- [x] White on `#FF91E7` at 2.01:1 on every primary button
- [x] Theme ignored on any page but the homepage; flashed on load
- [x] `replace('-', ' ')` mangled multi-hyphen titles
- [x] `css-generator` and `edit-pdf` rendered working-looking dead pages
- [x] `convert-pdf` listed twice; `/tool/<anything>` returned a page
- [x] Video size targeting wrong for any audio bitrate other than 128k
- [x] Unvalidated target size producing `NaN`
- [x] ffmpeg virtual FS never cleaned between runs
- [x] `alert()` as the only error channel, seven times over
- [x] Search could not find "transcribe"

## Remaining — all closed 2026-08-22

- [x] **PWA / offline.** `scripts/build-sw.mjs` generates `dist/sw.js` at build time.
      Precache is deliberately narrow — 29 files, 722 KB: HTML routes, CSS, latin font
      subsets. It excludes every JS chunk, because precaching them would make a
      first-time visitor download transformers.js (802 KB), pdf-lib (425 KB), pdf.js
      (394 KB) and jszip (95 KB) just for landing on the homepage, undoing the
      per-route lazy loading the architecture exists for. Those are
      stale-while-revalidate on first real use. The ffmpeg core (31 MB) and Whisper
      weights (39 MB) are cache-first at runtime and kept indefinitely.
      Result: after one visit the homepage works offline; any tool works offline
      once opened once.

- [x] **Web Workers for CPU-bound tools.** `src/tools/run-tool.ts` routes the five
      DOM-free tools (`pdf/merge`, `split`, `rotate`, `watermark`, `to-text`) to
      `src/workers/tool.worker.ts`. Verified: 1 worker constructed on `/pdf/merge`,
      0 on `/image/resize`. The rest stay on the main thread for concrete reasons —
      pdf.js rendering and the image tools need a canvas, ffmpeg runs its own worker,
      and transcribe needs an AudioContext. Falls back to inline if a worker cannot
      start, so a worker failure degrades to a busy tab rather than a broken tool.

- [x] **Lighthouse.** 100 / 100 / 100 / 100 (performance, accessibility, best
      practices, SEO) on the homepage, a file tool and a text tool. TBT 0 ms, CLS 0.
      Reports in `.design/nhako-tools-rebuild/lighthouse/`.
      *Caveat:* run against localhost, so FCP/LCP (0.4–0.5 s) are optimistic. TBT and
      CLS are network-independent and hold.

- [x] **Automated accessibility pass.** `e2e/a11y.spec.ts` runs axe-core over six
      pages in both themes, 14 checks, zero violations against wcag2a/2aa/21a/21aa.
      Found and fixed a real bug: the command palette nested an `<a>` inside
      `<li role="option">` (`nested-interactive`), which is invalid ARIA. Options now
      carry their own content and navigation, with `aria-activedescendant` tracking.
      **Still outstanding:** a pass with an actual screen reader. axe can tell you an
      announcement exists, not whether it is *useful* — that judgement needs a human.

- [x] **Deleted `_legacy/`.**

- [x] **Flagship homepage tool — decided: no.** Three reasons. The homepage currently
      ships 0 KB of JavaScript; embedding a live tool would pull Preact and a tool
      dependency onto it and contradict the measurement the positioning rests on.
      Homepage visitors arrive browsing rather than task-focused — someone who typed
      the URL wants to *find* a tool, not be handed an arbitrary one. And the speed
      claim lands harder on the tool page, where it is actually experienced. The
      directory plus ⌘K stays. (No autofocus on the search box either: it hijacks
      scroll position and is hostile to screen reader users; ⌘K covers power users.)

- [x] **Preact/compat — adopted.** Measured with identical methodology, real
      transferred JS on a tool page:

      | | Tool page JS (raw) |
      |---|---|
      | React 19 | 202 KB |
      | preact/compat | 32 KB |

      An 84% reduction on the page the brief calls "the product". The islands use
      only `useState`/`useEffect`/`useRef`/`useCallback`/`useMemo`, all supported.
      `@astrojs/preact@6` targets Astro 6 and fails to resolve `astro:preact:opts`
      on Astro 5 — v4 is the correct pairing. `react`/`react-dom` remain as
      dependencies because compat aliases them and the `.tsx` sources still import
      from `react`.

- [x] **New logo and favicon.** Replaced the logo-generator wordmark (a red-to-purple
      gradient on cream, illegible at 16 px) with a geometric N: stems and diagonal
      at a uniform 3.6u on a 32u grid, dark on brand pink at 9.23:1. Verified legible
      at 16/24/32/64 px. `public/favicon.svg` is the single source; `scripts/icons.mjs`
      rasterises the 180/192/512 PNGs from it, so every size is one design.
      Wired into the head, the nav, the footer and the web manifest.

## Round 3 — motion, copy, metadata (2026-08-22)

- [x] **Tab titles are the page name alone.** `Merge PDF`, not
      `Merge PDF — Nhako Tools`. `og:title` and `twitter:title` keep the brand, since a
      social card has no other context to sit in.

- [x] **Em-dashes removed from everything a person reads.** Roughly 90 in site copy and
      17 in the README, rewritten into sentences, commas, colons and parentheses rather
      than swapped for hyphens, which reads equally machine-made. Verified: the rendered
      HTML contains zero. The only ones left in `dist` are three inside a vendored
      cp1252 character table in pdf.js, which is not ours to touch.
      Value placeholders moved from `'—'` to `'n/a'` (`format.ts`, `jwt.ts`, plus the
      four assertions pinning them), and the limits bullet became a real list marker.
      Code comments and `.design/` keep theirs, as agreed.

- [x] **Motion system.** `src/styles/motion.css`, one reviewable surface.
      - Hero: a terminal readout that types out and loops. Every line is literally true,
        which is why there is no "wasm ████░░ ready" bar: ffmpeg is not loaded on the
        homepage. The full text ships in the HTML, so it survives with JS disabled.
      - Sitewide: scroll-driven card and section reveals, section rules that draw in,
        a pulsing local-runtime dot in the nav, and cross-document view transitions.
      - **Cost: 0 KB of external JS on the homepage**, unchanged. Route transitions use
        `@view-transition` and reveals use `animation-timeline: view()`, both CSS-only.
        Astro's `<ClientRouter />` was deliberately not used; it ships a sitewide runtime
        to do what one at-rule does.
      - Reveals translate, they do not fade. axe caught the first version rendering prose
        at 1.87:1 mid-animation. Text now holds full contrast throughout.
      - `vt-footer` was dropped: naming a below-the-fold element promotes it to its own
        layer for no visible gain and breaks full-page capture.

- [x] **Social preview images (bug found during audit).** `twitter:card` was
      `summary_large_image` with no `og:image` anywhere, so every share rendered blank.
      Five cards now generated by `scripts/og-images.mjs` (four categories plus a
      default) from the same favicon source.

- [x] **DESIGN_BRIEF.md amended** with the motion principle, so the documents no longer
      contradict the build.

Verified after the change: Lighthouse still 100/100/100/100 with CLS 0 and TBT 0 on all
three page types; 114 unit tests; 30 e2e; homepage external JS still 0; readout renders
in full with JS disabled; reduced motion shows the final frame with nothing animating.

## Still open

- [ ] **Screen-reader pass with a real screen reader** (see above — the automated
      audit is green, but that is not the same claim).
- [ ] **Lighthouse against a deployed URL**, to get realistic network numbers.
- [ ] **Confirm parity in production** before this replaces the live site.
