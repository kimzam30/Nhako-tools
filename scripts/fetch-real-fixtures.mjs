/**
 * Download the real-world files the human-path E2E specs use, into
 * e2e/fixtures/real/ (git-ignored: about 15 MB, and the licences differ).
 *
 * These are actual files made by cameras, phones and office software, not
 * files drawn by the tests themselves: an 18 MP camera JPEG, a GPS-tagged
 * Nikon photo, an iPhone-style HEIC, a Word/Excel/PowerPoint/ODT set, a
 * 1080p H.264 clip, recorded English and Malay speech and a typeset paper.
 * Every download is pinned by SHA-256, so a changed upstream file fails
 * loudly instead of quietly changing what the tests prove.
 *
 * Derived files are built from those (pdf-lib only, no system tools):
 *   scanned-40.pdf  40 image-only pages, the shape of a phone scan
 *   damaged.pdf     paper.pdf cut off at 70%: the page objects were packed
 *                   in object streams whose index was in the lost 30%, so
 *                   nothing can recover it; the tool must say so clearly
 *   bad-xref.pdf    paper.pdf with a wrong startxref offset: the common
 *                   damage, which repair must fix
 *
 *   node scripts/fetch-real-fixtures.mjs
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

const DIR = 'e2e/fixtures/real';
const UA = { 'user-agent': 'nhako-e2e-fixtures/1.0' };

const FILES = [
  // Nikon Coolpix photo with GPS EXIF (ianare/exif-samples, MIT).
  ['gps.jpg', 'https://github.com/ianare/exif-samples/raw/master/jpg/gps/DSCN0010.jpg', '17307b1207eb6487d7908e9d154890b46e3d2e0192369cfd3f4c33d5a5af4035'],
  // 5184 x 3456 camera JPEG, 5.5 MB (filesamples.com).
  ['big.jpg', 'https://filesamples.com/samples/image/jpeg/sample_5184%C3%973456.jpeg', '9bc52b9ea29d82d6f607b6e3685ef7f62a030480695cfe5013f36c98e49702ae'],
  // HEIF stills (libheif example, and filesamples.com).
  ['iphone.heic', 'https://github.com/strukturag/libheif/raw/master/examples/example.heic', '7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2'],
  ['sample.heic', 'https://filesamples.com/samples/image/heic/sample1.heic', '00d9e0636b645036f77b3809fcd26a29df71b9ee66f2865fd8729b894aeabf59'],
  // 10 s of Big Buck Bunny, 1080p H.264, video only (no audio track), 5.2 MB (CC BY 3.0, Blender Foundation).
  ['bbb1080.mp4', 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_5MB.mp4', 'e131ad42621442758a3acb899bfbdfeeab0b40c7e2f7c7e66683f58a09a99aee'],
  // 10 s phone-style clip with sound: H.264 video + AAC audio, 5.5 MB (samplelib.com).
  ['clip-with-sound.mp4', 'https://download.samplelib.com/mp4/sample-10s.mp4', 'be998e5fed5a9065bbccdb097884794ebd2492cb261ec40948e7a846af5724b8'],
  // Whisper's own test clip: JFK, "ask not what your country can do for you".
  ['jfk.flac', 'https://github.com/openai/whisper/raw/main/tests/jfk.flac', '63a4b1e4c1dc655ac70961ffbf518acd249df237e5a0152faae9a4a836949715'],
  // A native Malay speaker saying "kedaerahan" (Lingua Libre, CC BY-SA 4.0).
  ['ms-word.wav', 'https://upload.wikimedia.org/wikipedia/commons/6/66/LL-Q9237_%28msa%29-GinormousBuildings-kedaerahan.wav', '40baa98eb205f63ef844bf9bd49ae92618a382702d96780541dabd4c2100a2cd'],
  // Office documents made by Word, Excel, PowerPoint and LibreOffice.
  ['sample.docx', 'https://filesamples.com/samples/document/docx/sample3.docx', '58211ac149c4b05110cb95959f0f5f529333af5aea060d5a5baf096f531848b8'],
  ['sample.xlsx', 'https://filesamples.com/samples/document/xlsx/sample1.xlsx', '3cf0f4791bec46c988b6a7a1064bf9f6e843e1d6a682fa9cc85b402495905fee'],
  ['sample.pptx', 'https://github.com/apache/poi/raw/trunk/test-data/slideshow/SampleShow.pptx', 'bfb4b2f07c9233afd2f32aa5781d849d0c7d225bf03721a10becf487b481d828'],
  ['sample.odt', 'https://filesamples.com/samples/document/odt/sample1.odt', 'b1cbd771d3b5a7b0e02c7ecbf7330e2ca21c00d9aac88eea878b75fd9dbca23a'],
  ['sample.csv', 'https://filesamples.com/samples/document/csv/sample1.csv', '281202d678d490a22bf4d41902f67cbfbd81edfb893330641c0b29fadbcc83d1'],
  // "Attention Is All You Need", typeset with embedded fonts and figures (arXiv).
  ['paper.pdf', 'https://arxiv.org/pdf/1706.03762v7', 'bdfaa68d8984f0dc02beaca527b76f207d99b666d31d1da728ee0728182df697'],
];

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const exists = (p) => access(p).then(() => true, () => false);

await mkdir(DIR, { recursive: true });

for (const [name, url, want] of FILES) {
  const path = `${DIR}/${name}`;
  if (await exists(path) && sha(await readFile(path)) === want) continue;
  const res = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} from ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha(buf);
  if (got !== want) throw new Error(`${name}: sha256 ${got}, expected ${want}. Upstream changed; re-pin it.`);
  await writeFile(path, buf);
  console.log(`fetched ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
}

// A phone scan: every page is one photo and nothing else, no text layer.
const scan = await PDFDocument.create();
const photos = [
  await scan.embedJpg(await readFile(`${DIR}/gps.jpg`)),
  await scan.embedJpg(await readFile(`${DIR}/big.jpg`)),
];
for (let i = 0; i < 40; i++) {
  // Mostly the small photo, with the 18 MP one on every tenth page, so the
  // file is big enough (about 25 MB) to be worth compressing.
  const img = photos[i % 10 === 0 ? 1 : 0];
  const page = scan.addPage([595, 842]);
  const s = Math.min(595 / img.width, 842 / img.height);
  page.drawImage(img, { x: (595 - img.width * s) / 2, y: (842 - img.height * s) / 2, width: img.width * s, height: img.height * s });
}
await writeFile(`${DIR}/scanned-40.pdf`, await scan.save());

const paper = await readFile(`${DIR}/paper.pdf`);
await writeFile(`${DIR}/damaged.pdf`, paper.subarray(0, Math.floor(paper.length * 0.7)));

const text = paper.toString('latin1');
const at = text.lastIndexOf('startxref');
const offset = /startxref\s+(\d+)/.exec(text.slice(at))[1];
const wrong = String(Number(offset) - 1234).padStart(offset.length, '0');
await writeFile(`${DIR}/bad-xref.pdf`, Buffer.from(text.slice(0, at) + text.slice(at).replace(offset, wrong), 'latin1'));

console.log(`real fixtures ready in ${DIR}`);
