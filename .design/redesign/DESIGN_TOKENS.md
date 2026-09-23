# Design Tokens: Nhako Tools redesign

Feature slug: `redesign` · 2026-09-23 · Companion to `DESIGN_BRIEF.md`

## Source of truth

**The tokens live in `src/styles/tokens.css`, and that file is the source of
truth.** Values are not repeated here, because two copies of a colour is how a
design system starts lying. Every value carries its reasoning as a comment
beside it, and every colour is asserted by `src/styles/tokens.test.ts`.

This document records what changed, why, and what it measurably bought.

## What changed

### 1. Category hues, new

Five identifying hues, light and dark, one per category. Solved rather than
picked: each is the most saturated value at its hue that still clears 4.5:1
against `--bg`, `--surface` and `--sunken`. Derivation and the full table are in
`INFORMATION_ARCHITECTURE.md` section 3.

They are exposed to Tailwind as `--color-cat-*`, so a mark can take its category
hue without a component hard-coding a value.

### 2. Type ramp, raised

The floor moves from 11px to 12px and the lower half of the ramp shifts with it.
The upper half (22px and above) is untouched, because headings were never the
problem.

| Step | Was | Now |
| --- | --- | --- |
| `--text-2xs` | 11px | 12px |
| `--text-xs` | 12px | 13px |
| `--text-sm` | 13px | 14px |
| `--text-base` | 15px | 16px |
| `--text-lg` | 17px | 18px |
| `--text-xl` and above | unchanged | unchanged |

The rule this establishes, and which `tokens.test.ts` now enforces: **no step in
the ramp is below 12px, and prose never uses the bottom step.**

### 3. Rule weights, new

`--border-weak` joins `--border` and `--border-strong`. One border colour could
not separate a row from a section, so every rule on a category page carried the
same weight and the hierarchy read flat. A row now sits on a weaker line than a
group boundary does.

### 4. Edge, new

`--edge` is an inset hairline for the top of a recessed surface. This is the
mechanism behind principle 1, "machined, not floating": it buys depth without a
drop shadow. It is strongest in dark mode, where a 5% white inset reads as a
milled edge.

### 5. Shadow, exactly one

`--shadow-overlay` is the only drop shadow token on the site, and it is named
for its only permitted use. The command palette genuinely floats above the page.
Nothing else does.

### 6. Mark geometry, new

`--mark-size` 20px and `--mark-gutter` 28px. The drawing spec sits in the
comment beside them: 24 unit grid, 1.5 stroke, butt caps, miter joins. Butt and
miter rather than round, because a rounded cap at 20px reads as a soft consumer
icon and this set is meant to read as engraving.

## What this bought, measured

Lighthouse 12, production build, real COOP and COEP headers, same machine and
same method as the baseline in `DESIGN_BRIEF.md` section 2.

| Page | Legible text | Best practices | Performance |
| --- | --- | --- | --- |
| `/` | FAIL 44.34% to **PASS** | 93 to **96** | 98, unchanged |
| `/pdf` | FAIL 52.6% to **PASS** | 93 to **96** | 97, unchanged |
| `/pdf/merge` | PASS to PASS | 96, unchanged | 95 to **96** |

Accessibility stayed at 100 and CLS stayed at 0 on all three.

**The single defect found in Phase 2 is fixed by the token change alone**,
before a single component was touched. That is the argument for fixing it in
`tokens.css` rather than in one component at a time: it landed on all 137 pages
at once.

## Verification

- `npm run lint` clean.
- `npm run typecheck` clean, 169 files, 0 errors.
- `npm test`: 301 unit tests pass across 23 files, up from 289.
- `tokens.test.ts` is 30 tests, up from 18.
- **The new assertions were mutation tested**, because a test that cannot fail
  proves nothing. Restoring the 11px floor fails "has no step below 12px".
  Lightening `--cat-image` to `#7fe04a` fails with
  `--cat-image on --bg: expected 1.658... to be greater than or equal to 4.5`.

### Deliberately not asserted

That the five hues differ from each other in luminance. They are isoluminant by
construction, so their pairwise contrast is 1.00:1 and in greyscale they are
five identical greys. Separating them in lightness would make PDF, at 18 tools,
shout over Calculators at one. The mitigation is structural instead: colour is
redundant encoding, and the mark's shape carries the meaning. The reasoning is
written into `tokens.test.ts` beside the test so it is not silently "fixed"
later by someone who reads the 1.00:1 as a bug.

## Still to do in the build

Tokens alone do not finish the job. These are Phase 6 work:

- Tool blurbs still reference the ramp's bottom step in `ToolRow.astro`. They
  should move up, so that the floor is reserved for counts and calibration.
- `--border-weak` is defined and not yet used anywhere.
- `--edge` is defined and not yet used anywhere.
- `--shadow-overlay` is defined and the command palette does not yet take it.
- The 43 marks do not exist yet.
