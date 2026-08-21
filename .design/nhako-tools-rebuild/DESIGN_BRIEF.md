# Design Brief — Nhako Tools rebuild

Feature slug: `nhako-tools-rebuild` · Started 2026-08-21 · Branch `rebuild/astro`

## 1. The problem with the current design

The site's differentiation is stated as an ethical claim — "Your Files are Yours",
"no backend to leak them" — in the one place a first-time visitor has no way to
verify it. Someone arriving from a search for "merge pdf online" does not choose
the fourth result over iLovePDF because of its privacy posture.

Meanwhile the same technical fact buys something a user *feels in two seconds*,
and the site currently sells none of it:

| iLovePDF / Smallpdf | Nhako |
|---|---|
| upload bar | — |
| server queue | — |
| file size cap | limited only by device RAM |
| "2 of 2 free files today" | unlimited |
| account wall on some outputs | none |

**The reframe: client-side is not an ethics story, it is a speed story.**
Privacy becomes the reason it is fast, not the headline.

## 2. Positioning

> **Nhako Tools is the utility hub that finishes before the other one has
> finished uploading.**

Three consequences that bind the rest of this document:

1. **Every design decision is judged against whether it makes the product feel
   fast.** Decorative motion, bounce easing, staged wizards and hover-scale
   effects all read as *slow* and are therefore off the table.
2. **The tool page is the product.** Utility sites take the large majority of
   their traffic directly onto a tool page from search. The homepage is a
   competent directory; the craft budget goes to the 22 tool pages.
3. **Speed is demonstrated, not asserted.** See §5.

## 3. Audience

Primary: someone who arrived from a search engine with one file and one job, has
no intention of making an account, and will leave the moment they are asked to.
They are not loyal and they are not reading the footer.

Secondary: the returning user who bookmarked the hub — developers reaching for
JSON/JWT/base64 many times a day, for whom the interaction has to be
keyboard-fast and stay out of the way.

Explicitly **not** designing for: enterprise buyers, teams, anyone needing
accounts, storage, or history.

## 4. Aesthetic philosophy — "Precision Instrument"

The current visual language is soft consumer SaaS: `rounded-3xl`, gradient blobs
behind every card, pill buttons, glow shadows, and a bounce easing
(`cubic-bezier(0.175,0.885,0.32,1.275)`) with `hover:scale-105`. It is friendly
and it reads *slow* and decorative. It says brochure, not tool.

The rebuild goes the other way: **the aesthetic of a well-made instrument.**
Dense, precise, high-contrast, monospace-inflected. Closer to a Swiss control
panel or a good CLI than to a consumer app. Restrained enough that the single
hot accent does real work.

| | From | To |
|---|---|---|
| Radius | `rounded-3xl` (24px) | 6 / 8 / 12px |
| Motion | 300ms, bounce overshoot | 120–180ms, ease-out, no overshoot |
| Hover | `scale-105` + pink glow | border + background shift only |
| Decoration | gradient blob per card | none |
| Numbers | body font | **mono, always** |
| Density | airy, `h-72` cards | tight, information-dense |

**Numbers are always monospace** — file sizes, page counts, durations, byte
counts, elapsed times. This is the single most load-bearing detail in the
philosophy: it is what makes the thing read as an instrument rather than a
brochure, and it costs nothing.

### Type

- **Instrument Sans** (variable 400–700) — UI and headings. A slightly
  condensed grotesque with more character than Inter, and far less worn out.
- **JetBrains Mono** (variable) — all numerics, code panes, file names, readouts.

Both **self-hosted** via Fontsource, not the Google Fonts CDN. Consistent with
self-hosting the ffmpeg core, and required for the offline PWA goal.

### Colour

`#FF91E7` is fixed as the Nhako accent. But it is a *pale* pink, and the current
code uses it as `bg-nhakoPink text-white` for every primary button — **white on
`#FF91E7` is roughly 2.1:1, a clear WCAG failure.** It is a live accessibility
bug, not a matter of taste.

Resolution: the brand pink is kept as the **identity** colour (accents,
highlights, focus rings, dark-mode text) and a **deepened interactive variant**
is derived for anything that must carry text on a light background. Full ramp
in `DESIGN_TOKENS`. Contrast is asserted by a unit test, not by eye.

## 5. How speed gets demonstrated

Four decisions, all of which the current build gets wrong:

1. **No "Start Processing" button.** Today the flow is drop → click Start →
   wait. That intermediate click is the single most expensive thing on the page,
   because it converts an instantaneous result into a two-step task. Tools with
   no required options run **the moment the file lands**. Tools with options run
   immediately on sensible defaults and re-run when an option changes.
2. **Elapsed time is shown on completion**, in mono: `Merged 3 PDFs · 0.4s`.
   This is the entire positioning, proven, in eleven characters. It is the thing
   someone remembers.
3. **No progress bar unless the work is genuinely slow.** A progress bar on a
   400ms operation makes it feel slower. Bars appear only for ffmpeg and Whisper,
   where the wait is real.
4. **Results appear inline.** No modal, no redirect, no interstitial.

## 6. Trust, without preaching

Once ffmpeg and the Whisper model are self-hosted, the claim "nothing leaves this
machine" becomes unqualified and the design can afford to be quiet about it.

- A single line near the drop zone, not a banner.
- A **"verify this"** link that tells the reader to open their network tab and
  watch nothing happen. Inviting verification is a stronger signal than
  asserting trustworthiness, and it is the one move a competitor structurally
  cannot copy.
- No badges, no shields, no lock iconography.

## 7. Non-negotiables

- **Keyboard-complete.** Every tool must be operable without a mouse, including
  file selection. The current drop zone is a `<div onClick>` with no `tabIndex`
  or key handler, so keyboard users cannot open the file picker at all.
- **AA contrast everywhere**, verified by test.
- **No layout shift** on load. Theme is resolved by a blocking inline script
  before first paint.
- **`prefers-reduced-motion` respected** for real.
- **Dark mode is a first-class theme,** not an inverted afterthought — it must
  be reachable from every page, which today it is not.

## 8. Success criteria

| | Target |
|---|---|
| Landing page JS | < 20 KB transferred |
| Time to interactive on a tool page | < 1s on a mid-range phone |
| Lighthouse | Perf ≥ 95, A11y 100, SEO 100 |
| Keyboard-only completion | every tool, no exceptions |
| Someone can describe the site in one sentence | "the fast one that doesn't upload anything" |

## 9. Open questions

- Which tool, if any, earns a spot running live on the homepage. Deferred until
  the tool page pattern is built and can be judged.
- Whether the JSON tool wants a full editor (CodeMirror 6, ~100 KB island) or a
  read-only highlighted output pane (~50 lines, zero deps). Starting with the
  latter; upgrading only if it feels insufficient in use.
