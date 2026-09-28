# Tool audit, 2026-09-29: all 50 tools against real files and the industry

Kim's goal: test every tool with real files, find issues, compare each with
the industry standard and apply it; make the app feel like Apple's; plan the
APK (see [plan.md](../plan.md)).

**How each tool was verified.** A real-file harness (session scratchpad,
`real-sweep.mjs`) uploads real files into the production build, downloads
what the tool produced and checks it with tools that are not ours: `pdfinfo`,
`pdftotext`, `pdfimages`, `qpdf`-style encryption checks via `pdfinfo -upw`,
ImageMagick `identify`/`compare -metric PSNR`, `ffprobe`, `unzip`, jsQR,
LibreOffice. Real inputs: the arXiv "Attention Is All You Need" paper (15 pp),
IRS Form 1040 (form fields), IRS Publication 17 (142 pp), OCRmyPDF's
rotated-scan and skewed-scan samples, a 5000 px Unsplash photo, two Unsplash
portraits, a Wikimedia receipt photo, a Nikon JPEG with GPS EXIF, an
orientation-6 JPEG, a real iPhone HEIC, Big Buck Bunny clips, the Whisper
JFK sample, Apache POI's docx/xlsx/pptx samples, a 5 MB JSON file.

**Benchmarks** are the named products' public capabilities. Test files were
deliberately not uploaded to third-party services.

## Headline results

| | Before | After | Evidence |
|---|---|---|---|
| OCR of a scan with sideways and upside-down pages | 48% confidence, 3 of 4 pages garbage | **94%**, 3 pages turned upright | pdftotext per page; OCRmyPDF `cardinal.pdf` |
| OCR of a receipt photo | 4 of 7 key terms, noise from the wood grain | **7 of 7** | Wikimedia ReceiptSwiss.jpg |
| Compress PDF, photo-heavy report | only option to shrink: flatten pages (text lost) | **85% smaller, text kept** | pdftotext finds the heading |
| Compress PDF, 142-page IRS publication | output **9% bigger** than input, labelled "optimally packed" | never bigger; 1% smaller | byte sizes |
| Compress PDF to 500 KB | flattened pages | **258 KB, text kept** | pdftotext |
| Compress image, transparent PNG | "same size, choose WebP" | **69% smaller**, still PNG, still transparent | PSNR 35.5 dB, corner alpha 0 |
| Compress video, 60 s 720p to 8 MB | **7 min 35 s**, 8.34 MB (over 8,000,000 bytes) | **13.3 s** (34x), 7.64 MB | ffprobe: h264 + aac |
| Grayscale PDF, arXiv paper | pages flattened to JPEG, 15 characters of text left, 3.9 MB | **vector: 39,916 characters kept**, 1.8 MB, saturation 0 | pdftotext, ImageMagick HSL |
| JSON formatter, 5 MB file | 10.6 s | **2.3 s**, identical output length | timed in Chromium |

## Every tool

Legend: **Fixed** = changed today and re-verified; **OK** = verified, no gap
worth closing; **Gap** = gap found and left, with the reason.

### PDF (24)

| Tool | Real-file test and verified result | Industry benchmark | Verdict |
|---|---|---|---|
| Merge PDF | 3 real PDFs (15+2+4 pp) → 21 pages, 1.3 s | iLovePDF/Smallpdf merge | OK. Reorder now animates (FLIP) |
| Split PDF | 15 pp → ZIP of 15 PDFs | iLovePDF split | OK |
| Rotate PDF | pp 1-3 by 90°: `pdfinfo` rot 90 on 1-3, 0 on 4 | Acrobat rotate | OK, lossless |
| Organize PDF | e2e suite (reorder, rotate, delete across two files) | iLovePDF organize | OK. Reorder now animates (FLIP); a FLIP measuring bug found and fixed (see Motion) |
| Crop PDF | IRS form, 20 mm top: CropBox changed | Sejda crop | OK (states that hidden content remains) |
| Remove pages | remove 2-4, 15 of 15 → 11 pages | iLovePDF | OK |
| Extract pages | 1, 100-102 of 142 → 4 pages | iLovePDF | OK |
| JPG to PDF | orientation-6 JPEG, receipt, WebP, transparent PNG → 4 A4 pages | iLovePDF JPG to PDF | OK |
| PDF to JPG | 15 pp → ZIP at 144 dpi, 1.5 s | iLovePDF | OK |
| Office to PDF | Apache POI docx, pptx, xlsx → PDFs with the right text | LibreOffice/iLovePDF | OK (LibreOffice in wasm) |
| PDF to Word | arXiv → docx with title, body, 18 headings | Acrobat/iLovePDF | OK |
| PDF to PowerPoint | arXiv → 15 slides, 570 editable text boxes | iLovePDF | OK |
| PDF to text | arXiv → 40,069 characters, title and body present | pdftotext | OK |
| OCR PDF | rotated scan: **48% → 94%**, pages turned upright; upright 5-page scan unchanged (37 s) | OCRmyPDF `--rotate-pages`, Acrobat | **Fixed**: orientation detection by a same-crop probe scored on confidently read words (measured: the right turn reads 4-261 such words, wrong turns 0-9) |
| Scan to PDF | e2e suite | Adobe Scan / Microsoft Lens | Gap: no automatic edge detection or perspective correction. Needs a document-detection model |
| Watermark PDF | IRS form, "SULIT" at 0° → extractable text on both pages | iLovePDF | OK |
| Sign PDF | e2e suite (typed signature placed on the page) | Smallpdf eSign | OK. White-out option is now an iOS switch |
| Page numbers | "3 of 15" found on page 3 | iLovePDF | OK |
| Compress PDF | see headline table | iLovePDF "Recommended", Acrobat "Reduce size" | **Fixed**: three levels (Recommended downsizes images to 150 dpi and keeps text; Lossless; Extreme), a qpdf repack, never bigger than the input, and the target-size path shrinks images before flattening |
| Print handouts (n-up) | 15 pp, 4 per sheet → 4 sheets | Acrobat print n-up | OK |
| Grayscale PDF | 3 real PDFs, all pages saturation 0.000, text kept; spot-colour page correctly flattened | Sejda grayscale, Acrobat Convert Colors | **Fixed**: vector conversion (content streams, forms, annotations, images), a render check, raster only as a fallback |
| Protect PDF | AES-256, `pdfinfo` needs the password, print on, edit off | Acrobat | OK |
| Unlock PDF | the protected file → `Encrypted: no` | iLovePDF unlock | OK |
| Repair PDF | real PDF → rewritten, 15 pp intact | iLovePDF repair | OK |

### Media (4)

| Tool | Real-file test and verified result | Industry benchmark | Verdict |
|---|---|---|---|
| Compress video | 60 s 720p H.264+AAC, 8 MB target: 13.3 s, 7.64 MB, H.264+AAC 540p; iPhone-style HEVC .mov 1 MB target: 0.95 MB via fallback | Clipchamp/Canva (WebCodecs), 8mb.video, HandBrake presets | **Fixed**: WebCodecs encoder via Mediabunny (MPL-2.0) with an AAC extension where the browser has none; ffmpeg.wasm fallback; decimal MB with headroom and a corrective second pass; resolution stepped down when the bitrate is too thin |
| Extract audio | clip with AAC audio → MP3 192 kbps, 10.0 s, 0.5 s | CloudConvert | OK. A clip with no audio track gets an accurate message |
| Audio to text | Whisper JFK sample → exact quote, 6.1 s | Otter / Whisper | OK |
| Teleprompter | e2e suite (26 desktop tests + 7 on phone and tablet viewports: speed, cues, voice follow, recording, camera refusals) | PromptSmart, Teleprompter Premium | OK. Mirror and voice options are now iOS switches |

### Image (11)

| Tool | Real-file test and verified result | Industry benchmark | Verdict |
|---|---|---|---|
| Compress image | 5000 px JPEG −33%; 200 KB target: 193 KB; transparent PNG −69%; UI screenshot −60% | TinyPNG, Squoosh | **Fixed**: palette PNG (median cut, k-means refine, adaptive Floyd-Steinberg dithering, exact palette when ≤256 colours), written with the browser's own deflate. Gap: JPEG uses the browser encoder, not MozJPEG |
| Convert image | transparent PNG → JPG on white; WebP → PNG | Squoosh | OK |
| Resize image | 5000 px → 1280 px; orientation-6 JPEG comes out upright (600x900) | Squoosh | OK |
| Crop image | e2e suite | iOS Photos crop | OK |
| Rotate image | orientation-6 JPEG rotated → correct upright pixels, tag cleared | iOS Photos | OK |
| Watermark image | Unsplash portrait → 1600x2400 | Watermarkly | OK |
| HEIC to JPG | real iPhone HEIC → 3992x2992 JPEG, 1.4 s | iMazing converter | OK |
| Remove photo metadata | Nikon JPEG: 57 fields incl. GPS removed; orientation-6 JPEG keeps a 32-byte Orientation-only EXIF so it still displays upright | ExifCleaner | OK (a suspected bug was checked and is not one) |
| Image to text (OCR) | receipt **4/7 → 7/7** key terms; sideways receipt saved as PDF: turned upright, colour photo kept | Google Lens, Apple Live Text | **Fixed**: grey + 1800 px cap (measured: dense 300 dpi page keeps 98.4% recall), orientation detection, PDF output keeps the colour photo |
| Remove background | Unsplash portrait → transparent corners, opaque subject, 12.8 s | remove.bg | OK |
| Passport photo maker | Unsplash portrait → 827x1181 at 600 dpi + 4R sheet | PhotoAiD, Persofoto | Gap: no automatic face alignment (you line up a guide). Needs a face-landmark model |

### Calculators (2)

| Tool | Verified | Benchmark | Verdict |
|---|---|---|---|
| Salary calculator (Malaysia) | unit tests reproduce LHDN's own worked PCB examples (Jan-Apr, bonus, zakat), PERKESO table rows | LHDN e-PCB | OK |
| CGPA calculator | e2e reproduces the Universiti Malaya handbook example | University handbooks | OK |

### Developer (9)

| Tool | Real test and verified result | Benchmark | Verdict |
|---|---|---|---|
| JSON formatter | 5 MB file: **10.6 s → 2.3 s**, same output | jsonformatter.org, VS Code | **Fixed**: colour only the first 150 KB of tokens |
| JWT decoder | sweep | jwt.io | OK |
| Base64 | sweep (unicode) | CyberChef | OK |
| Word counter | whole paper: 6,152 words = independent count | wordcounter.net | OK |
| Hash generator | MD5 of the paper in the browser equals Node's | emn178 tools, CyberChef | **Fixed**: MD5 added for checksums (RFC 1321 suite + Node cross-check). Gap: hashing a file (drop) |
| UUID generator | v7 ids valid and sorted | uuidgenerator.net | **Fixed**: UUID v7 (RFC 9562) |
| QR code | decoded back by jsQR, exact URL | QR Code Generator | OK |
| Text diff | two versions of the paper | diffchecker | OK |
| CSS shadow | sweep | cssgenerator | OK |

## Motion ("smooth like Apple apps")

Built and verified in Chromium, Android Chrome (real `adb` touch input) and
WebKit's e2e run; full table in [plan.md](../plan.md#motion-what-smooth-like-apple-apps-means-here-and-how-it-was-checked).
Springs are real damped-spring responses sampled into CSS `linear()`
(tokens.css). One regression found and fixed on the way: FLIP measured with
`getBoundingClientRect`, which includes running animations, so a drag started
while cards were still arriving could trigger spurious animations under the
pointer (the Merge drag test failed 1 run in 4; after the fix it passed every run, with the staging, a11y and organize specs each run 3 times). And text-carrying
arrivals no longer fade (axe caught a card at 4.34:1 mid-fade).

## Not verified

- A real iPhone or Android phone (emulator and desktop engines only).
- Competitor outputs on these same files (not uploaded, by design).
- The iPhone home-screen edge swipe on a real iPhone (synthetic touch only).
- Compress video's WebCodecs path on Safari (the fallback is ffmpeg).
