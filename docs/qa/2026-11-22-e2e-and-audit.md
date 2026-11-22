# QA pass, 2026-11-22: human-path E2E, real devices, audit fixes

## How it was tested

- **Real files** (`node scripts/fetch-real-fixtures.mjs`, SHA-256 pinned, git-ignored): an 18 MP camera JPEG, a GPS-tagged Nikon photo, HEIC stills, Word/Excel/PowerPoint/ODT/CSV files made by office software, a 1080p H.264 clip (no audio) and a clip with sound, recorded English (Whisper's JFK clip) and Malay speech, a 15-page typeset paper, a 40-page phone-style scan, a truncated PDF and one with a broken xref offset.
- **Human path** (`e2e/human.spec.ts`, helpers in `e2e/support/human.ts`): start on the home page, type the tool name into search, close the keyboard, tap the result, set options, tap the drop zone, pick the file in the real file chooser, wait for the result, press Save, check the saved bytes (pdf-lib, pdf.js, JSZip, pixel decode). Desktop uses the real download event.
- **Real devices over Tailscale** (`scripts/device-e2e.sh`, Playwright project `device`): Galaxy Z Flip5 (Android 17, Chrome 152) and Galaxy Tab S9 FE (Android 16, Chrome 143), each driven over Chrome DevTools in its own tab, served through `adb reverse` so the page stays a secure, cross-origin-isolated context. Screenshots per step in `test-results/devices/<device>/`, outputs in `test-results/outputs/<device>/`.
- **Offline** (`e2e/pwa.spec.ts`): service worker precache, a used tool working with the network off, a never-visited page offline.

## Results

| Suite | Result |
|---|---|
| Unit (vitest) | 430 passed |
| Desktop baseline, all specs, Chromium + WebKit + Firefox | 718 passed, 3 failed: 2 load flakes (pass 6/6 alone), 1 WebKit contrast check measured mid fade-in (test fixed) |
| Human path, desktop Chromium, real files | 51 / 51 passed |
| PWA + accessibility, Chromium + WebKit | all passed |
| Human path, Flip5 and Tab S9 FE | in progress at the time of writing; see the session report |

## Bugs found and fixed

| Area | Finding | Fix |
|---|---|---|
| Compress image presets | `/image/compress/20kb` and `/50kb` returned 52 KB for a normal 18 MP camera photo: resolution steps stopped at 18% | `scalesFor()` keeps stepping down to a 320 px long side (`src/lib/fit-size.ts`) |
| Layout | Sticky header (and the phone tab bar) covered anything scrolled into view; on the Tab the header intercepted taps on search results | `scroll-padding-top/bottom` (`src/styles/app.css`) |
| Unlock / Protect on phones | After typing a password the "Run again" button sat under the keyboard | Enter/Go in an option field runs the job (`OptionsPanel.tsx`, `FileToolRunner.tsx`) |
| Office to PDF | First download got only 90 s for 77 MB (the 30-minute allowance was unreachable); engine start had no time limit | Read `firstLoad` before starting; 2-minute bound on `initialize()` (`src/lib/libreoffice.ts`) |
| Heavy tools | No way to stop a long video/OCR/Office job | Cancel button; ffmpeg really terminates (`abortFFmpeg`) |
| Heavy tools | A huge video or a 2 GB-RAM phone crashed the tab with no message | Memory guard before ffmpeg and LibreOffice (`src/lib/memory.ts`) |
| Errors | Raw engine errors shown ("memory access out of bounds", stale chunk after a deploy) | Friendly EN/MS mapping (`src/lib/errors.ts`) |
| Worker | A result that could not be deserialized left the run pending forever | `messageerror` handler (`src/tools/run-tool.ts`) |
| Scan / Sign PDF | Null canvas blob (iOS memory) left the spinner turning forever | Shared `toBlob` helper |
| Teleprompter remote | Rejoin loop with no backoff; half-dead socket never noticed; messages dropped while reconnecting; double-tap opened two rooms | Backoff, heartbeat check, queueing, pairing guard (`src/lib/relay.ts`, `Teleprompter.tsx`) |
| Preview | Paging a PDF preview while it was replaced threw an unhandled rejection | try/catch in `step()` |
| Accessibility | Progress re-announced every percent; no progressbar role; 24–32 px touch targets | `role=progressbar`, hidden percent, 44 px on coarse pointers |
| Offline | A never-visited page offline showed the home page under the tool's URL | `/offline` and `/ms/offline`, noindex, out of the sitemap |
| Typecheck | 5 errors from the Deno edge function | `supabase/functions` excluded from tsconfig |

## Found, not fixed (needs a decision or more work)

- **AVIF in Chrome**: Convert image offers AVIF, but Chrome's canvas cannot encode it; users learn only after choosing a file. Options: hide AVIF where unsupported, or add a wasm encoder.
- **Repair PDF**: a download cut off before its object-stream index cannot be recovered (also by qpdf and pdf.js); the tool says so clearly. Salvaging page images would need a new strategy.
- **Phone first visit**: the install sheet opens over half the screen on the first visit; pixel butterflies overlap the home headline on a phone. Both go away with the rebrand.
- **Tablet landscape**: the home hero leaves the right ~40% empty. Covered by the rebrand.
- Older open items still stand: `share_target` / `file_handlers`, TWA `assetlinks.json`, a listened screen-reader pass.
