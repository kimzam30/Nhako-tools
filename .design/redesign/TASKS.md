# Build Tasks: Nhako Tools redesign

Generated from: `.design/redesign/DESIGN_BRIEF.md`
Structure from: `.design/redesign/INFORMATION_ARCHITECTURE.md`
Tokens: `src/styles/tokens.css` (see `.design/redesign/DESIGN_TOKENS.md`)
Date: 2026-09-23

Philosophy: **"Precision Instrument"**, amendment 2. Finish reads as machining,
never as elevation. The first build task establishes that or disproves it.

---

## Already done, Phase 4

Recorded so the checklist is honest about where things stand.

- [x] **Category hues**: five, both themes, solved to 4.5:1 on three surfaces.
- [x] **Type ramp raised**: floor 11px to 12px, body 13px to 14px, no step below
      12px. Fixed the legible-text audit on `/` and `/pdf` on its own.
- [x] **`--border-weak`, `--edge`, `--shadow-overlay`, mark geometry**: defined
      and asserted. **Used nowhere yet.** That is tasks 5 and 11.
- [x] **Contrast and ramp assertions**: `tokens.test.ts` 18 tests to 30,
      mutation tested.

---

## Foundation

- [x] **1. The hard marks, and the decision gate.** Build `ToolIcon.astro` and
      draw only the **8 hardest marks**: Compress PDF, Compress image, Compress
      video (the three way rhyme), Merge and Split PDF (inverses), Protect and
      Unlock PDF (inverses), and Image to text against OCR PDF. Render them at
      20px, side by side, in both themes and in greyscale.
      **This is a gate, not a task.** If those eight do not separate at 20px,
      the base-plus-operation grammar is wrong and it is cheaper to find out now
      than after 35 more drawings. Stop and report rather than pressing on.
      _New component. Reuses `--mark-size`, `--mark-gutter`, `--cat-*`._
      _Risk first: this is the single most uncertain thing in the redesign._

- [x] **2. The remaining 35 marks.** Draw them from the table in
      `INFORMATION_ARCHITECTURE.md` section 2. One base, one operation, 24 unit
      grid, 1.75 stroke, butt caps, miter joins. Add a `registry.test.ts`
      assertion that **every tool in the registry has a mark**, so a new tool
      without one fails the build rather than rendering a blank gutter.
      _Depends on: task 1 passing its gate._

---

## Core UI

- [x] **3. `ToolRow` with a mark gutter.** Both forms. 28px gutter, mark at
      20px, optically centred. Tighten the name column from `sm:w-52` to
      `sm:w-44`, which pays for the gutter and closes a "Could Improve" item
      from the last review. **Done looks like:** the row is no taller and 4px
      narrower than it is today, and `data-tool-card`, `data-name`,
      `data-keywords` and `data-category` are untouched.
      _Modifies `ToolRow.astro`. Depends on: task 1._

- [x] **4. Blurbs come off the ramp floor.** Tool blurbs still use the bottom
      step, which is now reserved for counts and calibration. Move them to the
      body step across `ToolRow`, `ToolView` related cards and `OptionsPanel`
      help text. **Done looks like:** the legible-text audit still passes and no
      prose anywhere on the site sits on `--text-2xs`.
      _Modifies `ToolRow.astro`, `ToolView.astro`, `OptionsPanel.tsx`._

- [x] **5. Rule hierarchy on browse pages.** Put `--border-weak` on row rules
      and keep `--border` for group and section boundaries, so a row no longer
      carries the same weight as a section. Add the category hue as a thin rule
      under the category heading. **Done looks like:** at 768px the group
      structure is legible without reading a word.
      _Modifies `CategoryView.astro`, `HomeView.astro`, `ToolRow.astro`._

- [x] **6. Hero emphasis swap.** "Nothing uploads. Nothing waits." becomes the
      full strength line; "43 tools that run in your browser" drops to muted.
      One change in `HomeView.astro:41-43`, and it finally makes the page say
      what the brief says.
      _Modifies `HomeView.astro`._

- [x] **7. Tool page in two columns.** Primary column carries breadcrumb, h1,
      blurb, the tool, options, result and the privacy line. Secondary carries
      What this does, Limits, Sources, Presets and Related tools. Widen from
      `max-w-3xl`. **The 7 app tools keep one wide column with prose below.**
      _Modifies `ToolView.astro`. Affects 36 of 43 tools._

- [x] **8. The result readout at rest.** The centrepiece. A labelled result
      region present from first paint showing `out --`, `size --`, `time --` in
      mono, filling in place when a file lands. **Done looks like: a gauge at
      zero, not a disabled form.** No spinner, no skeleton shimmer, no
      placeholder text pretending to be content. Text tools show `chars` rather
      than `size`. **Verify CLS stays 0.**
      _Modifies `FileToolRunner.tsx` and `TextToolPane.tsx`. Pattern source is
      `HeroReadout.astro`, which already does exactly this._

---

## Interactions and states

- [x] **9. Row states.** Default, hover, focus-visible, active. The mark takes
      the accent with the name so the row responds as one object, and the
      category hue yields to the accent on hover. **Done looks like:** hovering
      anywhere on the row moves mark and name together.
      _Modifies `ToolRow.astro`. Depends on: task 3._

- [x] **10. Result readout states.** At rest, running, complete with elapsed
      time in mono, and error with an actionable message. The 10 heavy tools
      keep their real progress bar; nothing else gains one, because a bar on a
      400ms task makes it feel slower. **Nothing on the critical path moves.**
      _Modifies `FileToolRunner.tsx`, `TextToolPane.tsx`. Depends on: task 8._

- [x] **11. The machined finish pass.** `--edge` as an inset hairline on
      recessed surfaces, starting with the drop zone and the result region.
      `--shadow-overlay` on the command palette **and nowhere else**. This is
      where "it looks like styling was never applied" is actually answered, and
      where the temptation to add a drop shadow has to be refused.
      _Modifies `FileToolRunner.tsx`, `CommandPalette.astro`, `ToolView.astro`._

---

## Responsive and polish

- [x] **12. Tool page stacking.** Below the two column breakpoint the columns
      stack **primary first**, so the tool is still the first thing on the page.
      Breakpoints: verify at 375, 768 and 1280.
      _Depends on: task 7._

- [x] **13. Header controls to 44px on coarse pointers.** Search, language and
      theme are still 32px beside nav links that are already 44px. Same
      `pointer-coarse:min-h-11` treatment. Closes a "Should Fix" item carried
      over from the last review.
      _Modifies `Nav.astro`._

- [x] **14. Accessibility pass.** Marks are `aria-hidden` and rows announce as
      one link. Heading outline still walks h1, h2, h3 with no skips. axe on
      every changed route in **both themes**. AT-SPI tree read, because axe
      green is the weaker claim. **And a greyscale render of the homepage and
      one category page**, to prove the isoluminant hues carry no information
      that the shapes do not.

- [x] **15. Re-measure against the Phase 2 baseline.** Lighthouse on `/`,
      `/pdf` and `/pdf/merge`. Full e2e on Chromium **and WebKit**. Unit suite.
      Homepage height at 1280 against the 2807px baseline, and homepage external
      JavaScript still 0 KB. Record results in Build notes below.

---

## Review

- [x] **16. Design review.** Run `/design-review` against
      `.design/redesign/DESIGN_BRIEF.md`.

---

## Build notes

Record what actually happened here, especially anything that contradicts the
plan. The previous two rounds both found that the useful information was in this
section rather than in the checklist.

### Standing constraints, do not break

- **No tool URL changes.** 13 redirects already spent the old search equity.
- **Homepage ships 0 KB of external site JavaScript.** Marks are markup.
- **CLS stays 0.** Everything reserves its space up front.
- **No drop shadows** except `--shadow-overlay` on the command palette.
- **Colour is redundant encoding.** Anything that fails in greyscale is wrong.
- **Zero em dashes**, repo wide, including code comments and these documents.
- **No git actions** unless asked.

### What happened, 2026-09-23

**Task 1 failed its gate on the first attempt, and that was the point.** The
first nine marks were drawn with a 1.75 stroke and merge/split carried three
sheets plus an orthogonally routed bus. At 64px they were legible; at 20px,
which is the actual use, merge and split were mush. The grammar was not the
problem: the three way Compress rhyme separated cleanly on base alone, which is
the set's hardest case and the grammar's central claim. Two fixes, and the gate
passed on the second render:

- stroke 1.75 to 1.5
- merge and split stopped drawing their output sheet and let the arrow imply it,
  which halved the element count

**Two more marks were redrawn after seeing all 43 together.** Sign PDF began its
signature stroke outside the sheet and read as a detached hook. Organize PDF was
three plain rectangles and read as a bar chart, so the middle sheet gained a
folded corner.

**Seven hardcoded pixel type sizes were bypassing the ramp**, found only because
the floor rule made them worth looking for: a `text-[11px]` group heading on the
homepage, `text-[10px]` in the palette and on a SignPdf badge, `text-[11px]` on
the language toggle, and a `text-[9px]` in FilePreview. All now use the floor
token. Nothing in `src` is below 12px any more.

**CLS regressed from 0 to 0.002 and was fixed properly.** The cause was
`font-display: swap` from @fontsource: with the old 11px/13px ramp the
fallback-to-webfont swap moved text too little to register, and raising the ramp
pushed it over Lighthouse's floor. Confirmed by blocking the woff2 requests,
which took CLS to exactly 0. Fixed by preloading the two latin subsets the site
actually paints with, which also improved performance.

**The homepage is 2960px at 1280, against the 2807px baseline.** 153px taller, or
5.4%, and all of it is the larger type. The marks cost nothing: the 28px gutter
was paid for by tightening the name column from 13rem to 11rem.

### Final measurements

| Page | Perf | A11y | Best practices | SEO | Legible text | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 98 (was 98) | 100 | 96 (was 93) | 100 | PASS (was FAIL 44.34%) | 0 |
| `/pdf` | 99 (was 97) | 100 | 96 (was 93) | 100 | PASS (was FAIL 52.6%) | 0 |
| `/pdf/merge` | 97 (was 95) | 100 | 96 | 100 | PASS | 0 |

- Homepage external site JavaScript: **0 KB**. The only `src=` script is Vercel
  analytics, exactly as before. 43 inline SVGs cost no JavaScript.
- axe: **9 routes x 2 themes, 0 violations**.
- e2e: **299 passed, 0 failed, 3 skipped** across Chromium and WebKit against a
  production build, in 2.9 minutes. No flakes in this run, which is unusual:
  the suite normally loses one or two heavy WASM tests to contention.
- Heading outline: no skips on `/` or `/pdf`.
- Marks verified in greyscale: the shapes carry the meaning without hue.

### Revision, 2026-09-23: rows became cards

After the build was verified, Kim asked for all tools in a card style. This
reverses the browse layer's September decision, and the reversal is defensible
only because the 43 marks now exist: the row's argument was that a card shows
six tools per screen where a row shows fourteen, and that was written before a
mark was doing the scanning.

- `ToolTile.astro` is new and replaces `ToolRow.astro` across the homepage, all
  10 category pages and `/malaysia`. Compact card, mark in the leading gutter,
  presets inside, no shadow.
- **Cards stretch to equal height per grid row.** The first render used
  `items-start` and looked ragged, a one-line card sitting short beside a
  two-line neighbour. That is the failure mode of a card grid.
- `ToolRow.astro` and `ToolCard.astro` are both deleted. That background task
  landed, and its premise had gone stale: it was written to remove `ToolCard`
  and reword a comment in `ToolRow`, but `ToolRow` had itself become dead in
  the meantime, so both went. `src/components/astro/` is now 8 files.

Verified after the change: filter contract intact (43 cards, "rotate" leaves 3
with 13 groups and 3 sections hidden, "zzzzz" shows the no-match message,
clearing restores 43, `?q=` deep link works), Lighthouse `/` 98/100/96/100 and
`/pdf` 99/100/96/100, legible-text PASS, CLS 0, 304 unit tests, lint and
typecheck clean.

**Cost:** homepage 2960px to 3363px at 1280 (+13.6%), and ~4400px to 5368px at
375 (+22%). Against the pre-redesign 2807px baseline the homepage is 19.8%
taller at 1280. This was the known trade when cards were chosen.

### Known open before this started

- WebKit e2e not yet run against the Phase 4 token change (running now).
- The e2e suite is not deterministically green: one or two heavy WASM tests fail
  per full run and never the same ones. Contention under four workers, not a
  regression. Judge a failure by whether it passes in isolation.
- Nothing has ever been verified against the deployed site.
- `README.md` still says 36 tools. The real count is 43.
