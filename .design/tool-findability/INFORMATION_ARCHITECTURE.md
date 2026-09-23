# Information Architecture: Nhako Tools browse layer

Derived from `.design/tool-findability/DESIGN_BRIEF.md`. It extends, and does not
replace, `.design/nhako-tools-rebuild/INFORMATION_ARCHITECTURE.md`, whose URL
table and redirect table both remain authoritative and unchanged.

Load-bearing for the code, in the same way the rebuild IA is: `src/tools/registry.ts`
stays the single source of truth, and the group taxonomy below becomes data in
`src/tools/groups.ts` plus a required `group` field on every tool.

Counted from the registry on 2026-09-23: **43 tools**. Note that `README.md` still
says 36 and the rebuild memory says 44. Both are stale. 43 is the figure asserted
by `grep -c "^  {" src/tools/registry.ts` and by `TOOLS.length`, which is what the
site renders.

## Site Map

Existing pages are unmarked. **New** pages are marked. No existing URL moves.

- Home `/`
  - PDF `/pdf` **New**
    - 18 tool pages `/pdf/<tool>` (unchanged)
    - 8 preset pages `/pdf/compress/<size>`, `/pdf/office-to-pdf/<app>` (unchanged)
  - Image `/image` **New**
    - 11 tool pages `/image/<tool>` (unchanged)
    - 7 preset pages `/image/compress/<size>` (unchanged)
  - Media `/media` **New**
    - 4 tool pages `/media/<tool>` (unchanged)
    - Teleprompter remote `/media/teleprompter/remote` (unchanged, noindex, not in sitemap)
  - Developer `/dev` **New**
    - 9 tool pages `/dev/<tool>` (unchanged)
  - Calculators `/calc` **New**
    - 1 tool page `/calc/take-home-pay` (unchanged)
  - Malaysia `/malaysia` **New**
- About `/about`
- Privacy `/privacy`
- 404 `/404`

Every page above mirrors under `/ms`. Path segments are not translated
(`localePath()` in `src/i18n/paths.ts` prefixes only), so `/ms/pdf` and
`/ms/malaysia` follow the existing convention.

**New pages: 12.** Six English (`/pdf`, `/image`, `/media`, `/dev`, `/calc`,
`/malaysia`) and six Malay mirrors. Site goes from 125 to 137 pages.

## The group taxonomy

The rule: a category is sub-grouped only when it holds **more than six tools**.
Below that, a heading over two tools costs scanning effort and returns nothing.
So PDF, Image and Developer are grouped; Media and Calculators are flat.

`‡` marks a cross-listed tool: it lives canonically in another category and its
URL does not change. It appears here because this is where someone would look.

### PDF `/pdf`, 18 tools, 6 groups

| Group | Label (BM) | Tools |
|---|---|---|
| `organise` | Susun halaman | Merge, Split, Organize, Rotate, Crop |
| `create` | Buat PDF | JPG to PDF, Office to PDF, Scan to PDF |
| `extract` | Tukar dan ekstrak | PDF to JPG, PDF to text, PDF to Word, OCR PDF |
| `mark-up` | Sunting dan tandatangan | Sign, Watermark, Add page numbers |
| `shrink` | Kecilkan saiz fail | Compress (plus 5 preset chips) |
| `secure` | Kata laluan dan kebenaran | Protect, Unlock |

`shrink` holds one tool on purpose. Compress is the most-searched PDF job and it
carries five preset pages, so the group renders as a substantial block of chips
rather than a lonely row. It is also the one group label shared with Image, which
is deliberate: the same job gets the same words in both places.

OCR PDF sits under `extract` rather than in its own group because the job someone
arrives with is "get the text out of this", which is the same errand as PDF to
text. The distinction between a text layer and recognition is the tool's business,
not the person's.

### Image `/image`, 11 canonical tools plus 3 cross-listed, 6 groups

| Group | Label (BM) | Tools |
|---|---|---|
| `shrink` | Kecilkan saiz fail | Compress image (plus 7 preset chips) |
| `convert` | Tukar format | Convert image, HEIC to JPG, JPG to PDF ‡, PDF to JPG ‡ |
| `transform` | Ubah saiz, potong dan putar | Resize, Crop, Rotate |
| `edit` | Sunting foto | Watermark, Remove background |
| `clean` | Ekstrak dan bersihkan | Image to text (OCR), Remove photo metadata |
| `create` | Hasilkan | Passport photo maker, QR code generator ‡ |

### Developer `/dev`, 9 tools, 3 groups

| Group | Label (BM) | Tools |
|---|---|---|
| `text` | Teks dan kod | JSON formatter, Text diff, Word counter |
| `encode` | Enkod dan hash | Base64 converter, JWT decoder, Hash generator |
| `generate` | Jana | UUID generator, QR code generator, CSS shadow generator |

Three groups of three. Even, and each label names a real errand.

### Media `/media`, 4 tools, flat

Compress video, Extract audio, Audio to text, Teleprompter. Under the threshold.

### Calculators `/calc`, 1 tool, flat

Salary calculator (Malaysia). Shown plainly, no apology and no promise of more.
Phase 5 of the expansion plan (zakat, loan, SST, stamp duty, ringgit in words)
drops into this page without another restructure, and crosses six tools at which
point the grouping rule applies to it automatically.

## Cross-listings

Three, deliberately sparse. A cross-listing is justified only when someone with
the file in hand would plausibly browse the other category first.

| Tool | Canonical | Also appears in | Why |
|---|---|---|---|
| JPG to PDF | `/pdf/jpg-to-pdf` | Image, `convert` | The person is holding photos, not a PDF. They will look under Image. |
| PDF to JPG | `/pdf/to-image` | Image, `convert` | They want images out. Image is where images are. |
| QR code generator | `/dev/qr` | Image, `create` | A QR code is an image you download. Nobody looking for one thinks "developer tool". |

A cross-listed tool renders identically to any other row. No badge, no dimming,
no "also in" note. The data model is not the person's problem.

Rules enforced by `registry.test.ts`:
- `alsoIn` never changes the canonical URL, the sitemap, the breadcrumb or `related`.
- A tool may not be cross-listed into its own category.
- Every `alsoIn` entry must name a group that exists in the target category.
- The command palette lists a tool once, under its canonical category.

## Navigation Model

**Primary navigation.** Five items, ordered by catalogue weight with the
distinctive one last:

```
NhakoTools    PDF  Image  Media  Developer  Malaysia    [Search ⌘K]  [BM]  [◐]
```

Each links to a real page. Today they link to homepage anchors and the target
pages do not exist. Calculators leaves the nav (one tool does not earn a slot)
and remains reachable from the homepage, the footer and the Malaysia page.
`aria-current="page"` marks the active category. Still zero JavaScript.

**Secondary navigation.** The job groups within a category page. They are not
links, tabs or accordions: all groups are visible at once, because 18 tools under
6 headings fits on a page without interaction. Adding a control here would add
state to a page whose whole value is that it can be scanned.

**Utility navigation.** Unchanged: command palette, language switch, theme toggle.
The palette gains the 15 preset variants in its index.

**Mobile navigation.** The category row becomes horizontally scrollable below
768px rather than disappearing, which is what it does today. A scroll container,
not a menu: no open state, no focus trap, no JavaScript. The active item is
scrolled into view on load by `scroll-margin` and document order, not by script.

**Footer.** Gains the five category links plus Malaysia. On a long tool page the
footer is the natural place to find a way back up into the catalogue, and it is
the one browse path a tool page should carry.

## Content Hierarchy

### Homepage `/`

1. **Hero and search**: the promise in one line and the fastest path for
   someone who knows the word. Unchanged.
2. **Category sections, in nav order**: each headed by the category name, its
   tool count in mono, and a link to the category page. PDF, Image and Developer
   carry job-group subheadings; Media and Calculators are flat.
3. **Malaysia strip**: placed after the category sections, not before. It is a
   second cut through tools already listed above, so it earns its place only once
   the catalogue proper has been shown.
4. Footer.

All 43 tools stay in the HTML. That is what keeps the filter working on a page
that ships 0 KB of site JavaScript, and it is not negotiable.

### Category page `/pdf` and friends

1. **H1 and one-paragraph intro**: what this category does and the no-upload
   mechanism in a sentence. Real copy, written once per category, in both
   languages. This is the page that should rank for "free pdf tools no upload".
2. **Job groups**: each an `h2` with its tools as rows, and preset chips under
   the tool that owns them.
3. **Cross-listed tools**: inline in their group, indistinguishable.
4. **Link to the full catalogue**: back to the homepage.

### Malaysia page `/malaysia`

1. **H1 and intro**: what this is: the tools built around Malaysian forms,
   portals and payroll, and the fact that every rate and size limit comes from a
   dated official source.
2. **Curated entries, hand-ordered**, each with the context that justifies it:

| Entry | Context line |
|---|---|
| Passport photo maker | Passport, JPJ and SPM/UPU presets, white background, 4R print sheet |
| Salary calculator | Take-home pay after EPF, SOCSO, EIS and PCB |
| Compress PDF to 500 KB | The limit SSM, LHDN, JPA and UPU portals impose |
| Compress image to 200 KB | Upload caps on government and university portals |
| Compress image, SPA MyResume | The exact size SPA MyResume accepts |
| OCR PDF | Reads Malay as well as English |
| Image to text (OCR) | Reads Malay as well as English |
| Audio to text | Transcribes Malay speech on your device |

3. **Sources note**: pointing at the dated data files, matching the `sources`
   and `checkedOn` strings the tool pages already use.

This page uses a curated list in `src/tools/collections.ts`, not `alsoIn`. Its
ordering is editorial and its context lines are per-entry, neither of which the
cross-listing mechanism should be bent to carry.

## User Flows

### Browse to a tool, first visit, desktop

1. Person lands on `/` from a search result.
2. Sees the hero, the search field, then PDF with 18 tools under 6 job headings.
3. Decision point:
   - Knows the word -> types it, the grid filters, done in two seconds.
   - Does not -> reads six headings, picks "Password and permissions", sees
     Protect and Unlock, picks one.
4. Arrives at the tool page.

### Browse to a tool, phone

1. Person lands on `/` on a phone.
2. The category row is visible and scrollable, which today it is not.
3. Taps "PDF", arrives at `/pdf`, a page about PDFs rather than an anchor
   partway down a 43-tool homepage.
4. Reads six group headings in a single column, taps a tool.

### Find a preset

1. Person needs a PDF under 500 KB for an SSM submission.
2. Decision point:
   - Types "500" into the palette -> the preset now resolves, which today it
     does not. Goes straight to `/pdf/compress/500kb`.
   - Browses -> `/pdf`, "Reduce file size" group, chip reading "500 KB".
   - Arrives via the Malaysia page, which names the portals explicitly.
3. Lands on the preset page with the option already set.

### Arrive from search on a tool page and look around

1. Person lands on `/pdf/sign` from Google.
2. Breadcrumb reads Tools / PDF. "PDF" now goes to `/pdf` instead of a homepage
   anchor, so there is a real route up into a page about PDFs.
3. From `/pdf` they see the other 17.

## Naming Conventions

| Concept | Label in UI | Notes |
|---|---|---|
| A top-level section of the catalogue | Category | Never "section" or "collection". Five of them. |
| A job-based cluster inside a category | Group | Only ever seen as its label ("Organise pages"). The word "group" never appears in the interface. |
| A tool with different starting options | Preset | The existing `presets` UI string already uses this word. The code calls it `variant`; the interface never does. |
| A curated cross-category page | Collection | Currently one: Malaysia. The word appears in code, not on screen. |
| A tool shown in a second category | Cross-listed | Code only. Invisible to the reader by design. |
| The `dev` category | Developer | Already the convention: `dev` in URLs for brevity, "Developer" on screen. |
| The Malaysia page in the nav | Malaysia | Not "Malaysia pack" or "For Malaysia". One word, and the page explains itself. |
| Reducing file size | Compress | Consistent across PDF and Image. Never "shrink" or "optimise" on screen, although the group id is `shrink`. |

## Component Reuse Map

| Component | Used on | Behaviour differences |
|---|---|---|
| `BaseLayout.astro` | Every page | None. New pages pass `path` and `locale` as existing pages do. |
| `Nav.astro` | Every page | Links become real pages, order changes, mobile becomes a scroll row. `aria-current` on category and collection pages. |
| `Footer.astro` | Every page | Gains category links. Same on all pages. |
| `ToolRow.astro` **New** | Homepage, category pages, Malaysia page | One variant: the Malaysia page passes a context line, the others do not. |
| `ToolCard.astro` | Nothing, after this change | Kept, unused by the new surfaces. Deleting it is a separate decision. |
| `CategoryView.astro` **New** | `/pdf`, `/image`, `/media`, `/dev`, `/calc` and Malay mirrors | Grouped or flat depending on the tool count, driven by data not by a flag. |
| `CollectionView.astro` **New** | `/malaysia`, `/ms/malaysia` | Context line per entry. Hand-ordered. |
| `CommandPalette.astro` | Every page | Index gains variants. Behaviour otherwise identical. |
| `HomeView.astro` | `/`, `/ms` | Gains group headings and the filter learns to hide an empty heading. |

## Content Growth Plan

- **Tools** grow through `registry.ts`. Adding one means giving it a `group`,
  which `registry.test.ts` requires, so a new tool cannot land ungrouped and
  quietly re-create the wall-of-cards problem.
- **A category crossing six tools** starts being grouped automatically, because
  the threshold is a rule in `groups.ts`, not a per-category decision. Calculators
  will cross it during phase 5.
- **A category needing a seventh group** is the first real warning sign. Six
  headings is close to the limit of what is scannable at a glance, so at seven
  the right move is to re-cut the taxonomy, not to add a heading.
- **Collections** grow by adding files to `collections.ts`. There is one today.
  If a second appears, the nav is already at five items and the right answer is
  a collections index, not a sixth nav item.
- **Presets** grow under their parent tool. A tool with more than about eight
  preset chips needs a different treatment; `image/compress` is at seven.
- No pagination, no infinite scroll, no archive. 43 rows across five pages does
  not need any of it, and a static site should not pretend otherwise.

## URL Strategy

- **Pattern**: `/<category>` for a category page, `/<category>/<tool>` for a
  tool, `/<category>/<tool>/<variant>` for a preset, `/<collection>` for a
  curated page. Unchanged from the rebuild IA except for the first and last.
- **Dynamic segments**: `[category]/index.astro` enumerates the five categories
  from `CATEGORIES`. `/malaysia` is a static route, because a collection is
  editorial content and enumerating one item as a dynamic route would be theatre.
- **Query parameters**: only the existing `?q=` on the homepage, which backs the
  `SearchAction` in the homepage JSON-LD. Category pages take none, because
  filtering a page of 18 rows is what the palette is for.
- **Trailing slashes**: `never`, as configured. New pages inherit it.
- **Redirects**: none needed. Nothing moves. The existing table in `vercel.json`
  is untouched.
- **Canonical and hreflang**: new pages cross-link `en` and `ms` through the
  existing `BaseLayout` mechanism and enter the sitemap automatically, since the
  sitemap integration walks built pages.
