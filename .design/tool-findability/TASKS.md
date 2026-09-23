# Build Tasks: Tool Findability

Generated from: `.design/tool-findability/DESIGN_BRIEF.md` and
`.design/tool-findability/INFORMATION_ARCHITECTURE.md`
Date: 2026-09-23

Aesthetic philosophy for every task below: **"Precision Instrument"**, inherited
unchanged from `.design/nhako-tools-rebuild/DESIGN_BRIEF.md`. Dense, sharp radii,
120 to 180ms flat easing, numbers always mono. No new tokens, no new colours, no
new fonts. Every file touched keeps the repo rule of zero em dashes.

Standing constraints: no tool URL moves, no git actions, and every claim of "done"
is backed by a command that was actually run.

## Foundation

- [x] **Group taxonomy as data**: add a required `group` field to `ToolMeta`, an
  optional `alsoIn`, and a new `src/tools/groups.ts` holding the ordered group
  definitions per category plus the "group only above six tools" threshold.
  Assign a group to all 43 registry entries and `alsoIn` to the three cross-listed
  tools. Done when `npm run typecheck` passes and the registry compiles with no
  tool ungrouped. _Modifies: `src/tools/types.ts`, `src/tools/registry.ts`. New:
  `src/tools/groups.ts`._ **Build this first: everything else reads from it.**

- [x] **Lock the taxonomy with tests**: extend `src/tools/registry.test.ts` to
  assert every tool has a group that exists in its own category, no category
  exceeds six groups, no `alsoIn` points at a tool's own category, every `alsoIn`
  names a real group in the target category, and `alsoIn` never appears in
  `related` or changes a canonical id. Done when `npm test` passes and each new
  assertion has been seen to fail against a deliberately broken fixture.
  _Modifies: `src/tools/registry.test.ts`._ _Depends on: Group taxonomy as data._

- [x] **Malay group labels**: add the 14 group labels and the five category intro
  paragraphs to `src/i18n/ui.ts` in both locales, using the BM drafts in the IA
  document. Done when `npm test` passes including `i18n.test.ts`, which fails on
  any missing translation. _Modifies: `src/i18n/ui.ts`._ _Depends on: Group
  taxonomy as data._

- [x] **`ToolRow.astro`, the directory primitive**: a dense row carrying name,
  blurb in muted text, an optional context line and optional preset chips. This
  is the component the whole restructure is made of, so build it before any page
  that uses it and check it against the density principle at 375px and 1280px.
  Chips are links with a 44px minimum hit area and an accessible name that
  includes the parent tool. Done when it renders correctly in both themes and the
  `[data-reveal]` motion attribute behaves as `ToolCard` does today. _New
  component. Reuses: existing tokens, `motion.css` reveal attributes._

## Core UI

- [x] **Category pages**: `CategoryView.astro` plus `src/pages/[category]/index.astro`
  and the `/ms` mirror, generating `/pdf`, `/image`, `/media`, `/dev`, `/calc` and
  six Malay counterparts. H1, one-paragraph intro, job groups as `h2` sections with
  `ToolRow` children, preset chips under their parent, cross-listed tools inline,
  and a link back to the full catalogue. Grouped or flat is decided by the tool
  count, not a per-page flag. Done when all 12 pages build, appear in the sitemap,
  and `/pdf` shows 18 tools under 6 headings. _New: `src/views/CategoryView.astro`,
  two route files. Depends on: `ToolRow.astro`, Group taxonomy as data, Malay group
  labels._ **Highest visual risk: validate the aesthetic here before continuing.**

- [x] **Homepage restructure**: `HomeView.astro` switches from `ToolCard` grids to
  `ToolRow` lists, adds job-group subheadings for PDF, Image and Developer only,
  and links each category heading to its new page. All 43 tools stay in the HTML.
  Done when the homepage still ships 0 KB of site JavaScript (verified against the
  built output, not assumed) and the page is measurably shorter than it is today.
  _Modifies: `src/views/HomeView.astro`. Depends on: Category pages._

- [x] **Malaysia collection**: `src/tools/collections.ts` with the eight curated
  entries and their context lines, `CollectionView.astro`, and the `/malaysia` and
  `/ms/malaysia` routes. Each entry carries the portal context from the IA table.
  Done when both pages build, enter the sitemap, and every entry links to a URL
  that returns 200. _New: three files. Depends on: `ToolRow.astro`._

- [x] **Nav rework**: five items (PDF, Image, Media, Developer, Malaysia) pointing
  at real pages instead of homepage anchors, Calculators removed from the row,
  `aria-current="page"` on the active category, and a horizontally scrollable row
  below 768px replacing the current `hidden md:flex`. Still zero JavaScript. Done
  when the nav works at 375px, which today it does not exist at.
  _Modifies: `src/components/astro/Nav.astro`. Depends on: Category pages._

- [x] **Footer and breadcrumb**: add the five category links plus Malaysia to
  `Footer.astro`, and retarget the category link in the `ToolView.astro`
  breadcrumb from `/#<category>` to `/<category>`. One line for the breadcrumb,
  affecting all 125 existing tool and preset pages. Done when a breadcrumb click
  from `/pdf/sign` lands on `/pdf`. _Modifies: `Footer.astro`, `ToolView.astro`.
  Depends on: Category pages._

- [x] **Presets in the command palette**: extend the index in
  `CommandPalette.astro` to include the 15 variants and teach
  `src/components/react/search.ts` to rank them under their parent. Add a case to
  `search.test.ts` proving "500kb" resolves, which today returns nothing. Existing
  ranking behaviour must not regress, including the "transcribe finds Audio to
  Text" assertion already in `registry.test.ts`. _Modifies:
  `CommandPalette.astro`, `search.ts`, `search.test.ts`._

## Interactions and States

- [x] **Homepage filter learns the new structure**: typing hides non-matching rows,
  then hides a group heading once every row under it is hidden, then hides the
  category section once every group is hidden. The count readout and its
  `role="status"` live region behave exactly as they do now. Covers: empty group,
  empty category, no results at all, `?q=` deep link on load, and filter cleared.
  Done when each of those five states has been exercised in a real browser.
  _Modifies: the inline script in `HomeView.astro`._

- [x] **Preset chip and row states**: hover, focus-visible, and active for
  `ToolRow` and its chips, matching the existing 120ms flat easing and the
  `hover:border-accent` convention already used by `ToolCard`. Covers: keyboard
  focus order through a group, and a chip row that wraps to two lines on a phone.

## Responsive and Polish

- [x] **Responsive pass**: breakpoints 375, 768 and 1280. Single column rows and a
  scrollable nav on mobile; two columns inside a group at 768 where the group holds
  more than four tools; three columns at 1280 matching the existing
  `lg:grid-cols-3`. Done when `/pdf`, `/` and `/malaysia` have each been looked at
  in all three widths, in both themes.

- [x] **Accessibility pass**: heading outline walkable on every new page (`h1`,
  then category `h2`, then group `h3` on the homepage; `h1` then group `h2` on a
  category page), `aria-current="page"` correct, chip accessible names include the
  parent tool, the mobile nav scroll container keyboard reachable with no
  `tabindex` added, and no contrast regression. Run `@axe-core/playwright` via
  `e2e/a11y.spec.ts` extended to cover the new routes, then a real screen-reader
  pass over the new heading outline using the AT-SPI method recorded for this
  machine. Axe green is the floor, not the claim.

- [x] **Full verification sweep**: `npm run lint`, `npm run typecheck`,
  `npm test`, `npm run test:e2e:all` (Chromium and WebKit), `npm run build`, and
  `node scripts/sweep.mjs` against `npm run preview`. Add e2e coverage for the new
  routes: a category page renders its groups, a preset chip navigates, the mobile
  nav is reachable at 375px, and the palette resolves "500kb". Done when every
  command above has been run and its result reported, with anything unverifiable
  listed separately rather than mixed in.

## Build notes

Recorded during the build, where what was done differs from what was planned.

- **`group` is optional in the type, required by test.** Planned as a required
  field. Making it required would have forced a placeholder group onto the five
  tools in Media and Calculators, which declare no groups because they are under
  the threshold. Optional in TypeScript plus two assertions (grouped categories
  must group every tool, flat categories must group none) covers both directions
  and makes a category crossing the threshold fail loudly instead of silently
  flattening.
- **`alsoIn` holds objects, not strings.** Planned as `'<category>/<group>'`
  strings. The first test run failed on `pdf/to-image`, because `image/convert`
  is simultaneously a real tool id and a real group ref, and that tool already
  carries the tool in `related`. Renaming the group would have hidden the
  collision rather than removed it, so the two namespaces are now structurally
  distinct: `alsoIn: [{ category: 'image', group: 'convert' }]`.
- **`ToolVariant.short` added.** Not in the plan. A chip reading "Compress PDF
  to 500 KB" is unusable in a row of five, so each variant carries a short chip
  label while `name` remains the accessible name. Deliberately untranslated:
  every value is a file size or a product name.
- **The preset count is 15, not 11.** The brief, IA and this file said 11. The
  registry and `dist/` both say 5 for `pdf/compress`, 3 for `pdf/office-to-pdf`
  and 7 for `image/compress`. All three documents are corrected.
- **`pointer-coarse` verified, not assumed.** The 44px touch target for chips
  relies on a Tailwind variant. Confirmed present in the built CSS as
  `@media (pointer:coarse)` rather than taken on trust.
- **The homepage got longer, not shorter, and that criterion was wrong.**
  This file said the homepage task was done when the page was "measurably
  shorter". Measured at 1280px against a temporary harness rendering the old
  card grid: old 2430px, new 2835px. Tightening group and row spacing brought
  it to 2653px, still 223px (9%) longer. The remaining difference is the 15 job
  headings themselves, which is the structure that was asked for. Cutting
  further would mean removing headings or squeezing rows below a comfortable
  touch target. Recorded as a deliberate trade rather than quietly dropped:
  9% more height buys a page where 43 tools sit under 15 named jobs instead of
  five undifferentiated lists.
- **A compact row variant was needed.** Single-column dense rows replaced a
  three-column card grid, which made the homepage far longer. `ToolRow` gained
  a `compact` form that stacks name over blurb and drops the fixed name column,
  so the homepage can grid them two and three across while the category page
  keeps the wide tabular form.
- **Two pre-existing bugs found and fixed.** Neither was introduced by this
  work. First: the homepage's "no tool matches that" message has never once
  appeared, because `document.querySelector('[data-empty]')` matched the
  command palette's `<ul data-empty=...>` in the nav, which comes first in the
  document. The filter was toggling `hidden` on the palette's list instead. The
  homepage element is now `data-search-empty`. Second: the palette re-rendered
  its whole list through `innerHTML` on every `mouseenter`, including for the
  option already highlighted, which destroyed the node under the cursor and
  swallowed the click that followed. It now re-renders only when the highlight
  actually moves.
- **Two of my own test expectations were wrong, not the code.** `/pdf` has 18
  rows, not 20: PDF's cross-listings point outwards into Image, so none arrive.
  And filtering for "merge" leaves two groups visible, not one, because Text
  diff carries "merge" as a keyword. That is the search working. The filter
  test now uses "jwt", which names exactly one tool.
- **The wordmark hides below 640px.** On a 375px phone the nav showed one
  category and looked like it had only one. Dropping "NhakoTools" to the logo
  mark alone gives the row room for two and a half items plus a visible scroll
  edge.

## Review

- [x] **Design review**: run against `.design/tool-findability/DESIGN_BRIEF.md`.
  Done 2026-09-23, with a mobile pass folded in. Four must-fix defects found and
  fixed (group headings attached to the wrong group, half-length rules on
  partial grid rows, category counts disagreeing with the homepage, nav touch
  targets under 44px). Written up in `DESIGN_REVIEW.md` with 21 screenshots.
  One item deliberately left open: 11px body text on mobile, which is a token
  change and out of this brief's scope.
