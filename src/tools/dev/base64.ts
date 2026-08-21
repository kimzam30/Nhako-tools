import { ToolError, type TextRun } from '../types';

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
export function decode(b64: string): string {
  let bin: string;
  try {
    bin = atob(fromUrlSafe(b64));
  } catch {
    throw new ToolError('Not valid Base64. Check for stray characters or truncated input.');
  }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ToolError('Decoded successfully, but the result is not valid UTF-8 text. It may be binary data.');
  }
}

export const run: TextRun = async (input, opts) => {
  const urlSafe = Boolean(opts.urlSafe);
  const output = opts.mode === 'decode' ? decode(input) : encode(input, urlSafe);
  const ratio = input.length ? Math.round((output.length / input.length) * 100) : 100;
  return {
    output,
    stats: [
      { label: 'In', value: `${input.length} ch` },
      { label: 'Out', value: `${output.length} ch` },
      { label: 'Ratio', value: `${ratio}%` },
    ],
  };
};
