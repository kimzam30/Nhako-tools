# Working in parallel: who does what, and in which files

Written 2026-11-22 by the main session. Three Claude sessions work on Nhako Tools at once; this file keeps them from colliding. Read it before touching code, and update your own row when your plan changes.

## The sessions

| Session | Owns | Source of its plan |
|---|---|---|
| **Main** (E2E, audit fixes, rebrand, integration) | Testing on desktop and the real devices, merges and deploys, the Dompet rebrand | `docs/qa/2026-11-22-e2e-and-audit.md`, `.impeccable/surfaces/src-views-homeview-astro.md` |
| **SEO** ("Get tools.nhako.com indexed on Google") | Search Console, Bing, sitemap, off-site checklist, repo About/README | `docs/seo-offsite-checklist.md` |
| **Growth** ("Rival research") | New tool pages, payroll, task events, model licences | `/mnt/d/Work/reports/Nhako build plan.md` |

## Ground rules

1. **Base commit first.** The main session commits its audit fixes and tests to `main` (the "QA base"). Nobody starts code before that commit exists; `src/tools/run-tool.ts` and `FileToolRunner.tsx` are changed in it.
2. **One worktree and branch per session**, cut from the QA base: `git worktree add ../Nhako-tools-<name> -b <branch> main`. Nobody edits `/mnt/d/Work/Nhako-tools` itself except the main session; it serves the preview build that device tests run against.
3. **Stay inside your files** (table below). Need a file someone else owns? Message that session first and agree who edits it.
4. **Each branch ends in a PR** to `main` with `npm run typecheck && npm test` green and the specs it touches passing.
5. **The main session merges and deploys.** Before each merge it runs `npx playwright test --project=chromium` plus the real-device suite (`scripts/device-e2e.sh`) against the merged build, and it pushes only with the owner's OK.
6. **Merge order:** QA base, then SEO, then Growth batches as they finish, then the rebrand (largest, rebased last).

## File ownership

| Area | Owner | Files |
|---|---|---|
| Look and layout | Main (rebrand) | `src/styles/*`, `src/components/astro/*`, `src/layouts/BaseLayout.astro` (except the `<head>` meta block), `src/views/*` markup and classes, `src/components/react/*` classes, new `src/tools/groups-colors.ts` |
| Tool runner behaviour | Main | `src/components/react/FileToolRunner.tsx`, `OptionsPanel.tsx`, `ResultBar.tsx`, `src/lib/errors.ts`, `memory.ts`, `relay.ts`, `ffmpeg.ts`, `libreoffice.ts` |
| Tests and harness | Main | `e2e/*`, `playwright.config.ts`, `scripts/device-e2e.sh`, `scripts/fetch-real-fixtures.mjs` |
| Search and crawling | SEO | `astro.config.mjs` (sitemap, `<lastmod>`), `public/robots.txt`, `<head>` meta tags in `BaseLayout.astro`, `README.md`, `docs/seo-*` |
| Tool content and new pages | Growth | `src/tools/registry.ts`, `src/i18n/tools.ts`, `src/tools/calc/*`, `src/tools/image/remove-background.ts`, `src/tools/image/segment.ts` |
| Task events | Growth | new `src/lib/events.ts`, `supabase/*`, one call site in `src/tools/run-tool.ts` (after the QA base), privacy copy |
| Shared, ask first | whoever needs it | `src/i18n/ui.ts`, `src/views/ToolView.astro` (SEO: JSON-LD block; Growth: copy; Main: layout), `package.json` |

## What each session does next

**Main**
1. Rerun the failed device tests on the new build; land the QA base commit (owner OK before pushing).
2. Build the Dompet rebrand on branch `rebrand-dompet` in its own worktree: tokens and group colours, header and phone tab bar, home, category pages, tool page.
3. Integrate and test every PR on desktop and on the Flip5 and Tab S9 FE.

**SEO** (Phase 0 of the build plan, items 0.1, 0.3, 0.5, 0.6)
1. Commit its pending `docs/seo-offsite-checklist.md` edit on its branch.
2. Accurate `<lastmod>` in the sitemap (0.3).
3. GitHub About text and README corrections (0.5); off-site listings drafted for the owner (0.1, 0.2).
4. Day-0 baseline in GSC, Bing and PageSpeed (0.6); request indexing in small daily batches.

**Growth** (items 1.1, 1.2, 1.3, 1.4, then 0.4)
1. Model licence audit (1.1), then the remove.bg-alternative copy (1.2): registry and i18n only.
2. Government-portal presets as registry `variants` (1.3), in two batches; the main session adds each new preset to `e2e/human.spec.ts`.
3. Payroll foreign-worker mode and split pages (1.4) in `src/tools/calc/*` with unit tests.
4. Task events (0.4) after the QA base: `events.ts` plus a single hook in `run-tool.ts`; no edits to `FileToolRunner.tsx`.

## Hand-offs

- Growth adds a tool or preset: tell Main the URL and what a correct output looks like, so it joins the real-file suite.
- Rebrand changes a component's visible text or labels: Main updates the specs in the same branch.
- SEO needs a layout or content change for search: message the owner of that file instead of editing it.
