/**
 * Find the best encoding that fits under a byte budget.
 *
 * Upload portals (SSM, SPA, universities) reject anything over a fixed size,
 * so "a bit smaller" is not enough: the file has to land under the line. The
 * search keeps full resolution for as long as possible and only lowers
 * quality within that, because a sharp image at 60% quality reads better than
 * a soft one at 90%. When even the lowest acceptable quality is too big, it
 * steps the resolution down and searches again.
 */

export interface FitAttempt {
  blob: Blob;
  quality: number;
  scale: number;
}

export interface FitResult extends FitAttempt {
  /** False when nothing reached the target; `blob` is then the smallest found. */
  fits: boolean;
  /** Encodings tried, for tests and for the progress label. */
  attempts: number;
}

export interface FitOptions {
  minQuality?: number;
  maxQuality?: number;
  /** Resolution steps, largest first. */
  scales?: readonly number[];
  /** Quality bisection steps per resolution. */
  steps?: number;
  onAttempt?: (attempt: FitAttempt, index: number) => void;
}

export const DEFAULT_SCALES = [1, 0.85, 0.7, 0.55, 0.42, 0.32, 0.24, 0.18] as const;

export async function fitToSize(
  encode: (quality: number, scale: number) => Promise<Blob>,
  targetBytes: number,
  { minQuality = 0.4, maxQuality = 0.92, scales = DEFAULT_SCALES, steps = 5, onAttempt }: FitOptions = {},
): Promise<FitResult> {
  let attempts = 0;
  let smallest: FitAttempt | null = null;

  const tryOne = async (quality: number, scale: number): Promise<FitAttempt> => {
    const blob = await encode(quality, scale);
    const attempt = { blob, quality, scale };
    onAttempt?.(attempt, attempts);
    attempts++;
    if (!smallest || blob.size < smallest.blob.size) smallest = attempt;
    return attempt;
  };

  for (const scale of scales) {
    const top = await tryOne(maxQuality, scale);
    if (top.blob.size <= targetBytes) return { ...top, fits: true, attempts };

    const bottom = await tryOne(minQuality, scale);
    if (bottom.blob.size > targetBytes) continue; // too big even at the floor: go smaller

    // The answer lies between: bisect for the highest quality that fits.
    let best = bottom;
    let lo = minQuality;
    let hi = maxQuality;
    for (let i = 0; i < steps; i++) {
      const mid = Math.round(((lo + hi) / 2) * 100) / 100;
      if (mid <= lo || mid >= hi) break;
      const attempt = await tryOne(mid, scale);
      if (attempt.blob.size <= targetBytes) { best = attempt; lo = mid; } else { hi = mid; }
    }
    return { ...best, fits: true, attempts };
  }

  // Nothing fitted. smallest is set: the loop always encodes at least once.
  return { ...(smallest as unknown as FitAttempt), fits: false, attempts };
}

/**
 * Portals disagree on whether a KB is 1,000 or 1,024 bytes. Aiming for the
 * 1,000-byte reading passes both.
 */
export const kbToBytes = (kb: number) => kb * 1000;

/** "498,512 bytes": exact, so it can be compared with a portal's limit. */
export const exactBytes = (n: number) => `${n.toLocaleString('en-US')} bytes`;

/** "500 KB", "1 MB": the way upload portals state their limits. */
export function targetLabel(kb: number): string {
  return kb >= 1000 && kb % 1000 === 0 ? `${kb / 1000} MB` : `${kb} KB`;
}
