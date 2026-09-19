/**
 * The teleprompter's script library and settings, in this browser's
 * localStorage. Scripts are short text, so a few hundred of them fit. Every
 * read and write is guarded: private windows and blocked storage just mean
 * nothing is remembered, never a broken page.
 */
import { WPM, clampWpm } from '../../tools/media/teleprompter';

export interface SavedScript { id: string; title: string; text: string; updated: number }

export interface Settings {
  wpm: number;
  fontSize: number;
  lineHeight: number;
  margin: number;
  /** Reading line, as a percentage of the screen height from the top. */
  guide: number;
  theme: 'dark' | 'light' | 'yellow';
  align: 'left' | 'center';
  mirrorX: boolean;
  mirrorY: boolean;
  countdown: number;
  voice: boolean;
  voiceLang: string;
}

export const DEFAULTS: Settings = {
  wpm: WPM.default, fontSize: 56, lineHeight: 1.45, margin: 8, guide: 22,
  theme: 'dark', align: 'left', mirrorX: false, mirrorY: false, countdown: 3,
  voice: false, voiceLang: 'en-US',
};

const SCRIPTS = 'nhako.teleprompter.scripts';
const CURRENT = 'nhako.teleprompter.current';
const SETTINGS = 'nhako.teleprompter.settings';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked or full */ }
}

export function loadScripts(): SavedScript[] {
  const list = read<SavedScript[]>(SCRIPTS);
  if (!Array.isArray(list)) return [];
  return list.filter((s) => s && typeof s.id === 'string' && typeof s.text === 'string');
}
export const saveScripts = (list: SavedScript[]) => write(SCRIPTS, list);
export const loadCurrent = (): string | null => read<string>(CURRENT);
export const saveCurrent = (id: string) => write(CURRENT, id);

const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export function loadSettings(locale: string): Settings {
  const s = read<Partial<Settings>>(SETTINGS) ?? {};
  const d = { ...DEFAULTS, voiceLang: locale === 'ms' ? 'ms-MY' : 'en-US' };
  return {
    wpm: clampWpm(num(s.wpm, WPM.min, WPM.max, d.wpm)),
    fontSize: num(s.fontSize, 24, 140, d.fontSize),
    lineHeight: num(s.lineHeight, 1.1, 2.2, d.lineHeight),
    margin: num(s.margin, 0, 30, d.margin),
    guide: num(s.guide, 5, 60, d.guide),
    theme: s.theme === 'light' || s.theme === 'yellow' ? s.theme : 'dark',
    align: s.align === 'center' ? 'center' : 'left',
    mirrorX: s.mirrorX === true,
    mirrorY: s.mirrorY === true,
    countdown: [0, 3, 5, 10].includes(s.countdown as number) ? (s.countdown as number) : d.countdown,
    // Voice-follow sends audio to a speech service, so it is never remembered
    // as on: each visit opts in again.
    voice: false,
    voiceLang: typeof s.voiceLang === 'string' && /^[a-z]{2}-[A-Z]{2}$/.test(s.voiceLang) ? s.voiceLang : d.voiceLang,
  };
}
export const saveSettings = (s: Settings) => write(SETTINGS, { ...s, voice: false });

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
