# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Malaysians first, world-ready (owner decision, 2026-11-22).

- **Primary:** students, job seekers and young workers in Malaysia doing a form-driven job on a deadline: shrink a scan under a portal's KB limit (SPA MyRésumé, university and scholarship portals), make a 35×50 mm passport photo, merge or convert a PDF for submission, work out take-home pay (EPF, SOCSO, EIS, PCB) or a CGPA. Often on a phone, sometimes on a shared or library computer, in English or Bahasa Melayu.
- **Equally served:** anyone worldwide who searches a generic job ("merge pdf", "compress image to 100kb", "heic to jpg") and lands on a tool page. The site must read as credible to them in the first second, next to iLovePDF, Smallpdf and PDF24.
- Smaller audiences: creators using the tablet teleprompter with a phone remote; developers using the dev utilities.

## Product Purpose

50 free tools for PDFs, images, media, calculators and code. Today every tool runs in the browser on the person's own device, with no upload step, so there is no queue, no size cap set by a server, and no account. Success is a person finishing their job in a few taps, trusting the result, and coming back or installing the app.

## Positioning

Free with no limits, no account and no ads, permanently (owner commitments). Competitors gate the same jobs behind hourly task caps, file-size caps, sign-ups, watermarks or upsells. Nhako Tools also speaks Malaysia's forms natively (Bahasa Melayu throughout, SPA MyRésumé photo preset, LHDN/KWSP/PERKESO salary maths, Malaysian university CGPA).

On-device processing is how the tools work today and the reason they are fast and private, but the owner did **not** make "never uploads" a permanent vow. State it as current fact ("runs on your device"), never as a forever promise.

## Operating Context

- Arrives from Google, from nhako.com, or from social posts, usually straight onto one tool page or a size preset page (e.g. /pdf/compress/500kb).
- Phones dominate (Samsung devices with Samsung Internet or Chrome are common); tablets for the teleprompter; desktops for heavy jobs (video, Office to PDF).
- Heavy engines (ffmpeg.wasm, LibreOffice wasm, Tesseract, Whisper, ONNX) download once on first use and are cached; tools work offline after one visit.
- Installable PWA; an Android TWA app is planned (com.nhako.tools).

## Capabilities and Constraints

- 49 registered tools across PDF, Image, Media, Calculators and Developer, plus size-preset pages; full English at `/` and Malay at `/ms`.
- Astro 5 static site + Preact islands on Vercel; cross-origin isolated (COOP/COEP) for the wasm engines; no backend processing. Supabase is used only for the teleprompter remote relay and feedback.
- Favourites, command palette search (EN/MS synonyms), light/dark themes, reduced-motion support.
- Some engines are desktop-class (LibreOffice ~77 MB, needs ~1 GB RAM); phones get honest limits.
- Undecided: future monetisation beyond tips (no paid tier committed; Buy Me a Coffee may be replaced).

## Brand Commitments

- **Name:** "Nhako Tools" at tools.nhako.com, part of the wider Nhako brand.
- **Hammer mascot:** the red pixel-art hammer with a face (favicon, app icons, `docs/brand/`). Keep.
- **Butterflies:** the key motif across all Nhako branding. Keep butterflies, but the current "drifting pixel butterflies behind the page" treatment is open to reinvention.
- **Colour (owner decision, 2026-11-22):** magenta is the main brand accent, and every tool group has its own colour identity (PDF, Image, Media, Calculators, Developer, Malaysia), used consistently wherever that group appears.
- **Look (owner decision, 2026-11-22):** professional, clean, easy to understand and navigate, with super-app familiarity (category tiles, a bottom tab bar on phones) over expressive or retro treatments.
- Everything else (type, layout details, NeraOS boot-bar loader, petals, coffee placement) is free to replace in the rebrand.
- Voice today: plain, honest, specific ("Saying what a tool cannot do"), no hype; every tool page lists its real limits.

## Evidence on Hand

- Real product captures: `docs/images/` (phone home, compress result, salary, dark mode), launch film and posters in `launch/`.
- Measured performance: Lighthouse 95–98 performance, 100 accessibility and SEO (2026-09-23, `.design/redesign/DESIGN_BRIEF.md`).
- E2E evidence: human-path suite on real files and real devices (Galaxy Z Flip5, Galaxy Tab S9 FE), `e2e/human.spec.ts`.
- **No** testimonials, user counts, press quotes or reviews exist. Do not invent any.

## Product Principles

1. **Finish the job in a few taps.** The drop zone, the one primary action and the saved result are the product; everything else waits its turn.
2. **Say what is true, including limits.** Exact sizes, honest failures ("could not reach 20 KB"), no fake progress, no fabricated proof.
3. **Free means free.** No caps, accounts, ads or nags, so nothing in the design may imply a catch.
4. **Malaysian by default, credible to the world.** Local jobs and BM are first-class, never a translated afterthought, and the global searcher still feels at home.
5. **Fast and light on a mid-range phone.** Decoration never costs a heavy job its memory or a first visit its speed.

## Accessibility & Inclusion

WCAG 2.2 AA (axe-checked in CI), 44 px touch targets, 16 px minimum body text on phones, full keyboard use, reduced-motion respected, bilingual EN/BM with correct `lang`.
