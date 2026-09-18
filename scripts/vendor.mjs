/**
 * Copy the self-hosted runtimes out of node_modules into public/vendor.
 *
 *   ffmpeg core   -> public/vendor/ffmpeg/<version>/   (media tools)
 *   ONNX runtime  -> public/vendor/ort/<version>/      (Whisper, via transformers.js)
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
import { mkdir, copyFile, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FFMPEG_CORE_VERSION, TRANSFORMERS_VERSION } from './versions.mjs';

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
];

for (const { name, from, version, keep } of BUNDLES) {
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
  for (const file of (await readdir(from)).filter(keep)) {
    await copyFile(join(from, file), join(to, file));
    total += (await stat(join(to, file))).size;
  }
  console.log(`[vendor] ${name} ${version}: ${(total / 1024 / 1024).toFixed(1)} MB -> public/vendor/${name}/${version}`);
}
