import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentOf, stampLastmod } from '../scripts/seo-lastmod.mjs';

const page = (title: string, body: string, asset = 'a1b2') => `<!doctype html><html><head>
<title>${title}</title><meta name="description" content="Merge PDFs">
<script type="module" src="/_astro/page.${asset}.js"></script></head>
<body><nav>menu</nav><main class="mx-auto"><h1>${title}</h1>
<astro-island component-url="/_astro/Merge.${asset}.js"><script>self.x=1</script></astro-island>
<p>${body}</p></main><footer>© 2026</footer></body></html>`;

describe('contentOf', () => {
  it('ignores markup, scripts and asset hashes', () => {
    expect(contentOf(page('Merge PDF', 'Drop files', 'a1b2'))).toBe(contentOf(page('Merge PDF', 'Drop files', 'zz99')));
    expect(contentOf(page('Merge PDF', 'Drop files'))).not.toContain('self.x');
  });

  it('sees a change to the visible text, title or description', () => {
    const base = contentOf(page('Merge PDF', 'Drop files'));
    expect(contentOf(page('Merge PDF', 'Drop your files'))).not.toBe(base);
    expect(contentOf(page('Combine PDF', 'Drop files'))).not.toBe(base);
    expect(contentOf(page('Merge PDF', 'Drop files').replace('Merge PDFs', 'Join PDFs'))).not.toBe(base);
  });
});

describe('stampLastmod', () => {
  async function site(pages: Record<string, string>) {
    const dir = await mkdtemp(join(tmpdir(), 'seo-lastmod-'));
    const locs = Object.keys(pages).map((p) => `<url><loc>https://tools.nhako.com${p}</loc></url>`).join('');
    await writeFile(join(dir, 'sitemap-0.xml'), `<urlset>${locs}</urlset>`);
    for (const [p, html] of Object.entries(pages)) {
      const d = join(dir, p);
      await mkdir(d, { recursive: true });
      await writeFile(join(d, 'index.html'), html);
    }
    return { dist: pathToFileURL(`${dir}/`), sitemap: join(dir, 'sitemap-0.xml'), manifestFile: pathToFileURL(join(dir, 'm.json')) };
  }
  const quiet = { info() {} };

  it('keeps the old date for unchanged pages and stamps today on changed ones', async () => {
    const s = await site({ '/': page('Home', 'tools'), '/pdf/merge': page('Merge PDF', 'Drop files') });
    await stampLastmod(s.dist, { today: '2026-01-01', manifestFile: s.manifestFile, log: quiet });

    // Rebuild: home restyled only, merge's text changed.
    await writeFile(join(new URL(s.dist).pathname, 'index.html'), page('Home', 'tools', 'new1'));
    await writeFile(join(new URL(s.dist).pathname, 'pdf/merge/index.html'), page('Merge PDF', 'Drop your files'));
    await writeFile(s.sitemap, '<urlset><url><loc>https://tools.nhako.com/</loc></url><url><loc>https://tools.nhako.com/pdf/merge</loc></url></urlset>');
    const out = await stampLastmod(s.dist, { today: '2026-02-02', manifestFile: s.manifestFile, log: quiet });

    expect(out['/']?.lastmod).toBe('2026-01-01');
    expect(out['/pdf/merge']?.lastmod).toBe('2026-02-02');
    const xml = await readFile(s.sitemap, 'utf8');
    expect(xml).toContain('<loc>https://tools.nhako.com/</loc><lastmod>2026-01-01</lastmod>');
    expect(xml).toContain('<loc>https://tools.nhako.com/pdf/merge</loc><lastmod>2026-02-02</lastmod>');
  });

  it('fails the build when a sitemap URL has no built page', async () => {
    const s = await site({ '/': page('Home', 'tools') });
    await writeFile(s.sitemap, '<urlset><url><loc>https://tools.nhako.com/gone</loc></url></urlset>');
    await expect(stampLastmod(s.dist, { manifestFile: s.manifestFile, log: quiet })).rejects.toThrow(/gone/);
  });
});
