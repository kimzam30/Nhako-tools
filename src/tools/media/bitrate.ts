import { ToolError } from '../types';
import { sayer, type Say } from '../say';

/** English on its own, for the unit tests, which have no page locale. */
const englishOnly: Say = sayer({});

export interface BitratePlan {
  videoKbps: number;
  audioKbps: number;
  /** What the plan actually predicts, so the UI can be honest about it. */
  predictedMB: number;
}

/** Floor below which output is unwatchable; better to say so than to produce mush. */
const MIN_VIDEO_KBPS = 64;

/**
 * Work out the bitrates needed to land on a target file size.
 *
 * The old implementation subtracted a hardcoded 128 kbps for audio but then
 * passed `-c:a copy`, so the source's real audio bitrate was preserved and the
 * arithmetic was wrong whenever it was not exactly 128. A 320 kbps source
 * overshot the target by the difference on every single encode. Here the audio
 * bitrate is an explicit input AND is what gets encoded, so the sum is real.
 */
export function planBitrate(durationSeconds: number, targetMB: number, audioKbps: number, say: Say = englishOnly): BitratePlan {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new ToolError(say(
      'Could not read the video duration. The file may be corrupt or an unsupported container.',
      'Tidak dapat membaca tempoh video. Fail mungkin rosak atau bekas yang tidak disokong.',
    ));
  }
  if (!Number.isFinite(targetMB) || targetMB <= 0) {
    // The old UI bound this to a text input with no validation, so clearing the
    // field produced NaN and a generic "Compression failed" alert.
    throw new ToolError(say('Enter a target size larger than 0 MB.', 'Masukkan saiz sasaran lebih besar daripada 0 MB.'));
  }
  if (!Number.isFinite(audioKbps) || audioKbps < 0) {
    throw new ToolError(say('Invalid audio bitrate.', 'Kadar bit audio tidak sah.'));
  }

  // 1 MB = 1,000,000 bytes = 8000 kilobits: the way upload portals, chat
  // apps and the other tools here count, so a file for "under 8 MB" passes
  // however the other end counts. It used to be 1024 x 1024, and a real
  // 60 s clip for an 8 MB target came out at 8,340,000 bytes.
  // HEADROOM covers the container and the encoder's rate control, which
  // overshoots a single-pass bitrate by a few percent.
  const totalKbps = (targetMB * 8000 * HEADROOM) / durationSeconds;
  const videoKbps = Math.floor(totalKbps - audioKbps);

  if (videoKbps < MIN_VIDEO_KBPS) {
    const minMB = ((MIN_VIDEO_KBPS + audioKbps) * durationSeconds) / (8000 * HEADROOM);
    throw new ToolError(say(
      `${targetMB} MB is too small for ${Math.round(durationSeconds)}s of video. ` +
      `The smallest workable target here is about ${Math.ceil(minMB)} MB.`,
      `${targetMB} MB terlalu kecil untuk video ${Math.round(durationSeconds)}s. ` +
      `Sasaran terkecil yang boleh digunakan di sini adalah kira-kira ${Math.ceil(minMB)} MB.`,
    ));
  }

  return {
    videoKbps,
    audioKbps,
    predictedMB: ((videoKbps + audioKbps) * durationSeconds) / 8000,
  };
}

/** Share of the target the encode aims at; see planBitrate. */
export const HEADROOM = 0.96;

/**
 * Below about this many bits per pixel per frame, H.264 turns to mush, and a
 * smaller picture at the same bitrate looks better than a blocky big one.
 * 720p at 30 fps and 1 Mbps sits right at it.
 */
const MIN_BPP = 0.035;
const HEIGHTS = [2160, 1440, 1080, 720, 540, 480, 360, 240];

/**
 * The largest standard size, no bigger than the source, that the bitrate can
 * fill: what 8mb.video and HandBrake's presets do instead of starving a 4K
 * frame. Dimensions stay even, which 4:2:0 needs.
 */
export function fitResolution(width: number, height: number, fps: number, videoKbps: number): { width: number; height: number } {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const short = Math.min(width, height);
  const rate = Number.isFinite(fps) && fps > 0 ? Math.min(fps, 60) : 30;
  for (const h of HEIGHTS) {
    if (h > short) continue;
    const k = h / short;
    const bpp = (videoKbps * 1000) / (width * k * height * k * rate);
    if (bpp >= MIN_BPP || h === HEIGHTS[HEIGHTS.length - 1]) return { width: even(width * k), height: even(height * k) };
  }
  return { width: even(width), height: even(height) };
}
