/**
 * What a person reads when something below the tool fails.
 *
 * A ToolError is already written for people and passes through untouched.
 * Anything else used to be shown raw: "memory access out of bounds" from a
 * wasm engine, "Failed to fetch dynamically imported module" after a deploy
 * replaced the chunk a long-open tab was about to load. Those are mapped to
 * what the person can actually do about them.
 */
import type { Locale } from '../i18n/paths';
import { ToolError } from '../tools/types';

type Kind = 'memory' | 'stale' | 'network';

const PATTERNS: [Kind, RegExp][] = [
  ['memory', /out of memory|memory access out of bounds|array buffer allocation failed|allocation failed|could not allocate|maximum call stack|RangeError: (?:invalid array length|array buffer)/i],
  ['stale', /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \S+ failed/i],
  ['network', /^(?:TypeError: )?(?:failed to fetch|networkerror|load failed|network request failed)/i],
];

const TEXT: Record<Locale, Record<Kind, string>> = {
  en: {
    memory: 'This file is too big for this device’s memory. Try a smaller file, close other tabs, or use a computer.',
    stale: 'Nhako Tools was updated while this page was open. Reload the page and try again.',
    network: 'The engine for this tool could not be downloaded. Check your connection and try again.',
  },
  ms: {
    memory: 'Fail ini terlalu besar untuk memori peranti ini. Cuba fail yang lebih kecil, tutup tab lain, atau guna komputer.',
    stale: 'Nhako Tools telah dikemas kini semasa halaman ini dibuka. Muat semula halaman dan cuba lagi.',
    network: 'Enjin alat ini tidak dapat dimuat turun. Semak sambungan anda dan cuba lagi.',
  },
};

export function errorKind(err: unknown): Kind | null {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? '');
  for (const [kind, re] of PATTERNS) if (re.test(text) || (err instanceof Error && re.test(err.message))) return kind;
  return null;
}

/** The message to show for a failed run, in the page's language. */
export function friendlyError(err: unknown, locale: Locale, fallback: string): string {
  if (err instanceof ToolError) return err.message;
  const kind = errorKind(err);
  if (kind) return TEXT[locale][kind];
  return err instanceof Error && err.message ? err.message : fallback;
}
