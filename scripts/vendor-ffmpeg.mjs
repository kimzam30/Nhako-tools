/**
 * Copy the ffmpeg wasm core out of node_modules into public/vendor/ffmpeg.
 *
 * The old build fetched this from unpkg at runtime, which made every media
 * tool depend on a third party being reachable. Serving it from our own origin
 * removes that failure mode and makes "nothing leaves your machine" true
 * without an asterisk. The files are ~32 MB, so they are generated at build
 * time rather than committed; public/vendor is gitignored.
 *
 * It must be the ESM build, not UMD. @ffmpeg/ffmpeg spawns its worker with
 * { type: "module" }, where importScripts() does not exist, so the worker falls
 * back to `await import(coreURL)` and reads `.default`. The UMD bundle has no
 * default export, so that path yields undefined and load() never settles: no
 * error, no rejection, just a spinner forever. Vendoring UMD here is a silent
 * hang, which is why this line is worth a comment.
 */
import { mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules/@ffmpeg/core/dist/esm');
const to = join(root, 'public/vendor/ffmpeg');

if (!existsSync(from)) {
  console.error('[vendor-ffmpeg] @ffmpeg/core is not installed — media tools will not work.');
  process.exit(1);
}

await mkdir(to, { recursive: true });
let total = 0;
for (const name of await readdir(from)) {
  await copyFile(join(from, name), join(to, name));
  total += (await stat(join(to, name))).size;
}
console.log(`[vendor-ffmpeg] ${(total / 1024 / 1024).toFixed(1)} MB -> public/vendor/ffmpeg`);
