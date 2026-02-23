# 🛠️ Nhako Tools

A powerful, high-performance web utility hub designed for speed and absolute privacy. Built during a "1 Day 1 Project" sprint, Nhako Tools performs complex document and media processing **100% inside your browser**.

**Live:** [tools.nhako.com](https://tools.nhako.com)

---

## 🌟 Features

### 📄 PDF Utilities
- **Merge PDF:** Combine multiple documents into one without uploading to a server.
- **Split PDF:** Extract every page into a neat ZIP file instantly.
- **Compress PDF:** Structural optimization to reduce file size without quality loss.
- **Convert PDF:** Transform PDFs into High-Res JPG/PNG images or extract raw Text.

### 🎬 Media Tools
- **Video Compressor:** Target specific file sizes (MB) using client-side bitrate calculation.
- **Extract Assets:** Strip audio from video files into high-quality MP3s.
- **Audio to Text:** On-device AI transcription using OpenAI's Whisper model (via Transformers.js).

---

## 🔒 Privacy First (RM0 Infrastructure)
Unlike other popular tools, Nhako Tools has **zero backend**. 
- **Your files never leave your computer.**
- Processing happens via **WebAssembly (Wasm)** in your browser's memory.
- No databases, no tracking, and **RM0 server costs** hosted entirely on Vercel's edge network.

---

## 🚀 Tech Stack

- **Frontend:** React + Vite
- **Styling:** Tailwind CSS
- **PDF Engine:** `pdf-lib` & `pdf.js`
- **Media Engine:** `ffmpeg.wasm` (FFmpeg compiled to WebAssembly)
- **AI Engine:** `transformers.js` (Whisper-tiny)
- **Deployment:** Vercel (Continuous Deployment)

---

## 🛠️ Local Setup

1. **Clone the repo:**
   ```bash
   git clone [https://github.com/](https://github.com/)[GITHUB-USERNAME]/nhako-tools.git
   ```
2. **Install dependencies:**

```Bash
npm install
```
3. **Run development server:**

```Bash
npm run dev
```
***Note: Due to SharedArrayBuffer requirements for FFmpeg, the dev server includes specific security headers in ```vite.config.js```.***

📜 License
Distributed under the MIT License. See ```LICENSE``` for more information.

Developed with ❤️ by kimzam, owner of Nhako.