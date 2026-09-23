# Design Review: Tool Findability

Reviewed against: `.design/tool-findability/DESIGN_BRIEF.md`
Philosophy: "Precision Instrument", inherited from `.design/nhako-tools-rebuild/DESIGN_BRIEF.md`
Date: 2026-09-23

Two passes are combined here: the design critique, and a mobile pass. The mobile
skill is written for React Native and Flutter, so its list rendering, secure
storage and platform convention sections do not apply to a static Astro site.
Its touch sections do, and those are the ones measured below. Its audit script
reported 0 findings over 146 files, which is not a pass: it scans for native
patterns that this codebase does not contain.

Everything below was measured or observed in a browser against the production
build, not read off the source.

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `review-homepage-desktop-1280.png` | Desktop 1280x800 | Full catalogue, 43 tools in job groups, three columns |
| `review-homepage-tablet-768.png` | Tablet 768x1024 | Two columns, the breakpoint that exposed the grouping defect |
| `review-homepage-mobile-375.png` | Mobile 375x812 | Single column, scrollable nav |
| `review-homepage-dark-mode-desktop-1280.png` | Desktop, dark | Dark palette across the new rows |
| `review-category-pdf-desktop-1280.png` | Desktop 1280x800 | 18 tools, six job groups, preset chips |
| `review-category-pdf-tablet-768.png` | Tablet 768x1024 | Category page at tablet |
| `review-category-pdf-mobile-375.png` | Mobile 375x812 | Single column category page |
| `review-category-pdf-dark-mode-desktop-1280.png` | Desktop, dark | Category page, dark |
| `review-category-pdf-dark-mode-mobile-375.png` | Mobile, dark | The most common real-world combination |
| `review-category-image-crosslisted-desktop-1280.png` | Desktop | Cross-listed tools inline, indistinguishable |
| `review-category-media-flat-desktop-1280.png` | Desktop | Flat category, no headings, below the threshold |
| `review-category-calc-one-tool-desktop-1280.png` | Desktop | The one-tool category |
| `review-category-pdf-malay-desktop-1280.png` | Desktop | Malay group labels and intro |
| `review-collection-malaysia-desktop-1280.png` | Desktop | Curated collection with context lines |
| `review-collection-malaysia-mobile-375.png` | Mobile | Collection on a phone |
| `review-nav-touch-targets-mobile-375.png` | Mobile | Nav after the touch target fix |
| `review-row-hover-desktop-1280.png` | Desktop | Row hover state |
| `review-chip-focus-desktop-1280.png` | Desktop | Preset chip focus ring |
| `review-filter-active-desktop-1280.png` | Desktop | Filter applied, empty groups hidden |
| `review-filter-empty-state-desktop-1280.png` | Desktop | No results state |
| `review-palette-preset-results-desktop-1280.png` | Desktop | Palette resolving "500kb" |

> All screenshots are in `.design/tool-findability/screenshots/`.

## Summary

The structure holds up: a heading outline that a screen reader can walk, job
groups that read as jobs, and preset pages that are reachable for the first
time. The build had four real defects, three of them invisible at desktop width
and one invisible in dark mode. All four are fixed and re-verified. What remains
open is a single deliberate tension: the 11px blurb text that the "Precision
Instrument" type scale prescribes is below every mobile readability guideline,
and resolving it means changing a token, which this brief put out of scope.

## Must Fix

All four were found during this review and are now fixed.

1. **Group headings attached to the wrong group.** `src/views/HomeView.astro`.
   Measured at 768px: 14px of space above a heading and 5px below it, so every
   job label sat nearly three times closer to the group it did not belong to.
   This defeats the brief's first principle outright, since a heading that
   labels the wrong rows is worse than no heading. Invisible at 1280px, obvious
   at 768px. See `review-homepage-tablet-768.png`.
   *Fixed*: 24px above, 7px below, and the group's top rule now sits directly
   under the heading so it binds downwards. Re-measured at both widths.

2. **Half-length rules hanging under partial grid rows.** `ToolRow.astro`.
   In a two or three column grid, a group with an odd count left a bordered cell
   beside an empty one, drawing a rule that stopped halfway across the page and
   read as a rendering fault.
   *Fixed*: the compact form drops per-row borders and relies on the group rule
   and row padding. The wide form on category pages keeps its bordered table,
   which is where that density belongs.

3. **Category counts disagreed with the homepage.** `CategoryView.astro`.
   `/image` printed 14 beside its heading while the homepage printed 11 for the
   same category, because cross-listed rows were being counted as members. The
   five category pages would have summed to 46 against a real catalogue of 43.
   See `review-category-image-crosslisted-desktop-1280.png`.
   *Fixed*: the count reports the category's own tools. A regression test in
   `e2e/browse.spec.ts` asserts 14 rows and a count of 11 on the same page.

4. **Nav touch targets below the minimum.** `Nav.astro`, `Footer.astro`.
   Measured at 375px: category links 31px high with 4px between them, against a
   44px minimum and an 8px separation rule. This is the navigation the whole
   mobile fix was about, so shipping it under-sized would have undone the point.
   Footer links measured 15px.
   *Fixed*: 44px with 8px gaps on coarse pointers, verified at 44px on a
   simulated touch device and unchanged at 31px with a mouse, so desktop density
   is untouched.

## Should Fix

1. **Body text is 11px and 13px on mobile.** Measured in `main` at 375px: 53
   elements at 11px, 20 at 13px. Mobile guidance is 16px minimum for body text.
   The blurb under every tool name is the 11px one, and the restructure made
   those rows the primary browse surface, so this text now carries more of the
   work than it did as card subtitles. This is not a defect I introduced: it is
   `--text-2xs` and `--text-sm` from `tokens.css`, deliberate values described
   there as "body default in dense UI", and changing them is a token change that
   the brief explicitly puts out of scope. *Recommended fix, for your call: keep
   the desktop scale and raise only the row blurb and name at small widths, for
   example 13px and 15px below 640px. It touches one component rather than the
   token file, so the instrument density survives where there is room for it.*

2. **The active nav item does not scroll itself into view on a phone.** The row
   is scrollable and marked with `aria-current`, but landing on `/dev` shows PDF
   and Image with Developer off-screen to the right. Doing this properly needs
   either JavaScript, which the nav deliberately has none of, or reordering per
   page, which breaks the muscle memory of a fixed order. *Suggested fix: leave
   it, or accept a two-line inline script if you want it.* Recorded rather than
   silently accepted.

3. **Three header controls remain at 32px.** Search, language and theme, all
   pre-existing and outside this brief, but they now sit next to nav links that
   are 44px on touch, so the row is internally inconsistent. *Fix: the same
   `pointer-coarse:min-h-11` treatment, as a separate small change.*

## Could Improve

1. **The name column gap is wide for short names.** `sm:w-52` gives a 208px
   tabular column, so "Merge PDF" leaves roughly 150px of space before its
   blurb. It reads as a table, which is the intent, but `w-44` would tighten it
   without losing the alignment. See `review-category-pdf-desktop-1280.png`.

2. **Group labels render uppercase to assistive technology on category pages.**
   The AT-SPI tree reports "ORGANISE PAGES", because Chrome applies
   `text-transform` to the accessible name. Most screen readers handle this, and
   it matches the pre-existing category heading treatment, so it is noted rather
   than raised. The homepage `h3` labels are unaffected and read naturally.

3. **"All 43 tools" is easy to miss.** The only route from a category page back
   to the full catalogue is an 11px muted link under the last group.

4. **The homepage is 15% taller than before.** 2807px against 2430px at 1280px.
   The cost is the 15 job headings plus the spacing that makes them attach
   correctly, which is the structure that was asked for. Recorded in
   `TASKS.md` Build notes rather than treated as a regression.

## What Works Well

**The job groups do the job.** Six headings over 18 PDF tools is genuinely
faster to scan than 18 names, and the labels survived the test of being read
aloud: "Password and permissions" and "Convert and extract" need no explaining.

**Cross-listing is invisible, which is the point.** On `/image`, "PDF to JPG"
and "QR code generator" sit in their groups with no badge and no special
treatment, while their URLs never moved. Nobody has to learn the data model.

**Preset chips earn their place.** Five sizes under Compress PDF turn a group
that would have held one lonely row into the densest block on the page, and they
take the mono face, which is exactly right for a row of file sizes.

**The accessible names are correct where it matters most.** Verified through the
AT-SPI tree, not inferred: a chip announces "Compress PDF to 500 KB" while
showing "500 KB". That is the hard case, and it was handled.

**Dark mode needed no attention.** Every new surface uses semantic tokens only,
so the dark palette came out right first time with no new colour values and no
adjustment. Compare `review-category-pdf-desktop-1280.png` with its dark twin.

**The 0 KB JavaScript budget survived a structural change.** The homepage gained
group headings, a grid and filter logic for hiding empty groups, and still ships
no site JavaScript beyond the inline scripts and Vercel analytics.

## Verification

Run against the production build on 2026-09-23, not the dev server.

| Check | Result |
| --- | --- |
| `npm run lint` | clean |
| `npm run typecheck` | 0 errors, 164 files |
| `npm test` | 289 passed, 23 files |
| `npm run test:e2e:all` | 298 passed across Chromium and WebKit |
| `node scripts/sweep.mjs` | 29/29 tools |
| axe, via `e2e/a11y.spec.ts` | 6 new routes, light and dark |
| AT-SPI tree through Chrome | heading levels correct, chip names correct |
| Touch targets at 375px | nav 44px with 8px gaps, chips 44px, rows 52px |
| Touch targets at 1280px | nav 31px, chips 27px, rows 35px, density unchanged |

**The e2e suite is not deterministically green.** Across three full runs, one or
two tests failed each time and never the same ones: OCR and a search assertion
on WebKit in one run, the LibreOffice multi-file conversion on Chromium in
another. Each passes in isolation, so this is contention between the heavy
WebAssembly tests under four parallel workers, not a regression. The LibreOffice
case is already documented as hanging roughly 1 in 12 loads. `e2e/browse.spec.ts`
passed in every run, isolated and parallel.

## Not Verified

- Lighthouse.
- The deployed site. Everything here is a local production build.
- Orca's actual speech output. The AT-SPI tree is what Orca consumes, which is a
  stronger claim than axe, but it is not the same as listening to it.
- A native Malay speaker's review of the 15 group labels and 5 category intros.
- Real phone hardware. The touch measurements come from a simulated touch
  device with `hasTouch` and `isMobile` set, which is what triggers
  `pointer: coarse`, but it is not a thumb on glass.
