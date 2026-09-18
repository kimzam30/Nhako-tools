import { ToolError, type TextRun } from '../types';
import { decode as b64decode } from './base64';

const TIME_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at']);

function describeTime(seconds: number): string {
  const ms = seconds * 1000;
  // Beyond +/-8.64e15 ms a Date is invalid and toISOString throws.
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return 'not a valid date';
  const iso = new Date(ms).toISOString().replace('.000Z', 'Z');
  const delta = ms - Date.now();
  const abs = Math.abs(delta);
  const unit =
    abs < 60_000 ? `${Math.round(abs / 1000)}s` :
    abs < 3_600_000 ? `${Math.round(abs / 60_000)}m` :
    abs < 86_400_000 ? `${Math.round(abs / 3_600_000)}h` :
    `${Math.round(abs / 86_400_000)}d`;
  return `${iso}  (${delta < 0 ? `${unit} ago` : `in ${unit}`})`;
}

function annotate(claims: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(claims)) {
    out[k] = v;
    if (TIME_CLAIMS.has(k) && typeof v === 'number') out[`${k} →`] = describeTime(v);
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Decode one segment. Both must be JSON objects; `null` or `[]` used to crash. */
function decodePart(segment: string, name: 'header' | 'payload'): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(b64decode(segment));
  } catch {
    throw new ToolError(`The ${name} is not valid Base64-encoded JSON.`);
  }
  if (!isObject(value)) throw new ToolError(`The ${name} decodes to JSON, but not to an object, so this is not a JWT.`);
  return value;
}

export const run: TextRun = async (input) => {
  const token = input.trim().replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ToolError(
      `A JWT has three dot-separated parts; this has ${parts.length}. ` +
      (parts.length < 3 ? 'It may be truncated.' : 'It may have extra content appended.'),
    );
  }

  const header = decodePart(parts[0]!, 'header');
  const payload = decodePart(parts[1]!, 'payload');

  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  const expired = exp !== null && exp * 1000 < Date.now();

  return {
    output: JSON.stringify({ header, payload: annotate(payload) }, null, 2),
    language: 'json',
    stats: [
      { label: 'Algorithm', value: String(header.alg ?? 'n/a') },
      { label: 'Type', value: String(header.typ ?? 'n/a') },
      { label: 'Status', value: exp === null ? 'no expiry' : expired ? 'EXPIRED' : 'valid' },
      { label: 'Signature', value: 'not verified' },
    ],
  };
};
