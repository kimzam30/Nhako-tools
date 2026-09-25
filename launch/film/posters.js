/**
 * Lays out one poster, chosen by ?p=. Each is a small declaration: the words,
 * the devices (which capture, where, how big) and the butterflies. The
 * butterflies are placed by hand, like stickers, in the air beside the
 * devices; after layout every one is measured against every screen, and any
 * that touches one is counted in window.__guard, which makes render.mjs and
 * check.mjs fail.
 */
import { POSTERS } from './posters.config.mjs';
import { buildLaptop, buildTablet, addLayers, topColours, paintBar, butterfly, rect, grow, hits, LAPTOP, TABLET } from './kit.js';

const meta = await (await fetch('shots/meta.json')).json();
const name = new URLSearchParams(location.search).get('p') ?? 'hero';
const size = POSTERS[name];
document.documentElement.style.width = document.body.style.width = `${size.w}px`;
document.documentElement.style.height = document.body.style.height = `${size.h}px`;

const FOOT = { text: 'tools.nhako.com', small: 'Free. No account. 50 tools.' };

/**
 * x, y: a device's centre. s: its scale. scroll: points the teleprompter's
 * words have moved up. flies: [x, y, scale, colour, degrees].
 */
const LAYOUTS = {
  hero: {
    copy: { top: 64, eyebrow: ['Nhako Tools', 32], head: ['Built for the big screen.', 104], sub: ['50 free tools for your laptop and tablet. Nothing uploads.', 36] },
    devices: [
      { kind: 'laptop', shot: 'laptop-home', x: 830, y: 720, s: 1.02 },
      { kind: 'tablet', shot: 'stage', x: 1490, y: 800, s: 0.64, scroll: 70 },
    ],
    flies: [[90, 420, 5, 3, 110], [170, 610, 3, 0, 60], [70, 850, 4, 1, 140], [1810, 380, 5, 1, 70], [1830, 560, 3, 2, 30], [1760, 170, 4, 0, 100], [160, 150, 3.5, 2, 120]],
  },
  teleprompter: {
    copy: { top: 84, eyebrow: ['Teleprompter', 34], head: ['Read it. Record it.', 92], sub: ['Your script on your tablet, paced in words per minute. Takes stay on your device.', 34], width: 900 },
    devices: [{ kind: 'tablet', shot: 'stage', x: 540, y: 850, s: 1.12, scroll: 110 }],
    foot: 1272,
    flies: [[60, 120, 4, 3, 120], [985, 190, 5, 1, 60], [880, 400, 3, 2, 30], [140, 420, 3.5, 0, 150], [120, 1255, 4, 1, 80], [930, 1262, 3, 3, 40]],
  },
  malaysia: {
    copy: { top: 84, eyebrow: ['Made for Malaysia', 34], head: ['Your real take-home pay.', 84], sub: ['EPF, SOCSO, EIS and PCB from the 2026 tables. Photo and file sizes for SPA, UPU, JPJ and LHDN.', 32], width: 940 },
    devices: [
      { kind: 'laptop', shot: 'laptop-salary', x: 540, y: 740, s: 0.86 },
      { kind: 'tablet', shot: 'tablet-malaysia', x: 815, y: 1060, s: 0.44 },
    ],
    foot: 1282,
    flies: [[50, 90, 4, 0, 120], [1010, 56, 3.5, 2, 50], [110, 1110, 5, 3, 100], [300, 1180, 3, 1, 60], [1045, 1235, 3, 0, 20]],
  },
  students: {
    copy: { top: 76, eyebrow: ['For students', 34], head: ['Every semester job. One site.', 80], sub: ['CGPA, teleprompter, print handouts, merge PDF and compress to 500 KB.', 32], width: 920 },
    devices: [
      { kind: 'laptop', shot: 'laptop-home', x: 520, y: 690, s: 0.76 },
      { kind: 'tablet', shot: 'tablet-cgpa', x: 735, y: 1075, s: 0.58 },
    ],
    foot: 1296,
    flies: [[40, 80, 4, 1, 140], [1010, 470, 3.5, 3, 60], [110, 1040, 5, 0, 110], [250, 1180, 3, 2, 70], [1045, 1240, 3, 1, 20]],
  },
  story: {
    copy: { top: 170, eyebrow: ['Nhako Tools', 38], head: ['Built for the big screen.', 104], sub: ['50 free tools for your laptop and tablet. Nothing uploads.', 38], width: 900 },
    devices: [
      { kind: 'laptop', shot: 'laptop-home', x: 540, y: 890, s: 0.86 },
      { kind: 'tablet', shot: 'stage', x: 610, y: 1390, s: 0.86, scroll: 70 },
    ],
    foot: 1790,
    flies: [[70, 120, 4, 3, 120], [990, 130, 3.5, 1, 60], [80, 1330, 5, 0, 110], [150, 1560, 3, 2, 60], [1010, 1690, 4, 1, 30], [60, 1710, 3, 3, 150]],
  },
  banner: {
    banner: true,
    devices: [
      { kind: 'laptop', shot: 'laptop-home', x: 985, y: 292, s: 0.45 },
      { kind: 'tablet', shot: 'stage', x: 1142, y: 420, s: 0.3, scroll: 70 },
    ],
    flies: [[1245, 70, 3, 1, 70], [700, 60, 2.5, 3, 120], [745, 500, 2.5, 0, 40]],
  },
};
const L = LAYOUTS[name];

// ─── Words ───────────────────────────────────────────────────────────────────
if (L.copy) {
  const c = L.copy;
  const el = document.createElement('div');
  el.className = 'copy abs';
  const w = c.width ?? size.w - 160;
  Object.assign(el.style, { left: `${(size.w - w) / 2}px`, width: `${w}px`, top: `${c.top}px` });
  el.innerHTML = `<div class="eyebrow" style="font-size:${c.eyebrow[1]}px;margin-bottom:${c.eyebrow[1] * 0.4}px">${c.eyebrow[0]}</div>
    <div class="head" style="font-size:${c.head[1]}px">${c.head[0]}</div>
    <div class="sub" style="font-size:${c.sub[1]}px;margin-top:${c.sub[1] * 0.5}px">${c.sub[0]}</div>`;
  document.body.append(el);
}
if (L.foot) {
  const el = document.createElement('div');
  el.className = 'foot abs';
  Object.assign(el.style, { left: 0, right: 0, top: `${L.foot}px` });
  el.innerHTML = `<div class="ic" style="width:48px;height:48px;border-radius:11px"><img src="../../public/icons/apple-touch-icon.png" alt=""></div>
    <b style="font-size:30px">${FOOT.text}</b><span style="font-size:24px">${FOOT.small}</span>`;
  document.body.append(el);
}
if (L.banner) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="icon abs" style="left:72px;top:92px;width:120px;height:120px;border-radius:27px"><img src="../../public/icons/apple-touch-icon.png" alt=""></div>
    <div class="head abs" style="left:220px;top:104px;font-size:82px;white-space:nowrap">Nhako Tools</div>
    <div class="url abs" style="left:224px;top:190px;font-size:24px;font-weight:500;color:var(--ink-2)"><b>tools</b>.nhako.com</div>
    <div class="abs" style="left:72px;top:262px;font-size:42px;font-weight:600;letter-spacing:-0.025em">Built for the big screen.</div>
    <div class="sub abs" style="left:72px;top:320px;width:560px;font-size:24px;font-weight:400">50 free tools that run on your laptop and tablet. No upload, no account, no daily limit.</div>
    <div class="chips abs" style="left:72px;top:420px;font-size:19px"><div class="chip">PDF</div><div class="chip">Image</div><div class="chip">Media</div><div class="chip">Calculators</div><div class="chip">Malaysia</div></div>`);
}

// ─── Devices ─────────────────────────────────────────────────────────────────
const devices = [];
for (const d of L.devices) {
  const el = document.createElement('div');
  document.body.append(el);
  const dev = d.kind === 'laptop' ? buildLaptop(el) : buildTablet(el);
  const G = d.kind === 'laptop' ? LAPTOP : TABLET;
  Object.assign(el.style, { left: `${d.x - G.w / 2}px`, top: `${d.y - G.h / 2}px`, transform: `scale(${d.s})` });
  const layers = addLayers(dev, [d.shot], meta);
  const layer = layers[d.shot];
  if (d.shot === 'stage') layer.words.style.transform = `translateY(${(meta.stage.layerTop - (d.scroll ?? 0)) * G.K}px)`;
  paintBar(dev, (await topColours([d.shot]))[d.shot]);
  devices.push(dev);
}

// ─── Butterflies ─────────────────────────────────────────────────────────────
const flies = document.createElement('div');
flies.className = 'flies';
document.body.append(flies);
for (const [x, y, scale, colour, deg] of L.flies) {
  const el = butterfly(colour, scale);
  // (x, y) is the centre; the sprite is 15 x 12 cells.
  el.style.transform = `translate(${x - 7.5 * scale}px, ${y - 6 * scale}px) rotate(${deg}deg) scaleX(0.82)`;
  flies.append(el);
}

await document.fonts.ready;
await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));

window.__guard = [];
window.boxes = () => ({
  flies: [...flies.children].map((el) => rect(el.firstChild)),
  screens: devices.map((d) => rect(d.screen)),
  // The ink of the words, not their full-width boxes.
  words: [...document.querySelectorAll('.copy > *, .foot, .head, .sub, .url, .chips, .icon')].map((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    return { l: b.left, t: b.top, r: b.right, b: b.bottom };
  }),
});
const { flies: fb, screens, words } = window.boxes();
fb.forEach((f, i) => {
  if (screens.some((s) => hits(f, grow(s, 6)))) window.__guard.push({ fly: i, on: 'screen' });
  if (words.some((w) => hits(f, grow(w, 4)))) console.warn(`butterfly ${i} touches the words`);
});
window.sceneReady = true;
