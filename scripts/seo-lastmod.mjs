// Accurate <lastmod> for the sitemap.
//
// A page's lastmod is the day its visible content last changed: its <title>,
// meta description and the text inside <main>. Markup, classes, scripts and
// structured data don't count, so a restyle or a new asset hash doesn't
// tell Google that 150 pages were rewritten.
//
// Vercel builds without the git history, so the dates can't come from git at
// build time. Instead `seo-lastmod.json` (committed) keeps, per URL, a hash of
// that content and the date it was first seen. Every build:
//   - hashes each page in the sitemap,
//   - keeps the stored date where the hash matches, and stamps today (UTC)
//     where it doesn't or the URL is new,
//   - writes <lastmod> into sitemap-*.xml and saves the manifest back.
// So build locally before committing a content change, and commit the updated
// manifest with it. If you forget, Vercel still stamps today on the changed
// pages; they just keep saying today on every deploy until the manifest is
// committed.
//
// `node scripts/seo-lastmod.mjs --seed` (after `npm run build`) rebuilds the
// manifest from git history instead: each page gets the date of the last
// commit that touched its own source (the tool's registry and Malay entries,
// its module, its own page view). Shared files like ui.ts, ToolView and the
// layout are left out
// on purpose, or every page would get the same date.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MANIFEST = new URL('./seo-lastmod.json', import.meta.url);
const ROOT = new URL('../', import.meta.url);

/** The visible content that decides whether a page changed. */
export function contentOf(html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  const main = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/)?.[1] ?? '';
  const text = main
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${title}\n${description}\n${text}`;
}

const hashOf = (html) => createHash('sha256').update(contentOf(html)).digest('hex').slice(0, 16);

/** https://tools.nhako.com/pdf/merge -> <dist>/pdf/merge/index.html */
function htmlFileFor(loc, dist) {
  const path = new URL(loc).pathname.replace(/^\/|\/$/g, '');
  return new URL(path ? `${path}/index.html` : 'index.html', dist);
}

async function readManifest(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8')).pages ?? {};
  } catch {
    return {};
  }
}

// One URL per line, sorted, so two branches that change different pages
// merge cleanly.
async function writeManifest(file, pages) {
  const lines = Object.keys(pages)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(pages[k])}`);
  const readme = JSON.stringify('Written by scripts/seo-lastmod.mjs on every build. Commit it with content changes.');
  await writeFile(file, `{\n "_readme": ${readme},\n "pages": {\n${lines.join(',\n')}\n }\n}\n`);
}

async function sitemapFiles(dist) {
  return (await readdir(dist)).filter((f) => /^sitemap-\d+\.xml$/.test(f)).map((f) => new URL(f, dist));
}

/** @typedef {{ hash: string, lastmod: string }} Entry */

/**
 * Called from astro:build:done after @astrojs/sitemap has written its files.
 * @param {URL} outDir the build output directory
 * @param {{ today?: string, log?: { info?: (msg: string) => void }, manifestFile?: URL }} [options]
 * @returns {Promise<Record<string, Entry>>} the manifest entry for every URL in the sitemap
 */
export async function stampLastmod(outDir, { today = new Date().toISOString().slice(0, 10), log = console, manifestFile = MANIFEST } = {}) {
  const dist = new URL('.', outDir);
  const manifest = await readManifest(manifestFile);
  /** @type {Record<string, Entry>} */
  const next = {};
  let changed = 0;
  for (const file of await sitemapFiles(dist)) {
    let xml = await readFile(file, 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const loc of locs) {
      const key = new URL(loc).pathname;
      const html = htmlFileFor(loc, dist);
      if (!existsSync(html)) throw new Error(`seo-lastmod: ${loc} is in the sitemap but ${fileURLToPath(html)} was not built`);
      const hash = hashOf(await readFile(html, 'utf8'));
      const prev = manifest[key];
      const lastmod = prev && prev.hash === hash ? prev.lastmod : today;
      if (!prev || prev.hash !== hash) changed++;
      next[key] = { hash, lastmod };
      xml = xml.replace(`<loc>${loc}</loc>`, `<loc>${loc}</loc><lastmod>${lastmod}</lastmod>`);
    }
    await writeFile(file, xml);
  }
  const dropped = Object.keys(manifest).filter((k) => !(k in next)).length;
  if (changed || dropped) {
    await writeManifest(manifestFile, next);
    log.info?.(`seo-lastmod: ${changed} page(s) new or changed, ${dropped} dropped; commit scripts/seo-lastmod.json`);
  }
  return next;
}

// ─── Seeding from git ──────────────────────────────────────────────────────

function gitDate(args) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', ...args], { cwd: fileURLToPath(ROOT), encoding: 'utf8' })
      .split('\n')[0]
      .trim() || null;
  } catch {
    return null;
  }
}

const latest = (dates) => dates.filter(Boolean).sort().at(-1) ?? null;
const fileDate = (...files) => latest(files.filter((f) => existsSync(new URL(f, ROOT))).map((f) => gitDate(['--', f])));

/** Source dates for one URL path, newest wins. */
function seedDate(path) {
  const ms = path === '/ms' || path.startsWith('/ms/');
  const rest = ms ? path.slice(3) || '/' : path;
  const parts = rest.split('/').filter(Boolean);
  const i18n = ms ? ['src/i18n/tools.ts'] : [];

  if (parts.length >= 2) {
    const [category, slug] = parts;
    const entry = gitDate(['-L', `/slug: '${slug}', category: '${category}'/,/^  },/:src/tools/registry.ts`]);
    const msEntry = ms ? gitDate(['-L', `/^  '${category}\\/${slug}': {/,/^  },/:src/i18n/tools.ts`]) : null;
    return latest([entry, msEntry, fileDate(`src/tools/${category}/${slug}.ts`)]);
  }
  const page = parts[0] ?? 'index';
  const views = {
    index: ['src/views/HomeView.astro'],
    about: ['src/views/AboutView.astro'],
    privacy: ['src/views/PrivacyView.astro'],
    feedback: ['src/views/FeedbackView.astro'],
    malaysia: ['src/views/CollectionView.astro', 'src/tools/collections.ts'],
  }[page] ?? ['src/views/CategoryView.astro', 'src/tools/registry.ts', ...i18n];
  return fileDate(`src/pages/${ms ? 'ms/' : ''}${page}.astro`, ...views);
}

async function seed() {
  const dist = new URL('dist/', ROOT);
  const pages = {};
  for (const file of await sitemapFiles(dist)) {
    const xml = await readFile(file, 'utf8');
    for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const key = new URL(loc).pathname;
      const html = await readFile(htmlFileFor(loc, dist), 'utf8');
      pages[key] = { hash: hashOf(html), lastmod: seedDate(key) ?? new Date().toISOString().slice(0, 10) };
    }
  }
  await writeManifest(MANIFEST, pages);
  console.log(`seo-lastmod: seeded ${Object.keys(pages).length} pages from git history`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes('--seed')) {
  await seed();
}
