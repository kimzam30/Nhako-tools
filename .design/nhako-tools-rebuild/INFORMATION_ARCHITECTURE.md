# Information Architecture — Nhako Tools

Derived from `DESIGN_BRIEF.md`. This document is **load-bearing for the code**:
`src/tools/registry.ts` is the single source of truth and Astro's
`getStaticPaths()` generates one page per entry, so the URL table below *is* the
route table.

## 1. URL structure

`/<category>/<tool>` — flat, two segments, no `/tool/` prefix. Each segment is a
word someone would actually search for.

### PDF — `/pdf/*`

| URL | Tool | Replaces |
|---|---|---|
| `/pdf/merge` | Merge PDF | `merge-pdf` |
| `/pdf/split` | Split PDF | `split-pdf` |
| `/pdf/compress` | Compress PDF | `compress-pdf` |
| `/pdf/to-image` | PDF to JPG/PNG | `convert-pdf` (image half) |
| `/pdf/to-text` | PDF to text | `convert-pdf` (text half) |
| `/pdf/rotate` | Rotate & reorder pages | `edit-pdf` (was dead) |
| `/pdf/watermark` | Add watermark | new |

### Media — `/media/*`

| URL | Tool | Replaces |
|---|---|---|
| `/media/compress-video` | Compress video to a target size | `video-size-compress` |
| `/media/extract-audio` | Extract audio from video | `extract-assets` |
| `/media/transcribe` | Audio to text (Whisper) | `audio-to-text` |

### Image — `/image/*` (all new, all zero-dependency)

| URL | Tool |
|---|---|
| `/image/compress` | Compress JPG/PNG/WebP |
| `/image/convert` | Convert between JPG/PNG/WebP/AVIF |
| `/image/resize` | Resize and crop |

### Developer — `/dev/*`

| URL | Tool | Replaces |
|---|---|---|
| `/dev/json` | JSON formatter & validator | `json-formatter` |
| `/dev/jwt` | JWT decoder | `jwt-decoder` |
| `/dev/base64` | Base64 encode/decode | `base64-converter` |
| `/dev/word-count` | Word & character counter | `word-counter` |
| `/dev/hash` | SHA-1/256/384/512 | new |
| `/dev/uuid` | UUID generator | new |
| `/dev/qr` | QR code generator | new |
| `/dev/diff` | Text diff | new |
| `/dev/css-shadow` | Box-shadow & gradient generator | `css-generator` (was dead) |

**22 tools.** `convert-pdf` splits into two because "pdf to jpg" and "pdf to
text" are two different searches deserving two landing pages. `dev` is used in
the URL for brevity; "Developer tools" remains the display name.

### Static pages

`/` · `/about` · `/privacy` · `/404`

## 2. Redirects — `vercel.json`, 301

Every current URL must survive. Search equity is the only asset the old site has.

```
/tool/merge-pdf           → /pdf/merge
/tool/split-pdf           → /pdf/split
/tool/compress-pdf        → /pdf/compress
/tool/convert-pdf         → /pdf/to-image
/tool/edit-pdf            → /pdf/rotate
/tool/video-size-compress → /media/compress-video
/tool/extract-assets      → /media/extract-audio
/tool/audio-to-text       → /media/transcribe
/tool/json-formatter      → /dev/json
/tool/jwt-decoder         → /dev/jwt
/tool/base64-converter    → /dev/base64
/tool/word-counter        → /dev/word-count
/tool/css-generator       → /dev/css-shadow
```

## 3. Navigation

Deliberately thin. The nav is not where discovery happens — search is.

```
┌────────────────────────────────────────────────────┐
│ NhakoTools    PDF  Media  Image  Dev    [⌘K]  [◐]  │
└────────────────────────────────────────────────────┘
```

- Four category links, each to an anchor on the homepage grid.
- **`⌘K` command palette** — the primary navigation for returning users. Fuzzy
  match over tool names *and* keywords, so "transcribe" finds Audio to Text
  (which today's search fails at) and "minify" finds the JSON tool.
- Theme toggle, present on **every** page. Today it exists only on the homepage.
- No account, no pricing, no CTA. Nothing to sign up for.

Footer carries the real links (About, Privacy, GitHub, licence) — the current
footer's `<div>`s styled as links and `href="#"` stubs are all removed.

## 4. Page structures

### Homepage — directory, search-first

```
┌──────────────────────────────────────────────┐
│  nav                                         │
├──────────────────────────────────────────────┤
│  22 tools that run in your browser.          │  ← headline states the
│  Nothing uploads. Nothing waits.             │    mechanism + the payoff
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ⌕  Search 22 tools…              ⌘K   │  │  ← autofocus on desktop
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│  PDF ·······································7│  ← counts in mono
│  ┌────────┐ ┌────────┐ ┌────────┐            │
│  │ Merge  │ │ Split  │ │Compress│  …         │
│  └────────┘ └────────┘ └────────┘            │
│                                              │
│  MEDIA ····································3│
│  …                                           │
└──────────────────────────────────────────────┘
```

Cards are compact: name, one line, category. No gradient blob, no `h-72`, no
hover-scale. Typing filters live across all categories at once.

### Tool page — the product

This is the template that gets the craft budget. It must convert a cold visitor
from Google in seconds.

```
┌──────────────────────────────────────────────┐
│  nav                                         │
├──────────────────────────────────────────────┤
│  Merge PDF                                   │  ← h1, matches search intent
│  Combine several PDFs into one file.         │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  │   Drop PDFs here, or browse            │  │  ← real <button>, focusable
│  │                                        │  │  ← runs ON DROP, no Start
│  └────────────────────────────────────────┘  │
│  Runs in your browser. Verify ↗              │  ← quiet, one line
├──────────────────────────────────────────────┤
│  ▸ Options (only if the tool has any)        │
├──────────────────────────────────────────────┤
│  ✓ Merged 3 PDFs · 0.4s · 2.1 MB    [Save]  │  ← the speed claim, proven
├──────────────────────────────────────────────┤
│  What this does / Is it private? / Limits    │  ← prose: SEO + real answers
├──────────────────────────────────────────────┤
│  Related tools: Split · Compress · To image  │  ← internal linking
└──────────────────────────────────────────────┘
```

Three structural points:

1. **The tool is above the fold. The prose is below it.** Most tool sites invert
   this for SEO and make the visitor scroll past marketing copy to reach the
   thing they came for.
2. **The result row replaces the drop zone in place** — no modal, no scroll, no
   navigation.
3. **The prose section is real content**, not keyword filler: what the tool
   actually does, what it cannot do, where the limits are. Honest limits are
   also the thing that ranks.

## 5. The core user flow

```
Google "merge pdf"
      │
      ▼
  /pdf/merge  ← static HTML, ~0 JS until interaction
      │
      ▼
  drops 3 files
      │
      ▼
  ┌─ island hydrates, dynamic-imports pdf-lib
  │  worker merges off the main thread
  └─ 0.4s
      │
      ▼
  ✓ Merged 3 PDFs · 0.4s        [Save]
      │
      ├──→ saves, leaves            (job done)
      └──→ "Related: Compress" ──→ second tool  (the only retention mechanism)
```

There is no account, no history, no cross-session state. **Related tools are the
entire retention strategy**, which is why they are structural rather than
decorative.

## 6. Error and edge states

Every one of these is currently an `alert()` or nothing at all.

| State | Treatment |
|---|---|
| Wrong file type | Inline, before any work: "That's a .docx — this tool takes PDFs." |
| Corrupt / unparseable | Inline error in the result row, tool stays usable |
| File too large for RAM | Warn ahead of time with the actual number, don't crash |
| Whisper model downloading | The one honest progress bar: "Downloading model · 39 MB · once" |
| No JS | Static page renders fully; drop zone replaced by a note |
| Unknown URL | Real 404 with search — today `/tool/anything` renders a working-looking page |

## 7. What was cut

- The "Buy me a coffee" and "About" nav stubs (`href="#"`).
- The footer's Features / Learn More / Support columns — nine fake links to
  pages that do not exist (Blog, Best practices, Pro experience…).
- The `IG / IN / X` `<div>`s styled as social buttons.
- The gradient blob on every card.

An empty footer is more honest than nine links to nothing.
