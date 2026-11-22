# SEO baseline, day 0 (2026-11-22)

Build plan item 0.6. The numbers everything later is compared against.
Recorded the same day Bing was verified, the sitemap resubmitted and the
first 10 indexing requests sent (see `seo-offsite-checklist.md`).

## Google Search Console

Property `sc-domain:nhako.com`. It covers nhako.com, bazaar.nhako.com,
search.nhako.com and tools.nhako.com together; the report can't be split
by host without a per-page export.

| Measure | Value |
|---|---|
| Indexed pages (whole domain) | **1** |
| Not indexed | 252 |
| …Discovered – currently not indexed | 248 |
| …Crawled – currently not indexed | 3: tools.nhako.com/, bazaar.nhako.com/ms, search.nhako.com/ |
| …Not found (404) | 1 (validation started) |
| Web search clicks, last 3 months (whole domain) | 25 |
| tools sitemap (`/sitemap-index.xml`) | Success, 150 URLs discovered, last read 2026-11-16 |
| tools.nhako.com/ | Crawled 2026-10-05, fetch OK, indexing allowed, not indexed. Only referring page: github.com/kimzam30 |
| /ms and 8 top tool pages | "URL is unknown to Google" |

Not captured: a per-page Performance export for tools.nhako.com (impressions,
clicks, position). Chrome was disconnected when this file was written. Take it
from GSC → Performance → Pages, filter "URL contains tools.nhako.com",
3 months, Export.

## Bing Webmaster Tools

| Measure | Value |
|---|---|
| tools.nhako.com | Verified 2026-11-22 (meta tag); sitemap submitted, Processing, 0 URLs yet |
| nhako.com site, 12 Oct – 19 Nov | 2 clicks, 17 impressions |
| Bing's own recommendations for nhako.com | Set up IndexNow; no sitemap known; not enough inbound links from quality domains; many meta descriptions too short |

## Page speed (lab, mobile)

The PageSpeed Insights API was out of its shared daily quota, so these are
**local Lighthouse 13.6.0** runs (the engine PageSpeed uses): mobile form
factor, Lighthouse's default simulated throttling (slow 4G, 4× CPU), headless
Chrome for Testing 157, 3 runs each, median shown. Absolute numbers will
differ from pagespeed.web.dev, but all six pages ran on the same machine and
network, so they compare fairly with each other and with a rerun of
the same setup.

| Page | Score | FCP | LCP | TBT | CLS | Speed Index | Transfer | Runs |
|---|---|---|---|---|---|---|---|---|
| **Nhako** home | **100** | 1.1 s | 1.1 s | 16 ms | 0 | 1.1 s | 63 KB | 100, 100, 100 |
| **Nhako** Merge PDF | **100** | 0.9 s | 1.1 s | 0 ms | 0 | 0.9 s | 92 KB | 100, 100, 100 |
| iLovePDF home | 88 | 1.1 s | 2.4 s | 410 ms | 0 | 1.1 s | 470 KB | 82, 88, 88 |
| iLovePDF Merge PDF | 79 | 1.2 s | 1.2 s | 862 ms | 0 | 2.8 s | 961 KB | 76, 79, 82 |
| Smallpdf home | 52 | 1.3 s | 5.3 s | 1,526 ms | 0.091 | 1.6 s | 1,381 KB | 50, 52, 53 |
| Smallpdf Merge PDF | 52 | 1.3 s | 5.7 s | 1,656 ms | 0.009 | 1.5 s | 1,265 KB | 51, 53, 52 |

Speed is not what's holding Nhako back: its tool page is a tenth of
iLovePDF's weight and blocks the main thread for 0 ms. The gap is
discovery and links (see GSC above).

To rerun:

```bash
npm i --prefix /tmp/lh lighthouse@13.6.0
CHROME_PATH=~/.cache/ms-playwright/chromium-1252/chrome-linux64/chrome \
  /tmp/lh/node_modules/.bin/lighthouse https://tools.nhako.com/pdf/merge \
  --only-categories=performance --form-factor=mobile --output=json \
  --output-path=merge.json --chrome-flags="--headless=new --no-sandbox"
```

## Check again

- **2026-12-06 (2 weeks):** GSC indexed count, the 10 requested URLs in URL
  Inspection, Bing indexed pages.
- **2026-12-22 (1 month):** all of the above plus GSC Performance export for
  tools.nhako.com and GSC → Links (external links count).
