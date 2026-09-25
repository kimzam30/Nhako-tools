/**
 * What the widescreen film (scene.js) and the posters (posters.js) share: the
 * easing, Apple's word reveal, the drawn laptop and tablet, the pixel
 * butterflies, and the rule that keeps a butterfly off every screen.
 *
 * Both devices are drawn flat, in the site's graphite and silver, with no
 * gradient colours. Everything on their screens is a real capture from
 * capture.mjs.
 */
import { SPRITES, PALETTE, BUTTERFLY_COLORS } from '../video/data.js';

// ─── Easing ──────────────────────────────────────────────────────────────────
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
export const outCubic = (p) => 1 - (1 - p) ** 3;
export const outQuint = (p) => 1 - (1 - p) ** 5;
export const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
export const outBack = (p, s = 1.4) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;
export const show = (el, on) => { el.style.display = on ? '' : 'none'; };

// ─── Words ───────────────────────────────────────────────────────────────────
/** Split text into word spans, optionally all in the accent colour. */
export function words(el, text, { accent = false } = {}) {
  el.textContent = '';
  return text.split(' ').map((w, i, all) => {
    const s = document.createElement('span');
    s.className = accent ? 'w accent' : 'w';
    s.textContent = w + (i < all.length - 1 ? ' ' : '');
    el.append(s);
    return s;
  });
}
/** Apple's reveal: each word rises out of a blur, a beat after the last. */
export function reveal(spans, t, t0, { gap = 0.075, dur = 0.75, rise = 30, blur = 14 } = {}) {
  spans.forEach((s, i) => {
    const e = outQuint(prog(t, t0 + i * gap, t0 + i * gap + dur));
    s.style.opacity = e;
    s.style.transform = `translateY(${(1 - e) * rise}px)`;
    s.style.filter = e < 1 ? `blur(${(1 - e) * blur}px)` : '';
  });
}
export function leave(el, e) {
  el.style.opacity = 1 - e;
  el.style.transform = `translateY(${-e * 24}px)`;
  el.style.filter = e > 0 ? `blur(${e * 10}px)` : '';
}

// ─── Butterflies ─────────────────────────────────────────────────────────────
export function butterfly(colour, scale) {
  const rows = SPRITES.butterfly;
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const x = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((k, i) => {
    if (k === '.') return;
    x.fillStyle = BUTTERFLY_COLORS[colour][k] ?? PALETTE[k];
    x.fillRect(i, y, 1, 1);
  }));
  c.style.width = `${c.width * scale}px`;
  c.style.height = `${c.height * scale}px`;
  const el = document.createElement('div');
  el.className = 'bfly';
  el.append(c);
  return el;
}
/** Wing beat: the sprite squeezes sideways, as the site's butterflies do. */
export function flap(t, ph = 0) {
  const u = ((t / 0.42 + ph) % 2 + 2) % 2;
  const tri = u < 1 ? u : 2 - u;
  return 1 - 0.65 * (0.5 - 0.5 * Math.cos(Math.PI * tri));
}

// ─── Rectangles ──────────────────────────────────────────────────────────────
export const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
export const grow = (a, m) => ({ l: a.l - m, t: a.t - m, r: a.r + m, b: a.b + m });
export const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
export const union = (list) => list.length ? list.reduce((u, a) => ({ l: Math.min(u.l, a.l), t: Math.min(u.t, a.t), r: Math.max(u.r, a.r), b: Math.max(u.b, a.b) })) : null;
/** The smallest move that takes box `a` out of box `o`. */
export function pushOut(a, o) {
  if (!hits(a, o)) return [0, 0];
  const moves = [[o.l - a.r, 0], [o.r - a.l, 0], [0, o.t - a.b], [0, o.b - a.t]];
  return moves.sort((p, q) => Math.hypot(...p) - Math.hypot(...q))[0];
}
/** Visible, not hidden by display:none anywhere up the tree, and not faded out. */
export function visible(el) {
  if (!el.isConnected || el.getClientRects().length === 0) return false;
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (Number(getComputedStyle(e).opacity) < 0.02) return false;
  }
  return true;
}

// ─── Devices ─────────────────────────────────────────────────────────────────
/**
 * Geometry at scale 1, in stage pixels. `K` is screen pixels per CSS point of
 * the capture, so a point from shots/meta.json lands at `offset + pt * K`.
 */
export const LAPTOP = {
  w: 1180, h: 656, K: 0.75,
  lid: { x: 94, y: 0, w: 992, h: 636 },
  screen: { x: 110, y: 16, w: 960, h: 600 },
  bar: 39, // the browser bar, 52 points
};
export const TABLET = {
  w: 870, h: 618, K: 0.7,
  screen: { x: 22, y: 22, w: 826, h: 574 },
  bar: 16.8, // the status bar, 24 points
};

const WIFI = '<path d="M8 11.4 10.3 9a3.3 3.3 0 0 0-4.6 0zM3.9 7.2l1.2 1.2a4.2 4.2 0 0 1 5.8 0l1.2-1.2a5.9 5.9 0 0 0-8.2 0zM1.6 5l1.2 1.2a7.4 7.4 0 0 1 10.4 0L14.4 5a9.1 9.1 0 0 0-12.8 0z"/>';
const BATTERY = '<rect x="0.5" y="0.5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="2"/><path d="M24 4.2v3.6c.8-.3 1.3-1 1.3-1.8s-.5-1.5-1.3-1.8z" opacity=".45"/>';

/** A laptop, seen from the front: graphite lid, black bezel, silver base. */
export function buildLaptop(el) {
  el.classList.add('laptop');
  el.innerHTML = `
    <div class="lid"><div class="bezel"></div><div class="cam"></div>
      <div class="screen">
        <div class="bbar"><i></i><i></i><i></i>
          <svg class="nav" width="44" height="14" viewBox="0 0 44 14"><path d="M8 2 3 7l5 5M30 2l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div class="url"><svg width="8" height="10" viewBox="0 0 8 10"><rect x="0" y="4" width="8" height="6" rx="1.4" fill="currentColor"/><path d="M1.8 4.4V3a2.2 2.2 0 0 1 4.4 0v1.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>tools.nhako.com</div>
        </div>
        <div class="content"></div>
        <div class="off"></div>
      </div>
    </div>
    <div class="base"><div class="scoop"></div></div>
    <div class="shadow"></div>`;
  return {
    el, kind: 'laptop', G: LAPTOP,
    lid: el.querySelector('.lid'), screen: el.querySelector('.screen'), content: el.querySelector('.content'),
    bar: el.querySelector('.bbar'), off: el.querySelector('.off'),
    body: [el.querySelector('.lid'), el.querySelector('.base')],
  };
}

/** A tablet in landscape: graphite band, even black bezel, camera on the long edge. */
export function buildTablet(el) {
  el.classList.add('tablet');
  el.innerHTML = `
    <div class="frame"></div><div class="bezel"></div><div class="cam"></div>
    <div class="screen">
      <div class="sbar"><span class="time">9:41</span><span class="date">Thu 25 Sep</span>
        <span class="icons"><svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">${WIFI}</svg><span class="pct">100%</span><svg width="26" height="12" viewBox="0 0 26 12" fill="currentColor">${BATTERY}</svg></span></div>
      <div class="content"></div>
    </div>
    <div class="shadow"></div>`;
  return {
    el, kind: 'tablet', G: TABLET,
    screen: el.querySelector('.screen'), content: el.querySelector('.content'), bar: el.querySelector('.sbar'),
    body: [el.querySelector('.frame')],
  };
}

/**
 * One image layer per capture on a device. 'stage' is the teleprompter: its
 * chrome with the words on their own layer, clipped to the prompter view, so
 * they can scroll at the real speed.
 */
export function addLayers(dev, names, meta) {
  const layers = {};
  for (const name of names) {
    const div = document.createElement('div');
    div.className = 'layer';
    if (name === 'stage') {
      const h = meta.stage.view.height * dev.G.K;
      div.innerHTML = `<img src="shots/tablet-stage-chrome.png" alt=""><div class="words" style="height:${h}px"><img src="shots/tablet-stage-text.png" alt=""></div>`;
      div.words = div.querySelector('.words img');
    } else {
      div.innerHTML = `<img src="shots/${name}.png" alt="">`;
    }
    dev.content.append(div);
    layers[name] = div;
  }
  return layers;
}

/** The colour at the top of a capture: the device's bar takes it, as a real one does. */
export async function topColours(names) {
  const out = {};
  await Promise.all(names.map(async (name) => {
    const img = new Image();
    img.src = `shots/${name === 'stage' ? 'tablet-stage-chrome' : name}.png`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    const x = c.getContext('2d');
    x.drawImage(img, 4, 4, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
    out[name] = { bg: `rgb(${r},${g},${b})`, dark: r + g + b < 300 };
  }));
  return out;
}

/** Paint a device's bar for the capture it is showing. */
export function paintBar(dev, colour) {
  if (dev.kind === 'tablet') {
    dev.bar.style.background = colour.bg;
    dev.bar.style.color = colour.dark ? '#fff' : '#000';
  } else {
    dev.bar.classList.toggle('dark', colour.dark);
  }
}

/** The macOS arrow pointer, for the laptop. */
export const POINTER_SVG = `<svg width="22" height="33" viewBox="0 0 16 24"><path d="M1 1v19.5l4.6-4.4 3 6.9 3.4-1.5-3-6.7H15z" fill="#000" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
