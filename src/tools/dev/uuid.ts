import type { TextRun } from '../types';
import { sayer } from '../say';

/**
 * UUID version 7 (RFC 9562, 2024): the first 48 bits are the Unix time in
 * milliseconds, the rest random. Ids made later sort later, so a database
 * index stays in insertion order, which is why v7 is now the recommended
 * choice for keys. Within one millisecond the random part keeps them unique
 * but not ordered, as the RFC allows.
 */
export function uuidv7(now = Date.now()): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  const ms = BigInt(now);
  for (let i = 0; i < 6; i++) b[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  b[6] = (b[6]! & 0x0f) | 0x70; // version 7
  b[8] = (b[8]! & 0x3f) | 0x80; // RFC variant
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function generate(count: number, { uppercase = false, braces = false, version = '4' } = {}): string[] {
  return Array.from({ length: count }, () => {
    let id: string = version === '7' ? uuidv7() : crypto.randomUUID();
    if (uppercase) id = id.toUpperCase();
    return braces ? `{${id}}` : id;
  });
}

export const run: TextRun = async (_input, opts) => {
  const say = sayer(opts);
  const n = Math.min(Math.max(Number(opts.count) || 1, 1), 1000);
  const version = opts.version === '7' ? '7' : '4';
  const ids = generate(n, { uppercase: Boolean(opts.uppercase), braces: Boolean(opts.braces), version });
  return {
    output: ids.join('\n'),
    stats: [
      { label: say('Generated', 'Dijana'), value: String(ids.length) },
      { label: say('Version', 'Versi'), value: version === '7' ? say('7 (time-ordered)', '7 (tersusun masa)') : say('4 (random)', '4 (rawak)') },
      { label: say('Source', 'Sumber'), value: 'crypto CSPRNG' },
    ],
  };
};
