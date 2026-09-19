import type { OptionValues } from './types';

/**
 * Pick the English or Malay wording for a tool's own messages. The runner
 * passes the page's locale in the options (FileToolRunner), so a summary or
 * error reads in the same language as the page around it.
 */
export const sayer = (opts: OptionValues) => (en: string, ms: string): string => (opts.locale === 'ms' ? ms : en);

export type Say = ReturnType<typeof sayer>;
