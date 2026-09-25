/**
 * The widescreen launch film's single source of timing. The picture
 * (scene.js) and the soundtrack (../video/audio.mjs, pointed at this file)
 * both read it, so a click you see and the click you hear cannot drift apart.
 *
 * Laptop and tablet first: the phone film in ../video/ is the vertical cut.
 * Times are seconds. The music runs at 120 BPM, so a bar is 2 s.
 */

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const BPM = 120;
export const DURATION = 60;

/** The opening words, big and alone, before the laptop arrives. */
export const INTRO = [
  { t: 0.4, text: '50 tools.' },
  { t: 1.5, text: 'Zero uploads.', accent: true },
];
export const INTRO_OUT = [3.4, 3.95];

/**
 * Captions above the devices: eyebrow (accent), headline, grey line. Every
 * number is one the app printed in the capture it sits over (shots/meta.json).
 */
export const CAPTIONS = [
  { t: 4.1, eyebrow: 'Nhako Tools', head: 'Built for the big screen.', sub: 'Your laptop. Your tablet. Right in the browser.' },
  { t: 8.6, eyebrow: 'Home', head: '50 tools. One tab.', sub: 'PDF, image, media, calculators, code.' },
  { t: 13.4, eyebrow: 'Search', head: 'Type it in Malay. Found.', sub: '“Gaji” finds the salary calculator.' },
  { t: 17.2, eyebrow: 'Made for Malaysia', head: 'Your real take-home pay.', sub: 'EPF, SOCSO, EIS and PCB, from the 2026 tables.' },
  { t: 22.0, eyebrow: 'Malaysia', head: 'Sized for every portal.', sub: 'SPA, UPU, JPJ and LHDN limits, each from its official source.' },
  { t: 25.8, eyebrow: 'Teleprompter', head: 'Your script. On your tablet.', sub: 'Type it, paste it or import a .docx. Set the pace in words per minute.' },
  { t: 30.0, eyebrow: 'Teleprompter', head: 'Read it. Record it.', sub: 'The line sits high, by the camera. Takes stay on your tablet.' },
  { t: 35.4, eyebrow: 'For students', head: 'Know the GPA you need.', sub: 'A 3.62 next semester lifts a 3.47 CGPA to 3.50.' },
  { t: 40.0, eyebrow: 'Bahasa Melayu', head: 'English. Or Malay.', sub: 'Every page and every tool, in both.' },
  { t: 43.0, eyebrow: 'Dark mode', head: 'Light. Or dark.', dark: true },
  { t: 46.6, eyebrow: 'Private by design', head: 'Nothing leaves your device.', sub: 'No upload. No account. No daily limit.' },
  { t: 50.9, end: true },
];

/**
 * What each screen shows. `push` slides in like a page, `fade` crossfades,
 * `cut` swaps, `lift` crossfades with a small upward drift (a page scroll
 * between two captures). `scroll` is [[from, to, t0, t1], ...] in points of a
 * full-page capture. 'stage' is the teleprompter stage, composed from its
 * chrome and its words so the words can scroll.
 */
export const LAPTOP_SCREENS = [
  { t: 0, shot: 'laptop-home', via: 'cut' },
  { t: 8.8, shot: 'laptop-home-full', via: 'cut', scroll: [[0, 1500, 9.0, 11.7], [1500, 0, 12.0, 12.95]] },
  { t: 13.0, shot: 'laptop-home', via: 'cut' },
  { t: 14.25, shot: 'laptop-search', via: 'fade' },
  { t: 16.55, shot: 'laptop-salary', via: 'push' },
  { t: 22.0, shot: 'laptop-malaysia', via: 'fade' },
  { t: 39.0, shot: 'laptop-home-ms', via: 'cut' },
  { t: 43.0, shot: 'laptop-home-dark', via: 'fade' },
  { t: 46.6, shot: 'laptop-home', via: 'fade' },
];
export const TABLET_SCREENS = [
  { t: 0, shot: 'tablet-teleprompter', via: 'cut' },
  { t: 27.3, shot: 'tablet-teleprompter-start', via: 'lift' },
  { t: 28.75, shot: 'tablet-stage-idle', via: 'fade' },
  { t: 30.15, shot: 'stage', via: 'cut', play: 30.15 },
  { t: 35.4, shot: 'tablet-cgpa', via: 'fade' },
  { t: 39.95, shot: 'tablet-home-ms', via: 'fade' },
  { t: 43.0, shot: 'tablet-home-dark', via: 'fade' },
  { t: 46.6, shot: 'tablet-malaysia', via: 'fade' },
];

/** The laptop's pointer: where it glides to, and when it clicks (points on screen). */
export const POINTER = [
  { t: 12.9, at: [700, 420] },
  { t: 13.9, at: ['laptop-home', 'search'], click: true },
  { t: 15.9, at: ['laptop-search', 'result'], click: true },
  { t: 17.0, hide: true },
];
/** Finger taps on the tablet. */
export const TAPS = [
  { t: 28.55, shot: 'tablet-teleprompter-start', key: 'start' },
  { t: 30.0, shot: 'tablet-stage-idle', key: 'play' },
];

/** The laptop opens as it rises. */
export const LID = [4.3, 5.5];

/**
 * Where each device goes. Keys are eased (cubic in-out; outQuint when coming
 * up from below). `zoom: [scale, fx, fy]` lands screen point (fx, fy) on the
 * frame's focus point. `o` is opacity.
 */
export const LAPTOP_POSES = [
  { t: 3.6, y: 900, rx: 26, s: 0.9 },
  { t: 5.1, y: 0, s: 1 },
  { t: 13.9, y: 0, s: 1 },
  { t: 14.7, zoom: [1.75, 640, 190] },
  { t: 16.2, zoom: [1.75, 640, 190] },
  { t: 17.0, y: 0, s: 1 },
  { t: 18.3, y: 0, s: 1 },
  { t: 19.3, zoom: [1.75, 590, 292] },
  { t: 21.3, zoom: [1.75, 590, 292] },
  { t: 22.1, y: 0, s: 1 },
  { t: 24.8, y: 0, s: 1 },
  { t: 25.8, x: -1500, ry: 18, s: 0.8 },
  { t: 39.0, x: -1500, ry: 18, s: 0.8 },
  { t: 40.0, x: -340, y: -10, s: 0.8 },
  { t: 50.1, x: -340, y: -10, s: 0.8 },
  { t: 51.0, x: -340, y: 1000, rx: -14, s: 0.78 },
];
export const TABLET_POSES = [
  { t: 24.9, x: 1500, ry: -18, s: 0.9 },
  { t: 25.9, x: 0, s: 1 },
  { t: 30.4, x: 0, s: 1 },
  { t: 31.2, s: 1.1, y: 30 },
  { t: 34.8, s: 1.1, y: 30 },
  { t: 35.4, x: 0, s: 1 },
  { t: 36.4, x: 0, s: 1 },
  { t: 37.3, zoom: [1.45, 895, 390] },
  { t: 39.2, zoom: [1.45, 895, 390] },
  { t: 40.0, x: 490, y: 20, s: 0.7 },
  { t: 50.1, x: 490, y: 20, s: 0.7 },
  { t: 51.0, x: 490, y: 1000, rx: -14, s: 0.68 },
];

/** The stage goes black for dark mode and back. */
export const DARK = { in: [42.7, 43.5], out: [46.1, 46.9] };

/** End card. */
export const END = { icon: 51.0, title: 51.7, tagline: 52.4, url: 53.5, small: 54.1, fadeOut: 58.8 };

/**
 * Every sound effect, derived from the cues above so it cannot drift.
 * ../video/audio.mjs turns each kind into a sound.
 */
export function soundCues() {
  const cues = [{ t: 3.7, kind: 'whoosh' }, { t: LID[0] + 0.4, kind: 'drop' }];
  for (const s of [...LAPTOP_SCREENS, ...TABLET_SCREENS]) if (s.via === 'push' || s.via === 'lift') cues.push({ t: s.t, kind: 'swish' });
  for (const p of POINTER) if (p.click) cues.push({ t: p.t, kind: 'tap' });
  for (const tap of TAPS) cues.push({ t: tap.t, kind: 'tap' });
  cues.push({ t: 18.4, kind: 'shimmer' });
  cues.push({ t: 24.9, kind: 'whoosh' });
  cues.push({ t: 36.5, kind: 'done' });
  cues.push({ t: 39.3, kind: 'whoosh' });
  cues.push({ t: END.icon, kind: 'swell' });
  return cues.sort((a, b) => a.t - b.t);
}
