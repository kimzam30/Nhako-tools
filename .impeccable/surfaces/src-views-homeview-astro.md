---
version: 1
slug: "src-views-homeview-astro"
primary_target: "src/views/HomeView.astro"
related_targets: ["src/views/ToolView.astro","src/views/CategoryView.astro","src/layouts/BaseLayout.astro","src/components/astro/Nav.astro","src/components/astro/TabBar.astro"]
---

# Surface brief: site shell, home and tool pages (rebrand)

Scope: the whole site's shell (header, phone tab bar, footer), the home page, category pages and the tool page template, English and Malay. Visitor mode: Operate. Audience and promises: see PRODUCT.md. Chosen in the safer re-roll on 2026-11-22 from home, tool-page and phone sketches (`.impeccable/mocks/decision/r1/A-*.html`), with magenta as the main accent and one colour per tool group.

## Direction contract

THESIS: Nhako Tools is the super-app for file jobs: you land, tap the category or the job, and finish. It refuses both the anonymous tool grid of the category and the decorative pixel-world of the old site: category tiles and a known app shell do the navigating, and colour tells you where you are.

OWN-WORLD: Light, cool-neutral ground (#f5f6f8) with white rounded surfaces (radius 16–22px, 1px #eceef1 hairline, no heavy shadows). Magenta (#c7009b) is the brand: header rule, links, focus rings, active nav, the home hero tint. Six group colours own their group everywhere: PDF #e03131, Image #1c7ed6, Media #7048e8, Calculators #0ca678, Developer #1098ad, Malaysia #f08c00, as an 11% tint chip behind a 1.8px line icon and as the tool page's primary button. Manrope throughout, 800 for headings, 16px minimum body on phones. The hammer stays as the logo; one butterfly, drawn smooth in magenta, is the brand mark in the hero and the success moment.

STORY: A student on a phone sees in one screen that the jobs they need are here (Compress PDF to 500 KB, passport photo, gaji), that it is free with no account or ads, taps a coloured tile, and finishes on a tool page whose colour matches the tile they tapped.

FIRST VIEWPORT: Desktop: white header with logo, a centred pill search ("compress pdf 500kb", "gaji"), favourites and BM/EN; a magenta-tinted hero card with the headline, one line, and three promise pills, the butterfly at right; six category tiles in one row; "Popular with students" as four-by-two job rows. Phone: header, hero card with the search inside it, a three-by-two tile grid, popular jobs as full-width rows, a floating bottom tab bar (Home, Tools, Saved, Malaysia). Tool page: breadcrumb in the group colour, title and one line, a large drop area on the left with the group-coloured Choose button, settings and the result readout (before → after at display size) in a right panel, Save in the group colour.

FORM: Dompet, super-app clarity; my grounded candidate 7 (Touch 'n Go / MySejahtera super-app home), chosen by the owner from the safer-register lineup. seed:7642e15937ee7931

Signature move: the group colour travels with you, from tile to breadcrumb to drop area to Save, and the finished state shows the size before and after at display scale with the butterfly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
