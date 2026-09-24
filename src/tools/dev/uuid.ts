import type { TextRun } from '../types';
import { sayer } from '../say';

export function generate(count: number, { uppercase = false, braces = false } = {}): string[] {
  return Array.from({ length: count }, () => {
    let id: string = crypto.randomUUID();
    if (uppercase) id = id.toUpperCase();
    return braces ? `{${id}}` : id;
  });
}

export const run: TextRun = async (_input, opts) => {
  const say = sayer(opts);
  const n = Math.min(Math.max(Number(opts.count) || 1, 1), 1000);
  const ids = generate(n, { uppercase: Boolean(opts.uppercase), braces: Boolean(opts.braces) });
  return {
    output: ids.join('\n'),
    stats: [
      { label: say('Generated', 'Dijana'), value: String(ids.length) },
      { label: say('Version', 'Versi'), value: say('4 (random)', '4 (rawak)') },
      { label: say('Source', 'Sumber'), value: 'crypto CSPRNG' },
    ],
  };
};
