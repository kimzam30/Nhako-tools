// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver; they share
// submissions) which pages changed, so they recrawl them the same day
// instead of waiting for the sitemap.
//
// Run it after a deploy is live, never before: the engines fetch the key file
// and the pages straight away.
//
//   node scripts/seo-indexnow.mjs                  pages whose lastmod is today (UTC)
//   node scripts/seo-indexnow.mjs --since 2026-11-20
//   node scripts/seo-indexnow.mjs --all            every URL in the sitemap
//   node scripts/seo-indexnow.mjs --dry-run ...    list them, send nothing
//
// The URLs and dates come from the live sitemap, so what is sent is what is
// deployed. The key is public by design: IndexNow checks ownership by
// fetching public/<key>.txt from the site.

const SITE = 'https://tools.nhako.com';
const KEY = 'ba367e976c0d48d891510a0a1cf93015';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const all = args.includes('--all');
const sinceAt = args.indexOf('--since');
const since = sinceAt >= 0 ? args[sinceAt + 1] : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(since ?? '')) {
  console.error('--since needs a date like 2026-11-22');
  process.exit(2);
}

async function text(url) {
  const res = await fetch(url, { redirect: 'manual' });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

const keyFile = `${SITE}/${KEY}.txt`;
const keyLive = await text(keyFile).then((t) => t.trim() === KEY, () => false);
if (!keyLive) {
  const msg = `${keyFile} is not live yet; deploy public/${KEY}.txt first`;
  if (!dryRun) throw new Error(msg);
  console.warn(`warning: ${msg}`);
}

const index = await text(`${SITE}/sitemap-index.xml`);
const urls = [];
for (const [, sitemap] of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const xml = await text(sitemap);
  for (const [, loc, lastmod] of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) {
    if (all || (lastmod && lastmod >= since)) urls.push(loc);
  }
}

console.log(`${urls.length} URL(s) ${all ? 'in the sitemap' : `with lastmod on or after ${since}`}`);
for (const u of urls) console.log(`  ${u}`);
if (dryRun || urls.length === 0) process.exit(0);

// One request takes up to 10,000 URLs; the whole site is well under that.
const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: keyFile, urlList: urls }),
});
// 200 = accepted, 202 = accepted, key check pending. Anything else is a failure.
console.log(`IndexNow answered ${res.status} ${res.statusText}`);
if (res.status !== 200 && res.status !== 202) {
  console.error(await res.text());
  process.exit(1);
}
