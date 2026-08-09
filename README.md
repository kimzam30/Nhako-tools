# Nhako Tools

A browser-based utility hub for PDF, media, and developer tasks. Every operation runs client-side — files never leave your machine, and there is no backend to leak them.

**Live — [tools.nhako.com](https://tools.nhako.com)**

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite_7-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/github/license/kimzam30/Nhako-tools?style=flat-square)

---

## Tools

### PDF

| Tool | What it does |
|---|---|
| Merge | Combine several PDFs into one |
| Split | Extract every page into a ZIP |
| Compress | Structural optimisation to shrink file size |
| Convert | PDF → high-resolution JPG/PNG, or extract raw text |

### Media

| Tool | What it does |
|---|---|
| Video compressor | Target a specific output size using client-side bitrate calculation |
| Audio extractor | Strip audio from video into MP3 |
| Audio to text | On-device transcription with Whisper via Transformers.js |

### Developer

| Tool | What it does |
|---|---|
| JSON formatter | Parse and pretty-print with syntax highlighting |
| JWT decoder | Decode tokens locally, no server round-trip |
| Base64 converter | Text or files to Base64 and back |
| Word counter | Live word, character, and reading-time counts |

---

## Privacy

There is no backend. No upload endpoint, no database, no analytics.

- Files are read into browser memory and processed there.
- Heavy lifting runs through WebAssembly — FFmpeg and the Whisper model execute in your tab.
- The site is static, served from Vercel's edge network.

The practical consequence: large files are limited by your device's memory, not by an upload cap, and nothing you process is ever transmitted.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite 7 |
| Routing | React Router 7 |
| Styling | Tailwind CSS v4 |
| PDF | `pdf-lib`, `pdf.js` |
| Media | `ffmpeg.wasm` |
| Transcription | `transformers.js` (Whisper) |
| Archives | `jszip` |
| Hosting | Vercel |

---

## Local development

```bash
git clone https://github.com/kimzam30/Nhako-tools.git
cd Nhako-tools
npm install
npm run dev
```

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

> **Note.** `ffmpeg.wasm` needs `SharedArrayBuffer`, which requires cross-origin isolation. The COOP/COEP headers that enable it are set in `vite.config.js` for dev and `vercel.json` for production. Serving the build with a plain static server without those headers will break the media tools.

---

## License

MIT — see [LICENSE](LICENSE).
