/**
 * The launch video's soundtrack, synthesised from nothing: a bright, modern
 * electronic bed in C major at 120 BPM, plus quiet interface sounds on the
 * cues in timeline.mjs. No samples, no recordings, nothing licensed.
 *
 *   node launch/video/audio.mjs   ->  launch/video/out/soundtrack.wav
 *
 * Voices:
 *   pad    three detuned band-limited saws per note, low-passed, ducked by the kick
 *   pluck  sine with a quick decay, eighth-note arpeggios, dotted-eighth ping-pong delay
 *   bell   sine partials, the topline
 *   sub    sine bass on the root
 *   drums  sine-sweep kick, three-burst clap, soft closed hats
 * Everything melodic also feeds a Schroeder reverb.
 *
 * Sections follow the picture: an airy intro under the opening words, the beat
 * when the phone lands (4 s), the full groove from the home scroll (8 s), a
 * breakdown for dark mode (42 to 45 s), and a held chord for the end card (50 s).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BPM, DURATION, DARK, END, soundCues } from './timeline.mjs';

const RATE = 44100;
const N = Math.ceil(DURATION * RATE);
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;
const BAR = BEAT * 4;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
let seed = 7;
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;

/** Stereo buses. `pad` and `sub` are ducked by the kick before the mix. */
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const B = { dry: bus(), pad: bus(), sub: bus(), send: bus(), delay: bus() };

function add(target, t0, dur, fn, gain = 1, pan = 0, send = 0, delay = 0) {
  const a = Math.round(t0 * RATE);
  const n = Math.round(dur * RATE);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
  const gr = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
  for (let i = 0; i < n; i++) {
    const j = a + i;
    if (j < 0 || j >= N) continue;
    const v = fn(i / RATE, i / n);
    target.L[j] += v * gl;
    target.R[j] += v * gr;
    if (send) { B.send.L[j] += v * gl * send; B.send.R[j] += v * gr * send; }
    if (delay) { B.delay.L[j] += v * gl * delay; B.delay.R[j] += v * gr * delay; }
  }
}

// --- Oscillators --------------------------------------------------------------
/** A band-limited saw (polyBLEP), so the pads do not alias into grit. */
function saw(f) {
  let ph = 0;
  const dt = f / RATE;
  return () => {
    ph += dt;
    if (ph >= 1) ph -= 1;
    let v = 2 * ph - 1;
    if (ph < dt) { const x = ph / dt; v -= x + x - x * x - 1; } else if (ph > 1 - dt) { const x = (ph - 1) / dt; v -= x * x + x + x + 1; }
    return v;
  };
}
const adsr = (t, p, dur, a, d, s, r) => {
  const rel = r / dur;
  const env = t < a ? t / a : t < a + d ? 1 - (1 - s) * ((t - a) / d) : s;
  return env * (p > 1 - rel ? (1 - p) / rel : 1);
};

function pad(t0, midi, dur, { gain = 0.05, cutoff = 1800, pan = 0 } = {}) {
  const oscs = [-0.11, 0, 0.12].map((c) => saw(hz(midi + c)));
  let l1 = 0;
  let l2 = 0;
  add(B.pad, t0, dur, (t, p) => {
    const x = (oscs[0]() + oscs[1]() + oscs[2]()) / 3;
    const k = 1 - Math.exp(-2 * Math.PI * cutoff / RATE);
    l1 += k * (x - l1);
    l2 += k * (l1 - l2);
    return l2 * adsr(t, p, dur, 0.35, 0.4, 0.8, 0.6);
  }, gain, pan, 0.35);
}
function pluck(t0, midi, { gain = 0.12, pan = 0, decay = 7 } = {}) {
  const f = hz(midi);
  add(B.dry, t0, 0.6, (t) => (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 20)) * Math.exp(-t * decay) * Math.min(1, t / 0.003), gain, pan, 0.4, 0.35);
}
function bell(t0, midi, dur, { gain = 0.07, pan = 0 } = {}) {
  const f = hz(midi);
  add(B.dry, t0, dur + 1.2, (t) => (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 3)
    + 0.18 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(-t * 6)) * Math.exp(-t * 1.6) * Math.min(1, t / 0.004), gain, pan, 0.6, 0.25);
}
function sub(t0, midi, dur, gain = 0.13, release = 0.08) {
  const f = hz(midi);
  add(B.sub, t0, dur, (t, p) => Math.sin(2 * Math.PI * f * t) * adsr(t, p, dur, 0.01, 0.1, 0.85, release), gain);
}

// --- Drums -----------------------------------------------------------------------
const kicks = [];
function kick(t0, gain = 0.42) {
  kicks.push(t0);
  let ph = 0;
  add(B.dry, t0, 0.32, (t) => {
    ph += (46 + 110 * Math.exp(-t * 32)) / RATE;
    return Math.tanh(1.6 * Math.sin(2 * Math.PI * ph)) * Math.exp(-t * 9);
  }, gain);
}
function clap(t0, gain = 0.2) {
  let bp1 = 0;
  let bp2 = 0;
  add(B.dry, t0, 0.3, (t) => {
    const n = noise();
    bp1 += 0.35 * (n - bp1);
    bp2 += 0.08 * (bp1 - bp2);
    const band = bp1 - bp2; // roughly 1 to 3 kHz
    const bursts = [0, 0.011, 0.022].reduce((s, o) => s + (t >= o ? Math.exp(-(t - o) * 90) : 0), 0);
    return band * (bursts * 0.6 + Math.exp(-t * 16) * 0.5);
  }, gain, 0.05, 0.3);
}
function hat(t0, gain = 0.035, pan = 0.35) {
  let prev = 0;
  add(B.dry, t0, 0.05, (t) => { const n = noise(); const hp = n - prev; prev = n; return hp * Math.exp(-t * 70); }, gain, pan);
}
function riser(t0, dur, gain = 0.12) {
  let lp = 0;
  add(B.dry, t0, dur, (t, p) => { lp += (0.02 + 0.5 * p * p) * (noise() - lp); return lp * p * p; }, gain, 0, 0.5);
}

// --- Arrangement -------------------------------------------------------------------
// Fmaj7, G, Em7, Am7 (IV V iii vi): bright, a little wistful, never resolved
// until the end card lands on C.
const CHORDS = [
  { root: 41, pad: [57, 60, 64, 65], arp: [65, 69, 72, 76] },
  { root: 43, pad: [55, 59, 62, 67], arp: [67, 71, 74, 79] },
  { root: 40, pad: [55, 59, 62, 64], arp: [64, 67, 71, 74] },
  { root: 45, pad: [55, 60, 64, 69], arp: [69, 72, 76, 79] },
];
const TOP = [
  [[76, 2], [79, 1], [81, 1], [84, 4]],
  [[83, 2], [81, 2], [79, 4]],
  [[79, 2], [76, 1], [79, 1], [83, 4]],
  [[81, 3], [79, 1], [76, 4]],
];
const inDark = (t) => t >= DARK.in[0] && t < DARK.out[1];
for (let bar = 0; bar * BAR < END.icon - 0.01; bar++) {
  const t = bar * BAR;
  const ch = CHORDS[bar % 4];
  const len = Math.min(BAR, END.icon - t);
  const intro = t < 4;
  const dark = inDark(t) || inDark(t + BAR - 0.01);
  const cutoff = intro ? 900 + bar * 300 : dark ? 900 : 2600;
  ch.pad.forEach((m, i) => pad(t, m, len + 0.05, { cutoff, pan: (i - 1.5) * 0.35, gain: intro || dark ? 0.075 : 0.05 }));
  // Plucks: sparse in the intro, eighths once the phone is up.
  for (let e = 0; e < 8; e++) {
    if (intro && e % 2) continue;
    if (t + e * EIGHTH >= END.icon) break;
    pluck(t + e * EIGHTH, ch.arp[e % 4] + (e >= 4 && !intro ? 12 : 0), { gain: intro || dark ? 0.12 : 0.09, pan: e % 2 ? 0.4 : -0.4 });
  }
  if (t >= 4 && !dark) {
    for (let b = 0; b < 4; b++) if (t + b * BEAT < END.icon) { kick(t + b * BEAT); sub(t + b * BEAT, ch.root, BEAT * 0.95); }
  }
  if (t >= 8 && !dark) {
    clap(t + BEAT); clap(t + 3 * BEAT);
    for (let e = 0; e < 8; e++) hat(t + e * EIGHTH + EIGHTH / 2, e % 2 ? 0.045 : 0.06);
  }
  // Topline from the home scroll on, resting in the breakdown.
  if (t >= 8 && !dark) {
    let e = 0;
    for (const [m, l] of TOP[bar % 4]) { if (t + e * EIGHTH < END.icon) bell(t + e * EIGHTH, m, l * EIGHTH, { gain: 0.055, pan: 0.1 }); e += l; }
  }
}
riser(1.6, 2.4, 0.1); // into the phone landing
riser(6.0, 2.0, 0.08); // into the full groove
riser(DARK.out[0] - 1.6, 1.6, 0.1); // out of the breakdown
// The end card: C major, held, and let the reverb carry it out.
kick(END.icon, 0.5);
sub(END.icon, 48, DURATION - END.icon, 0.12, 3);
[48, 55, 60, 64, 67, 72].forEach((m, i) => pad(END.icon, m, DURATION - END.icon, { cutoff: 2200, pan: (i - 2.5) * 0.25, gain: 0.05 }));
[72, 76, 79, 84, 88].forEach((m, i) => bell(END.icon + 0.7 + i * 0.12, m, 1.5, { gain: 0.05, pan: (i - 2) * 0.3 }));

// --- Interface sounds ----------------------------------------------------------------
function tick(t0, gain = 0.1) {
  add(B.dry, t0, 0.03, (t) => Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 260), gain);
  add(B.dry, t0, 0.02, () => noise() * 0.3, gain * 0.5);
}
function swish(t0, dur = 0.28, gain = 0.1) {
  let lp = 0;
  add(B.dry, t0 - dur * 0.4, dur, (t, p) => { lp += (0.03 + 0.25 * Math.sin(Math.PI * p)) * (noise() - lp); return lp * Math.sin(Math.PI * p); }, gain, 0.2, 0.2);
}
const SFX = {
  tap: (t) => tick(t, 0.12),
  swish: (t) => swish(t, 0.3, 0.14),
  whoosh: (t) => swish(t, 0.9, 0.3),
  drop: (t) => { tick(t, 0.1); pluck(t, 72, { gain: 0.08, decay: 12 }); },
  done: (t) => { bell(t, 84, 0.2, { gain: 0.07 }); bell(t + 0.09, 91, 0.3, { gain: 0.06 }); },
  shimmer: (t) => [84, 88, 91, 96, 100].forEach((m, i) => bell(t + i * 0.07, m, 0.2, { gain: 0.03, pan: (i - 2) * 0.35 })),
  install: (t) => { bell(t, 88, 0.3, { gain: 0.06 }); bell(t + 0.1, 96, 0.4, { gain: 0.05 }); },
  swell: (t) => riser(t - 1.2, 1.2, 0.12),
};
for (const c of soundCues()) SFX[c.kind](c.t);

// --- Effects and mix --------------------------------------------------------------------
// Sidechain: the pad and the sub dip under every kick, the pump of modern pop.
const duck = new Float32Array(N).fill(1);
for (const k of kicks) {
  const a = Math.round(k * RATE);
  for (let i = 0; i < RATE * 0.35 && a + i < N; i++) duck[a + i] = Math.min(duck[a + i], 1 - 0.55 * Math.exp(-(i / RATE) * 9));
}
// Ping-pong delay, dotted eighth.
const dly = { L: new Float32Array(N), R: new Float32Array(N) };
{
  const d = Math.round(EIGHTH * 1.5 * RATE);
  for (let i = 0; i < N; i++) {
    const inL = B.delay.L[i];
    const inR = B.delay.R[i];
    const fbL = i >= d ? dly.R[i - d] : 0;
    const fbR = i >= d ? dly.L[i - d] : 0;
    dly.L[i] = inR * 0.5 + fbL * 0.42;
    dly.R[i] = inL * 0.5 + fbR * 0.42;
  }
}
// Schroeder reverb: four damped combs into two allpasses, per side.
function reverb(x, offset) {
  const out = new Float32Array(N);
  for (const [len, fb] of [[1557, 0.84], [1617, 0.83], [1491, 0.85], [1422, 0.86]]) {
    const n = len + offset;
    const buf = new Float32Array(n);
    let idx = 0;
    let damp = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[idx];
      damp = y * 0.75 + damp * 0.25;
      buf[idx] = x[i] + damp * fb;
      idx = (idx + 1) % n;
      out[i] += y * 0.25;
    }
  }
  for (const len of [556, 441]) {
    const n = len + offset;
    const buf = new Float32Array(n);
    let idx = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[idx];
      const y = -out[i] + b;
      buf[idx] = out[i] + b * 0.5;
      idx = (idx + 1) % n;
      out[i] = y;
    }
  }
  return out;
}
const sendL = new Float32Array(N);
const sendR = new Float32Array(N);
for (let i = 0; i < N; i++) { sendL[i] = B.send.L[i] + dly.L[i] * 0.4; sendR[i] = B.send.R[i] + dly.R[i] * 0.4; }
const revL = reverb(sendL, 0);
const revR = reverb(sendR, 23);

const L = new Float32Array(N);
const R = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / RATE;
  const fade = t > DURATION - 1.6 ? Math.max(0, (DURATION - t) / 1.6) : 1;
  const fadeIn = Math.min(1, t / 0.08);
  const l = B.dry.L[i] + (B.pad.L[i] + B.sub.L[i]) * duck[i] + dly.L[i] * 0.55 + revL[i] * 0.5;
  const r = B.dry.R[i] + (B.pad.R[i] + B.sub.R[i]) * duck[i] + dly.R[i] * 0.55 + revR[i] * 0.5;
  // Gentle saturation only: the level comes from normalising, not from squashing.
  L[i] = Math.tanh(l * 0.8) * fade * fadeIn;
  R[i] = Math.tanh(r * 0.8) * fade * fadeIn;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak; // -1 dBFS
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(RATE, 24); pcm.writeUInt32LE(RATE * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  pcm.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4);
}
const out = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(out, { recursive: true });
writeFileSync(`${out}soundtrack.wav`, pcm);
console.log(`  out/soundtrack.wav  ${DURATION}s, ${RATE} Hz stereo, peak normalised to -1 dBFS`);
