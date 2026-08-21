import { ToolError } from '../types';

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
export function planBitrate(durationSeconds: number, targetMB: number, audioKbps: number): BitratePlan {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new ToolError('Could not read the video duration. The file may be corrupt or an unsupported container.');
  }
  if (!Number.isFinite(targetMB) || targetMB <= 0) {
    // The old UI bound this to a text input with no validation, so clearing the
    // field produced NaN and a generic "Compression failed" alert.
    throw new ToolError('Enter a target size larger than 0 MB.');
  }
  if (!Number.isFinite(audioKbps) || audioKbps < 0) {
    throw new ToolError('Invalid audio bitrate.');
  }

  // 1 MB = 1024 * 1024 bytes = 8192 kilobits.
  const totalKbps = (targetMB * 8192) / durationSeconds;
  const videoKbps = Math.floor(totalKbps - audioKbps);

  if (videoKbps < MIN_VIDEO_KBPS) {
    const minMB = ((MIN_VIDEO_KBPS + audioKbps) * durationSeconds) / 8192;
    throw new ToolError(
      `${targetMB} MB is too small for ${Math.round(durationSeconds)}s of video. ` +
      `The smallest workable target here is about ${Math.ceil(minMB)} MB.`,
    );
  }

  return {
    videoKbps,
    audioKbps,
    predictedMB: ((videoKbps + audioKbps) * durationSeconds) / 8192,
  };
}
