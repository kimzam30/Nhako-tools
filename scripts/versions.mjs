/**
 * Versions of the self-hosted runtimes, read from their installed packages.
 *
 * They go into the served path (/vendor/ffmpeg/0.12.6/...) so a new version
 * is a new URL. The service worker caches /vendor/ forever and Vercel marks
 * it immutable, so an unversioned path would pin returning visitors to
 * whatever they downloaded first, however many upgrades later.
 *
 * Shared by astro.config.mjs (compile-time constants), scripts/vendor.mjs
 * (where files are copied) and scripts/build-sw.mjs (which paths are current).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = (pkg) => JSON.parse(readFileSync(join(root, 'node_modules', pkg, 'package.json'), 'utf8')).version;

export const FFMPEG_CORE_VERSION = version('@ffmpeg/core');
export const TRANSFORMERS_VERSION = version('@xenova/transformers');
export const QPDF_VERSION = version('@neslinesli93/qpdf-wasm');
export const LIBHEIF_VERSION = version('libheif-js');
export const TESSERACT_VERSION = version('tesseract.js');
// eng and msa are versioned together; their package version names the path.
export const TESSDATA_VERSION = version('@tesseract.js-data/eng');
export const LIBREOFFICE_VERSION = version('@matbee/libreoffice-converter');

/** Served base paths, each ending in a slash. */
export const FFMPEG_BASE = `/vendor/ffmpeg/${FFMPEG_CORE_VERSION}/`;
export const ORT_BASE = `/vendor/ort/${TRANSFORMERS_VERSION}/`;
export const QPDF_BASE = `/vendor/qpdf/${QPDF_VERSION}/`;
export const LIBHEIF_BASE = `/vendor/libheif/${LIBHEIF_VERSION}/`;
export const TESSERACT_BASE = `/vendor/tesseract/${TESSERACT_VERSION}/`;
export const TESSDATA_BASE = `/vendor/tessdata/${TESSDATA_VERSION}/`;
export const LIBREOFFICE_BASE = `/vendor/libreoffice/${LIBREOFFICE_VERSION}/`;
