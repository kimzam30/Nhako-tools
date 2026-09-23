# Information Architecture: Nhako Tools redesign

Feature slug: `redesign` · 2026-09-23 · Companion to `DESIGN_BRIEF.md`

## 0. Scope of this document

This is a **structural** IA, not a navigational one. Site structure is settled
and deliberately frozen by the brief: no URL moves, no taxonomy change, no new
categories or groups. `SITE_ANATOMY.md` section 3 holds the full route map and
`.design/tool-findability/INFORMATION_ARCHITECTURE.md` holds the group taxonomy.
Neither is restated here.

What is genuinely unresolved, and what this document decides:

1. The mark grammar, and all 43 tools mapped through it.
2. The five category hues, as verified values.
3. The structure of a tool page in two columns, and what the reserved result
   area contains before anything is dropped.
4. The anatomy of a catalogue row with a mark in it, in both forms.

Tool data in the tables below was extracted from `src/tools/registry.ts` on
2026-09-23, not recalled.

---

## 1. The mark grammar

Every mark is **one base** with **one operation** applied. Two rules keep the
set honest:

- **A mark that needs two operations is wrong.** It means the tool name is doing
  work the mark should do, or the tool does two things.
- **The base is chosen by what the tool acts on, never by the category it is
  filed under.** This is what makes JPG to PDF read correctly when it appears
  cross-listed on `/image`: it acts on photos, so it carries a photo base, and
  the person holding photos recognises it.

### Bases, 9

| Base | Drawn as | Used by |
| --- | --- | --- |
| `page` | a document sheet, portrait, one folded corner | PDF tools |
| `photo` | a landscape frame with a horizon and a sun | image tools |
| `frame` | a plain rectangle viewport, no horizon | video, CSS shadow |
| `wave` | a three-peak waveform | audio |
| `text` | three stacked lines, last one short | text tools, teleprompter |
| `braces` | a matched pair of curly braces | structured code |
| `token` | three linked segments, dot separated | JWT, UUID |
| `grid` | a modular grid of filled cells | QR |
| `ledger` | a figures column with a rule and a total | calculators |

### Operations, 26

`converge` · `diverge` · `arc` · `inward arrows` · `scale handles` ·
`crop marks` · `viewfinder` · `overlay` · `reorder` · `closed lock` ·
`open lock` · `scan line` · `arrow to` · `cycle` · `knockout` · `tag struck
through` · `portrait guides` · `numerals` · `signature stroke` · `extract` ·
`scroll` · `compare` · `one way to seal` · `emit` · `offset` · `indent`

---

## 2. The 43 marks

### PDF, 18

| Tool | Base | Operation | Reads as |
| --- | --- | --- | --- |
| Merge PDF | page | converge | two pages meeting at one |
| Split PDF | page | diverge | one page becoming two |
| Rotate PDF | page | arc | a page with a quarter turn arrow |
| Organize PDF | page | reorder | three pages, one lifted out of order |
| Crop PDF | page | crop marks | a page inside four corner marks |
| JPG to PDF | photo | arrow to page | a photo becoming a sheet |
| Office to PDF | page (ruled) | arrow to page | a ruled sheet becoming a plain one |
| Scan to PDF | page | viewfinder | a page inside camera brackets |
| PDF to JPG | page | arrow to photo | a sheet becoming a photo |
| PDF to text | page | arrow to text | a sheet becoming three lines |
| PDF to Word | page | arrow to page (ruled) | a plain sheet becoming a ruled one |
| OCR PDF | page | scan line | a line sweeping across a sheet |
| Watermark PDF | page | overlay | a diagonal band across a sheet |
| Sign PDF | page | signature stroke | a written stroke on a sheet |
| Add page numbers | page | numerals | a sheet with a numbered corner |
| Compress PDF | page | inward arrows | a sheet squeezed from both sides |
| Protect PDF | page | closed lock | a sheet with a shut shackle |
| Unlock PDF | page | open lock | the same lock, shackle open |

### Image, 11

| Tool | Base | Operation | Reads as |
| --- | --- | --- | --- |
| Compress image | photo | inward arrows | a photo squeezed from both sides |
| Convert image | photo | cycle | a photo with two curved arrows around it |
| HEIC to JPG | photo | arrow to photo | one photo becoming another |
| Resize image | photo | scale handles | a photo with a corner handle and a diagonal |
| Crop image | photo | crop marks | a photo inside four corner marks |
| Rotate image | photo | arc | a photo with a quarter turn arrow |
| Watermark image | photo | overlay | a diagonal band across a photo |
| Remove background | photo | knockout | a subject lifted off a checkered ground |
| Remove photo metadata | photo | tag struck through | a photo and a struck out tag |
| Image to text (OCR) | photo | scan line | a line sweeping across a photo |
| Passport photo maker | photo | portrait guides | a head oval inside measurement guides |

### Media, 4

| Tool | Base | Operation | Reads as |
| --- | --- | --- | --- |
| Compress video | frame | inward arrows | a viewport squeezed from both sides |
| Extract audio | frame | extract | a waveform lifting out of a viewport |
| Audio to text | wave | arrow to text | a waveform becoming three lines |
| Teleprompter | text | scroll | lines with an upward scroll arrow |

### Developer, 9

| Tool | Base | Operation | Reads as |
| --- | --- | --- | --- |
| JSON formatter | braces | indent | braces around stepped lines |
| Text diff | text | compare | two blocks either side of a divider |
| Word counter | text | numerals | lines with a count beside them |
| Base64 converter | text | cycle | lines with two curved arrows around them |
| JWT decoder | token | diverge | three segments coming apart |
| Hash generator | text | one way to seal | lines collapsing into a fixed block |
| UUID generator | token | emit | segments appearing from nothing |
| QR code generator | grid | emit | a modular grid resolving |
| CSS shadow generator | frame | offset | a rectangle and its offset double |

### Calculators, 1

| Tool | Base | Operation | Reads as |
| --- | --- | --- | --- |
| Salary calculator (Malaysia) | ledger | numerals | a figures column ruled to a total |

### The rhyming pairs, resolved

This is the test the set had to pass. Every pair that shares an operation is
separated by its base, and every pair that shares a base is separated by its
operation.

| Pair | Shares | Separated by |
| --- | --- | --- |
| Compress PDF / image / video | inward arrows | page, photo, frame |
| Rotate PDF / Rotate image | arc | page, photo |
| Crop PDF / Crop image | crop marks | page, photo |
| Watermark PDF / Watermark image | overlay | page, photo |
| OCR PDF / Image to text | scan line | page, photo |
| Merge PDF / Split PDF | page | converge against diverge |
| Protect PDF / Unlock PDF | page | shackle closed against open |
| PDF to JPG / JPG to PDF | page and photo | direction of the arrow |
| Convert image / Base64 converter | cycle | photo, text |
| JWT decoder / UUID generator | token | diverge against emit |

---

## 3. Category hues

Computed against the real surface values and verified, not chosen by eye.
Each is the most saturated value at its hue that still clears **4.5:1 against
`--bg`, `--surface` and `--sunken`** in its theme. That is well above the 3:1
that WCAG 1.4.11 asks of a graphical object, and the headroom is deliberate
because these are thin strokes at 20px.

| Category | Hue | Light | Dark | Worst contrast |
| --- | --- | --- | --- | --- |
| PDF | 25 | `#e10225` | `#ff2234` | 4.51:1 |
| Calculators | 75 | `#986600` | `#b27800` | 4.51:1 |
| Image | 140 | `#258101` | `#2d9702` | 4.52:1 |
| Developer | 195 | `#087d7e` | `#009292` | 4.50:1 |
| Media | 255 | `#016ed6` | `#0282fa` | 4.54:1 |

Spacing around the wheel, with the fixed accent at 313: 50, 65, 55, 60, 58, 72
degrees. The smallest gap is PDF against Calculators at 50 degrees, which also
carry very different chroma (0.232 against 0.116), so they separate on
saturation as well as hue. The accent keeps 58 and 72 degrees of clearance from
its neighbours, and PDF keeps a true red rather than the crimson that perfectly
even spacing would have forced next to a pink brand colour.

### The rule that this set makes non-negotiable

**Pairwise contrast between the five hues is 1.00:1.** They are isoluminant by
construction, because each was solved to the same contrast target. In greyscale,
in a screenshot converted to mono, or to someone with severe colour vision
deficiency, they are five identical greys. Red against green is PDF against
Image, the two largest categories, and it is the pair that deuteranopia and
protanopia collapse first.

This is not a defect to correct by pulling the hues apart in lightness, because
that would make one category shout and another whisper, and PDF at 18 tools
would dominate the catalogue. It is instead the reason the shape grammar exists:

> **Colour is redundant encoding. Shape is primary.** No information may be
> carried by hue alone. Every distinction a hue makes must already be made by
> the base, the operation, the group heading or the label. A design that fails
> when rendered in greyscale is wrong and gets redrawn.

Category hue appears in exactly two places: the mark, and a thin rule tied to a
category heading. Never a fill, never a wash, never a text colour, never an
interactive state. The accent remains the only colour that means "this acts".

---

## 4. Tool page structure

Applies to the **36 file and text tools**. The 7 app tools keep a single wide
column with prose beneath, because their interfaces need the horizontal room.

```
nav
Tools / PDF                                              breadcrumb
Merge PDF                                                h1
Combine several PDFs into one file.                      blurb
--------------------------------------------------------------------------------
PRIMARY COLUMN                          |  SECONDARY COLUMN
                                        |
[ the tool: drop zone or text panes ]   |  What this does
[ options, when the tool has them ]     |    prose
                                        |
RESULT                                  |  Limits
  out    --                             |    what it cannot do, honestly
  size   --                             |
  time   --                             |  Sources          calculators only
                                        |
Runs entirely in your browser.          |  Presets          chips, when variants exist
Verify it in your network tab.          |
                                        |  Related tools    3 links
--------------------------------------------------------------------------------
footer
```

### The reserved result area

This is the single most important structural change, and it is where the
instrumentation reference stops being a mood and becomes a mechanism.

The result region is **present, labelled and at rest from first paint**. It
shows its own fields with empty readings: `out --`, `size --`, `time --`, in the
mono face, exactly as `HeroReadout.astro` already does on the homepage. Dropping
a file fills those fields in place.

It must read as **a gauge at zero, not a disabled form.** A greyed-out button
says "you cannot use this yet". A readout at rest says "this is ready and
waiting for input", which is the same fact told the way the product wants it
told. No spinner, no skeleton shimmer, no placeholder text pretending to be
content.

Three things this buys:

1. The page is visually complete before the person commits a file, which is the
   entire fix for "it looks unfinished".
2. It shows what they are about to get, before they get it.
3. CLS stays 0 for free, because the space was never going to change.

### Column proportions and order

- Primary column carries roughly 60% of the width, secondary roughly 40%.
- The page widens from `max-w-3xl` toward the homepage's `max-w-6xl`. The exact
  value is a tokens and build decision, not an IA one.
- Below the two-column breakpoint the columns stack **primary first**, so the
  tool is still the first thing on the page. That is the current order on mobile
  and it is already correct.
- The privacy line stays directly under the tool, not in the secondary column.
  It is about the thing it sits beneath.

---

## 5. Card anatomy

**Revised after the row layout shipped.** The browse layer's bordered row was
replaced by a card on 2026-09-23, at Kim's direction, once the 43 marks existed.
The row's own argument against cards, that at 43 tools a padded card shows six
per screen where a row shows about fourteen, was made before the marks and does
not survive them: a card carrying a mark does the scanning work that the tight
row did with alignment. The height cost is real and recorded below.

`ToolTile.astro` is the primitive for the homepage, all 10 category pages and
`/malaysia`. It replaces `ToolRow.astro`.

```
+--------------------------------------+
| [mark]  Merge PDF                    |
|         Combine several PDFs into    |
|         one file.                    |
+--------------------------------------+
```

- Mark at `--mark-size` in the leading gutter, `gap-2.5` to the text.
- Border, `--surface` fill, `--edge` inset hairline. **No shadow**: depth is
  machined, not floated.
- The wrapper carries the hover state, so the whole card responds as one object
  even though only part of it is the anchor.
- Presets sit inside the card, below the blurb, indented to the text column. The
  card that owns them is taller than its neighbours, which is honest: it leads
  somewhere they do not.
- Cards stretch to equal height within a grid row. Sized to their own content
  they read as ragged, which is the failure mode of a card grid.

### Grid density

| Surface | Columns |
| --- | --- |
| Homepage | 1, then 2 at `sm`, 3 at `lg`, 4 at `xl` |
| Category and collection | 1, then 2 at `sm`, 3 at `lg` (inside `max-w-4xl`) |

### Contracts that must not change

`data-tool-card`, `data-name`, `data-keywords` and `data-category` are the
homepage filter's contract and are load-bearing. The mark goes **inside** the
filtered element so it hides and shows with its card.

The preset chips stay outside the anchor, because a link inside a link is
invalid HTML.

### Accessibility of the mark

Every mark is `aria-hidden="true"` and purely presentational. The accessible
name of a card is the tool name and does not change. A mark that repeated the
name would add noise to a screen reader and no information.

### What the cards cost

| Surface | Rows | Cards | Delta |
| --- | --- | --- | --- |
| Homepage at 1280 | 2960px | 3363px | +403px, +13.6% |
| Homepage at 375 | ~4400px | 5368px | +968px, +22% |

Against the pre-redesign baseline of 2807px, the homepage at 1280 is now 556px
taller, 19.8%. Roughly a quarter of that is the raised type and the rest is the
card padding. The search field and the command palette are the real navigation
at this length, and both are unchanged.

## 6. Naming conventions

| Concept | Label in UI | Notes |
| --- | --- | --- |
| A tool's picture | mark | "icon" in code and conversation, "mark" in this document, never shown to the user |
| What a mark is drawn on | base | 9 of them, fixed vocabulary |
| What is done to a base | operation | 26 of them, one per mark |
| A category's colour | category hue | never "brand colour", which is only `#FF91E7` |
| The output region on a tool page | Result | singular, even when a tool emits several files |
| The empty state of that region | at rest | a gauge at zero, not "disabled" or "empty" |
| A job cluster inside a category | group | unchanged, 15 of them |
| A preset landing page | variant in code, preset in UI | unchanged |

---

## 7. Component reuse map

| Component | Used on | Behaviour differences |
| --- | --- | --- |
| `ToolIcon.astro` | homepage, 10 category pages, `/malaysia` | One component, 43 marks, category hue from the tool's own category. Inline SVG, `aria-hidden` |
| `ToolRow.astro` | homepage (compact), category pages and `/malaysia` (wide) | Gains the mark gutter in both forms. Collection rows swap the blurb for a context line, as now |
| `ToolView.astro` | 125 tool pages | Two columns for the 36 file and text tools, one wide column for the 7 app tools |
| Result readout | `FileToolRunner.tsx`, `TextToolPane.tsx` | Same structure, same at-rest fields. Text tools show `chars` rather than `size` |
| `HeroReadout.astro` | homepage only | Unchanged, and now the acknowledged pattern source for the result readout |
| `CategoryView.astro` | 10 pages | Gains a category hue rule under its heading. Grouped or flat still decided by tool count |
| `CommandPalette.astro` | every page | No marks, no change |

---

## 8. Content growth plan

The catalogue grows. Phase 5 of the expansion plan adds zakat, loan, SST, stamp
duty and ringgit in words to Calculators, which crosses `GROUP_THRESHOLD` and
starts that category being grouped automatically.

**A new tool gets its mark by picking one base and one operation from the
existing vocabulary.** That is the whole procedure, and it is why the grammar
exists rather than 43 freehand drawings.

If no existing base fits, that is a signal worth reading: it usually means the
tool acts on something the site has not handled before, which is a taxonomy
question before it is an icon question. Adding a base is allowed and should be
deliberate. Adding an operation is routine.

A test should assert that **every tool in the registry has a mark**, in the same
spirit as the existing test that fails when a category crosses the grouping
threshold without groups written. A tool without a mark should fail the build
rather than render a blank gutter.

---

## 9. URL strategy

Unchanged, and out of scope. `/<category>`, `/<category>/<tool>`,
`/<category>/<tool>/<variant>`, `trailingSlash: 'never'`, every page mirrored
under `/ms` with untranslated path segments. The 13 permanent redirects stand.

Recorded here only so it is unambiguous that this redesign moves nothing.

---

## 10. Open questions

- Whether the secondary column is sticky as the primary column grows during use.
  Recommend not sticky to begin with: a tool that produces a long result should
  be allowed to own the screen. Revisit once a real result is in it.
- Whether the `ledger` base survives contact with a second calculator. It was
  drawn for one tool, and Phase 5 adds five more.
- Whether `frame` doing duty for both video and CSS shadow is a collision worth
  splitting. They never appear on the same page, and their operations differ,
  so it is recorded rather than fixed.
- The exact drawn weight and grid for the marks. That is a tokens decision and
  belongs to Phase 4, not here.
