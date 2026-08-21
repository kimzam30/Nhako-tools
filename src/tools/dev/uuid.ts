import type { TextRun } from '../types';

export function generate(count: number, { uppercase = false, braces = false } = {}): string[] {
  return Array.from({ length: count }, () => {
    let id: string = crypto.randomUUID();
    if (uppercase) id = id.toUpperCase();
    return braces ? `{${id}}` : id;
  });
}

export const run: TextRun = async (_input, opts) => {
  const n = Math.min(Math.max(Number(opts.count) || 1, 1), 1000);
  const ids = generate(n, { uppercase: Boolean(opts.uppercase), braces: Boolean(opts.braces) });
  return {
    output: ids.join('\n'),
    stats: [
      { label: 'Generated', value: String(ids.length) },
      { label: 'Version', value: '4 (random)' },
      { label: 'Source', value: 'crypto CSPRNG' },
    ],
  };
};
