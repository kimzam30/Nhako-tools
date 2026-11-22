# Getting tools.nhako.com found: off-site checklist

Written 2026-11-22. The site itself is fine: Google can fetch every page, and
nothing on it blocks indexing. The problem is that Google hasn't seen enough
reason to crawl it yet.

## What Search Console said (2026-11-22)

Property `sc-domain:nhako.com` (Domain property, so it covers tools.nhako.com).
The numbers include nhako.com and bazaar.nhako.com.

| Status | Pages |
|---|---|
| Indexed | 1 |
| Discovered – currently not indexed | 248 |
| Crawled – currently not indexed | 3 (tools.nhako.com/, bazaar.nhako.com/ms, search.nhako.com/) |
| Not found (404) | 1 (validation started) |

- Sitemap `https://tools.nhako.com/sitemap-index.xml`: Success, 150 URLs, first
  submitted 2026-10-05. Resubmitted 2026-11-22.
- URL Inspection on `/`: crawled 2026-10-05, fetch OK, indexing allowed,
  canonical OK. **The only page linking to it is github.com/kimzam30.**
- Every tool page inspected said **"URL is unknown to Google"**, even though
  they're in the sitemap.

"Discovered – not indexed" on almost every page means Google knows the URLs and
chose not to spend crawl effort on them. Google decides that from links from
other sites. Fixing it is off-site work.

Indexing requested on 2026-11-22 for: `/`, `/ms`, `/pdf/merge`,
`/pdf/compress`, `/image/compress`, `/image/passport-photo`,
`/calc/take-home-pay`, `/calc/cgpa`, `/pdf/to-word`, `/image/heic-to-jpg`.
Also `/malaysia` on 2026-11-22; the 12th request that day hit Google's daily
quota (about 10–12 a day). Sitemap resubmitted to Google and Bing on
2026-11-22 after the `<lastmod>` deploy. Next batch to request, a few a day, newest pages first: `/pdf/redact`,
the six `/image/convert/*` pages (`webp-to-jpg`, `png-to-jpg`, `jpg-to-png`,
`jpg-to-webp`, `png-to-webp`, `avif-to-jpg`), `/pdf/compress/300kb`,
`/image/compress/300kb`, `/calc/cgpa/ukm`, `/pdf/to-image/spa-myresume`, then
`/ms/malaysia`, `/pdf/compress/500kb`, `/image/compress/200kb`,
`/image/compress/spa-myresume`, `/pdf/ocr`, `/media/transcribe`, `/pdf/split`,
`/image/remove-background`, and the `/ms` versions of the top tools.

## 1. Links you control (do these first, under an hour)

- [ ] **nhako.com home page**: a plain, crawlable `<a href="https://tools.nhako.com/">`
      link in the body, not only in a menu built by JS. Add a few deep links too
      (Merge PDF, Take-home pay, CGPA). This is the strongest link you can give.
- [ ] **bazaar.nhako.com and search.nhako.com**: footer link to tools.nhako.com.
- [ ] **GitHub repo `kimzam30/Nhako-tools`**: set the "Website" field to
      https://tools.nhako.com, add topics (`pdf-tools`, `image-compressor`,
      `privacy`, `webassembly`, `malaysia`, `astro`), and link it at the top of
      the README.
- [ ] **GitHub profile README and bio**: link it.
- [ ] **Social bios** (X, TikTok, Instagram, YouTube, LinkedIn): link it. These
      are nofollow but Google still discovers URLs through them.

## 2. Bing (also feeds DuckDuckGo, Ecosia, Yahoo, ChatGPT search)

- [x] tools.nhako.com added in Bing Webmaster Tools (unverified).
      Import from GSC found nothing new: Bing already holds nhako.com and
      doesn't split subdomains out of a Domain property.
- [x] Deployed the `msvalidate.01` meta tag (commit 3ea8a1a) and verified
      tools.nhako.com in Bing on 2026-11-22.
- [x] Sitemap `https://tools.nhako.com/sitemap-index.xml` submitted to Bing
      on 2026-11-22 (status: Processing).
- [x] IndexNow set up: key file `public/ba367e976c0d48d891510a0a1cf93015.txt`
      and `scripts/seo-indexnow.mjs`. After each deploy:
      `node scripts/seo-indexnow.mjs` (pages whose lastmod is today).
      First run after the key file is live: `--all`.

## 3. Directories and listings (one-off, each a real backlink)

Free-tool and privacy-tool directories link out, and searchers use them.
Main pitch: **every tool runs in the browser, nothing is uploaded, free, no
sign-up, open source (MIT).**

- [ ] **AlternativeTo**: add Nhako Tools as an alternative to iLovePDF,
      Smallpdf, TinyPNG, PDF24, remove.bg. Tag "privacy-focused",
      "works offline", "open source".
- [ ] **Product Hunt**: launch on a Tuesday–Thursday at 00:01 PT. Use
      `launch/nhako-tools-launch.mp4` and the posters in `launch/posters`. Tell
      your own followers on launch day. A good result matters less than the
      permanent listing and link.
- [ ] **Hacker News "Show HN"**: "Show HN: 60+ PDF/image/video tools that never
      upload your files (WASM, MIT)". Talk about how it works (ffmpeg.wasm, qpdf,
      LibreOffice in the browser), not the marketing.
- [ ] **privacytools / PrivacyGuides forums, r/privacy wiki-style lists**,
      and **awesome-lists on GitHub** (e.g. awesome-privacy, awesome-selfhosted
      "alternatives", awesome-wasm). Open a PR adding one line.
- [ ] **SaaSHub, Toolify-style free-tool directories, BetaList, Uneed,
      Fazier, MicroLaunch**: submit the free listing only; skip paid tiers.
- [ ] **Malaysian directories/blogs**: Lowyat.NET forum (Software & Tech),
      Malaysian tech blogs that do "useful free tools" roundups (SoyaCincau,
      Amanz, Vulcan Post): send a short email pitching the take-home pay and
      SPA/MyResume photo tools.

## 4. Communities (be useful, not spammy)

Answer a real question with the specific tool that solves it. One link, and
say it's yours. Don't post the same link in many places on the same day.

- [ ] **Reddit**: r/malaysia, r/MalaysianPF (take-home pay, EPF/SOCSO/PCB
      calculator; flair as a tool, say you built it), r/malaysiauni,
      r/SideProject, r/webdev (the WASM story), r/opensource, r/privacy
      (only where self-promotion is allowed, check the rules), r/PDF,
      r/selfhosted (if you document running it locally).
- [ ] **Student groups**: university Telegram/WhatsApp/Facebook groups (UiTM,
      UM, UKM, USM, UTM, UPM, MMU, Taylor's, Sunway). Lead with the **CGPA
      calculator**, **compress PDF to 500 KB** and **passport photo** tools,
      which students need for submissions and SPA/JPA applications. Ask a
      student rep or society to pin it rather than posting yourself.
- [ ] **Facebook groups**: Malaysian job-seeker and HR/payroll groups
      (take-home pay calculator, SPA photo/resume sizes).
- [ ] **Quora / Stack Exchange (Super User)**: answer existing "how to merge
      PDF without uploading" / "convert HEIC to JPG on Windows" questions.

## 5. Content that earns links over time

- [ ] One short write-up per flagship tool explaining the Malaysian specifics
      (e.g. "How PCB, EPF and SOCSO are worked out in 2026, with LHDN's own
      examples"), posted on nhako.com or dev.to/Medium **with a link back**.
- [ ] A technical post: "Running LibreOffice and ffmpeg in the browser" on
      dev.to / your blog. Dev posts get linked and shared.
- [ ] Keep the YouTube/TikTok demos linking to the specific tool URL, not just
      the home page.

## 6. Check progress

- Weekly: GSC → Pages. Watch "Discovered – not indexed" fall and "Indexed" rise.
- After 2–3 weeks: URL Inspection on the 10 requested pages. If they still say
  "unknown to Google" after the links above exist, request them again.
- GSC → Links: shows when the new backlinks are counted.
