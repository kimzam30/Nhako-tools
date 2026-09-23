# Design Brief: Tool Findability

Scoped brief. It does not replace `.design/nhako-tools-rebuild/DESIGN_BRIEF.md`,
which still governs positioning, aesthetics and the token system. This one covers
one question only: how 43 tools are arranged so a person can find the one they came for.

Written 2026-09-23.

## Problem

The catalogue tripled and the arrangement did not move with it.

When the structure was designed there were 22 tools, and the bet recorded in
`.design/nhako-tools-rebuild/INFORMATION_ARCHITECTURE.md` §3 was explicit:
"the nav is not where discovery happens; search is." That bet held at 22.
At 43 it does not, and the failures are concrete:

- Someone who wants to sign a PDF clicks "PDF" in the nav and is dropped at an
  anchor partway down the homepage, facing 18 cards in no meaningful order.
  Merge, OCR, Protect and Office to PDF sit at the same visual weight with
  nothing to say they are different kinds of job.
- There is no page for a category. `/pdf` is a 404. Verified: `dist/pdf/`
  contains 18 tool folders and no `index.html`. So the site has no page that
  answers "what can this do with PDFs", which is both a navigation gap and the
  most valuable page it does not have.
- On a phone there is no category navigation at all. `Nav.astro:27` carries
  `hidden ... md:flex`, so below 768px browsing means scrolling the whole
  homepage.
- Fifteen preset pages exist and nothing links to them from any browse path.
  `pdf/compress` has five, `image/compress` has seven, `pdf/office-to-pdf` has
  three. Typing "500kb" into the command palette returns nothing, because the
  index in `CommandPalette.astro:13` is built from tools only, never variants.
- "Calculators" holds one tool and sits third in the nav, ahead of categories
  holding nine and eleven.

Search papers over some of this for the person who already knows the word for
what they want. It does nothing for the person who is browsing to find out what
is on offer, and browsing is exactly what a first visit from search results is.

## Solution

Two layers, added without moving a single tool.

A **browse layer**: real category landing pages that group tools by the job
someone came to do, with the preset pages surfaced as chips under their parent
tool, and a curated Malaysia page that gathers the passport photo maker, the
take-home pay calculator and the portal size presets into the one place where
their shared context (SSM, LHDN, JPA, UPU, JPJ) actually makes sense.

A **restructured directory**: the homepage keeps every tool in the HTML, so the
existing filter and the 0 KB JavaScript budget both survive untouched, but the
flat grids become job groups rendered as dense rows. More tools per screen, and
each one sitting under a heading that says what kind of work it is for.

The result is that both approaches work. Someone who knows the word types it.
Someone who does not can walk down from "PDF" to "secure a PDF" to "Protect"
without ever reading a tool name they do not need.

## Experience Principles

1. **A heading is the fastest filter**: a person scanning 18 tools reads six
   group headings, not eighteen names. Every group label names a job in the
   words someone would use out loud ("Convert from PDF", not "Extraction").
   If a label needs explaining, the grouping is wrong.

2. **Structure is added, never moved**: no tool URL changes. The old site's
   search equity is the only asset carried forward, and it was already paid for
   once with the redirect table. Cross-listing lets a tool appear in a second
   browse location while keeping exactly one canonical home.

3. **Density over comfort**: this is an instrument panel, not a marketing page.
   Where the choice is between whitespace and showing one more tool without a
   scroll, the tool wins. A padded card that shows six tools per screen is a
   worse directory than a dense row that shows fourteen.

## Aesthetic Direction

- **Philosophy**: "Precision Instrument", inherited unchanged. Dense, sharp
  radii, 120 to 180ms flat easing, numbers always mono.
- **Tone**: Clinical and unhurried. The arrangement should feel like a
  well-labelled drawer, not a shop window. Nothing persuades, nothing promotes,
  nothing is "featured" except where a real shared context justifies it.
- **Reference points**: the tool index of a good CLI's man page. A parts
  catalogue. iLovePDF's job grouping specifically, which is genuinely good at
  matching how people search, and nothing else about iLovePDF.
- **Anti-references**: SaaS marketing homepages with hero cards and gradients.
  "Most popular" badges. Anything that implies a tool is behind a tier.
  Mega menus that cover the page on hover.

## Existing Patterns

Scanned and confirmed in the codebase. This design extends them and adds none.

- **Typography**: Instrument Sans Variable for prose, JetBrains Mono Variable
  for numbers and readouts, both via `@fontsource-variable`. Mono is used for
  counts, so group counts keep that treatment.
- **Colors**: `src/styles/tokens.css`. Semantic variables only
  (`--bg`, `--surface`, `--sunken`, `--border`, `--border-strong`, `--text`,
  `--text-muted`, `--accent`). Every contrast pair is asserted by
  `src/styles/tokens.test.ts`, so no colour is hand-picked here.
- **Spacing**: Tailwind v4 defaults via `@tailwindcss/vite`. The existing
  homepage rhythm (`gap-2.5`, `p-3.5`, `py-8` per section) is the scale to match.
- **Motion**: `src/styles/motion.css`. Scroll reveals via `[data-reveal]` and
  `[data-reveal-rule]`, both guarded by `@supports` and reduced-motion. New
  sections reuse these attributes rather than defining anything.
- **Components**: `Nav.astro`, `Footer.astro`, `ToolCard.astro`,
  `CommandPalette.astro`, `HomeView.astro`, `BaseLayout.astro`.
  `src/components/react/search.ts` already holds the shared search ranking and
  is tested by `search.test.ts`.
- **i18n**: `src/i18n/` with `ui.ts` (page strings), `tools.ts` (Malay registry
  text) and `paths.ts`. `i18n.test.ts` enforces completeness, so every new
  string ships in both languages or the suite fails.
- **Registry**: `src/tools/registry.ts` is the single source of truth. Routes,
  the homepage grid, the palette and the sitemap all derive from it, and
  `registry.test.ts` fails the build on a duplicate id. Grouping metadata
  belongs there for the same reason.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `ToolMeta.group` | New (field) | Job group id on each tool. Required, validated against the category's declared groups by `registry.test.ts`. |
| `ToolMeta.alsoIn` | New (field) | Optional cross-listing targets. Browse surfaces only, never affects the canonical URL, `related` or the sitemap. |
| `src/tools/groups.ts` | New | Per-category ordered group definitions and labels. The ordering authority for every browse surface. |
| `CategoryView.astro` | New | Shared view behind `/[category]` in both locales. Intro, job groups, preset chips. |
| `src/pages/[category]/index.astro` | New | Route for the five category pages. Malay mirror under `/ms`. |
| `CollectionView.astro` | New | Shared view behind the Malaysia page. Curated, hand-ordered, carries portal context per tool. |
| `src/pages/malaysia.astro` | New | Plus `/ms/malaysia`. New URL, nothing moved. |
| `ToolRow.astro` | New | Dense row: name, blurb in muted text, optional preset chips. The directory primitive. |
| `ToolCard.astro` | Keep | Still used where a card is right. Unchanged, so nothing that renders it breaks. |
| `Nav.astro` | Modify | Links to real pages instead of homepage anchors. Reordered. Scrollable row on mobile instead of hidden. Still zero JavaScript. |
| `HomeView.astro` | Modify | Category sections gain group headings and switch to rows. All 43 tools stay in the HTML. |
| `CommandPalette.astro` | Modify | Index includes the 15 variants so "500kb" resolves. |
| `search.ts` | Modify | Accepts variant entries. Existing ranking behaviour preserved, asserted by `search.test.ts`. |
| `Footer.astro` | Modify | Add the category links. It is the one place a browse path belongs on a tool page's deep scroll. |
| `src/i18n/ui.ts` | Modify | Group labels, category intros, collection copy, in both locales. |

## Key Interactions

**Browsing from the nav.** Clicking "PDF" loads `/pdf`, a real page. The person
lands on a short intro and six job headings. No JavaScript ran, nothing moved,
the page was prerendered. Clicking a group heading is not a thing: the groups
are all visible at once, because eighteen tools under six headings fits.

**Finding a preset.** Under "Compress PDF" on `/pdf`, a row of small chips reads
100 KB, 200 KB, 500 KB, 1 MB, 2 MB. Clicking one lands directly on the preset
page with the option already set. The same presets now resolve in the palette,
so typing "500" surfaces them ranked under their parent.

**Filtering the homepage.** Unchanged in mechanism. Typing hides non-matching
rows, and now also hides a group heading when every row under it is hidden, and
the category section when every group is hidden. The count readout keeps its
existing mono treatment and `role="status"`.

**Arriving on a phone.** The nav category row is horizontally scrollable with
the current item marked. It is a scroll container, not a menu: no open state, no
JavaScript, no focus trap.

**Cross-listed tools.** A cross-listed tool renders identically to any other row
in its second location. No "also in" badge, no duplicate-looking treatment. The
person does not need to know about the data model.

## Responsive Behavior

- **Below 768px**: nav categories become a horizontally scrollable row with
  `overflow-x-auto` and momentum scrolling, replacing the current disappearance.
  Rows go single column. Preset chips wrap and stay at a 44px touch target.
- **768px and up**: nav is the standard inline row. Category page groups render
  in two columns where a group holds more than four tools.
- **1024px and up**: three columns inside a group, matching the homepage grid's
  existing `lg:grid-cols-3`.
- **Behaviour change, not just size**: the nav is the only component that
  changes behaviour. Everything else reflows.

## Accessibility Requirements

- Each job group is a real `<section>` with an `<h3>` inside the category's
  `<h2>`, so the heading outline is walkable. Today's homepage jumps from `h1`
  to five `h2`s with 43 undifferentiated links under them.
- The mobile nav scroll container is keyboard reachable and does not trap focus.
  A scrollable region holding focusable children needs no `tabindex`, and it
  must not be given one.
- Preset chips are links, minimum 44 by 44 CSS pixels of hit area, with an
  accessible name that includes the parent tool ("Compress PDF to 500 KB", not
  "500 KB").
- Current page in the nav carries `aria-current="page"`.
- Contrast comes only from existing semantic tokens, all asserted by
  `tokens.test.ts`. No new colour values.
- Group headings must not be the only signal: the filter's empty state stays a
  `role="status"` live region, as it is today.
- Verification bar per `.design/nhako-tools-rebuild/TASKS.md`: axe green is the
  floor, not the claim. A real screen-reader pass over the new heading outline
  is required before this is called done, using the AT-SPI method already
  recorded for this machine.

## Out of Scope

- **Any change to a tool URL.** No re-slotting a tool into a different canonical
  category, no redirect table edits. Decided explicitly.
- **Design tokens.** "Precision Instrument" and `tokens.css` are untouched. No
  new colour, no new font, no new easing.
- **Tool page interiors.** What happens inside `/pdf/merge` is not this brief.
  The `related` block stays exactly as it is.
- **Tool chaining** (passing a result from one tool into the next). It sits in
  §5 of `~/.claude/plans/sprightly-beaming-frost.md` and is a separate piece of
  work.
- **Drop a file anywhere to route to a tool.** Same plan, same reason.
- **New tools.** Phase 5 of the expansion plan (zakat, loan, SST, stamp duty)
  will fill the Calculators page. This brief only makes sure the page is ready
  to absorb them without another restructure.
- **Usage-ranked ordering.** Vercel Analytics has only been collecting since
  2026-09-18. Ordering by real usage is a later pass with real data, not a guess
  dressed as one.
- **FAQ or schema blocks on category pages.** Considered and declined. Useful
  FAQ copy has to be written twice, once in Malay, and thin FAQ copy reads as
  filler on a site whose whole pitch is that it does not pad.
