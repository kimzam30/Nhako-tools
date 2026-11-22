# Listing and post drafts (build plan 0.1, 0.2, 0.5)

Drafted 2026-11-22 for the owner to post. Nothing here has been posted. Each
draft says where it goes, what to paste, and what to check first. Facts are
taken from the registry on this date: 50 tools (24 PDF, 11 image, 4 media,
2 calculators, 9 developer), English and Malay, MIT licence.

Ground rules for every post: say you built it, give one link, answer
comments, and don't post the same text in two places on the same day.

---

## GitHub repository About (0.5)

Current description: "Browser-based PDF, media and developer tools.
Everything runs client-side via WebAssembly, no uploads, no backend."
It leaves out images and calculators, and "no backend" isn't quite true
(the feedback form writes to Supabase; page views go to Vercel Analytics).
The topics list `react`, but the site uses Preact.

**Description** (fits GitHub's 350-character limit):

> 50 free PDF, image, video and calculator tools that run in your browser.
> Files never leave your device: WebAssembly (qpdf, ffmpeg, LibreOffice,
> Whisper) does the work locally. No account, no upload, no watermark.
> English and Bahasa Melayu.

**Website:** https://tools.nhako.com (already set)

**Topics:** remove `react`, `vite`; add `astro`, `preact`, `image-tools`,
`pdf-converter`, `ocr`, `malaysia`, `pwa`. Keep the rest.

Applied 2026-11-22 with the owner's OK (description and topics as above).

---

## AlternativeTo (0.2)

Add as an application, then "Suggest as alternative" on iLovePDF, Smallpdf,
PDF24 Tools, TinyPNG, remove.bg and Sejda.

- **Name:** Nhako Tools
- **URL:** https://tools.nhako.com
- **Licence:** Free, open source (MIT)
- **Platforms:** Online / Web, PWA (works offline once loaded)
- **Tags:** pdf-merger, pdf-compressor, image-compressor, background-remover,
  privacy-focused, no-registration-required, works-offline, ad-free
- **Short description:**
  > Free PDF, image and video tools that run entirely in your browser.
  > Your files are never uploaded.
- **Long description:**
  > Nhako Tools is a set of 50 free tools for PDFs, images, video and
  > everyday calculations. Every tool runs on your own device using
  > WebAssembly, so your documents are never uploaded to a server, there's
  > no file-size limit set by a server, and the tools keep working offline
  > once loaded. Merge, split, compress, sign, OCR and convert PDFs (including
  > PDF to Word and Office to PDF); compress, resize and convert images,
  > HEIC to JPG, background removal and a passport-photo maker; compress
  > video and turn speech into text. No account, no watermark, no daily
  > limit. Open source under MIT, in English and Bahasa Melayu.

---

## Product Hunt (0.2)

Launch Tuesday to Thursday at 00:01 PT (16:01 MYT). Media:
`launch/nhako-tools-launch.mp4`, `launch/posters/*`, `docs/images/*`.

- **Name:** Nhako Tools
- **Tagline (60 chars max):** `50 PDF and image tools that never upload your files` (51)
- **Topics:** Productivity, Privacy, Open Source, Developer Tools
- **Description (260 max):**
  > Merge, compress, sign and convert PDFs, shrink images, remove
  > backgrounds and transcribe audio. All in your browser with WebAssembly:
  > nothing is uploaded, no account, no watermark, no limits. Free and open
  > source.
- **Maker's first comment:**
  > Hi Product Hunt! I built Nhako Tools because every "free PDF tool" I
  > used wanted my files on its server, then an account, then a
  > subscription for the second file.
  >
  > Here everything runs on your device. qpdf and pdf-lib handle PDFs,
  > ffmpeg.wasm handles video, LibreOffice compiled to WebAssembly does
  > Office to PDF, and Whisper does speech-to-text, all inside the tab. Open
  > DevTools → Network while a tool runs: your file never goes anywhere.
  >
  > It also has a few things for Malaysia: a take-home pay calculator (EPF,
  > SOCSO, EIS and PCB from LHDN's own worked examples), a CGPA calculator,
  > and size presets for SPA, MyResume and passport photos.
  >
  > It's MIT-licensed on GitHub. I'd love to know which tool you'd want next.

---

## Hacker News, Show HN (0.2)

Post Tuesday to Thursday, about 08:00 US Eastern (20:00 MYT). Link to the
site, not GitHub. Stay around for the first two hours to answer.

- **Title:** `Show HN: Nhako Tools – 50 PDF/image/video tools that run fully in the browser`
- **Text:**
  > I built a set of file tools where the file never leaves your machine:
  > merge/split/compress/OCR PDFs, PDF to Word, Office to PDF, image
  > compression, HEIC to JPG, background removal, video compression and
  > speech-to-text.
  >
  > Everything is WebAssembly in the tab: qpdf for PDF structure, ffmpeg.wasm
  > for media (cross-origin isolated so it gets SharedArrayBuffer), a
  > LibreOffice build for Office conversion (77 MB, so it only loads on
  > demand and wants a desktop-class browser), Tesseract for OCR and Whisper
  > via transformers.js for transcription. The site itself is static Astro
  > with Preact islands; a tool page is about 32 KB before the tool's own
  > engine loads.
  >
  > Some honest limits are on each page: reaching a small PDF target size
  > usually rasterises the pages, video compression runs at about real-time,
  > and LibreOffice stalls on roughly 1 in 12 conversions (a watchdog retries
  > it).
  >
  > MIT licensed: https://github.com/kimzam30/Nhako-tools. Happy to go into
  > the WASM and memory details.

---

## Lowyat.NET forum (0.2)

Section: Software → Software Discussion (or Kopitiam → Show your work
if that subforum exists when you post). Read the section rules first.

**Title (BM):** `[Percuma] 50 alat PDF & gambar yang berjalan dalam browser, fail tak dimuat naik`

> Salam semua. Saya buat laman alat percuma untuk PDF, gambar dan video:
> https://tools.nhako.com/ms
>
> Bezanya dengan iLovePDF/Smallpdf: semua proses berlaku dalam browser anda
> sendiri. Fail tidak dihantar ke mana-mana server. Tiada akaun, tiada
> watermark, tiada had harian.
>
> Yang mungkin berguna untuk orang Malaysia:
> - Kalkulator gaji bersih (KWSP, PERKESO, SIP dan PCB, diuji dengan contoh
>   kiraan LHDN)
> - Kalkulator CGPA
> - Kecilkan PDF ke 500 KB dan gambar ke 200 KB untuk borang SPA/MyResume
> - Pembuat gambar pasport
>
> Kod sumber terbuka (MIT). Komen dan cadangan alat baharu dialu-alukan.

---

## Reddit (0.2)

Check each subreddit's self-promotion rule and flair first. Post from an
account with some history, not a new one.

### r/malaysia (BM/EN mix is normal there; weekend "Show & Tell" style threads if they exist)

**Title:** `I made a free take-home pay calculator that shows EPF, SOCSO, EIS and PCB, checked against LHDN's examples`

> Every salary calculator I found either skipped PCB or didn't say where its
> rates came from. This one works out EPF, SOCSO, EIS and monthly PCB, and
> each rate links to the LHDN/KWSP/PERKESO source with the date it was
> checked. It runs in your browser, so nothing you type is sent anywhere.
>
> https://tools.nhako.com/calc/take-home-pay
>
> I built it (it's part of a free tools site). If your payslip doesn't
> match, tell me the inputs and I'll check the maths.

### r/MalaysianPF

**Title:** `Free gross-to-net salary calculator with PCB, sources linked (I built it)`

Same body as r/malaysia, plus:

> Known gaps: it doesn't cover foreign-worker rates yet, and PCB assumes
> standard reliefs unless you add yours.

(Before posting, confirm both gaps are still true. Growth item 1.4 adds
foreign-worker mode.)

### r/malaysiauni / student groups (WhatsApp, Telegram)

> Free tools for assignments and applications, nothing uploaded, no account:
> CGPA calculator: https://tools.nhako.com/calc/cgpa
> Compress PDF to 500 KB: https://tools.nhako.com/pdf/compress/500kb
> Passport photo: https://tools.nhako.com/image/passport-photo
> Merge PDF: https://tools.nhako.com/pdf/merge

BM:

> Alat percuma untuk tugasan dan permohonan, fail tak dimuat naik, tiada akaun:
> Kalkulator CGPA: https://tools.nhako.com/ms/calc/cgpa
> Kecilkan PDF ke 500 KB: https://tools.nhako.com/ms/pdf/compress/500kb
> Gambar pasport: https://tools.nhako.com/ms/image/passport-photo
> Gabung PDF: https://tools.nhako.com/ms/pdf/merge

### r/SideProject, r/webdev

Use the Show HN text. For r/webdev, lead with the WASM engineering
(cross-origin isolation, lazy-loading a 77 MB LibreOffice, memory limits on
phones) and put the link at the end.

---

## Directories (0.2): quick-submit list

Free listing only. Paste the AlternativeTo short and long descriptions.

| Site | Category | Notes |
|---|---|---|
| SaaSHub | PDF tools | Add as alternative to iLovePDF and Smallpdf |
| BetaList | Productivity | Takes a few weeks to appear |
| Uneed | Productivity | Free queue |
| Fazier | Productivity | Free launch day |
| MicroLaunch | Productivity | Free |
| awesome-privacy (GitHub) | PDF / file tools section | PR adding one line |
| awesome-wasm (GitHub) | Applications | PR adding one line |
