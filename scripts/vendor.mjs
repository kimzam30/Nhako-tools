/**
 * Copy the self-hosted runtimes out of node_modules into public/vendor.
 *
 *   ffmpeg core   -> public/vendor/ffmpeg/<version>/   (media tools)
 *   ONNX runtime  -> public/vendor/ort/<version>/      (Whisper, MODNet, via transformers.js)
 *   qpdf          -> public/vendor/qpdf/<version>/     (Protect and Unlock PDF)
 *   libheif       -> public/vendor/libheif/<version>/  (HEIC to JPG, LGPL-3.0, unmodified)
 *   tesseract     -> public/vendor/tesseract/<version>/ (OCR: worker + LSTM cores)
 *   tessdata      -> public/vendor/tessdata/<version>/  (eng and msa, best_int, gzipped)
 *   LibreOffice   -> public/vendor/libreoffice/<version>/ (Office to PDF, MPL-2.0,
 *                    unmodified; the two big files gzipped, see below)
 *
 * The old build fetched ffmpeg from unpkg at runtime, and transformers.js
 * fetches its ONNX runtime from cdn.jsdelivr.net unless told otherwise. Serving
 * both from our own origin removes two third-party failure modes and keeps the
 * privacy page true: the only third party left is the Hugging Face model
 * download. Together the files are ~70 MB, so they are generated at build time
 * rather than committed; public/vendor is gitignored.
 *
 * ffmpeg must be the ESM build, not UMD. @ffmpeg/ffmpeg spawns its worker with
 * { type: "module" }, where importScripts() does not exist, so the worker falls
 * back to `await import(coreURL)` and reads `.default`. The UMD bundle has no
 * default export, so that path yields undefined and load() never settles: no
 * error, no rejection, just a spinner forever. Vendoring UMD here is a silent
 * hang, which is why this line is worth a comment.
 */
import { mkdir, copyFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FFMPEG_CORE_VERSION, TRANSFORMERS_VERSION, QPDF_VERSION, LIBHEIF_VERSION, TESSERACT_VERSION, TESSDATA_VERSION, LIBREOFFICE_VERSION } from './versions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BUNDLES = [
  {
    name: 'ffmpeg',
    from: join(root, 'node_modules/@ffmpeg/core/dist/esm'),
    version: FFMPEG_CORE_VERSION,
    keep: () => true,
  },
  {
    name: 'ort',
    from: join(root, 'node_modules/@xenova/transformers/dist'),
    version: TRANSFORMERS_VERSION,
    keep: (file) => file.endsWith('.wasm'),
  },
  {
    // Only the binary: the small JS loader is bundled by Vite and told where
    // the binary lives through locateFile.
    name: 'qpdf',
    from: join(root, 'node_modules/@neslinesli93/qpdf-wasm/dist'),
    version: QPDF_VERSION,
    keep: (file) => file.endsWith('.wasm'),
  },
  {
    // libheif is LGPL-3.0: it ships as its own unmodified file, with its
    // licence beside it, so it can be swapped for any other build.
    name: 'libheif',
    from: join(root, 'node_modules/libheif-js/libheif-wasm'),
    version: LIBHEIF_VERSION,
    keep: (file) => file === 'libheif.wasm' || file === 'LICENSE',
  },
  {
    // The worker and the LSTM-only cores (plain, SIMD, relaxed SIMD): the
    // worker picks one by feature detection. The legacy engine is never used.
    name: 'tesseract',
    from: join(root, 'node_modules/tesseract.js-core'),
    extra: [join(root, 'node_modules/tesseract.js/dist/worker.min.js')],
    version: TESSERACT_VERSION,
    keep: (file) => /-lstm\.wasm\.js$/.test(file) || file === 'LICENSE',
  },
  {
    // "best_int": the accurate LSTM models, integer-quantised. Already
    // gzipped; tesseract.js gunzips them itself.
    name: 'tessdata',
    from: join(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
    extra: [join(root, 'node_modules/@tesseract.js-data/msa/4.0.0_best_int/msa.traineddata.gz')],
    version: TESSDATA_VERSION,
    keep: (file) => file.endsWith('.traineddata.gz'),
  },
  {
    // LibreOffice is 147 MB of WebAssembly and a 100 MB file-system image.
    // Gzipped here (to 77 MB together) and unzipped in the browser with
    // DecompressionStream, so the download is a third of the size whether or
    // not the host compresses on the fly, and no single file nears a host's
    // size limit. Gzipping takes a while, so it is skipped when done already.
    name: 'libreoffice',
    from: join(root, 'node_modules/@matbee/libreoffice-converter/wasm'),
    extra: [join(root, 'node_modules/@matbee/libreoffice-converter/dist/browser.worker.global.js')],
    version: LIBREOFFICE_VERSION,
    keep: (file) => ['soffice.js', 'soffice.worker.js', 'soffice.wasm', 'soffice.data'].includes(file),
    gzip: (file) => file === 'soffice.wasm' || file === 'soffice.data',
    // MPL-2.0 asks that anyone given the program is told where its source is.
    notice: [
      `LibreOffice compiled to WebAssembly, from @matbee/libreoffice-converter ${LIBREOFFICE_VERSION},`,
      'served unmodified (soffice.wasm and soffice.data are only gzipped for transfer).',
      '',
      'Licence: Mozilla Public License 2.0, https://www.mozilla.org/MPL/2.0/',
      'Source of this build: https://github.com/matbeedotcom/libreoffice-document-converter',
      'LibreOffice source: https://www.libreoffice.org/about-us/source-code/',
      '',
    ].join('\n'),
  },
];

for (const { name, from, version, keep, extra = [], gzip = () => false, notice } of BUNDLES) {
  if (!existsSync(from)) {
    console.error(`[vendor] ${from} is missing. Run npm install; the tools that need ${name} will not work.`);
    process.exit(1);
  }

  const base = join(root, 'public/vendor', name);
  const to = join(base, version);

  // Remove other versions (and the old unversioned layout) so stale copies
  // are never deployed next to the current one.
  if (existsSync(base)) {
    for (const entry of await readdir(base)) {
      if (entry !== version) await rm(join(base, entry), { recursive: true, force: true });
    }
  }

  await mkdir(to, { recursive: true });
  let total = 0;
  const sources = [...(await readdir(from)).filter(keep).map((file) => join(from, file)), ...extra];
  for (const src of sources) {
    const file = basename(src);
    if (gzip(file)) {
      const out = join(to, `${file}.gz`);
      if (!existsSync(out) || (await stat(out)).mtimeMs < (await stat(src)).mtimeMs) {
        const tmp = `${out}.partial`;
        await pipeline(createReadStream(src), createGzip({ level: 9 }), createWriteStream(tmp));
        await copyFile(tmp, out);
        await rm(tmp);
      }
      total += (await stat(out)).size;
      continue;
    }
    await copyFile(src, join(to, file));
    total += (await stat(join(to, file))).size;
  }
  if (notice) await writeFile(join(to, 'NOTICE.txt'), notice);
  console.log(`[vendor] ${name} ${version}: ${(total / 1024 / 1024).toFixed(1)} MB -> public/vendor/${name}/${version}`);
}
