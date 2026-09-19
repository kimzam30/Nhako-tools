/**
 * Two locales. English lives at the root (existing URLs and their search
 * equity stay put); Bahasa Melayu mirrors every page under /ms.
 */
export type Locale = 'en' | 'ms';

export const LOCALES: readonly Locale[] = ['en', 'ms'];

/** Value for <html lang> and hreflang. */
export const LANG: Record<Locale, string> = { en: 'en', ms: 'ms' };

/** '/pdf/merge' -> '/ms/pdf/merge'; '/' -> '/ms' (no trailing slashes anywhere). */
export function localePath(locale: Locale, path: string): string {
  if (locale === 'en') return path;
  return path === '/' ? '/ms' : `/ms${path}`;
}

export function localeFromPath(pathname: string): Locale {
  return pathname === '/ms' || pathname.startsWith('/ms/') ? 'ms' : 'en';
}
