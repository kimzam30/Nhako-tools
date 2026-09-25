/**
 * The widescreen film's picture. renderFrame(t) puts every element where it
 * belongs at second t, with no CSS animation and no clock of its own, so a
 * frame rendered twice is the same frame and render.mjs can step through time
 * at any speed.
 *
 * Butterflies: every fly has a patch of air it wanders in, and that patch is
 * worked out each frame from where the devices actually are (their drawn
 * boxes, read from the page after they are posed). The patches are the space
 * beside the devices, so as a device grows or slides in, the flies are moved
 * aside, or out of frame, and never cross a screen. A last check reads every
 * fly's box against every screen's box and hides a fly that would touch one,
 * counting it in window.__guard; check.mjs requires that count to stay at 0,
 * so the guard is a proof, not a crutch.
 */
import * as T from './timeline.mjs';
import {
  clamp, lerp, prog, outCubic, outQuint, inOut, outBack, show, words, reveal, leave,
  butterfly, flap, rect, grow, hits, union, pushOut, visible,
  LAPTOP, TABLET, buildLaptop, buildTablet, addLayers, topColours, paintBar, POINTER_SVG,
} from './kit.js';

const $ = (id) => document.getElementById(id);
const meta = await (await fetch('shots/meta.json')).json();

// ─── Devices ─────────────────────────────────────────────────────────────────
const HOME = { x: 960, y: 720 }; // where a device's centre sits at pose (0, 0, 1)
const FOCUS_TO = { x: 960, y: 680 }; // where a zoomed-in detail lands on the stage

const laptop = buildLaptop($('laptop'));
const tablet = buildTablet($('tablet'));
Object.assign(laptop.el.style, { left: `${HOME.x - LAPTOP.w / 2}px`, top: `${HOME.y - LAPTOP.h / 2}px` });
Object.assign(tablet.el.style, { left: `${HOME.x - TABLET.w / 2}px`, top: `${HOME.y - TABLET.h / 2}px` });
laptop.list = T.LAPTOP_SCREENS;
tablet.list = T.TABLET_SCREENS;
laptop.poses = T.LAPTOP_POSES;
tablet.poses = T.TABLET_POSES;
// A pose's `s` is relative to this: the size that fills the frame under a caption.
laptop.base = 1.1;
tablet.base = 1.12;
// Screen origin inside the device, at scale 1 (the laptop's page starts under its browser bar).
laptop.origin = { x: LAPTOP.lid.x + 16, y: LAPTOP.screen.y + LAPTOP.bar };
tablet.origin = { x: TABLET.screen.x, y: TABLET.screen.y + TABLET.bar };

for (const dev of [laptop, tablet]) {
  const names = [...new Set(dev.list.map((s) => s.shot))];
  dev.layers = addLayers(dev, names, meta);
  dev.colours = await topColours(names);
}
// The laptop's home scroll: the full page scrolls under the real header.
const lbars = document.createElement('img');
lbars.className = 'overlay-bars';
lbars.src = 'shots/laptop-bars.png';
laptop.content.append(lbars);
// Pointer and finger.
laptop.screen.insertAdjacentHTML('beforeend', `<div class="pointer">${POINTER_SVG}</div>`);
const pointer = laptop.screen.querySelector('.pointer');
tablet.screen.insertAdjacentHTML('beforeend', '<div class="finger"></div>');
const finger = tablet.screen.querySelector('.finger');

/** The teleprompter's real pace: its 138 words over the words layer, at 140 wpm. */
const WORDS = Number(/(\d+) words/.exec(meta.prompterStats)[1]);
const WPM = Number(/at (\d+) wpm/.exec(meta.prompterStats)[1]);
const PT_PER_S = (meta.stage.layerHeight / WORDS) * (WPM / 60);

/** Zoom keys become plain poses: the focus point lands on FOCUS_TO. */
function resolvePoses(dev) {
  return dev.poses.map((k) => {
    if (!k.zoom) return { ...k, s: (k.s ?? 1) * dev.base };
    const [s, fx, fy] = k.zoom;
    const cx = HOME.x;
    const cy = HOME.y;
    const px = HOME.x - dev.G.w / 2 + dev.origin.x + fx * dev.G.K;
    const py = HOME.y - dev.G.h / 2 + dev.origin.y + fy * dev.G.K;
    return { t: k.t, s, x: FOCUS_TO.x - cx - s * (px - cx), y: FOCUS_TO.y - cy - s * (py - cy), zoomed: true };
  });
}
laptop.keys = resolvePoses(laptop);
tablet.keys = resolvePoses(tablet);

function poseAt(dev, t) {
  const K = dev.keys;
  let i = 0;
  while (i < K.length - 1 && t >= K[i + 1].t) i++;
  const a = K[i];
  const b = K[Math.min(i + 1, K.length - 1)];
  const raw = b === a ? 1 : prog(t, a.t, b.t);
  const e = Math.abs(a.y ?? 0) > 800 && a.t < 10 ? outQuint(raw) : inOut(raw);
  const g = (k, d) => lerp(a[k] ?? d, b[k] ?? d, e);
  const s = g('s', dev.base);
  return { x: g('x', 0), y: g('y', 0), s, rx: g('rx', 0), ry: g('ry', 0), zoomed: a.zoomed || b.zoomed ? clamp((s - dev.base) / 0.35) : 0 };
}

function framePoses(t) {
  let veil = 0;
  for (const dev of [laptop, tablet]) {
    const p = poseAt(dev, t);
    const float = 1 - p.zoomed;
    const fy = Math.sin(t * 0.9 + (dev === tablet ? 1.3 : 0)) * 5 * float;
    const fr = Math.sin(t * 0.45 + (dev === tablet ? 2 : 0)) * 1.2 * float;
    dev.el.style.transform = `translate(${p.x}px, ${p.y + fy}px) perspective(2800px) rotateX(${p.rx}deg) rotateY(${p.ry + fr}deg) scale(${p.s})`;
    show(dev.el, true);
    const r = rect(dev.el);
    const onStage = r.r > 0 && r.l < 1920 && r.b > 0 && r.t < 1080;
    show(dev.el, onStage);
    dev.on = onStage;
    veil = Math.max(veil, p.zoomed);
  }
  $('veil').style.opacity = veil;
  // The lid opens as the laptop rises, and the screen wakes.
  const lp = outCubic(prog(t, ...T.LID));
  laptop.lid.style.transform = `perspective(1600px) rotateX(${lerp(78, 0, lp)}deg)`;
  laptop.off.style.opacity = 1 - prog(t, T.LID[1] - 0.35, T.LID[1] + 0.3);
}

// ─── Screens ─────────────────────────────────────────────────────────────────
function frameScreens(dev, t) {
  for (const l of Object.values(dev.layers)) show(l, false);
  if (dev === laptop) show(lbars, false);
  const i = dev.list.findLastIndex((s) => t >= s.t);
  if (i < 0) return;
  const cur = dev.list[i];
  const prev = dev.list[i - 1];
  const p = inOut(prog(t, cur.t, cur.t + (cur.via === 'lift' ? 0.6 : 0.45)));
  const W = dev.G.screen.w;
  const place = (s, x, y, opacity, z, dim = 0) => {
    const l = dev.layers[s.shot];
    show(l, true);
    let sy = 0;
    if (s.scroll) {
      sy = s.scroll[0][0];
      for (const [from, to, t0, t1] of s.scroll) if (t >= t0) sy = lerp(from, to, inOut(prog(t, t0, t1)));
      show(lbars, true);
    }
    l.style.transform = `translate(${x}px, ${y - sy * dev.G.K}px)`;
    l.style.opacity = opacity;
    l.style.zIndex = z;
    l.style.filter = dim ? `brightness(${1 - dim})` : '';
    if (s.shot === 'stage') {
      const scrolled = Math.max(0, t - s.play) * PT_PER_S;
      l.words.style.transform = `translateY(${(meta.stage.layerTop - scrolled) * dev.G.K}px)`;
    }
  };
  if (prev && p < 1 && cur.via !== 'cut') {
    if (cur.via === 'push') {
      place(prev, -p * 0.3 * W, 0, 1, 1, p * 0.1);
      place(cur, (1 - p) * W, 0, 1, 2);
    } else if (cur.via === 'lift') {
      place(prev, 0, -p * 60, 1 - p, 1);
      place(cur, 0, (1 - p) * 60, p, 2);
    } else {
      place(prev, 0, 0, 1, 1);
      place(cur, 0, 0, p, 2);
    }
  } else {
    place(cur, 0, 0, 1, 2);
  }
  const shown = p < 0.5 && prev && cur.via !== 'cut' ? prev.shot : cur.shot;
  paintBar(dev, dev.colours[shown]);
}

function framePointer(t) {
  const keys = T.POINTER;
  const on = t >= keys[0].t - 0.3 && t < keys.at(-1).t;
  show(pointer, on);
  if (!on) return;
  const at = (k) => (typeof k.at[0] === 'number' ? { x: k.at[0], y: k.at[1] } : meta.taps[k.at[0]][k.at[1]]);
  let i = keys.findLastIndex((k) => t >= k.t);
  if (i < 0) i = 0;
  const a = keys[i];
  const b = keys[i + 1];
  let pos = at(a);
  if (b && !b.hide && t > b.t - 0.8) {
    const q = inOut(prog(t, b.t - 0.8, b.t - 0.05));
    const bp = at(b);
    pos = { x: lerp(pos.x, bp.x, q), y: lerp(pos.y, bp.y, q) - Math.sin(Math.PI * q) * 30 };
  }
  const click = keys.some((k) => k.click && t >= k.t - 0.04 && t < k.t + 0.1);
  const K = LAPTOP.K;
  pointer.style.opacity = Math.min(prog(t, keys[0].t - 0.3, keys[0].t), 1 - prog(t, keys.at(-1).t - 0.3, keys.at(-1).t));
  pointer.style.transform = `translate(${pos.x * K - 2}px, ${LAPTOP.bar + pos.y * K - 2}px) scale(${click ? 0.86 : 1})`;
}

function frameFinger(t) {
  const tap = T.TAPS.find((x) => t >= x.t - 0.3 && t < x.t + 0.45);
  show(finger, !!tap);
  if (!tap) return;
  const at = meta.taps[tap.shot][tap.key];
  const K = TABLET.K;
  finger.style.left = `${at.x * K}px`;
  finger.style.top = `${TABLET.bar + at.y * K}px`;
  const inP = outCubic(prog(t, tap.t - 0.3, tap.t - 0.08));
  const outP = prog(t, tap.t + 0.1, tap.t + 0.45);
  const press = t >= tap.t - 0.02 && t < tap.t + 0.12 ? 0.84 : 1;
  finger.style.opacity = inP * (1 - outP);
  finger.style.transform = `scale(${lerp(1.3, 1, inP) * press * (1 + outP * 0.3)})`;
}

// ─── Words ───────────────────────────────────────────────────────────────────
const introEls = T.INTRO.map((line) => {
  const d = document.createElement('div');
  $('intro').append(d);
  return { ...line, spans: words(d, line.text, { accent: line.accent }) };
});
const endTitle = words($('end-title'), 'Nhako Tools');
const endTag = words($('end-tag'), 'Nothing uploads. Nothing waits.');
const endSmall = words($('end-small'), 'Free. No account. 50 tools, for your laptop and tablet.');

function frameBackground(t) {
  const night = inOut(prog(t, ...T.DARK.in)) * (1 - inOut(prog(t, ...T.DARK.out)));
  $('night').style.opacity = night;
  const c = Math.round(lerp(251, 0, night));
  const d = night ? 0 : 2;
  $('veil').style.background = `linear-gradient(180deg, rgb(${c},${c},${c + d}) 0%, rgb(${c},${c},${c + d}) 70%, rgba(${c},${c},${c + d},0) 100%)`;
  return night;
}

function frameIntro(t) {
  const on = t < T.INTRO_OUT[1];
  show($('intro'), on);
  if (!on) return;
  introEls.forEach((l) => reveal(l.spans, t, l.t, { rise: 50, blur: 22, dur: 0.9, gap: 0.11 }));
  const out = inOut(prog(t, ...T.INTRO_OUT));
  $('intro').style.opacity = 1 - out;
  $('intro').style.transform = `translateY(${-out * 100}px) scale(${1 - out * 0.08})`;
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
    capSpans = { eyebrow: words(eb, cap.eyebrow, { accent: true }), head: words(hd, cap.head), sub: cap.sub ? words(sb, cap.sub) : [] };
    show(sb, !!cap.sub);
    capBuilt = i;
  }
  reveal(capSpans.eyebrow, t, cap.t, { rise: 18, blur: 10 });
  reveal(capSpans.head, t, cap.t + 0.08);
  reveal(capSpans.sub, t, cap.t + 0.45, { rise: 18, blur: 10, gap: 0.035 });
  const next = T.CAPTIONS[i + 1];
  leave(el, next ? inOut(prog(t, next.t - 0.4, next.t)) : 0);
}

function frameEnd(t) {
  const on = t >= T.END.icon - 0.1;
  show($('end'), on);
  if (!on) return;
  const ip = prog(t, T.END.icon, T.END.icon + 0.8);
  $('end-icon').style.opacity = outCubic(Math.min(1, ip * 2));
  $('end-icon').style.transform = `translateY(${(1 - outQuint(ip)) * 50}px) scale(${ip === 0 ? 0.6 : lerp(0.6, 1, outBack(ip, 1.2))})`;
  $('end-icon').style.filter = ip < 1 ? `blur(${(1 - ip) * 14}px)` : '';
  reveal(endTitle, t, T.END.title, { rise: 40, blur: 20, dur: 0.9, gap: 0.12 });
  reveal(endTag, t, T.END.tagline, { gap: 0.09 });
  const up = outQuint(prog(t, T.END.url, T.END.url + 0.7));
  $('end-url').style.opacity = up;
  $('end-url').style.transform = `translateX(-50%) translateY(${(1 - up) * 26}px) scale(${lerp(0.9, 1, up)})`;
  reveal(endSmall, t, T.END.small, { rise: 14, blur: 8, gap: 0.04 });
  $('fade').style.opacity = inOut(prog(t, T.END.fadeOut + 0.3, T.DURATION));
}

// ─── Butterflies ─────────────────────────────────────────────────────────────
// [layer, scale, opacity, colour, side, u speed, v speed, phase]. Far ones are
// small and sit behind the devices' plane; front ones are larger and sharp.
const FLY_DEFS = [
  ['far', 3, 0.55, 0, 'L', 0.23, 0.31, 0.0], ['far', 3, 0.55, 1, 'R', 0.27, 0.22, 1.7],
  ['far', 3.5, 0.6, 2, 'L', 0.19, 0.37, 3.1], ['far', 3, 0.55, 3, 'R', 0.21, 0.29, 4.4],
  ['front', 5, 0.95, 3, 'L', 0.17, 0.26, 2.2], ['front', 5, 0.95, 1, 'R', 0.2, 0.19, 0.6],
  ['front', 4, 0.9, 0, 'R', 0.15, 0.33, 5.3],
];
const flies = FLY_DEFS.map(([layer, scale, opacity, colour, side, su, sv, ph], i) => {
  const el = butterfly(colour, scale);
  el.style.opacity = opacity;
  $(`flies-${layer}`).append(el);
  // A rotated sprite fits in a square of its diagonal: plan with that.
  const size = Math.hypot(15 * scale, 12 * scale);
  return { i, el, layer, opacity, side, su, sv, ph, size, ox: (size - 15 * scale) / 2, oy: (size - 12 * scale) / 2 };
});
// Near: big and out of focus, drifting across a bottom corner in the opening
// and on the end card only, when no device is on screen.
const NEAR = [[0.2, 3.5, 930, 1, 12], [53.0, 59.8, 1010, -1, 12]].map(([t0, t1, y, dir, scale], i) => {
  const el = butterfly((i + 1) % 4, scale);
  el.firstChild.style.filter = 'blur(5px)';
  $('flies-near').append(el);
  return { el, t0, t1, y, dir, ph: i * 2.2 };
});
// Three that circle the icon on the end card.
const ORBIT = [0, 1, 3].map((c, i) => {
  const el = butterfly(c, 4.5);
  $('flies-front').append(el);
  return { el, a0: i * (Math.PI * 2 / 3) };
});

const EDGE = 20; // the flies keep this far from the frame's edges
const AIR = { L: 380, R: 1540 }; // the widest the side patches get, even on an empty stage
const MARGIN = 40; // air kept between a fly and a device's body

/** Where the devices are, from the page: bodies for planning, screens for the guard. */
function obstacles() {
  const bodies = [];
  const screens = [];
  for (const dev of [laptop, tablet]) {
    if (!dev.on) continue;
    bodies.push(union(dev.body.map(rect)));
    screens.push(rect(dev.screen));
  }
  const words = [];
  for (const id of ['cap', 'intro', 'end-icon', 'end-title', 'end-tag', 'end-url', 'end-small']) {
    const el = $(id);
    if (!visible(el)) continue;
    const parts = id === 'cap' ? [...el.children].filter((c) => c.textContent && c.style.display !== 'none').map(rect) : [rect(el)];
    for (const r of parts) if (r.r > r.l) words.push(grow(r, 18));
  }
  return { bodies, screens, words };
}

/** A fly's point in its patch at time t, before anything is pushed. */
function wander(f, t) {
  const u = 0.5 + 0.35 * Math.sin(t * f.su * 2 * Math.PI * 0.35 + f.ph) + 0.15 * Math.sin(t * 1.3 + f.ph * 2);
  const v = 0.5 + 0.38 * Math.sin(t * f.sv * 2 * Math.PI * 0.3 + f.ph * 1.7) + 0.12 * Math.sin(t * 1.9 + f.ph);
  return { u: clamp(u), v: clamp(v) };
}

function place(f, t, O) {
  const S = f.size;
  // The side patch: from the frame's edge to the nearest device (or AIR).
  const inStage = O.bodies.map((b) => ({ l: Math.max(0, b.l), t: Math.max(0, b.t), r: Math.min(1920, b.r), b: Math.min(1080, b.b) })).filter((b) => b.r > b.l && b.b > b.t);
  const U = union(inStage);
  const presence = U ? clamp((U.b - U.t) / 260) * clamp((U.r - U.l) / 260) : 0;
  const { u, v } = wander(f, t);
  let x;
  if (f.side === 'L') {
    const air = AIR.L - S;
    const max = U ? lerp(air, Math.min(air, U.l - MARGIN - S), presence) : air;
    x = Math.min(lerp(EDGE, max, u), max);
  } else {
    const air = AIR.R;
    const min = U ? lerp(air, Math.max(air, U.r + MARGIN), presence) : air;
    x = Math.max(lerp(1920 - EDGE - S, min, u), min);
  }
  let y = lerp(90, 1080 - EDGE - S, v);
  // Step out of the words, and out of any device body the patch did not already clear.
  for (let pass = 0; pass < 3; pass++) {
    for (const o of [...O.words, ...O.bodies.map((b) => grow(b, MARGIN))]) {
      const [dx, dy] = pushOut({ l: x, t: y, r: x + S, b: y + S }, o);
      x += dx;
      y += dy;
    }
  }
  return { x, y };
}

function frameFlies(t) {
  const O = obstacles();
  for (const f of flies) {
    const p = place(f, t, O);
    const q = place(f, t + 0.08, O);
    const heading = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + 90;
    f.el.style.transform = `translate(${p.x + f.ox}px, ${p.y + f.oy}px) rotate(${heading}deg)`;
    f.el.firstChild.style.transform = `scaleX(${flap(t, f.ph)})`;
    // On the end card the side flies thin out, leaving the three around the icon.
    f.el.style.opacity = f.opacity * (1 - 0.5 * prog(t, T.END.icon, T.END.icon + 1));
    show(f.el, true);
  }
  for (const n of NEAR) {
    const p = prog(t, n.t0, n.t1);
    const on = p > 0 && p < 1;
    show(n.el, on);
    if (!on) continue;
    const x = n.dir > 0 ? lerp(-260, 700, p) : lerp(2000, 1250, p);
    const y = n.y + Math.sin(p * 7 + n.ph) * 40;
    n.el.style.opacity = 0.5 * Math.sin(Math.PI * p);
    n.el.style.transform = `translate(${x}px, ${y}px) rotate(${n.dir * 80 + Math.cos(p * 7) * 10}deg)`;
    n.el.firstChild.style.transform = `scaleX(${flap(t, n.ph)})`;
  }
  const e = outCubic(prog(t, T.END.icon + 0.4, T.END.icon + 1.6));
  ORBIT.forEach((o) => {
    show(o.el, e > 0);
    const a = o.a0 + t * 0.8;
    const rx = lerp(900, 250, e);
    o.el.style.opacity = e;
    o.el.style.transform = `translate(${960 - 34 + Math.cos(a) * rx}px, ${298 - 27 + Math.sin(a) * 92}px) rotate(${(a * 180) / Math.PI + 180}deg)`;
    o.el.firstChild.style.transform = `scaleX(${flap(t, o.a0)})`;
  });
  // The guard: no fly may touch a screen. check.mjs fails the build if this ever fires.
  const guard = O.screens.map((s) => grow(s, 6));
  for (const el of [...flies.map((f) => f.el), ...NEAR.map((n) => n.el), ...ORBIT.map((o) => o.el)]) {
    if (el.style.display === 'none') continue;
    const r = rect(el.firstChild);
    if (guard.some((s) => hits(r, s))) {
      show(el, false);
      window.__guard.push({ t: Math.round(t * 1000) / 1000, fly: [...el.parentElement.children].indexOf(el), layer: el.parentElement.id });
    }
  }
}

window.__guard = [];
window.renderFrame = (t) => {
  const night = frameBackground(t);
  frameIntro(t);
  framePoses(t);
  frameScreens(laptop, t);
  frameScreens(tablet, t);
  framePointer(t);
  frameFinger(t);
  frameCaption(t, night);
  frameEnd(t);
  frameFlies(t);
};

/** For check.mjs: every visible fly and every visible screen, as boxes. */
window.boxes = () => ({
  flies: [...document.querySelectorAll('.bfly')].filter((el) => el.style.display !== 'none' && visible(el)).map((el) => rect(el.firstChild)),
  screens: [laptop, tablet].filter((d) => d.on).map((d) => rect(d.screen)),
});

await document.fonts.ready;
await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
window.renderFrame(0);
window.sceneReady = true;

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
