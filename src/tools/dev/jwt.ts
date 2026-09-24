import { ToolError, type TextRun } from '../types';
import { decode as b64decode } from './base64';
import { sayer, type Say } from '../say';

const TIME_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at']);

function describeTime(seconds: number, say: Say): string {
  const ms = seconds * 1000;
  // Beyond +/-8.64e15 ms a Date is invalid and toISOString throws.
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return say('not a valid date', 'bukan tarikh yang sah');
  const iso = new Date(ms).toISOString().replace('.000Z', 'Z');
  const delta = ms - Date.now();
  const abs = Math.abs(delta);
  const unit =
    abs < 60_000 ? `${Math.round(abs / 1000)}s` :
    abs < 3_600_000 ? `${Math.round(abs / 60_000)}m` :
    abs < 86_400_000 ? `${Math.round(abs / 3_600_000)}h` :
    `${Math.round(abs / 86_400_000)}d`;
  return `${iso}  (${delta < 0 ? say(`${unit} ago`, `${unit} lalu`) : say(`in ${unit}`, `dalam ${unit}`)})`;
}

function annotate(claims: Record<string, unknown>, say: Say): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(claims)) {
    out[k] = v;
    if (TIME_CLAIMS.has(k) && typeof v === 'number') out[`${k} →`] = describeTime(v, say);
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Decode one segment. Both must be JSON objects; `null` or `[]` used to crash. */
function decodePart(segment: string, name: 'header' | 'payload', say: Say): Record<string, unknown> {
  const part = say(name, name === 'header' ? 'pengepala' : 'muatan');
  let value: unknown;
  try {
    value = JSON.parse(b64decode(segment));
  } catch {
    throw new ToolError(say(
      `The ${part} is not valid Base64-encoded JSON.`,
      `${part[0]!.toUpperCase()}${part.slice(1)} bukan JSON berkod Base64 yang sah.`,
    ));
  }
  if (!isObject(value)) {
    throw new ToolError(say(
      `The ${part} decodes to JSON, but not to an object, so this is not a JWT.`,
      `${part[0]!.toUpperCase()}${part.slice(1)} dinyahkod kepada JSON, tetapi bukan objek, jadi ini bukan JWT.`,
    ));
  }
  return value;
}

export const run: TextRun = async (input, opts) => {
  const say = sayer(opts);
  const token = input.trim().replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ToolError(say(
      `A JWT has three dot-separated parts; this has ${parts.length}. ` +
      (parts.length < 3 ? 'It may be truncated.' : 'It may have extra content appended.'),
      `JWT mempunyai tiga bahagian dipisahkan titik; ini mempunyai ${parts.length}. ` +
      (parts.length < 3 ? 'Ia mungkin terpotong.' : 'Ia mungkin mempunyai kandungan tambahan di hujungnya.'),
    ));
  }

  const header = decodePart(parts[0]!, 'header', say);
  const payload = decodePart(parts[1]!, 'payload', say);

  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  const expired = exp !== null && exp * 1000 < Date.now();

  return {
    output: JSON.stringify({ header, payload: annotate(payload, say) }, null, 2),
    language: 'json',
    stats: [
      { label: say('Algorithm', 'Algoritma'), value: String(header.alg ?? 'n/a') },
      { label: say('Type', 'Jenis'), value: String(header.typ ?? 'n/a') },
      {
        label: say('Status', 'Status'),
        value: exp === null
          ? say('no expiry', 'tiada tamat tempoh')
          : expired ? say('EXPIRED', 'TAMAT TEMPOH') : say('valid', 'sah'),
      },
      { label: say('Signature', 'Tandatangan'), value: say('not verified', 'tidak disahkan') },
    ],
  };
};
