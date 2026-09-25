/**
 * The launch video's picture. renderFrame(t) puts every element where it
 * belongs at second t, with no CSS animation and no clock of its own, so a
 * frame rendered twice is the same frame and render.mjs can step through time
 * at any speed.
 *
 * The butterflies come from ./data.js, which render.mjs builds at request time
 * from src/lib/butterfly.ts: they are the same cells as the site's.
 */
import * as T from './timeline.mjs';
import { SPRITES, PALETTE, BUTTERFLY_COLORS } from './data.js';

const $ = (id) => document.getElementById(id);
const K = 600 / 393; // screen px per iPhone point
const STATUS = 83; // status bar height in screen px
const PHONE = { left: 222, top: 540, w: 636, h: 1336, screen: 18 };
const CENTER = { x: PHONE.left + PHONE.w / 2, y: PHONE.top + PHONE.h / 2 };
const FOCUS_TO = { x: 540, y: 1230 }; // where a zoomed-in detail lands on the stage

// --- Easing ------------------------------------------------------------------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
const outCubic = (p) => 1 - (1 - p) ** 3;
const outQuint = (p) => 1 - (1 - p) ** 5;
const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const outBack = (p, s = 1.4) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;

// --- Sprites -------------------------------------------------------------------
function sprite(rows, overrides = {}, scale = 1) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const x = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((k, i) => {
    if (k === '.') return;
    x.fillStyle = overrides[k] ?? PALETTE[k];
    x.fillRect(i, y, 1, 1);
  }));
  c.style.width = `${c.width * scale}px`;
  c.style.height = `${c.height * scale}px`;
  return c;
}

// --- Words -----------------------------------------------------------------------
/** Split text into word spans, optionally in the accent colour. */
function words(el, text, { accent = false } = {}) {
  el.textContent = '';
  const spans = text.split(' ').map((w, i, all) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w + (i < all.length - 1 ? ' ' : '');
    el.append(s);
    return s;
  });
  if (accent) for (const s of spans) s.classList.add('accent');
  return spans;
}
/** Apple's reveal: each word rises out of a blur, a beat after the last. */
function reveal(spans, t, t0, { gap = 0.075, dur = 0.75, rise = 36, blur = 16 } = {}) {
  spans.forEach((s, i) => {
    const e = outQuint(prog(t, t0 + i * gap, t0 + i * gap + dur));
    s.style.opacity = e;
    s.style.transform = `translateY(${(1 - e) * rise}px)`;
    s.style.filter = e < 1 ? `blur(${(1 - e) * blur}px)` : '';
  });
}
const leave = (el, e) => {
  el.style.opacity = 1 - e;
  el.style.transform = `translateY(${-e * 30}px)`;
  el.style.filter = e > 0 ? `blur(${e * 10}px)` : '';
};


// --- Butterflies -----------------------------------------------------------------
// far: small, behind the phone. mid: between the phone and the words. near:
// big and out of focus, crossing close to the lens now and then.
const FLY_DEFS = [
  ['far', 3, 0.6, 0, 60, 380, 34, 0.0], ['far', 4, 0.65, 1, 700, 900, 28, 1.3], ['far', 3, 0.55, 2, 300, 1500, 40, 2.1],
  ['far', 4, 0.6, 3, 900, 1250, 31, 3.4], ['far', 3, 0.55, 1, 500, 200, 37, 4.2], ['far', 5, 0.65, 0, 120, 1780, 26, 5.5],
  // The mid layer keeps below the caption band (y 150..560) so it never crosses a headline.
  ['mid', 6, 0.95, 3, 820, 900, 44, 0.8], ['mid', 5, 0.9, 2, 640, 1680, 40, 4.9],
];
const flies = FLY_DEFS.map(([layer, scale, opacity, colour, x0, y0, v, ph]) => ({ layer, opacity, ...makeFly(layer, scale, opacity, colour), x0, y0, v, ph }));
function makeFly(layer, scale, opacity, colour) {
  const el = document.createElement('div');
  el.className = 'bfly';
  el.style.opacity = opacity;
  el.append(sprite(SPRITES.butterfly, BUTTERFLY_COLORS[colour], scale));
  $(`flies-${layer}`).append(el);
  return { el, scale };
}
// Near flies cross on cue: [start, end, y, direction, scale].
const NEAR = [[5.0, 10.5, 1320, 1, 13], [31.5, 37.5, 760, -1, 15], [53.2, 58, 1620, 1, 12]].map(([t0, t1, y, dir, scale], i) => {
  const el = document.createElement('div');
  el.className = 'bfly';
  el.style.filter = 'blur(5px)';
  el.append(sprite(SPRITES.butterfly, BUTTERFLY_COLORS[(i + 1) % 4], scale));
  $('flies-near').append(el);
  return { el, t0, t1, y, dir, scale, ph: i * 2.2 };
});
// Three that circle the icon on the end card.
const ORBIT = [0, 1, 3].map((c, i) => {
  const el = document.createElement('div');
  el.className = 'bfly';
  el.append(sprite(SPRITES.butterfly, BUTTERFLY_COLORS[c], 5));
  $('flies-mid').append(el);
  return { el, a0: i * (Math.PI * 2 / 3) };
});
const flap = (t, ph = 0) => {
  const u = ((t / 0.42 + ph) % 2 + 2) % 2;
  const tri = u < 1 ? u : 2 - u;
  return 1 - 0.65 * (0.5 - 0.5 * Math.cos(Math.PI * tri));
};

// --- Phones ----------------------------------------------------------------------
const STATUS_SVG = `<svg width="112" height="23" viewBox="0 0 118 24" aria-hidden="true"><g fill="currentColor">
  <rect x="0" y="15" width="6" height="8" rx="1.5"/><rect x="9" y="11" width="6" height="12" rx="1.5"/>
  <rect x="18" y="6" width="6" height="17" rx="1.5"/><rect x="27" y="1" width="6" height="22" rx="1.5"/>
  <path d="M53 22.5l4.2-4.4a6 6 0 0 0-8.4 0zM45.6 14.9l2.1 2.2a8.7 8.7 0 0 1 10.6 0l2.1-2.2a11.7 11.7 0 0 0-14.8 0zM42.2 11.3l2.1 2.2a13.4 13.4 0 0 1 17.4 0l2.1-2.2a16.4 16.4 0 0 0-21.6 0z"/>
  <rect x="74" y="2" width="38" height="20" rx="6" fill="none" stroke="currentColor" stroke-width="2" opacity=".4"/>
  <rect x="77" y="5" width="30" height="14" rx="3.5"/><rect x="114" y="8.5" width="3" height="7" rx="1.5" opacity=".4"/></g></svg>`;

function buildPhone(el, shot) {
  el.classList.add('phone');
  el.innerHTML = `<div class="frame"></div><div class="bezel"></div>
    <div class="btn-side" style="left:-5px;top:250px;height:56px"></div>
    <div class="btn-side" style="left:-5px;top:340px;height:104px"></div>
    <div class="btn-side" style="left:-5px;top:462px;height:104px"></div>
    <div class="btn-side" style="right:-5px;top:380px;height:160px"></div>
    <div class="screen"><div class="status"><span class="time">9:41</span>${STATUS_SVG}</div><div class="island"></div>
      <div class="content">${shot ? `<div class="layer"><img src="shots/${shot}.png" alt=""></div>` : ''}</div>
      <div class="home-ind"></div></div>`;
  return { el, screen: el.querySelector('.screen'), content: el.querySelector('.content'), status: el.querySelector('.status'), ind: el.querySelector('.home-ind') };
}
const main = buildPhone($('phone'));
const left = buildPhone($('side-left'), T.FAN.left);
const right = buildPhone($('side-right'), T.FAN.right);
for (const p of [left, right]) Object.assign(p.el.style, { left: `${PHONE.left}px`, top: `${PHONE.top}px`, zIndex: 19 });

// One layer per capture on the main phone, two shown at most.
const layers = {};
for (const name of new Set(T.SCREENS.map((s) => s.shot))) {
  if (name === 'homescreen') continue;
  const div = document.createElement('div');
  div.className = 'layer';
  div.innerHTML = `<img src="shots/${name}.png" alt="">`;
  main.content.append(div);
  layers[name] = div;
}
const bars = document.createElement('img');
bars.id = 'bars';
bars.src = 'shots/home-bars.png';
main.content.append(bars);
const STATUS_BG = { 'home-dark': '#0b0b0e', homescreen: 'transparent' };
const STATUS_INK = { 'home-dark': '#ffffff' };

// The Home Screen: plain pastel apps with simple glyphs, then Nhako's real icon.
const GLYPH = {
  folder: '<path d="M8 16h14l4 4h18v22H8z" fill="#fff"/>',
  camera: '<rect x="8" y="16" width="36" height="24" rx="6" fill="#fff"/><circle cx="26" cy="28" r="7" fill="none" stroke="#b7a6e8" stroke-width="3"/>',
  notes: '<rect x="12" y="10" width="28" height="32" rx="4" fill="#fff"/><path d="M17 19h18M17 26h18M17 33h12" stroke="#e9c46a" stroke-width="3"/>',
  music: '<path d="M22 12v20a6 6 0 1 1-3-5V14l18-4v18a6 6 0 1 1-3-5V12z" fill="#fff"/>',
  clock: '<circle cx="26" cy="26" r="17" fill="#fff"/><path d="M26 15v11l8 5" stroke="#9b8ad8" stroke-width="3" fill="none"/>',
  maps: '<path d="M26 44s-13-13-13-22a13 13 0 0 1 26 0c0 9-13 22-13 22z" fill="#fff"/><circle cx="26" cy="22" r="5" fill="#7fc4a0"/>',
  mail: '<rect x="8" y="14" width="36" height="24" rx="4" fill="#fff"/><path d="M9 16l17 13 17-13" stroke="#f0a3c4" stroke-width="3" fill="none"/>',
  chat: '<path d="M10 14h32v20H22l-8 7v-7h-4z" fill="#fff"/>',
  globe: '<circle cx="26" cy="26" r="17" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M9 26h34M26 9c-8 9-8 25 0 34M26 9c8 9 8 25 0 34" stroke="#fff" stroke-width="3" fill="none"/>',
  photo: '<rect x="9" y="12" width="34" height="28" rx="5" fill="#fff"/><path d="M12 36l10-11 7 7 5-5 7 9z" fill="#8fcfae"/>',
  gear: '<circle cx="26" cy="26" r="14" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="6 5"/><circle cx="26" cy="26" r="6" fill="#fff"/>',
};
const icon = (bg, glyph) => `<div class="ic" style="background:${bg}"><svg width="60" height="60" viewBox="0 0 52 52">${GLYPH[glyph]}</svg></div>`;
const homescreen = document.createElement('div');
homescreen.id = 'homescreen';
const APPS = [
  ['Files', '#7fa6f2', 'folder'], ['Camera', '#aea3cf', 'camera'],
  ['Notes', '#f0c75e', 'notes'], ['Music', '#ee7fa8', 'music'],
  ['Clock', '#a594e6', 'clock'], ['Maps', '#7cc79d', 'maps'],
  ['Mail', '#ef9cc0', 'mail'],
];
const col = (i) => 34 + (i % 4) * 140;
const row = (i) => 140 + Math.floor(i / 4) * 150;
APPS.forEach(([label, bg, g], i) => {
  homescreen.insertAdjacentHTML('beforeend', `<div class="app" style="left:${col(i)}px;top:${row(i)}px">${icon(bg, g)}<span>${label}</span></div>`);
});
homescreen.insertAdjacentHTML('beforeend', `<div class="app" id="nhako-app" style="left:${col(7)}px;top:${row(7)}px"><div class="ic"><img class="px" src="../../public/icons/apple-touch-icon.png" alt=""></div><span>Nhako</span></div>`);
homescreen.insertAdjacentHTML('beforeend', `<div id="dock">${[['#7fd08f', 'chat'], ['#76a8ff', 'globe'], ['#ffb3cf', 'photo'], ['#b9b4c4', 'gear']]
  .map(([bg, g], i) => `<div class="app" style="left:${24 + i * 140}px;top:23px">${icon(bg, g)}</div>`).join('')}</div>`);
main.screen.insertBefore(homescreen, main.screen.querySelector('.home-ind'));
layers.homescreen = homescreen;
const nhakoApp = $('nhako-app');

// Tap, the file, the progress card.
main.screen.insertAdjacentHTML('beforeend', '<div id="tap"><div class="dot"></div></div>');
const tapDot = main.screen.querySelector('#tap .dot');
const progress = document.createElement('div');
progress.id = 'progress';
progress.className = 'abs';
progress.innerHTML = '<div class="row"><span>Compressing holiday.png</span><span id="pct">0%</span></div><div class="track"><div class="fill" id="fill"></div></div>';
// Over the drop zone of the capture: 16..377 x 229..401 points.
Object.assign(progress.style, { left: `${16 * K}px`, width: `${361 * K}px`, top: `${STATUS + 229 * K}px`, height: `${172 * K}px` });
main.screen.insertBefore(progress, main.screen.querySelector('#tap'));
{
  const x = $('thumb').getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 176);
  sky.addColorStop(0, '#e9eefb'); sky.addColorStop(0.5, '#efe6f8'); sky.addColorStop(1, '#fbe7f0');
  x.fillStyle = sky; x.fillRect(0, 0, 264, 176);
  x.fillStyle = '#ffd98a'; x.beginPath(); x.arc(187, 53, 20, 0, Math.PI * 2); x.fill();
  for (const [y, c] of [[115, '#b5e3be'], [132, '#8fcf9e'], [149, '#6bb784']]) {
    x.fillStyle = c; x.beginPath(); x.moveTo(0, 176);
    for (let i = 0; i <= 264; i += 4) x.lineTo(i, y + Math.sin(i / 29 + y * 10) * 10);
    x.lineTo(264, 176); x.fill();
  }
}

// Intro lines, end card words.
const introEls = T.INTRO.map((line) => {
  const d = document.createElement('div');
  $('intro').append(d);
  return { ...line, spans: words(d, line.text, { accent: line.accent }) };
});
const endTitle = words($('end-title'), 'Nhako Tools');
const tagLines = ['Nothing uploads.', 'Nothing waits.'].map((l) => {
  const d = document.createElement('div');
  $('end-tag').append(d);
  return words(d, l);
});
const endSmall = words($('end-small'), 'Free. No account. 50 tools.');

const taps = await (await fetch('shots/taps.json')).json();

// Zoom keys become plain poses: the focus point lands on FOCUS_TO.
const POSES = T.POSES.map((k) => {
  if (!k.zoom) return k;
  const [s, fx, fy] = k.zoom;
  const px = PHONE.left + PHONE.screen + fx * K;
  const py = PHONE.top + PHONE.screen + STATUS + fy * K;
  return { t: k.t, s, rx: 0, ry: 0, x: FOCUS_TO.x - CENTER.x - s * (px - CENTER.x), y: FOCUS_TO.y - CENTER.y - s * (py - CENTER.y) };
});
function poseAt(t) {
  let i = 0;
  while (i < POSES.length - 1 && t >= POSES[i + 1].t) i++;
  const a = POSES[i];
  const b = POSES[Math.min(i + 1, POSES.length - 1)];
  const raw = b === a ? 1 : prog(t, a.t, b.t);
  const e = (a.y ?? 0) > 1000 ? outQuint(raw) : inOut(raw);
  const g = (k, d) => lerp(a[k] ?? d, b[k] ?? d, e);
  return { x: g('x', 0), y: g('y', 0), s: g('s', 1), rx: g('rx', 0), ry: g('ry', 0), zoomed: Math.max(a.s ?? 1, b.s ?? 1) > 1.05 ? Math.min(1, ((g('s', 1) - 1) / 0.4)) : 0 };
}

// --- Frame -----------------------------------------------------------------------
const show = (el, on) => { el.style.display = on ? '' : 'none'; };

function frameBackground(t) {
  const night = inOut(prog(t, ...T.DARK.in)) * (1 - inOut(prog(t, ...T.DARK.out)));
  $('night').style.opacity = night;
  const c = Math.round(lerp(251, 0, night));
  $('veil').style.background = `linear-gradient(180deg, rgb(${c},${c},${c + (night ? 0 : 2)}) 0%, rgb(${c},${c},${c}) 72%, rgba(${c},${c},${c},0) 100%)`;
  return night;
}

function frameIntro(t) {
  const on = t < T.INTRO_OUT[1];
  show($('intro'), on);
  if (!on) return;
  introEls.forEach((l) => reveal(l.spans, t, l.t, { rise: 50, blur: 22, dur: 0.9, gap: 0.11 }));
  const out = inOut(prog(t, ...T.INTRO_OUT));
  $('intro').style.opacity = 1 - out;
  $('intro').style.transform = `translateY(${-out * 120}px) scale(${1 - out * 0.08})`;
  $('intro').style.filter = out > 0 ? `blur(${out * 12}px)` : '';
}

let capBuilt = -1;
let capSpans = null;
function frameCaption(t, night) {
  const i = T.CAPTIONS.findLastIndex((c) => t >= c.t);
  const cap = T.CAPTIONS[i];
  const el = $('cap');
  show(el, !!cap && !cap.end);
  if (!cap || cap.end) return;
  el.classList.toggle('dark', night > 0.5);
  if (capBuilt !== i) {
    const [eb, hd, sb] = el.children;
    capSpans = {
      eyebrow: words(eb, cap.eyebrow, { accent: true }),
      head: words(hd, cap.head),
      sub: cap.sub ? words(sb, cap.sub) : [],
    };
    show(sb, !!cap.sub);
    capBuilt = i;
  }
  if (cap.count) {
    const span = capSpans.head.find((s) => s.textContent.includes('{count}') || s.dataset.count);
    const n = Math.round(lerp(cap.count.from, cap.count.to, outCubic(prog(t, cap.count.t0, cap.count.t1))));
    span.dataset.count = '1';
    span.textContent = `${n.toLocaleString('en-US')} KB.`;
    span.classList.add('accent');
  }
  reveal(capSpans.eyebrow, t, cap.t, { rise: 20, blur: 10 });
  reveal(capSpans.head, t, cap.t + 0.08);
  reveal(capSpans.sub, t, cap.t + 0.45, { rise: 20, blur: 10, gap: 0.04 });
  const next = T.CAPTIONS[i + 1];
  leave(el, next ? inOut(prog(t, next.t - 0.4, next.t)) : 0);
}

function screenIndex(t) { return T.SCREENS.findLastIndex((s) => t >= s.t); }

function frameScreen(t) {
  for (const l of Object.values(layers)) show(l, false);
  show(bars, false);
  const i = screenIndex(t);
  if (i < 0) return;
  const cur = T.SCREENS[i];
  const prev = T.SCREENS[i - 1];
  const p = inOut(prog(t, cur.t, cur.t + 0.45));
  const place = (s, x, opacity, z, dim = 0) => {
    const l = layers[s.shot];
    show(l, true);
    let y = 0;
    if (s.scroll) {
      y = s.scroll[0][0];
      for (const [from, to, t0, t1] of s.scroll) if (t >= t0) y = lerp(from, to, inOut(prog(t, t0, t1)));
      show(bars, true);
    }
    l.style.transform = `translate(${x}px, ${-y * K}px)`;
    l.style.opacity = opacity;
    l.style.zIndex = z;
    l.style.filter = dim ? `brightness(${1 - dim})` : '';
  };
  if (prev && p < 1 && cur.via !== 'cut') {
    if (cur.via === 'push') {
      place(prev, -p * 0.3 * 600, 1, 1, p * 0.1);
      place(cur, (1 - p) * 600, 1, 2);
    } else {
      place(prev, 0, 1, 1);
      place(cur, 0, p, 2);
    }
  } else {
    place(cur, 0, 1, 2);
  }
  const shown = p < 0.5 && prev && cur.via !== 'cut' ? prev.shot : cur.shot;
  main.status.style.background = STATUS_BG[shown] ?? '#ffffff';
  main.status.style.color = STATUS_INK[shown] ?? '#000000';
  main.ind.style.background = shown === 'home-dark' ? '#ffffff' : '#111111';
  const ip = prog(t, T.INSTALL_POP, T.INSTALL_POP + 0.55);
  nhakoApp.style.transform = `scale(${ip === 0 ? 0 : outBack(ip, 2.2)})`;
  nhakoApp.style.filter = ip < 1 ? `blur(${(1 - ip) * 6}px)` : '';
}

function framePhones(t) {
  const on = t >= T.POSES[0].t && t < 51.2;
  show(main.el, on);
  if (on) {
    const p = poseAt(t);
    const floatY = Math.sin(t * 0.9) * 6 * (1 - p.zoomed);
    const floatR = Math.sin(t * 0.45) * 1.6 * (1 - p.zoomed);
    main.el.style.transform = `translate(${p.x}px, ${p.y + floatY}px) perspective(2600px) rotateX(${p.rx}deg) rotateY(${p.ry + floatR}deg) scale(${p.s})`;
    $('veil').style.opacity = p.zoomed;
  }
  const fin = inOut(prog(t, ...T.FAN.in));
  const fout = inOut(prog(t, ...T.FAN.out));
  const f = fin * (1 - fout);
  for (const [phone, dir] of [[left, -1], [right, 1]]) {
    show(phone.el, f > 0.001);
    phone.el.style.transform = `translate(${dir * 340 * f}px, ${130 + 40 * (1 - f)}px) perspective(2600px) rotateY(${-dir * 24 * f}deg) rotateZ(${dir * 3 * f}deg) scale(${lerp(0.55, 0.6, f)})`;
    phone.el.style.opacity = Math.min(1, f * 1.6);
  }
}

function frameTap(t) {
  const tap = T.TAPS.find((x) => t >= x.t - 0.3 && t < x.t + 0.45);
  show($('tap'), !!tap);
  if (!tap) return;
  const at = taps[tap.shot][tap.key];
  tapDot.style.left = `${at.x * K}px`;
  tapDot.style.top = `${STATUS + at.y * K}px`;
  const inP = outCubic(prog(t, tap.t - 0.3, tap.t - 0.08));
  const outP = prog(t, tap.t + 0.1, tap.t + 0.45);
  const press = t >= tap.t - 0.02 && t < tap.t + 0.12 ? 0.84 : 1;
  tapDot.style.opacity = inP * (1 - outP);
  tapDot.style.transform = `scale(${lerp(1.3, 1, inP) * press * (1 + outP * 0.3)})`;
}

function frameFile(t) {
  const [t0, t1] = T.FILE_DROP;
  const on = t >= t0 - 0.35 && t < t1;
  show($('file'), on);
  if (!on) return;
  const pose = poseAt(t);
  const target = taps['image-compress-empty'].choose;
  const toX = CENTER.x + pose.x + pose.s * (PHONE.left + PHONE.screen + target.x * K - CENTER.x) - 230;
  const toY = CENTER.y + pose.y + pose.s * (PHONE.top + PHONE.screen + STATUS + target.y * K - CENTER.y) - 64;
  const appear = outQuint(prog(t, t0 - 0.35, t0));
  const p = inOut(prog(t, t0, t1));
  $('file').style.left = `${lerp(560, toX, p)}px`;
  $('file').style.top = `${lerp(560, toY, p)}px`;
  $('file').style.opacity = appear * (1 - prog(t, t1 - 0.15, t1));
  $('file').style.transform = `scale(${lerp(0.9, 1, appear) * lerp(1, 0.5, p)}) rotate(${lerp(-5, 0, p)}deg)`;
  $('file').style.filter = appear < 1 ? `blur(${(1 - appear) * 10}px)` : '';
}

function frameProgress(t) {
  const [t0, t1] = T.PROGRESS;
  const on = t >= t0 && t < t1 + 0.25;
  show(progress, on);
  if (!on) return;
  const a = outCubic(prog(t, t0, t0 + 0.2));
  progress.style.opacity = a * (1 - prog(t, t1, t1 + 0.25));
  progress.style.transform = `scale(${lerp(0.96, 1, a)})`;
  const pct = Math.round(100 * outCubic(prog(t, t0 + 0.1, t1 - 0.05)));
  $('fill').style.width = `${pct}%`;
  $('pct').textContent = `${pct}%`;
}

function frameFlies(t) {
  for (const f of flies) {
    const span = 1080 + 240;
    const x = (((f.x0 + f.v * t) % span) + span) % span - 120;
    const y = f.y0 + Math.sin(t * 0.7 + f.ph) * 70 + Math.sin(t * 1.9 + f.ph) * 14;
    const tilt = Math.cos(t * 0.7 + f.ph) * 14;
    f.el.style.transform = `translate(${x}px, ${y}px) rotate(${78 + tilt}deg)`;
    // The mid layer steps aside for the end card's words.
    if (f.layer === 'mid') f.el.style.opacity = f.opacity * (1 - prog(t, T.END.icon - 0.6, T.END.icon));
    f.el.firstChild.style.transform = `scaleX(${flap(t, f.ph)})`;
  }
  for (const n of NEAR) {
    const p = prog(t, n.t0, n.t1);
    const on = p > 0 && p < 1;
    show(n.el, on);
    if (!on) continue;
    const x = n.dir > 0 ? lerp(-260, 1180, p) : lerp(1180, -260, p);
    const y = n.y + Math.sin(p * 7 + n.ph) * 60;
    n.el.style.opacity = 0.55;
    n.el.style.transform = `translate(${x}px, ${y}px) rotate(${n.dir * 80 + Math.cos(p * 7) * 10}deg)`;
    n.el.firstChild.style.transform = `scaleX(${flap(t, n.ph)})`;
  }
  const e = outCubic(prog(t, T.END.icon + 0.4, T.END.icon + 1.6));
  ORBIT.forEach((o) => {
    show(o.el, e > 0);
    const a = o.a0 + t * 0.9;
    const r = lerp(700, 300, e);
    o.el.style.opacity = e;
    o.el.style.transform = `translate(${540 - 37 + Math.cos(a) * r}px, ${614 - 30 + Math.sin(a) * r * 0.5}px) rotate(${(a * 180) / Math.PI + 180}deg)`;
    o.el.firstChild.style.transform = `scaleX(${flap(t, o.a0)})`;
  });
}

function frameEnd(t) {
  const on = t >= T.END.icon - 0.1;
  show($('end'), on);
  if (!on) return;
  const ip = prog(t, T.END.icon, T.END.icon + 0.8);
  $('end-icon').style.opacity = outCubic(Math.min(1, ip * 2));
  $('end-icon').style.transform = `translateY(${(1 - outQuint(ip)) * 60}px) scale(${ip === 0 ? 0.6 : lerp(0.6, 1, outBack(ip, 1.2))})`;
  $('end-icon').style.filter = ip < 1 ? `blur(${(1 - ip) * 14}px)` : '';
  reveal(endTitle, t, T.END.title, { rise: 44, blur: 20, dur: 0.9, gap: 0.12 });
  reveal(tagLines[0], t, T.END.tagline, { gap: 0.1 });
  reveal(tagLines[1], t, T.END.tagline + 0.35, { gap: 0.1 });
  const up = outQuint(prog(t, T.END.url, T.END.url + 0.7));
  $('end-url').style.opacity = up;
  $('end-url').style.transform = `translateX(-50%) translateY(${(1 - up) * 30}px) scale(${lerp(0.9, 1, up)})`;
  reveal(endSmall, t, T.END.small, { rise: 16, blur: 8, gap: 0.05 });
  $('fade').style.opacity = inOut(prog(t, T.END.fadeOut + 0.4, T.DURATION));
}

window.renderFrame = (t) => {
  const night = frameBackground(t);
  frameIntro(t);
  framePhones(t);
  frameScreen(t);
  frameTap(t);
  frameFile(t);
  frameProgress(t);
  frameCaption(t, night);
  frameFlies(t);
  frameEnd(t);
};

// Everything decoded before the first frame, or the first frames are blank.
await document.fonts.ready;
await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
window.renderFrame(0);
window.sceneReady = true;

// ?t=27.6 shows one frame; ?play runs in real time with the soundtrack.
const params = new URLSearchParams(location.search);
if (params.has('t')) window.renderFrame(Number(params.get('t')));
if (params.has('play')) {
  const audio = new Audio('out/soundtrack.wav');
  const start = performance.now();
  audio.play().catch(() => {});
  const tick = () => {
    window.renderFrame(((performance.now() - start) / 1000) % T.DURATION);
    requestAnimationFrame(tick);
  };
  tick();
}
