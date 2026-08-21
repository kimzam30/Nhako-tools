import type { TextRun } from '../types';

export type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export async function hash(text: string, algo: Algo): Promise<string> {
  const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const run: TextRun = async (input, opts) => {
  const algo = (opts.algo ?? 'SHA-256') as Algo;
  const digest = await hash(input, algo);
  return {
    output: digest,
    stats: [
      { label: 'Algorithm', value: algo },
      { label: 'Length', value: `${digest.length * 4} bits` },
      { label: 'Input', value: `${new TextEncoder().encode(input).length} B` },
    ],
  };
};
