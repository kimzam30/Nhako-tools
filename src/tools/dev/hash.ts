import type { TextRun } from '../types';
import { sayer } from '../say';

export type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export async function hash(text: string, algo: Algo): Promise<string> {
  const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const run: TextRun = async (input, opts) => {
  const say = sayer(opts);
  const algo = (opts.algo ?? 'SHA-256') as Algo;
  const digest = await hash(input, algo);
  return {
    output: digest,
    stats: [
      { label: say('Algorithm', 'Algoritma'), value: algo },
      { label: say('Length', 'Panjang'), value: say(`${digest.length * 4} bits`, `${digest.length * 4} bit`) },
      { label: say('Input', 'Input'), value: `${new TextEncoder().encode(input).length} B` },
    ],
  };
};
