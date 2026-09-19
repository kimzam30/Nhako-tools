/**
 * Teleprompter logic that has nothing to do with the screen: reading a
 * script, timing it, following a voice through it, and checking the messages
 * a phone remote sends. The island in components/react/Teleprompter.tsx owns
 * everything visual.
 *
 * Script format, kept to what a presenter can type on a tablet keyboard:
 *   # Heading          starts a section (shown, not read, used to jump)
 *   [PAUSE]            stops the scroll when it reaches the reading line
 *   [anything else]    a cue for the reader, shown but not read
 *   **words**          emphasis
 *   a blank line       a new paragraph
 */

/**
 * `index` is the word's place in `Script.words`. A `glue` piece continues the
 * word before it with no space: the comma in "**minute**," or the bold middle
 * of "un**believ**able". It shares that word's index and is not counted again.
 */
export interface Word { kind: 'word'; text: string; index: number; em: boolean; glue: boolean }
export interface Cue { kind: 'cue'; text: string; pause: boolean }
export type Inline = Word | Cue;
export type Block =
  | { kind: 'heading'; text: string; section: number }
  | { kind: 'para'; items: Inline[] };

export interface Script {
  blocks: Block[];
  /** Words to be read aloud, in order: headings and cues are not counted. */
  words: string[];
  sections: string[];
}

/** Cues that stop the scroll, in both site languages. */
const PAUSE_CUES = new Set(['PAUSE', 'STOP', 'BERHENTI', 'JEDA', 'HENTI']);

export function parseScript(text: string): Script {
  const blocks: Block[] = [];
  const words: string[] = [];
  const sections: string[] = [];
  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/);

  for (const para of paragraphs) {
    let items: Inline[] = [];
    const flush = () => { if (items.length) blocks.push({ kind: 'para', items }); items = []; };
    for (const line of para.split('\n')) {
      const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        flush();
        const title = heading[1]!;
        blocks.push({ kind: 'heading', text: title, section: sections.length });
        sections.push(title);
        continue;
      }
      // Split into cues, emphasis runs and plain runs, in order.
      let em = false;
      // True while the text so far on this line ends mid-word, so the next
      // run continues that word rather than starting a new one.
      let open = false;
      for (const part of line.split(/(\[[^\]\n]*\]|\*\*)/)) {
        if (part === '**') { em = !em; continue; }
        const cue = /^\[([^\]]*)\]$/.exec(part);
        if (cue) {
          const label = (cue[1] ?? '').trim();
          if (label) items.push({ kind: 'cue', text: label, pause: PAUSE_CUES.has(label.toUpperCase()) });
          open = false;
          continue;
        }
        const tokens = part.split(/\s+/);
        tokens.forEach((w, i) => {
          if (!w) return;
          const prev = items.at(-1);
          if (i === 0 && open && prev?.kind === 'word') {
            items.push({ kind: 'word', text: w, index: prev.index, em, glue: true });
            words[prev.index] += w;
            return;
          }
          items.push({ kind: 'word', text: w, index: words.length, em, glue: false });
          words.push(w);
        });
        if (part) open = !/\s$/.test(part);
      }
    }
    flush();
  }
  return { blocks, words, sections };
}

/** Seconds to read `words` words aloud at `wpm`. */
export const readingSeconds = (words: number, wpm: number): number =>
  wpm > 0 ? Math.round((words / wpm) * 60) : 0;

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const WPM = { min: 60, max: 260, step: 10, default: 140 } as const;
export const clampWpm = (v: number): number =>
  Math.min(WPM.max, Math.max(WPM.min, Math.round(v / WPM.step) * WPM.step));

/**
 * Scroll speed in pixels a second. Laid-out text has a measurable height per
 * word, so a words-per-minute setting stays true when the font, the margins
 * or the orientation change.
 */
export function pixelsPerSecond(wpm: number, contentHeight: number, words: number): number {
  if (words <= 0 || contentHeight <= 0) return 0;
  return (wpm / 60) * (contentHeight / words);
}

// ─── Voice-follow ─────────────────────────────────────────────────────────

/** Lowercase, no accents or punctuation: "Selamat," and "selamat" match. */
export function normalizeWord(w: string): string {
  return w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

const same = (a: string, b: string) =>
  a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

/**
 * Where the speaker is in the script, from the last few words recognised.
 * Looks a little behind and further ahead of `from` (people skip more than
 * they repeat), and returns the index of the word after the best match, or
 * null when nothing matches well enough to move.
 *
 * `script` must already be normalised.
 */
export function followMatch(script: string[], heard: string[], from: number): number | null {
  const tail = heard.map(normalizeWord).filter(Boolean).slice(-6);
  if (tail.length === 0) return null;
  // One word matches too much by chance; ask for two unless that is all we have.
  const need = Math.min(2, tail.length);
  const lo = Math.max(0, from - 12);
  const hi = Math.min(script.length - 1, from + 60);
  let best: { end: number; score: number; dist: number } | null = null;

  for (let end = lo; end <= hi; end++) {
    // Align the heard tail backwards from `end`, allowing one skipped word.
    let score = 0;
    let s = end;
    for (let h = tail.length - 1; h >= 0 && s >= 0; h--) {
      const word = tail[h]!;
      if (same(word, script[s]!)) { score++; s--; }
      else if (s > 0 && same(word, script[s - 1]!)) { score++; s -= 2; }
      else if (h === tail.length - 1) break;
      else s--;
    }
    if (score < need || !same(tail[tail.length - 1]!, script[end]!)) continue;
    const dist = end + 1 >= from ? end + 1 - from : (from - end - 1) * 3;
    if (!best || score > best.score || (score === best.score && dist < best.dist)) best = { end, score, dist };
  }
  return best ? best.end + 1 : null;
}

// ─── Phone remote ─────────────────────────────────────────────────────────

export const ACTIONS = ['toggle', 'faster', 'slower', 'back', 'forward', 'prev', 'next', 'restart', 'record'] as const;
export type Action = (typeof ACTIONS)[number];

export type RemoteMessage =
  | { t: 'hello' }
  | { t: 'cmd'; a: Action }
  | { t: 'wpm'; v: number };

export interface PrompterState {
  t: 'state';
  playing: boolean;
  wpm: number;
  /** 0 to 1. */
  progress: number;
  remaining: number;
  section: number;
  sections: string[];
  recording: boolean;
  canRecord: boolean;
}

/**
 * Anyone who guesses a room code can send messages, so the tablet trusts
 * nothing: only these shapes get through, and only the listed actions.
 */
export function parseRemote(x: unknown): RemoteMessage | null {
  if (!x || typeof x !== 'object') return null;
  const m = x as Record<string, unknown>;
  if (m.t === 'hello') return { t: 'hello' };
  if (m.t === 'cmd' && typeof m.a === 'string' && (ACTIONS as readonly string[]).includes(m.a)) return { t: 'cmd', a: m.a as Action };
  if (m.t === 'wpm' && typeof m.v === 'number' && Number.isFinite(m.v)) return { t: 'wpm', v: clampWpm(m.v) };
  return null;
}

/** The phone's view of the tablet, checked the same way. */
export function parseState(x: unknown): PrompterState | null {
  if (!x || typeof x !== 'object') return null;
  const m = x as Record<string, unknown>;
  if (m.t !== 'state') return null;
  const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
  const sections = Array.isArray(m.sections) ? m.sections.filter((s): s is string => typeof s === 'string').slice(0, 200).map((s) => s.slice(0, 120)) : [];
  return {
    t: 'state',
    playing: m.playing === true,
    wpm: clampWpm(num(m.wpm, WPM.min, WPM.max)),
    progress: num(m.progress, 0, 1),
    remaining: num(m.remaining, 0, 360000),
    section: Math.round(num(m.section, -1, sections.length - 1)),
    sections,
    recording: m.recording === true,
    canRecord: m.canRecord === true,
  };
}

/**
 * A room code: 10 characters from an alphabet with no look-alikes (no 0/O,
 * 1/I/L), 50 bits from the platform's secure random source. Short enough to
 * type on a phone, far too many to guess.
 */
export const ROOM_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function roomCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % ROOM_ALPHABET.length);
  while (out.length < 10) {
    for (const b of random(16)) {
      if (b < limit && out.length < 10) out.push(ROOM_ALPHABET[b % ROOM_ALPHABET.length]!);
    }
  }
  return out.join('');
}

export const isRoomCode = (s: string): boolean =>
  s.length === 10 && [...s].every((c) => ROOM_ALPHABET.includes(c));

/** Tidy what someone typed: "abc de2-3fgh" -> "ABCDE23FGH". */
export const cleanRoomCode = (s: string): string => s.toUpperCase().replace(/[^0-9A-Z]/g, '');

// ─── Importing ────────────────────────────────────────────────────────────

/**
 * Plain text from a Word document's main XML. Paragraphs styled as headings
 * become "# " lines so they turn into sections.
 */
export function docxXmlToScript(xml: string): string {
  const out: string[] = [];
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []) {
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? '';
    const text = (p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? [])
      .map((r) => (r.startsWith('<w:t') && !r.startsWith('<w:tab') ? r.replace(/<[^>]+>/g, '') : ' '))
      .join('')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
      .trim();
    if (!text) continue;
    out.push(/^(Heading|Title)/i.test(style) ? `# ${text}` : text);
  }
  return out.join('\n\n');
}

/** A title for a script: its first heading, else its first few words. */
export function scriptTitle(text: string, fallback: string): string {
  const heading = /^\s{0,3}#{1,6}\s+(.+)$/m.exec(text)?.[1];
  const first = heading ?? text.replace(/\[[^\]]*\]|\*\*|#/g, ' ').trim().split(/\s+/).slice(0, 6).join(' ');
  return (first || fallback).slice(0, 60);
}
