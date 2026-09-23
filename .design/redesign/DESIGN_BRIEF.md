# Design Brief: Nhako Tools redesign

Feature slug: `redesign` · Started 2026-09-23 · Baseline measured the same day

## 0. How this brief relates to the others

`SITE_ANATOMY.md`, beside this file, describes the site as it stands: 43 tools,
137 pages, every number read from source or measured. **This brief does not
repeat it.** Read the anatomy for what exists, its section 13 for what is
load-bearing, and this document for what changes and why.

Two earlier briefs still govern and are not overturned here:
`.design/nhako-tools-rebuild/DESIGN_BRIEF.md` holds the positioning and the
"Precision Instrument" philosophy; `.design/tool-findability/DESIGN_BRIEF.md`
holds the reasoning behind the browse layer. This brief is an amendment to the
first and builds on the second.

---

## 1. Problem

Someone searches "merge pdf online", picks the fourth result, and lands on
`/pdf/merge`. What they see is a dashed rectangle floating in a 768px column,
two lines of grey text inside it, and nothing else above the fold. In about a
second they have to decide whether this is a real product or an abandoned one,
and they are about to hand it a file.

The page is not broken. It is unfinished, and unfinished reads as untrustworthy
in a category where the competition looks expensive.

The second friction is the catalogue. Someone who does not arrive knowing the
tool's name gets 43 rows of 11px grey text with nothing to aim at. Every row
looks like every other row, so finding the right one is reading rather than
recognising, and reading 43 blurbs is work.

Neither problem is speed. The site is fast and now has the numbers to prove it.
The problem is that it does not look like it was finished by someone who cared,
and the person deciding whether to trust it has nothing else to go on.

## 2. Measured baseline, 2026-09-23

Lighthouse 12, against a production build served with the real COOP and COEP
headers. This closes an item that had been open since the motion round.

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 98 | 100 | 93 | 100 | 2.1s | 0 |
| `/pdf` | 97 | 100 | 93 | 100 | 2.3s | 0 |
| `/pdf/merge` | 95 | 100 | 96 | 100 | 2.7s | 0 |

The rebuild brief's success table (Performance at least 95, Accessibility 100,
SEO 100) is **met and verified**. CLS is 0 everywhere, so the "everything
reserves its space" rule is holding.

**The one real failure: the homepage scores 44.34% legible text.** 47.8% of its
text is 11px and a further 3.9% is below 12px. `/pdf` fails identically. The
tool-findability review recorded this as a deliberate tension that was out of
scope because it meant changing a token. Tokens are in scope now, and this is
failing on the two surfaces the redesign is about to build on.

The remaining best-practices deduction is a console error from Vercel analytics
404ing outside production. It is a local preview artifact, not a defect.

### Why the site currently looks unfinished, mechanically

Three facts, read from source rather than felt:

1. **There is no elevation system.** `tokens.css` defines radii, easings and
   durations. It defines nothing for shadow. Every surface on the site is a flat
   fill inside a 1px border.
2. **Almost everything is small.** 80 uses of the 11px token, 129 of 13px, 10 of
   15px. There is very little type on the site above 13px that is not a heading.
3. **Border weight never varies.** One `--border` and one `--border-strong`,
   used at 1px, carry every separation on every page.

A flat fill, a hairline, and 11px grey text is what an unstyled prototype looks
like. The bones are right, which is why this is a finish problem and not a
concept problem.

---

## 3. Solution

Finish the instrument.

The tool page stops being a box in a void: the result area exists, labelled and
empty, from first paint, so the page is complete before anything is dropped and
the person can see what they are about to get. The prose moves beside the tool
instead of below it, and the column widens to match.

The catalogue gets 43 hand-drawn marks, one per tool, so finding a tool becomes
recognising a shape rather than reading a blurb. Five category hues carry those
marks, warming the page without turning it into a grid of coloured tiles.

And the type gets a legible floor, so the density that makes this an instrument
stops being the thing that makes it hard to read.

None of this adds a kilobyte of JavaScript. The icons are markup, the colour is
tokens, and the homepage keeps its 0 KB budget.

---

## 4. Experience principles

Three, each resolving a real tension in this project.

1. **Machined, not floating.** *Resolves: it looks unfinished, against a
   philosophy that rejects decoration.* Depth comes from the surface layers that
   already exist, from varied and deliberate rule weights, and from inset
   hairlines. It never comes from a drop shadow. An instrument has milled edges
   and printed calibration, not elements hovering over a page. The single
   exception is the command palette, which genuinely does float.

2. **Legible before dense.** *Resolves: instrument density, against 44% legible
   text.* Density is a reward for readability, not a substitute for it. A blurb
   and a row count are not the same kind of text and stop sharing a token. Where
   density and legibility conflict, legibility wins and the density is recovered
   somewhere that costs nothing, such as horizontal space.

3. **The mark is a second reading of the name, not an ornament.** *Resolves: 43
   bespoke icons, against "no decoration".* Every icon must be derivable from
   what the tool does to what it acts on. If a mark cannot be explained in four
   words it is wrong and gets redrawn. Icons earn their place by making the
   catalogue scannable, and they appear only where scanning happens.

---

## 5. Aesthetic direction

- **Philosophy**: "Precision Instrument", unchanged, with a second amendment
  recorded below. Dense, sharp radii, fast flat easing, numbers always mono.
- **Tone**: calm, exact, quietly confident. It should feel like equipment that
  has been calibrated, not like software that wants to be liked.
- **Reference points**: engineering instrumentation (oscilloscope panels, Figma
  dev mode, Grafana): readouts, mono numerals, calibration marks, honest data
  shown plainly. And precise illustration (Things, macOS system glyphs) as the
  bar for the icon set specifically: 43 marks that hold up at 20px.
- **Anti-references**: filled colour icon tiles in the iLovePDF and Smallpdf
  manner, which would make the site resemble the products it defined itself
  against. Soft consumer SaaS: `rounded-3xl`, gradient blobs, pill buttons, glow
  shadows, bounce easing. Anything that floats.

### Amendment 2 to the philosophy, 2026-09-23

The rebuild brief's amendment permitted motion that reads "as machinery working,
never as decoration". This amendment extends the same test to surface and mark:

> Finish must read as **machining**, never as elevation. Layered surfaces,
> varied rule weights and printed calibration are in. Drop shadows, glows and
> floating cards are out, other than for genuine overlays.

The hero readout is the one place the site already does this, and nothing else
follows through. That is the gap this redesign closes.

---

## 6. The icon system

43 bespoke marks, one per tool. Drawn, not imported: the repo has no icon
dependency today and gains none.

### The grammar

Every mark is **a base object with an operation applied to it**. Nothing is
drawn freehand, so no choice is arbitrary and a 44th tool draws itself.

| Bases | Operations |
| --- | --- |
| page, photo, waveform, braces, receipt, frame | converge, diverge, arc, inward arrows, outward arrows, diagonal cut, overlay, grid, lock, scan line |

This is what makes 43 marks survive at this count. The catalogue contains eight
or so rhyming pairs, and the grammar separates every one of them:

| Pair | How they separate |
| --- | --- |
| Merge PDF / Split PDF | two pages converging against one page diverging: inverses, which read as inverses |
| Compress PDF / Compress image / Compress video | one operation (inward arrows) on three different bases: page, photo, waveform |
| Rotate PDF / Rotate image | same arc, page against photo |
| Crop PDF / Crop image | same frame, page against photo |
| Watermark PDF / Watermark image | same overlay, page against photo |
| Protect PDF / Unlock PDF | the same lock, closed against open |
| PDF to JPG / JPG to PDF | the same two bases, arrow reversed |
| OCR PDF / Image to text | scan line over page against over photo |

The base carries the category, which the category hue then reinforces. Someone
scanning `/image` sees photo bases throughout and the two cross-listed PDF tools
read correctly as page-shaped visitors, without needing a badge.

### Where they appear

**Catalogue rows only**: the homepage's 43 rows and the rows on all 10 category
pages, plus `/malaysia` which shares the row primitive.

Deliberately excluded, each for a reason: the tool page header (the tool page is
fixed by layout and finish, and a large decorative mark above an h1 is the soft
SaaS move), the command palette (its index is serialised as JSON, so marks there
would mean putting markup in a data structure), the related-tool cards, the
footer, and the six OG images.

### Cost

Roughly 3 KB gzipped of additional HTML on the catalogue pages, and zero
JavaScript. The 0 KB homepage budget is a non-negotiable and survives untouched,
because an inline SVG is markup.

---

## 7. Colour

Five category hues, added to `tokens.css` as semantic tokens with light and dark
values, each asserted by `tokens.test.ts` exactly as the existing pairs are.

They appear in **two places only**: the tool mark, and a thin rule or marker
tied to the category. They are never a filled tile, never a background wash,
never text colour on a large area.

`#FF91E7` remains the brand accent and remains the only interactive colour.
A category hue identifies; the accent acts. Those two jobs do not merge, because
the moment a category hue becomes clickable-looking the site has five accents
and no accent.

The hues must be distinguishable from each other and from the pink at 20px, and
must pass AA against both `--bg` and `--surface` in both themes. Any hue that
cannot do both gets reselected rather than excused.

---

## 8. Type

The floor rises. `--text-2xs` at 11px currently carries both a tool blurb and a
row count, which are not the same kind of text and should never have shared a
token.

- **Blurbs, row names and body prose** move to a legible floor of 13px minimum,
  and the ramp shifts to sit on it.
- **Counts, micro-labels and calibration text** keep a genuinely small size,
  because a tabular numeral beside a heading is not body text and Lighthouse's
  audit is not aimed at it.
- The change is made in `tokens.css`, so it lands on all 137 pages at once
  rather than one component at a time.

Numbers stay mono everywhere. That rule is described in `tokens.css` as the most
load-bearing detail in the philosophy and this brief agrees.

**Target: the homepage and every category page pass Lighthouse's legible-text
audit**, and the instrument density survives at desktop width.

---

## 9. Existing patterns

What the redesign extends rather than replaces.

- **Typography**: Instrument Sans Variable for prose, JetBrains Mono Variable
  for numerals and readouts, both self-hosted. Nine-step ramp from 11px to 48px.
  Body line height 1.55, headings 600 weight at `-0.02em`. The families stay;
  the ramp's lower end moves.
- **Colour**: `--pink-50` through `--pink-900` with hue locked to 313.1deg, plus
  neutrals `--gray-0` to `--gray-950` and `--ink`. Components use semantic
  tokens only (`--bg`, `--surface`, `--sunken`, `--border`, `--border-strong`,
  `--text`, `--text-muted`, `--accent`). That discipline is why dark mode came
  out right first time in the last review, and every new token follows it.
- **Spacing**: Tailwind v4 defaults, no custom scale. Theme lives in `@theme
  inline` in `tokens.css`; there is no `tailwind.config.js`.
- **Radius**: 4, 6 default, 8, 12, full. Never 24.
- **Motion**: two easings, two durations (120ms and 180ms), no overshoot, all in
  `motion.css`. Nothing on a tool page's critical path moves. Unchanged.
- **Components**: `ToolRow.astro` is the directory primitive in wide and compact
  forms and is the correct place for the icon. `FileToolRunner.tsx` and
  `TextToolPane.tsx` serve 36 of the 43 tools between them, so fixing those two
  fixes most of the site. `OptionsPanel.tsx` renders all five option kinds.

---

## 10. Component inventory

| Component | Status | Notes |
| --- | --- | --- |
| `ToolIcon.astro` | New | Renders one of 43 marks from a tool id. Inline SVG, category hue via `currentColor`, no runtime |
| The 43 marks | New | Drawn on one grid at one stroke weight, built from the base + operation grammar |
| `tokens.css` | Modify | Raised type floor, five category hues, varied rule weights, contrast tests for each new pair |
| `ToolTile.astro` | New | Replaced `ToolRow.astro` on 2026-09-23. Card with the mark in a leading gutter, presets inside, equal height per grid row. `data-tool-card`, `data-name`, `data-keywords` and `data-category` are the filter contract and must not change |
| `ToolView.astro` | Modify | Two columns for file and text tools, widened from `max-w-3xl`. The 7 app tools keep one wide column |
| `FileToolRunner.tsx` | Modify | Result area reserved and labelled from first paint, for all 27 file tools |
| `TextToolPane.tsx` | Modify | Same reserved-output treatment, 9 text and text2 tools |
| `HomeView.astro` | Modify | Hero emphasis swaps so the speed line is full strength; row and group spacing retuned around the icons |
| `CategoryView.astro` | Modify | Card grid, 3 up at `lg`; category hue rule under the heading |
| `CollectionView.astro` | Modify | Card grid; the context line replaces the blurb |
| `OptionsPanel.tsx` | Modify | Type floor, and finish on the five option kinds |
| `Nav.astro`, `Footer.astro` | Modify | The three 32px header controls go to 44px on coarse pointers, closing a review item |
| `CommandPalette.astro` | Unchanged | No icons. Behaviour is correct and hard won |
| `HeroReadout.astro` | Unchanged | Already the reference for the whole direction |
| `ToolCard.astro` | Deleted | Dead since the browse-layer restructure. Not revived by the card change: `ToolTile.astro` is a new component |
| `ToolRow.astro` | Deleted | Superseded by `ToolTile.astro` |

---

## 11. Key interactions

- **Landing on a tool page.** The result area is present, labelled and empty
  before anything happens. Dropping a file fills it in place. No layout shift,
  because the space was already reserved.
- **Dropping a file.** Tools with no required options run the moment the file
  lands. There is no Start button, and that stays. Completion prints elapsed
  time in mono, which remains the single most important eleven characters on the
  site.
- **Scanning the catalogue.** The eye lands on the mark, confirms on the name,
  reads the blurb only when uncertain. That is the order the row layout has to
  support, and it is the whole justification for the icons.
- **Filtering the homepage.** Unchanged, and still zero external JavaScript.
  Rows hide, empty groups hide, empty categories hide, the count updates in a
  `role="status"` region. Icons are inside the filtered row and follow it.
- **Hovering or focusing a row.** Name goes to accent, background to `--sunken`.
  The mark takes the accent with it, so the row responds as one object.

---

## 12. Responsive behaviour

- **Below 640px** the row keeps the mark in its gutter and stacks name over
  blurb, as it does now. The mark is what makes a stacked row scannable, so it
  matters more here than at desktop width.
- **Below 768px** the nav stays a horizontally scrollable row, not a menu. No
  open state, no focus trap, no script.
- **Tool pages** collapse to one column below the two-column breakpoint, tool
  first and prose after, which is the current order and the correct one.
- **Touch targets** are 44px with 8px separation on coarse pointers via
  `pointer-coarse:`, extended to the three header controls that were missed.
- The larger type floor lands hardest here, which is the point: mobile is where
  the 11px blurb was doing the most damage.

---

## 13. Accessibility requirements

- **Every new colour pair asserted in `tokens.test.ts`.** Five category hues in
  two themes against two surfaces. Contrast is tested, never eyeballed.
- **Icons are decorative to assistive technology.** `aria-hidden` with the
  accessible name coming from the tool name, which is already correct. A mark
  that repeats the name adds nothing to a screen reader and adds noise.
- **Legible-text audit passes** on the homepage and all category pages.
- **AA everywhere**, keyboard completeness for every tool including file
  selection, `prefers-reduced-motion` honoured, CLS held at 0.
- **Heading outline stays walkable**: h1, category h2, group h3 on the homepage;
  h1 then group h2 on a category page. No level skips.
- Verification is by axe plus an AT-SPI tree read, not by inference. Green axe
  is the weaker claim and is not sufficient on its own.

---

## 14. Out of scope

- **No tool URL changes.** 13 permanent redirects already spent the old site's
  search equity once. Search is the acquisition channel.
- **No taxonomy changes.** The 5 categories, 15 job groups, `GROUP_THRESHOLD`,
  the six-group ceiling and the 3 cross-listings all stand as built.
- **No new tools, and no change to what any tool does.** This is presentation
  only. The 43-tool catalogue is fixed for the duration.
- **No architecture changes.** The registry stays the source of truth, Preact
  stays on `preact/compat` with `@astrojs/preact` pinned to v4, COOP and COEP
  stay in both files, vendor paths stay versioned, heavy runtimes stay lazy.
- **No copy rewrite** beyond the hero emphasis swap and any label the icon work
  makes wrong.
- **No icons** on the tool page header, the command palette, related cards or
  the OG images.
- **No drop shadows**, other than the command palette.
- **No git actions.** Nothing is committed unless asked.

---

## 15. Open questions

- Whether the two-column tool page keeps the prose sticky as the tool grows
  during use, or lets it scroll away. Deferred until the layout exists and can
  be judged with a real result in it.
- Whether a category hue belongs anywhere on a tool page, or stays purely a
  browse affordance. Currently the latter, and revisitable once the marks exist.
- Whether raising the type floor makes the homepage tall enough to justify
  revisiting its structure. Measured after the change, not guessed at now.
- The `shrink` group holds a single tool in both PDF and Image. The weakest part
  of the taxonomy, noted in the anatomy, and out of scope here.

---

## 16. Success criteria

| | Target | Baseline 2026-09-23 |
| --- | --- | --- |
| Homepage legible text | pass | 44.34% legible, fails |
| Lighthouse performance | no regression, at least 95 | 98 / 97 / 95 |
| Accessibility | 100, and axe clean on every changed route | 100 |
| CLS | 0 | 0 |
| Homepage external site JavaScript | 0 KB | 0 KB |
| Contrast pairs asserted | every new pair | 18 existing tests |
| Someone can describe the site in one sentence | "the fast one that doesn't upload anything" | unchanged |
| The tool page reads as finished | a stranger trusts it with a file | the thing being fixed |
