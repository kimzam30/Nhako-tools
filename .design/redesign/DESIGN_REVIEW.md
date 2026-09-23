# Design Review: Nhako Tools redesign

Reviewed against `.design/redesign/DESIGN_BRIEF.md` · 2026-09-23
34 screenshots in `.design/redesign/screenshots/`

## Summary

The redesign does what the brief set out to do. The measured defect is fixed and
verified, the tool page no longer reads as unfinished, and the 43 marks survive
the test that mattered: 20px, both themes, and greyscale.

What is worth saying plainly is that **the icon gate failed on its first
attempt**, which is the most useful thing that happened in the build. The
grammar was never the problem; the drawing density was. The three way Compress
rhyme separated on base alone from the first render, which was the grammar's
central claim and the hardest case in the set. Merge and Split were mush at 20px
because they each carried three sheets and a routed bus. Cutting the implied
output sheet and dropping the stroke from 1.75 to 1.5 fixed both.

Three findings remain open below. None is broken; one is a genuine weakness in
the mark set that no amount of redrawing fully solves.

---

## Screenshots captured

| Page | Desktop 1280 | Tablet 768 | Mobile 375 | Dark |
| --- | --- | --- | --- | --- |
| Homepage | yes | yes | yes | desktop + mobile |
| Category, PDF | yes | yes | yes | desktop + mobile |
| Category, Image | yes | yes | yes | |
| Tool, file (`/pdf/merge`) | yes | yes | yes | desktop + mobile |
| Tool, text (`/dev/json`) | yes | yes | yes | |
| Tool, app (`/image/passport-photo`) | yes | yes | yes | |
| Collection (`/malaysia`) | yes | yes | yes | |

States: `review-row-hover`, `review-chip-focus`,
`review-command-palette-open`, `review-filter-active`,
`review-filter-empty-state`, `review-tool-presets-desktop-1280`,
`review-marks-greyscale-desktop-1280`.

---

## Must fix

**None found.** What was checked: axe on 9 routes in both themes (0
violations), heading outline on `/` and `/pdf` (no level skips), CLS on three
pages (0), Lighthouse on three pages, keyboard operation of the palette, the
homepage filter with and without JavaScript, and every mark in greyscale.

---

## Should fix

**1. Protect PDF and Unlock PDF are the weakest pair in the mark set.** They sit
adjacent in the same `secure` group and differ by a single short stroke: the
shackle's right leg. At 20px in greyscale, which is the honest test, that
difference is close to the limit of what reads. See
`review-marks-greyscale-desktop-1280.png` and the `Password and permissions`
group in `review-category-pdf-tablet-768.png`.

This is not fixable by redrawing within the grammar, because open and closed
padlocks genuinely are the same object in two states, and that is also why the
convention is universally understood. *Options, for your call: accept it and let
the labels carry the distinction, which they do; or break the grammar for this
one pair by giving Unlock a different base treatment. I would accept it. The
labels are two words apart and the pair is conventional.*

**2. The homepage is 2960px at 1280, against a 2807px baseline.** 153px taller,
5.4%, and all of it is the raised type. The marks cost nothing: the 28px gutter
was paid for by tightening the name column from 13rem to 11rem, so the row is
actually 4px narrower than before and exactly as tall.

This was a deliberate trade under principle 2, legible before dense, and the
audit it bought was worth more than the 153px. Recorded rather than treated as a
regression, because a future reader will otherwise wonder.

**3. `--edge` does almost nothing in light mode.** At `rgb(19 19 22 / 0.06)` on
a `--sunken` surface of `#f4f4f6`, the machined inset hairline is close to
invisible; in dark mode at 5% white it reads clearly. Compare
`review-tool-file-desktop-1280.png` with its dark twin. The "machined, not
floating" principle is therefore carried mostly by the sunken surface and the
rule hierarchy in light mode, and by all three in dark. *Suggested fix: raise
the light value, or accept that light mode gets its depth from surface layering
alone. Worth deciding rather than leaving at a value that was guessed.*

---

## Could improve

**1. Compress image and Compress video are the second weakest pair.** Both are a
square frame with a small shape inside, separated by sun-and-ridge against a
play triangle, plus their hues. They are in different categories and never
adjacent, so this is much less pressing than Protect and Unlock.

**2. The result readout is three rows on every file tool.** `out`, `size`,
`time` is right for most, but a tool that emits several files (Split, batch
outputs) will want a count. Worth revisiting when the readout has been used in
anger.

**3. The mark is the same 20px on a phone as on a desktop.** On mobile the row
is the primary browse surface and a slightly larger mark might earn its space.
Measurable, and not guessed at here.

**4. The hero readout types out on load**, so a screenshot taken early catches
it part way. Not a defect, and it is the one piece of the site that already
looked like the instrumentation reference. Noted only because it makes the
homepage screenshots inconsistent with each other.

---

## What works well

**The result area at rest is the single biggest change.** `out --`, `size --`,
`time --` in mono, present from first paint, is what stopped `/pdf/merge` from
reading as an abandoned page. It says "ready, waiting for input" where a greyed
out button would have said "you cannot use this yet". See
`review-tool-file-desktop-1280.png`. It also holds CLS at 0 for free, because
the space was never going to change.

**The grammar pays off exactly where it was supposed to.** Compress PDF, Compress
image and Compress video share one operation and separate instantly on base.
That is the case that kills most hand drawn sets at this count, and the reason
the base-plus-operation rule exists rather than 43 freehand drawings.

**Cross-listing still needs no explaining.** On `/image`, PDF to JPG and JPG to
PDF now carry red page-shaped marks among green photo-shaped ones, which is
more informative than the old undifferentiated rows and still needs no badge.
See `review-category-image-desktop-1280.png`.

**The type change did the heavy lifting on its own.** The legible-text audit
passed from the token change alone, before a single component was touched, on
all 137 pages at once.

**Seven hardcoded pixel sizes were caught that nobody was looking for.** A
`text-[11px]` homepage group heading, `text-[10px]` in the palette and on a
SignPdf badge, and a `text-[9px]` in FilePreview. They only became visible
because the floor rule made them worth grepping for. Nothing in `src` is below
12px now.

**Fixing CLS properly found a real performance win.** Chasing 0.002 back to 0 led
to `font-display: swap` and the absence of any font preload. Preloading the two
latin subsets took CLS to 0 and moved `/pdf` from 97 to 99 and `/pdf/merge` from
95 to 97.

---

## Measurements

| Page | Perf | A11y | Best practices | SEO | Legible text | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 98 (was 98) | 100 | 96 (was 93) | 100 | PASS (was FAIL 44.34%) | 0 |
| `/pdf` | 99 (was 97) | 100 | 96 (was 93) | 100 | PASS (was FAIL 52.6%) | 0 |
| `/pdf/merge` | 99 (was 95) | 100 | 96 | 100 | PASS | 0 |

- Homepage external site JavaScript: **0 KB**, unchanged. 43 inline SVGs cost
  no JavaScript.
- `npm run lint` clean, `npm run typecheck` clean, **304 unit tests** pass
  across 23 files (was 289).
- **299 e2e pass, 0 fail, 3 skipped** across Chromium and WebKit against a
  production build. Notably no flakes: the suite normally loses one or two
  heavy WASM tests to contention under four workers.
- `tokens.test.ts` 30 tests (was 18), `registry.test.ts` 34 (was 31). New
  assertions mutation tested: restoring the 11px floor, lightening a category
  hue and deleting a mark each fail with a message naming the exact token.

## Revision after review: rows became cards

The review above was written against the row layout. Kim then asked for all
tools in a card style, which `ToolTile.astro` now provides on every browse
surface. The findings above survive the change except these:

- **Should fix 2 is now larger.** The homepage is 3363px at 1280 rather than
  2960px, and 5368px at 375. Against the pre-redesign baseline that is 19.8%
  taller on desktop and roughly 22% taller on a phone. Mobile is where this
  costs most, because a single column of cards is the longest possible form.
- **Should fix 3 is unchanged but more visible.** `--edge` now appears on 43
  cards rather than two panels, so its near-invisibility in light mode is a
  larger share of the page than it was.
- **Protect and Unlock (Should fix 1) are unaffected.** The marks are identical;
  only their container changed.

Re-verified after the change: filter contract intact, Lighthouse `/` 98/100/96/100
and `/pdf` 99/100/96/100, legible-text PASS, CLS 0, 304 unit tests, 299 e2e pass
with 0 failures across Chromium and WebKit, lint and typecheck clean. Card screenshots are not in `screenshots/`: that folder is the
row-layout review and is left intact as the record of what was reviewed.

## Not verified

- Nothing has been checked against the deployed site. Lighthouse ran against a
  local production build with the real COOP and COEP headers.
- Orca's actual speech output. The AT-SPI tree was not re-read after this round;
  axe passed on 9 routes in both themes, which is the weaker claim.
- Real phone hardware. Touch sizing was measured on a simulated coarse pointer.
- A native Malay speaker has not reviewed the six new island strings
  (`resultLabel`, `resultOut`, `resultSize`, `resultTime`, `resultChars`,
  `resultWaiting`).
