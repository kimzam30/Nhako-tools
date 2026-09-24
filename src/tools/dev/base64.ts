import { ToolError, type TextRun } from '../types';
import { sayer, type Say } from '../say';

/** English on its own, for the unit tests, which have no page locale. */
const englishOnly: Say = sayer({});

const toUrlSafe = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromUrlSafe = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  return b64 + '='.repeat((4 - (b64.length % 4)) % 4);
};

/** Encode UTF-8 text to Base64. Handles multi-byte input correctly. */
export function encode(text: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return urlSafe ? toUrlSafe(b64) : b64;
}

/** Decode Base64 (standard or URL-safe) to UTF-8 text. */
export function decode(b64: string, say: Say = englishOnly): string {
  let bin: string;
  try {
    bin = atob(fromUrlSafe(b64));
  } catch {
    throw new ToolError(say(
      'Not valid Base64. Check for stray characters or truncated input.',
      'Bukan Base64 yang sah. Periksa aksara terpesong atau input terpotong.',
    ));
  }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ToolError(say(
      'Decoded successfully, but the result is not valid UTF-8 text. It may be binary data.',
      'Berjaya dinyahkod, tetapi hasilnya bukan teks UTF-8 yang sah. Ia mungkin data binari.',
    ));
  }
}

export const run: TextRun = async (input, opts) => {
  const say = sayer(opts);
  const urlSafe = Boolean(opts.urlSafe);
  const output = opts.mode === 'decode' ? decode(input, say) : encode(input, urlSafe);
  const ratio = input.length ? Math.round((output.length / input.length) * 100) : 100;
  return {
    output,
    stats: [
      { label: say('In', 'Masuk'), value: say(`${input.length} ch`, `${input.length} aks`) },
      { label: say('Out', 'Keluar'), value: say(`${output.length} ch`, `${output.length} aks`) },
      { label: say('Ratio', 'Nisbah'), value: `${ratio}%` },
    ],
  };
};
