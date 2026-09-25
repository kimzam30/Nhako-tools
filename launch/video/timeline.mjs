/**
 * The launch video's single source of timing. The picture (scene.js) and the
 * soundtrack (audio.mjs) both read this file, so a tap you see and the click
 * you hear cannot drift apart: move a cue here and both follow.
 *
 * Times are seconds. The music runs at 120 BPM, so a beat is 0.5 s and a bar
 * is 2 s.
 */

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const BPM = 120;
export const DURATION = 58;

/** The opening words, big and alone, before the phone arrives. */
export const INTRO = [
  { t: 0.4, text: '50 tools.' },
  { t: 1.5, text: 'Zero uploads.', accent: true },
];
export const INTRO_OUT = [3.5, 4.0];

/**
 * Captions above the phone. `eyebrow` is the small accent label, `head` the
 * headline, `sub` the grey line under it. Words reveal one by one; a caption
 * leaves as the next one arrives. Every number is one the app printed in the
 * capture it sits over.
 */
export const CAPTIONS = [
  { t: 4.1, eyebrow: 'Nhako Tools', head: 'Everything runs on your phone.' },
  { t: 8.6, eyebrow: 'Home', head: '50 tools. One tap away.', sub: 'PDF, image, media, calculators, code.' },
  { t: 13.8, eyebrow: 'Search', head: 'Four letters. Found.', sub: 'The whole catalogue, as you type.' },
  { t: 17.0, eyebrow: 'Compress image', head: 'Made for form limits.', sub: 'A 5.5 MB photo. The form wants 500 KB.' },
  { t: 20.8, eyebrow: 'Done', head: '5.5 MB → {count}.', sub: 'In under a second. It never left your phone.', count: { from: 5632, to: 432, t0: 21.2, t1: 22.2 } },
  { t: 25.8, eyebrow: 'PDF', head: '24 PDF tools.', sub: 'Merge. Split. Sign. Convert.' },
  { t: 30.0, eyebrow: 'And more', head: 'Built for how you work.', sub: 'Scripts, payslips, PDFs and photos.' },
  { t: 35.0, eyebrow: 'Salary', head: 'Your real take-home pay.', sub: 'EPF, SOCSO, EIS and PCB, from the 2026 tables.' },
  { t: 40.0, eyebrow: 'Bahasa Melayu', head: 'English. Or Malay.', sub: 'Every page and tool, in both.' },
  { t: 42.6, eyebrow: 'Dark mode', head: 'Light. Or dark.', dark: true },
  { t: 45.2, eyebrow: 'Install', head: 'Add to Home Screen.', sub: 'Tools you have used work offline.' },
  { t: 49.9, end: true },
];

/**
 * What the phone shows. `push` slides in from the right like an iOS
 * navigation, `fade` crossfades, `cut` swaps. `scroll` is [from, to, t0, t1]
 * in points of the full-page capture.
 */
export const SCREENS = [
  { t: 4.0, shot: 'home', via: 'cut' },
  { t: 8.8, shot: 'home-full', via: 'cut', scroll: [[0, 1350, 9.0, 11.6], [1350, 0, 12.0, 12.9]] },
  { t: 12.95, shot: 'home', via: 'cut' },
  { t: 14.35, shot: 'search', via: 'fade' },
  { t: 17.0, shot: 'home', via: 'fade' },
  { t: 17.6, shot: 'image', via: 'push' },
  { t: 18.7, shot: 'image-compress-empty', via: 'push' },
  { t: 20.8, shot: 'image-compress-done', via: 'fade' },
  { t: 25.8, shot: 'home', via: 'fade' },
  { t: 26.6, shot: 'pdf', via: 'push' },
  { t: 27.9, shot: 'to-image-done', via: 'push' },
  { t: 30.0, shot: 'salary', via: 'fade' },
  { t: 40.0, shot: 'home-ms', via: 'fade' },
  { t: 42.6, shot: 'home-dark', via: 'fade' },
  { t: 45.2, shot: 'home', via: 'fade' },
  { t: 45.9, shot: 'install', via: 'fade' },
  { t: 47.6, shot: 'homescreen', via: 'fade' },
];

/** Taps on real element positions (shots/taps.json); the screen change follows. */
export const TAPS = [
  { t: 14.0, shot: 'home', key: 'search' },
  { t: 17.3, shot: 'home', key: 'image' },
  { t: 18.4, shot: 'image', key: '500kb' },
  { t: 19.3, shot: 'image-compress-empty', key: 'choose' },
  { t: 26.3, shot: 'home', key: 'pdf' },
  { t: 27.6, shot: 'pdf', key: 'to-image' },
];

/** The photo flying into Compress image, then the progress bar. */
export const FILE_DROP = [19.45, 20.05];
export const PROGRESS = [20.05, 20.8];

/**
 * Where the camera goes. The phone's pose between keys is eased; `zoom` is
 * [scale, focusX, focusY] with the focus in iPhone points on the screen.
 */
export const POSES = [
  { t: 3.7, y: 1500, rx: 32, ry: -10, s: 0.92 },
  { t: 5.2, y: 0, rx: 0, ry: 0, s: 1 },
  { t: 20.9, y: 0, rx: 0, ry: 0, s: 1 },
  { t: 21.8, zoom: [1.55, 196, 190] },
  { t: 24.6, zoom: [1.55, 196, 190] },
  { t: 25.5, y: 0, rx: 0, ry: 0, s: 1 },
  { t: 30.0, y: 0, rx: 0, ry: 0, s: 1 },
  { t: 30.9, y: 90, rx: 0, ry: 0, s: 0.74 },
  { t: 34.4, y: 90, rx: 0, ry: 0, s: 0.74 },
  { t: 35.4, y: 0, rx: 0, ry: 0, s: 1 },
  { t: 35.8, y: 0, rx: 0, ry: 0, s: 1 },
  { t: 36.7, zoom: [1.5, 196, 250] },
  { t: 39.2, zoom: [1.5, 196, 250] },
  { t: 40.0, y: 0, rx: 0, ry: 0, s: 1 },
  { t: 49.7, y: 0, rx: 0, ry: 0, s: 1 },
  { t: 50.6, y: 1700, rx: -18, ry: 0, s: 0.9 },
];

/** The two phones either side during "Built for how you work." */
export const FAN = { in: [30.2, 31.1], out: [34.2, 35.0], left: 'teleprompter', right: 'to-image-done' };

/** The background goes to black for dark mode and back. */
export const DARK = { in: [42.3, 43.1], out: [44.8, 45.5] };

/** The Nhako icon lands on the Home Screen. */
export const INSTALL_POP = 48.0;

/** End card. */
export const END = { icon: 50.5, title: 51.2, tagline: 51.9, url: 53.0, small: 53.6, fadeOut: 57.0 };

/**
 * Every sound effect, derived from the cues above so it cannot drift.
 * audio.mjs turns each kind into a sound.
 */
export function soundCues() {
  const cues = [];
  cues.push({ t: 3.75, kind: 'whoosh' });
  for (const s of SCREENS) if (s.via === 'push') cues.push({ t: s.t, kind: 'swish' });
  for (const tap of TAPS) cues.push({ t: tap.t, kind: 'tap' });
  cues.push({ t: FILE_DROP[1], kind: 'drop' });
  cues.push({ t: PROGRESS[1], kind: 'done' });
  cues.push({ t: 21.2, kind: 'shimmer' });
  cues.push({ t: FAN.in[0], kind: 'whoosh' });
  cues.push({ t: INSTALL_POP, kind: 'install' });
  cues.push({ t: END.icon, kind: 'swell' });
  return cues.sort((a, b) => a.t - b.t);
}
