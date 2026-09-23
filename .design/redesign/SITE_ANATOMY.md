# Nhako Tools: complete site anatomy

A full description of the site as it stands, written so a redesign can start
from fact rather than from memory. Every number here was read out of the source
or measured against a production build on 2026-09-23, not recalled.

Live at [tools.nhako.com](https://tools.nhako.com). Repository root is
`~/Documents/Work/Nhako-tools`.

**How to read this**: sections 1 to 12 describe what exists. Section 13 is the
one to read first if you are about to change things, because it separates what
is load-bearing from what is free to redesign.

---

## 1. At a glance

| | |
| --- | --- |
| Tools | 43 |
| Preset pages (tool variants) | 15 |
| Total pages | 137 (68 English, 68 Malay, plus `/404`), verified by file count |
| Categories | 5 (PDF 18, Image 11, Developer 9, Media 4, Calculators 1) |
| Job groups | 15, across PDF, Image and Developer only |
| Curated collections | 1 (`/malaysia`, 8 entries) |
| Languages | English at root, Bahasa Melayu under `/ms` |
| Page templates | 7 views |
| Preact components | 15, of which 10 mount as islands |
| Site JavaScript on the homepage | 0 KB external |
| Largest runtime | LibreOffice WASM, 76 MB, lazy |
| Total vendor payload on disk | 161 MB, none of it loaded unless used |
| Unit tests | 289 across 23 files |
| End to end tests | 298 across Chromium and WebKit |

**The one sentence that explains the product**: every tool runs in the
browser, so there is no upload, no queue, no size cap, no account.

**Positioning decision that drives the design** (from
`.design/nhako-tools-rebuild/DESIGN_BRIEF.md`): the wedge is **speed, not
privacy**. "No upload, no queue, no cap, no account" is felt in two seconds; a
privacy claim has to be trusted. Privacy is the mechanism, never the headline.

---

## 2. Stack and architecture

| Layer | Choice | Note |
| --- | --- | --- |
| Framework | Astro 5, `output: 'static'` | One prerendered page per tool, for SEO |
| Islands | Preact 10 via `preact/compat` | Measured 202 KB to 32 KB of tool-page JS versus React |
| Language | TypeScript 5.7, strict | `astro check` plus `tsc --noEmit` |
| Styling | Tailwind v4 through `@tailwindcss/vite` | No `tailwind.config.js`; theme lives in CSS |
| Fonts | Instrument Sans Variable, JetBrains Mono Variable | Self-hosted via `@fontsource-variable` |
| Unit tests | Vitest 3 | |
| Browser tests | Playwright, Chromium and WebKit | WebKit is the Safari stand-in |
| Accessibility | `@axe-core/playwright` | Plus a manual AT-SPI pass |
| Hosting | Vercel, static | `vercel.json` carries headers and redirects |
| Analytics | Vercel Web Analytics, cookieless | 3.2 KB, production only |

**Pin to remember**: `@astrojs/preact@^4`. Version 6 targets Astro 6 and fails
to resolve `astro:preact:opts`.

### The architectural rule

`src/tools/registry.ts` is the single source of truth. Routes, page metadata,
the homepage grid, category pages, the command palette and the sitemap are all
derived from one array. A tool that is not in it has no page, and a duplicate id
fails the build. This structurally eliminated four bugs the previous build
shipped, including a dead slug that rendered a working-looking page doing
nothing.

Metadata is deliberately separated from implementation. The registry imports
only metadata, so `getStaticPaths()` can enumerate all 43 tools at build time
without pulling pdf-lib, ffmpeg and transformers.js into the graph.
Implementations are reached through `src/tools/loaders.ts`, which dynamic
imports one module per tool on demand.

```
src/
  tools/registry.ts     the source of truth, 43 entries
  tools/types.ts        ToolMeta contract, categories, option specs
  tools/groups.ts       job group taxonomy and nav order
  tools/collections.ts  curated cross-category pages
  tools/loaders.ts      one dynamic import per tool
  tools/apps.ts         the 7 tools with a bespoke interface
  tools/search-index.ts what the command palette can find
  views/                7 page templates
  components/astro/     8 server-rendered pieces of chrome
  components/react/     15 components (10 mount as islands) plus 4 helpers
  lib/                  shared engines (pdf, ffmpeg, ocr, qpdf, docx, relay)
  i18n/                 all text, both languages
  styles/tokens.css     the design system
  styles/motion.css     all animation
  workers/              off-main-thread tool execution
```

---

## 3. Route map

URL shape: `/<category>`, `/<category>/<tool>`, `/<category>/<tool>/<variant>`.
Flat, two or three segments, no `/tool/` prefix. Every segment is a word someone
would actually search for. `trailingSlash: 'never'`, enforced in both
`astro.config.mjs` and `vercel.json`.

Every page below mirrors under `/ms`. Path segments are **not** translated:
`localePath()` only prefixes, so Malay lives at `/ms/pdf/merge`.

### Static pages

`/` `/about` `/privacy` `/404` `/malaysia`

### Category pages (5)

`/pdf` `/image` `/media` `/dev` `/calc`

### PDF, `/pdf/*` (18 tools, 8 presets)

| URL | Tool | Group |
| --- | --- | --- |
| `/pdf/merge` | Merge PDF | Organise pages |
| `/pdf/split` | Split PDF | Organise pages |
| `/pdf/rotate` | Rotate PDF | Organise pages |
| `/pdf/organize` | Organize PDF | Organise pages |
| `/pdf/crop` | Crop PDF | Organise pages |
| `/pdf/jpg-to-pdf` | JPG to PDF | Create a PDF |
| `/pdf/office-to-pdf` | Office to PDF | Create a PDF |
| `/pdf/office-to-pdf/word` | Word to PDF | preset |
| `/pdf/office-to-pdf/excel` | Excel to PDF | preset |
| `/pdf/office-to-pdf/powerpoint` | PowerPoint to PDF | preset |
| `/pdf/scan` | Scan to PDF | Create a PDF |
| `/pdf/to-image` | PDF to JPG | Convert and extract |
| `/pdf/to-text` | PDF to text | Convert and extract |
| `/pdf/to-word` | PDF to Word | Convert and extract |
| `/pdf/ocr` | OCR PDF | Convert and extract |
| `/pdf/watermark` | Watermark PDF | Edit and sign |
| `/pdf/sign` | Sign PDF | Edit and sign |
| `/pdf/page-numbers` | Add page numbers | Edit and sign |
| `/pdf/compress` | Compress PDF | Reduce file size |
| `/pdf/compress/{100kb,200kb,500kb,1mb,2mb}` | size presets | preset |
| `/pdf/protect` | Protect PDF | Password and permissions |
| `/pdf/unlock` | Unlock PDF | Password and permissions |

### Image, `/image/*` (11 tools, 7 presets)

| URL | Tool | Group |
| --- | --- | --- |
| `/image/compress` | Compress image | Reduce file size |
| `/image/compress/{20kb,50kb,100kb,200kb,500kb,1mb,spa-myresume}` | size presets | preset |
| `/image/convert` | Convert image | Convert |
| `/image/heic-to-jpg` | HEIC to JPG | Convert |
| `/image/resize` | Resize image | Resize, crop and rotate |
| `/image/crop` | Crop image | Resize, crop and rotate |
| `/image/rotate` | Rotate image | Resize, crop and rotate |
| `/image/watermark` | Watermark image | Edit a photo |
| `/image/remove-background` | Remove background | Edit a photo |
| `/image/remove-metadata` | Remove photo metadata | Extract and clean |
| `/image/ocr` | Image to text (OCR) | Extract and clean |
| `/image/passport-photo` | Passport photo maker | Create |

### Developer, `/dev/*` (9 tools)

| URL | Tool | Group |
| --- | --- | --- |
| `/dev/json` | JSON formatter | Text and code |
| `/dev/diff` | Text diff | Text and code |
| `/dev/word-count` | Word counter | Text and code |
| `/dev/base64` | Base64 converter | Encode and hash |
| `/dev/jwt` | JWT decoder | Encode and hash |
| `/dev/hash` | Hash generator | Encode and hash |
| `/dev/uuid` | UUID generator | Generate |
| `/dev/qr` | QR code generator | Generate |
| `/dev/css-shadow` | CSS shadow generator | Generate |

### Media, `/media/*` (4 tools, no groups)

`/media/compress-video` `/media/extract-audio` `/media/transcribe`
`/media/teleprompter`, plus `/media/teleprompter/remote` which is `noindex` and
kept out of the sitemap because it is useless without a room code.

### Calculators, `/calc/*` (1 tool, no groups)

`/calc/take-home-pay`

### Redirects

13 permanent 301s in `vercel.json`, mapping every URL the old site shipped
(`/tool/merge-pdf` and friends) onto the current structure. Search equity is the
only asset carried forward from the old build, so these are load-bearing.
`registry.test.ts` asserts every redirect target resolves to a real tool and
that every legacy slug is covered.

---

## 4. The tool contract

Everything a tool page renders comes from one object. This is the schema a
redesign has to respect, or change deliberately.

```ts
interface ToolMeta {
  slug: string;              // path segment within the category
  category: 'pdf' | 'image' | 'calc' | 'media' | 'dev';
  name: string;              // display name and <h1>, never derived from slug
  seoTitle?: string;         // when the default title reads wrong
  blurb: string;             // one line, used as row and page subtitle
  description: string;       // <meta description>, written for a search result
  keywords: string[];        // drives palette and on-page search
  kind: 'file' | 'text' | 'text2' | 'app';
  accept?: string;           // file input filter
  multiple?: boolean;
  options?: OptionSpec[];    // declarative, one renderer serves every tool
  limits?: string[];         // what the tool cannot do, rendered on the page
  about?: string;            // "What this does" prose
  related?: string[];        // fully qualified ids, e.g. 'pdf/split'
  generator?: boolean;       // output from options alone, input pane hidden
  heavy?: boolean;           // needs a large runtime, gets a real progress bar
  variants?: ToolVariant[];  // preset landing pages
  group?: string;            // job group within its category
  alsoIn?: GroupRef[];       // extra browse locations, never a second home
}
```

### Option kinds

Five, and one generic renderer (`OptionsPanel.tsx`) serves all of them:
`select`, `number`, `range`, `toggle`, `text`. Each can carry a `when`
condition so an option only appears while another has a given value.

### Tool kinds, and what each renders

| Kind | Count | Renders | Island |
| --- | --- | --- | --- |
| `file` | 27 | A drop zone, options, result row | `FileToolRunner.tsx` |
| `text` | 8 | One text pane in, one out | `TextToolPane.tsx` |
| `text2` | 1 | Two input panes (diff) | `TextToolPane.tsx` |
| `app` | 7 | Its own bespoke interface | one component each |

The 7 `app` tools and their components: Passport photo maker
(`PhotoMaker.tsx`, 473 lines), Salary calculator (`SalaryCalculator.tsx`, 262),
Organize PDF (`OrganizePdf.tsx`, 231), Sign PDF (`SignPdf.tsx`, 460), Crop image
(`CropImage.tsx`, 202), Teleprompter (`Teleprompter.tsx` plus
`TeleprompterStage.tsx`, 1009 combined), Scan to PDF (`ScanToPdf.tsx`, 347).

**10 tools are `heavy`**: they pull a large WebAssembly runtime and get a real
progress bar. The rest do not, because a progress bar on a 400ms task makes it
feel slower.

---

## 5. Taxonomy: categories, groups, cross-listings

### Categories

Five. The display label and the URL segment differ in one case: `dev` in the
URL for brevity, "Developer" on screen.

| id | Label | Label (BM) | Tools | Grouped |
| --- | --- | --- | --- | --- |
| `pdf` | PDF | PDF | 18 | yes |
| `image` | Image | Imej | 11 | yes |
| `dev` | Developer | Pembangun | 9 | yes |
| `media` | Media | Media | 4 | no |
| `calc` | Calculators | Kalkulator | 1 | no |

### The grouping rule

`GROUP_THRESHOLD = 6` in `src/tools/groups.ts`. A category is sub-grouped only
when it holds **more than six** tools. Below that a heading over two rows costs
a glance and returns nothing. The threshold is a rule rather than a per-category
flag, so a category that grows past it starts being grouped without anyone
remembering to switch it on, and `registry.test.ts` fails until its groups are
written.

Six groups is the practical ceiling, also enforced by test. A seventh means the
taxonomy needs re-cutting, which should be a deliberate decision.

### The 15 groups

| Category | Group id | Label | Label (BM) | Tools |
| --- | --- | --- | --- | --- |
| pdf | `organise` | Organise pages | Susun halaman | 5 |
| pdf | `create` | Create a PDF | Buat PDF | 3 |
| pdf | `extract` | Convert and extract | Tukar dan ekstrak | 4 |
| pdf | `mark-up` | Edit and sign | Sunting dan tandatangan | 3 |
| pdf | `shrink` | Reduce file size | Kecilkan saiz fail | 1 |
| pdf | `secure` | Password and permissions | Kata laluan dan kebenaran | 2 |
| image | `shrink` | Reduce file size | Kecilkan saiz fail | 1 |
| image | `convert` | Convert | Tukar format | 2 |
| image | `transform` | Resize, crop and rotate | Ubah saiz, potong dan putar | 3 |
| image | `edit` | Edit a photo | Sunting foto | 2 |
| image | `clean` | Extract and clean | Ekstrak dan bersihkan | 2 |
| image | `create` | Create | Hasilkan | 1 |
| dev | `text` | Text and code | Teks dan kod | 3 |
| dev | `encode` | Encode and hash | Enkod dan hash | 3 |
| dev | `generate` | Generate | Jana | 3 |

Two groups hold a single tool on purpose. `shrink` in both PDF and Image holds
Compress, which carries 5 and 7 preset chips respectively, so the group renders
as a substantial block rather than a lonely row. Using the same label in both
places is deliberate: the same job gets the same words.

### Cross-listings

Three. A tool keeps exactly one canonical home and one URL, but may appear in a
second category's browse list where someone would plausibly look for it first.

| Tool | Canonical | Also shown in | Why |
| --- | --- | --- | --- |
| JPG to PDF | `/pdf/jpg-to-pdf` | Image, Convert | The person is holding photos, not a PDF |
| PDF to JPG | `/pdf/to-image` | Image, Convert | They want images out |
| QR code generator | `/dev/qr` | Image, Create | A QR code is an image; nobody thinks "developer tool" |

A cross-listed tool renders identically to any other row. No badge, no dimming,
no "also in" note.

`alsoIn` holds typed objects, `{ category, group }`, never `'image/convert'`
strings. That string form is ambiguous: `image/convert` is simultaneously a real
tool id and a real group reference, and `pdf/to-image` already carries the tool
in `related`. A test caught the collision, so the two namespaces are kept
structurally apart.

**Counts label the category, not the page.** `/image` shows 14 rows but prints
11, because three of those rows are cross-listed in. Counting rows would make
the five category pages sum to 46 against a catalogue of 43.

### Collections

Editorial, hand-ordered, defined in `src/tools/collections.ts`. One exists.

`/malaysia`, 8 entries, each carrying a context line in both languages that
explains why it belongs: Passport photo maker, Salary calculator, Compress PDF
to 500 KB (the SSM, LHDN, JPA and UPU portal ceiling), Compress image to 200 KB,
Compress image for SPA MyResume, OCR PDF, Image to text, Audio to text.

A collection uses its own curated list rather than `alsoIn`, because its
ordering is editorial and its context lines are per entry.

### Navigation order

`NAV_CATEGORIES = ['pdf', 'image', 'media', 'dev']`, plus Malaysia appended.
Ordered by catalogue weight with the distinctive one last. **Calculators is
deliberately absent from the nav**: one tool does not earn a slot in a row of
five, and it stays reachable from the homepage, the footer and the Malaysia
page.

---

## 6. Page templates

Seven views in `src/views/`. Every page on the site is one of these.

### 6.1 `BaseLayout.astro`, wraps everything

Order in the document: skip link, `Nav`, `<main id="main">`, `Footer`.

Head contains: title, description, canonical, `hreflang` alternates for both
locales plus `x-default`, favicon, apple touch icon, manifest, sitemap link, Open
Graph and Twitter cards, theme-color for both schemes, optional JSON-LD.

Two inline scripts, both deliberate:
- **Theme resolution**, blocking, before first paint. The previous build
  resolved theme in a `useEffect` that only ran on the homepage, so a tool page
  opened directly ignored the saved theme and flashed the wrong one.
- **Service worker registration**, after `load`, so it never competes with the
  page's own resources on a first visit.

Props: `title`, `description`, `path` (locale-free), `locale`, `alternates`,
`keywords`, `jsonLd`, `category` (picks the social image), `documentTitle`,
`noindex`.

### 6.2 `HomeView.astro`, the catalogue (`/`, `/ms`)

```
nav
hero: h1 headline + subtitle + body + search field + status line   | HeroReadout
--------------------------------------------------------------------------------
PDF ...................................................................... 18
  Organise pages
  ── Merge PDF ──────── Split PDF ──────── Rotate PDF ───   (2 or 3 columns)
  Create a PDF
  ...
Image ..................................................................... 11
Calculators ................................................................ 1
Media ...................................................................... 4
Developer .................................................................. 9
--------------------------------------------------------------------------------
[no results message, hidden until needed]
footer
```

All 43 tools are in the HTML. That is what lets the search field filter with
almost no JavaScript and keeps the homepage at 0 KB of external site JS.

Each tool appears **exactly once**: cross-listings are a category-page
affordance only, because on the catalogue itself a row appearing twice would
make the count disagree with the heading.

Category headings link to the category page. Counts are mono. Group headings
appear only for PDF, Image and Developer.

### 6.3 `CategoryView.astro`, the browse page (10 pages)

```
nav
Tools / PDF
PDF ─────────────────────────────────────────────────────── 18
Merge, split, convert, sign, compress and protect PDFs. Every tool runs...

ORGANISE PAGES
  Merge PDF              Combine several PDFs into one file.
  Split PDF              Extract every page into a separate PDF.
  ...
REDUCE FILE SIZE
  Compress PDF           Shrink a PDF, or get it under an exact size.
  [100 KB] [200 KB] [500 KB] [1 MB] [2 MB]
...
All 43 tools
footer
```

Single column, `max-w-4xl`, tabular: a fixed 208px name column then the blurb.
Rows are bordered. Preset chips sit under their parent tool, indented to the
blurb column, in the mono face. Group headings are uppercase with wide tracking.
Carries `CollectionPage` JSON-LD including a `BreadcrumbList`.

Flat or grouped is decided by the tool count, not a per-page flag.

### 6.4 `CollectionView.astro`, `/malaysia` and `/ms/malaysia`

Same shell as a category page, but each row shows a **context line** in place of
the tool's own blurb, and the order is hand-set. Ends with a sources note.
Entries are resolved at build time, so a broken entry is a build error rather
than a row rendering "undefined".

### 6.5 `ToolView.astro`, 125 of the 137 pages

```
nav
Tools / PDF                                    (breadcrumb, category links to /pdf)
Merge PDF
Combine several PDFs into one file.

[ THE TOOL ITSELF: drop zone or text panes or bespoke app ]

────────────────────────────────────────────────────────
What this does      prose
Limits              bulleted, honest, what it cannot do
Sources             calculators only, each with a checked date
Is this private?    "Yes, and you can check rather than take our word for it"
Presets             chips to sibling variants
Related tools       3 cards
footer
```

**The tool sits above the fold and the prose below it.** Most tool sites invert
this and make you scroll past marketing to reach the thing.

The privacy note is selected per tool: transcription, the photo maker,
teleprompter, background removal and calculators each get their own wording,
heavy tools get one about the WebAssembly engine, everything else gets "the
whole site is static files". Carries `SoftwareApplication` JSON-LD priced at 0.

### 6.6 `AboutView` and `PrivacyView`

Static prose pages.

### 6.7 `RemoteView`, `/media/teleprompter/remote`

The phone remote for the teleprompter. `noindex`, excluded from the sitemap. The
room code lives in the URL fragment and is stripped by an inline script before
analytics runs.

---

## 7. Global chrome

### Nav (`Nav.astro`), on every page, zero JavaScript

```
[N] NhakoTools •   PDF  Image  Media  Developer  Malaysia    [Search ⌘K] [BM] [◐]
```

- Logo mark plus wordmark. The wordmark hides below 640px so the category row
  has room; the mark alone still links home.
- A pulsing dot beside the wordmark, titled "Everything runs locally in your
  browser". It is the one piece of ambient motion on a tool page.
- Five links to real pages. `aria-current="page"` marks the active one, and a
  tool page marks its own category, so `/pdf/merge` still highlights PDF.
- Below 768px the row becomes a **horizontally scrollable container**, not a
  menu: no open state, no focus trap, no script. Scrollbar hidden.
- Sticky, `z-40`, translucent background with `backdrop-blur-sm`.
- `view-transition-name: nav`, so the chrome persists across navigations.

Touch sizing: 44px tall with 8px gaps on a coarse pointer, 31px with 4px on a
mouse, via the `pointer-coarse:` variant.

### Command palette (`CommandPalette.astro`)

Opened by the button or Ctrl/Cmd+K. A `role="dialog"` with `aria-modal`, a
combobox input and a `role="listbox"` of up to 8 results.

- The index is **serialised into the page as JSON**, not imported as code, so
  the full registry never ships to the browser as executable JavaScript.
- Indexes all 43 tools **and all 15 presets**, built by
  `src/tools/search-index.ts`. Typing "500kb", "500 kb" or "500" all resolve.
- Keywords carry both languages, so "gabung" and "merge" work on either locale.
- Ranking (`search.ts`): exact name 400, name contains query 200, keyword exact
  150, and per-term bonuses. A preset takes a 10 point penalty so it never
  outranks its parent on an equal match.
- Tab is trapped to the input; options are reached with arrows. Without that,
  Tab walked out to the theme toggle behind the overlay.
- `aria-activedescendant` follows the highlight.
- The list re-renders only when the highlight actually moves. Re-rendering on
  every `mouseenter` destroyed the node under the cursor and swallowed clicks.

### Footer (`Footer.astro`)

Two rows: a browse nav (PDF, Image, Media, Developer, Calculators, Malaysia) and
a line with the logo, the tagline "Every tool runs in your browser. Nothing is
uploaded.", then About, Privacy, Source, and `MIT © <year>`.

Deliberately thin. The old footer carried nine links to pages that did not exist
plus three `<div>`s styled as social buttons. Footer links are 44px tall on a
coarse pointer.

### Theme toggle (`ThemeToggle.astro`)

Present on every page. Writes to `localStorage`, read back by the blocking
inline script in `BaseLayout`.

### Hero readout (`HeroReadout.astro`)

A terminal-style panel on the homepage that types out five rows: `runtime
local`, `uploaded 0 bytes`, `tools 43 ready`, `queue none`, `account not
required`. The script is inline to preserve the 0 KB homepage budget, and with
no JavaScript the whole readout renders as static text.

### Skip link

First focusable element, visually hidden until focused, jumps to `#main`.

---

## 8. Design system

Everything lives in `src/styles/tokens.css`. There is no `tailwind.config.js`;
Tailwind v4 reads the theme from `@theme inline`.

**Philosophy: "Precision Instrument".** Dense, sharp radii, fast flat easing,
numbers always mono.

### Colour

The brand accent `#FF91E7` is fixed. It is pale: white text on it is 2.01:1, so
it can never carry text on a light background. Shades 600 and 700 are the
derived interactive variants that pass AA. Hue is locked to 313.1deg throughout.

```
--pink-50  #fcf3fa    --pink-400 #ff52d9    --pink-800 #86036a
--pink-100 #f8e7f4    --pink-500 #ff1acd    --pink-900 #5a0246
--pink-200 #ffc2f2    --pink-600 #c7009b  <- interactive, light. white 5.38:1
--pink-300 #ff91e7  <- BRAND, identity, dark-mode text
                       --pink-700 #a80083  <- hover/active, light
```

Neutrals run `--gray-0` #ffffff through `--gray-950` #0b0b0e, plus `--ink`
#131316.

Semantic variables are the only thing components use:

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` | `--gray-0` | `--gray-950` |
| `--surface` | `--gray-25` | `--gray-900` |
| `--sunken` | `--gray-50` | `--gray-850` |
| `--border` | `--gray-200` | `--gray-800` |
| `--border-strong` | `--gray-300` | `--gray-700` |
| `--text` | `--ink` | `#f2f2f5` |
| `--text-muted` | `--gray-500` | `#9a9aa8` |
| `--accent` | `--pink-600` | `--pink-300` |
| `--accent-hover` | `--pink-700` | `--pink-200` |
| `--ok` / `--warn` / `--err` | `#0f7a3d` / `#8a5300` / `#b4231e` | `#4ade80` / `#fbbf24` / `#ff7a75` |

On dark, the brand pink is usable directly (9.79:1 on `--bg`), so identity and
interaction converge. That is the one place they are allowed to.

**Every contrast pair is asserted by `src/styles/tokens.test.ts`, 18 tests.** Do
not hand-edit a colour without running the suite.

### Type

Two families, both self-hosted variable fonts: Instrument Sans for prose,
JetBrains Mono for numbers and readouts.

```
--text-2xs  11px   labels, counts, tool blurbs
--text-xs   12px
--text-sm   13px   body default in dense UI, and the <body> size
--text-base 15px
--text-lg   17px
--text-xl   22px
--text-2xl  28px   tool page h1
--text-3xl  36px
--text-4xl  48px   home headline
```

Body line height 1.55. Headings 600 weight, `-0.02em` tracking, 1.2 line height.

**Numbers are always mono.** `[data-numeric]`, `<output>` and `.tabular` get the
mono face with `tabular-nums`. The comment in `tokens.css` calls this "the
single most load-bearing detail in the philosophy: it is what makes the product
read as an instrument."

### Radius

4, 6 (default), 8, 12, and full. Never 24. Precision reads sharp.

### Motion (`src/styles/motion.css`)

Two easings only: `--ease-out` `cubic-bezier(0.2, 0, 0, 1)` and `--ease-in-out`
`cubic-bezier(0.4, 0, 0.2, 1)`. Two durations: `--dur-fast` 120ms, `--dur`
180ms. No overshoot, because bounce reads slow.

The governing rule, from a dated amendment to the rebuild brief: motion must
read as **machinery working, never as decoration**.

Two hard rules:
1. **Nothing on a tool page's critical path moves.** The drop zone, options and
   result row stay still. Someone waiting for their file should never be
   watching an animation instead.
2. **Everything reserves its space up front.** CLS is 0 and stays 0.

What exists:
- Cross-document view transitions via the `@view-transition` at-rule, 140ms.
  One CSS rule replaces what Astro's `<ClientRouter />` would ship a whole
  client runtime to do.
- Scroll-driven reveals on `[data-reveal]` and `[data-reveal-rule]`, guarded by
  `@supports (animation-timeline: view())`.
- Reveals move only, never fade. Fading text in means it spends the animation
  below AA contrast, which axe caught at 1.87:1 on tool page prose.
- The nav runtime dot, a 2.8s pulse.
- The hero readout cursor blink.
- `prefers-reduced-motion: reduce` flattens durations globally and asserts end
  states for the cases that need it.

### Focus

`:focus-visible` gets a 2px `--accent-ring` outline at 2px offset, 2px radius.
`:focus:not(:focus-visible)` gets none.

---

## 9. Content and i18n

All text lives in `src/i18n/`, 1036 lines across five files.

| File | Holds |
| --- | --- |
| `paths.ts` | `localePath()`, `localeFromPath()`, the two locales |
| `ui.ts` | 59 page-level strings, English and Malay |
| `island.ts` | Strings used inside interactive components |
| `tools.ts` | Malay text for every tool, option, choice and variant, 656 lines |
| `index.ts` | The barrel. Islands import from `./paths` and `./ui` directly, because this barrel also re-exports every tool's Malay text, which has no business in a browser bundle |

`ms` is typed as `typeof en`, so a string added in English and forgotten in
Malay is a **compile error**, not a blank on the page. `i18n.test.ts` additionally
fails on a tool, option, choice, variant or group label missing a translation,
and on a stale key that names nothing real.

### Copy rules in force

- **Zero em dashes anywhere in the repository.** Site copy, README, code
  comments, tests and `.design/` documents. This was swept once and is kept.
- Tab titles are `<Tool> online, free, no upload | Nhako Tools`. This reversed
  an earlier "page name alone" decision.
- Category titles are `Free <Label> tools online, no upload | Nhako Tools`.
- Limits are written honestly: saying what a tool cannot do is both more useful
  and better content than keyword filler.
- Category intros carry **no tool counts**, because a number written into prose
  goes stale the moment a tool is added, and the count is already rendered from
  the registry beside the heading.
- Preset `short` labels are untranslated by design: every value is a file size
  or a product name.

---

## 10. SEO and metadata

| Element | Source |
| --- | --- |
| `<title>` | `t.toolTitle(name)`, or `seoTitle`, or `t.categoryTitle(label)` |
| `<meta description>` | `tool.description`, written for a search result, length-checked by test |
| Canonical | Built from the locale-free `path` prop |
| `hreflang` | Both locales plus `x-default`, on every page with a twin |
| Open Graph | Six images under `/og/`: one per category plus a default, generated by `scripts/og-images.mjs` |
| Sitemap | `@astrojs/sitemap` with i18n cross-linking; excludes the teleprompter remote |
| `robots.txt` | In `public/` |
| JSON-LD | `WebSite` with `SearchAction` on the homepage, `CollectionPage` with `BreadcrumbList` on category and collection pages, `SoftwareApplication` on tool pages |

The homepage `SearchAction` target is `?q={search_term_string}`, and the
homepage filter honours `?q=` on load, so the declared action actually works.

---

## 11. Performance, offline and assets

### The budget that matters

**The homepage ships 0 KB of external site JavaScript.** The only `src=` script
is Vercel analytics at 3.2 KB, production only. The hero readout and the search
filter are inline. This is stated in the rebuild brief as non-negotiable.

Measured HTML weights: homepage 64 KB, `/pdf` 48 KB, a tool page 40 KB,
`/malaysia` 40 KB.

### JavaScript chunks, all lazy

| Chunk | Size | Pulled by |
| --- | --- | --- |
| `ort-web.min` | 548 KB | background removal |
| Preact/React compat bundles | 428 KB each | any island |
| `pdf` | 396 KB | anything reading a PDF |
| `transformers` | 224 KB | transcription |
| `jszip` | 96 KB | split, batch outputs |
| `libheif` | 88 KB | HEIC conversion |
| `qpdf` | 44 KB | protect and unlock |
| `Teleprompter` | 32 KB | teleprompter |

One CSS file, 52 KB, shared by every page.

### Vendor runtimes, self-hosted, 161 MB on disk

| Runtime | Size | Used by |
| --- | --- | --- |
| LibreOffice WASM | 76 MB | Office to PDF |
| ONNX runtime plus models | 37 MB | background removal |
| ffmpeg core | 31 MB | video and audio |
| Tesseract | 12 MB | OCR |
| Tesseract language data (eng, msa) | 4 MB | OCR |
| libheif | 1.5 MB | HEIC |
| qpdf | 1.3 MB | protect and unlock |

**None of it loads unless you open the tool that needs it.** Served from
versioned paths, `/vendor/{name}/{version}/`, because the service worker caches
`/vendor/` forever and Vercel marks it immutable. An unversioned path would pin
returning visitors to whatever they downloaded first.

ONNX is self-hosted specifically so Hugging Face is the only third party, and
it is only reached for model weights, never for user data.

### Service worker

Precaches **only the shell**: home, about, privacy and 404 in both languages,
plus CSS and latin font subsets. 10 files, 415 KB.

Deliberately excluded, with reasons recorded in `scripts/build-sw.mjs`: every
tool dependency chunk, the ffmpeg core, the ONNX runtime, the Whisper weights,
and all 125 tool pages. Precaching tool pages alone would cost a first-time
visitor over a megabyte for pages they will mostly never open.

Practical result: after one visit the homepage works offline, and any tool works
offline once you have opened it once.

### Cross-origin isolation

`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` are set in both `vercel.json` and
`astro.config.mjs`. ffmpeg.wasm needs `SharedArrayBuffer`, which needs isolation.
**Changing one without the other silently breaks every media tool.**
`npm run preview` uses `scripts/preview.mjs` rather than Astro's preview
specifically to mirror these headers locally.

---

## 12. Accessibility, states and testing

### Accessibility as built

- Heading outline is walkable: `h1` then category `h2` then group `h3` on the
  homepage, `h1` then group `h2` on a category page, verified with no level
  skips.
- `aria-current="page"` on the active nav item.
- Preset chips show "500 KB" but their accessible name is the full
  "Compress PDF to 500 KB". Verified through the AT-SPI tree, which is what
  Orca consumes, rather than inferred.
- Touch targets are 44px with 8px separation on coarse pointers.
- The filter's result count is a `role="status"` live region.
- Contrast is asserted by `tokens.test.ts`, not eyeballed.
- The palette traps Tab, exposes `aria-activedescendant`, and its options carry
  no nested interactive children.
- `prefers-reduced-motion` is honoured globally.

### Interaction states that exist

Rows and chips have default, hover, focus-visible and active. The homepage
filter covers: matches, empty group hidden, empty category hidden, no results at
all, `?q=` deep link on load, and cleared. File tools have idle, file loaded,
running with progress (heavy tools only), result, and error with an actionable
message.

### Test inventory

| Suite | Count | Covers |
| --- | --- | --- |
| `registry.test.ts` | 31 | ids, slugs, categories, related links, options, variants, redirects, the whole group taxonomy |
| `dev-tools.test.ts` | 57 | the 9 developer tools |
| `calc.test.ts` | 34 | payroll maths against official worked examples |
| `teleprompter.test.ts` | 22 | script handling |
| `tokens.test.ts` | 18 | every contrast pair |
| `lib.test.ts` | 17 | shared helpers |
| `search.test.ts` | 14 | ranking, and that presets resolve |
| `phase2.test.ts`, `pdf-tools`, `word-layout`, `scan`, `pdf-geometry` | 39 | PDF engines |
| others | 57 | i18n, images, media, workers, loaders |
| **Unit total** | **289** | across 23 files |
| **End to end** | **298** | Chromium and WebKit, against a production build |
| `scripts/sweep.mjs` | 29/29 | drives every tool in a real browser and reports what actually happens |

**The e2e suite is not deterministically green.** Across three consecutive full
runs, one or two heavy WebAssembly tests failed each time and never the same
ones. Each passes in isolation. This is contention under four parallel workers,
and the LibreOffice hang is already documented as roughly 1 in 12 loads.

### Verification tooling on this machine

- Playwright WebKit needs `libavif16`, `libgav1-1` and `libyuv0`, fetched
  without root and symlinked into the webkit build. `LD_LIBRARY_PATH` does not
  work because the MiniBrowser wrapper resets it.
- Screen reader checks run Chrome with `--force-renderer-accessibility` and a
  remote debugging port, driven over CDP, with the tree read through AT-SPI.
- Lighthouse: `CHROME_PATH=/usr/bin/google-chrome npx -y lighthouse@12 <url>`.

### Known open items

- Lighthouse has not been run since the motion round.
- Nothing has been verified against the deployed site.
- Orca's actual speech output has not been captured.
- No native Malay speaker has reviewed the translations.
- `nhako.com` apex has no public A record, and `www` points at a Tailscale CGNAT
  address. Check DNS with `dig @1.1.1.1`, because Tailscale MagicDNS makes local
  answers lie.
- `README.md` still says 36 tools. The real count is 43.

---

## 13. Redesigning: what is load-bearing and what is free

This is the section to argue with. Everything above is description; this is
judgement about what a redesign can move.

### Do not break these without a deliberate decision

| Thing | Why it is load-bearing |
| --- | --- |
| **Every tool URL** | 13 permanent redirects already spent the old site's search equity once. Search traffic is the acquisition channel. Moving a URL again costs real visitors. |
| **The registry as source of truth** | Routes, metadata, the grid, the palette and the sitemap all derive from it. Bypassing it reintroduces the class of bug it was built to eliminate. |
| **COOP and COEP headers** | Remove them and every media tool dies, silently, because `SharedArrayBuffer` disappears. Mirrored in two files that must agree. |
| **Versioned vendor paths** | The service worker caches `/vendor/` forever. An unversioned path strands returning visitors on an old runtime. |
| **`preact/compat`, pinned `@astrojs/preact@^4`** | Measured 202 KB to 32 KB. v6 fails to resolve `astro:preact:opts`. |
| **Lazy everything heavy** | 161 MB of runtimes exist. The entire architecture is that none of it loads until asked. |
| **`#FF91E7` as the accent** | Fixed brand colour. Everything else about the visual identity is open. |
| **Contrast assertions** | 18 tests will fail if a colour stops passing AA. That is the point. |
| **The i18n completeness contract** | Malay is typed as `typeof en`, so dropping a string is a compile error. Weakening this lets `/ms` rot silently. |
| **Zero em dashes** | A standing repo-wide rule, already swept once. |

### Free to redesign

- **The entire visual layer.** Type scale, spacing, radii, row versus card,
  colour roles other than the accent, the hero, the readout panel, iconography.
  None of it is referenced by tests except contrast pairs.
- **Page composition.** Where the tool sits relative to the prose, how limits
  and related tools are presented, whether the breadcrumb stays.
- **The taxonomy.** Group labels and membership are data in `groups.ts`. The
  threshold rule and the six-group ceiling are conventions enforced by test, not
  laws; change the test if you change the rule.
- **Navigation model.** The current nav is five links with zero JavaScript. A
  mega menu, a sidebar or a command-first model are all open, as long as the
  category pages remain reachable and mobile keeps a real browse path.
- **The homepage's job.** It is currently a full 43-tool catalogue. Making it a
  summary is legitimate, but note the trade in the next section.

### Tensions worth resolving deliberately

1. **Density versus mobile readability.** The type scale puts body text at 13px
   and tool blurbs at 11px. Mobile guidance says 16px minimum. The current
   position is deliberate ("body default in dense UI") but 11px blurbs now carry
   the browsing load on a phone. A targeted fix exists: raise only the row name
   and blurb below 640px, leaving the token scale alone.

2. **The homepage is 15% taller than the card grid it replaced.** 2807px against
   2430px at 1280px. The cost is 15 job headings plus the spacing that makes
   them attach to the right group. Shortening it means either fewer headings or
   a summary homepage, and a summary homepage breaks the 0 KB filter unless the
   hidden cards stay in the DOM.

3. **Calculators holds one tool.** It has a page and a homepage section but no
   nav slot. Phase 5 of the expansion plan (zakat, loan, SST, stamp duty,
   ringgit in words) fills it and crosses the grouping threshold automatically.

4. **Two groups hold a single tool.** `shrink` in PDF and Image. Justified by
   their preset chips, but it is the weakest part of the taxonomy.

5. **The active nav item does not scroll into view on a phone.** Landing on
   `/dev` shows PDF and Image with Developer off-screen. Fixing it properly
   needs either JavaScript in a nav that deliberately has none, or per-page
   reordering that breaks muscle memory.

6. **Three header controls are still 32px** while the nav links beside them are
   44px on touch. Internally inconsistent.

### Where the prior reasoning lives

| Document | Covers |
| --- | --- |
| `.design/nhako-tools-rebuild/DESIGN_BRIEF.md` | Positioning, "Precision Instrument", the motion amendment |
| `.design/nhako-tools-rebuild/INFORMATION_ARCHITECTURE.md` | The original URL and redirect tables |
| `.design/nhako-tools-rebuild/TASKS.md` | The rebuild checklist and what remains open |
| `.design/tool-findability/DESIGN_BRIEF.md` | Why the browse layer exists |
| `.design/tool-findability/INFORMATION_ARCHITECTURE.md` | The group taxonomy in full |
| `.design/tool-findability/DESIGN_REVIEW.md` | 21 screenshots and the defects found in review |
| `~/.claude/plans/sprightly-beaming-frost.md` | Motion and copy pass; §5 holds the forward roadmap |

Unbuilt ideas already recorded in that plan's §5: drop a file anywhere to route
to the right tool, and tool chaining (passing one tool's output into the next).

---

## Appendix: every tool

`k` = kind, `g` = group, `H` = heavy runtime, `opts` = option count,
`lim` = stated limits, `var` = preset pages.

### PDF

| Tool | URL | k | g | H | opts | lim | var |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Merge PDF | `/pdf/merge` | file | organise | | 0 | 2 | |
| Split PDF | `/pdf/split` | file | organise | | 1 | 1 | |
| Rotate PDF | `/pdf/rotate` | file | organise | | 2 | 1 | |
| Organize PDF | `/pdf/organize` | app | organise | | 0 | 2 | |
| Crop PDF | `/pdf/crop` | file | organise | | 5 | 1 | |
| JPG to PDF | `/pdf/jpg-to-pdf` | file | create | | 3 | 2 | |
| Office to PDF | `/pdf/office-to-pdf` | file | create | H | 0 | 3 | 3 |
| Scan to PDF | `/pdf/scan` | app | create | | 0 | 3 | |
| PDF to JPG | `/pdf/to-image` | file | extract | | 2 | 1 | |
| PDF to text | `/pdf/to-text` | file | extract | | 0 | 2 | |
| PDF to Word | `/pdf/to-word` | file | extract | | 0 | 3 | |
| OCR PDF | `/pdf/ocr` | file | extract | H | 2 | 4 | |
| Watermark PDF | `/pdf/watermark` | file | mark-up | | 4 | 3 | |
| Sign PDF | `/pdf/sign` | app | mark-up | | 0 | 2 | |
| Add page numbers | `/pdf/page-numbers` | file | mark-up | | 5 | 2 | |
| Compress PDF | `/pdf/compress` | file | shrink | | 3 | 3 | 5 |
| Protect PDF | `/pdf/protect` | file | secure | H | 4 | 3 | |
| Unlock PDF | `/pdf/unlock` | file | secure | H | 1 | 2 | |

### Image

| Tool | URL | k | g | H | opts | lim | var |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Compress image | `/image/compress` | file | shrink | | 3 | 4 | 7 |
| Convert image | `/image/convert` | file | convert | | 2 | 2 | |
| HEIC to JPG | `/image/heic-to-jpg` | file | convert | H | 2 | 2 | |
| Resize image | `/image/resize` | file | transform | | 3 | 1 | |
| Crop image | `/image/crop` | app | transform | | 0 | 2 | |
| Rotate image | `/image/rotate` | file | transform | | 1 | 1 | |
| Watermark image | `/image/watermark` | file | edit | | 5 | 2 | |
| Remove background | `/image/remove-background` | file | edit | H | 2 | 4 | |
| Remove photo metadata | `/image/remove-metadata` | file | clean | | 0 | 2 | |
| Image to text (OCR) | `/image/ocr` | file | clean | H | 2 | 4 | |
| Passport photo maker | `/image/passport-photo` | app | create | | 0 | 3 | |

### Developer

| Tool | URL | k | g | opts | lim |
| --- | --- | --- | --- | --- | --- |
| JSON formatter | `/dev/json` | text | text | 2 | 1 |
| Text diff | `/dev/diff` | text2 | text | 2 | 1 |
| Word counter | `/dev/word-count` | text | text | 0 | 1 |
| Base64 converter | `/dev/base64` | text | encode | 2 | 1 |
| JWT decoder | `/dev/jwt` | text | encode | 0 | 2 |
| Hash generator | `/dev/hash` | text | encode | 1 | 2 |
| UUID generator | `/dev/uuid` | text | generate | 3 | 1 |
| QR code generator | `/dev/qr` | text | generate | 3 | 1 |
| CSS shadow generator | `/dev/css-shadow` | text | generate | 7 | 1 |

UUID and CSS shadow are `generator: true`: output comes from options alone, so
the input pane is hidden.

### Media and Calculators (flat, no groups)

| Tool | URL | k | H | opts | lim |
| --- | --- | --- | --- | --- | --- |
| Compress video | `/media/compress-video` | file | H | 2 | 3 |
| Extract audio | `/media/extract-audio` | file | H | 1 | 1 |
| Audio to text | `/media/transcribe` | file | H | 2 | 4 |
| Teleprompter | `/media/teleprompter` | app | | 0 | 4 |
| Salary calculator (Malaysia) | `/calc/take-home-pay` | app | | 0 | 3 |

### Notes on the unusual ones

- **Teleprompter** has a companion phone remote at
  `/media/teleprompter/remote`, connected over Supabase Realtime Broadcast
  (control messages only, no file data). Recording streams to OPFS with a memory
  fallback. Voice-follow is opt-in and never persisted as on, because Chrome
  sends audio to Google.
- **Salary calculator** rates come from LHDN, KWSP and PERKESO, stored in dated
  files with source URLs and tested against official worked examples. LINDUNG 24
  Jam adds a 0.75% employee SOCSO share from 1 June 2026 that many calculators
  miss.
- **Passport photo maker** presets follow the issuing authority. JIM photographs
  adult passports at the counter; its 35x50mm printed rule is for under-4s. 4R
  fits only four copies of 35x50 with safe margins.
- **Office to PDF** runs LibreOffice compiled to WebAssembly, 76 MB gzipped at
  vendor time and unzipped with `DecompressionStream`. It hangs in
  `lok_documentLoad` roughly 1 in 12 loads; a watchdog restarts the worker.
- **Protect and Unlock** use qpdf, whose build prints straight to stderr and
  returns exit 2 for both "wrong password" and "not encrypted", so encryption is
  detected with pdf-lib and passwords with `--requires-password`.
