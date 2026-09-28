/**
 * Video compression on the device's own video encoder, through WebCodecs.
 *
 * ffmpeg.wasm encodes H.264 in software, in WebAssembly, on one core: a real
 * 60 s 720p clip took 7 m 35 s (0.13x real time). WebCodecs hands the same
 * job to the encoder the phone or laptop already has, the one its camera and
 * screen recorder use, which is what Clipchamp and Canva do in the browser.
 *
 * Mediabunny (MPL-2.0) does the demuxing, the WebCodecs plumbing and the MP4
 * writing. Where the browser has no AAC encoder (Chrome on Linux, some
 * Firefox builds), its libavcodec-based AAC extension fills in, so the output
 * is always H.264 + AAC in MP4, which every phone, QuickTime and chat app plays.
 *
 * Returns null whenever this path cannot do the job (no WebCodecs, a codec
 * the device cannot decode, an encoder that refuses the settings), and the
 * caller falls back to ffmpeg.wasm. It never half-does a file.
 */
import type { InputVideoTrack } from 'mediabunny';

export interface VideoFacts { duration: number; width: number; height: number; fps: number; hasAudio: boolean }

/** What the container says, without decoding a frame. Null if it cannot be read. */
export async function readVideoFacts(file: File): Promise<VideoFacts | null> {
  try {
    const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const video = await input.getPrimaryVideoTrack();
    if (!video) return null;
    const duration = await input.computeDuration();
    const stats = await video.computePacketStats(120).catch(() => null);
    const audio = await input.getPrimaryAudioTrack();
    return {
      duration,
      width: await video.getDisplayWidth(),
      height: await video.getDisplayHeight(),
      fps: stats?.averagePacketRate ?? 30,
      hasAudio: Boolean(audio),
    };
  } catch {
    return null;
  }
}

export interface EncodePlan {
  videoKbps: number;
  /** 0 drops the audio. */
  audioKbps: number;
  width: number;
  height: number;
  onProgress?: (fraction: number) => void;
}

export async function encodeWithWebCodecs(file: File, plan: EncodePlan): Promise<Blob | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return null;
  try {
    const mb = await import('mediabunny');
    const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS, canEncodeVideo, canEncodeAudio } = mb;
    if (!(await canEncodeVideo('avc', { width: plan.width, height: plan.height, bitrate: plan.videoKbps * 1000 }))) {
      console.warn('[video] no H.264 encoder for', plan.width, 'x', plan.height);
      return null;
    }
    if (plan.audioKbps > 0 && !(await canEncodeAudio('aac', { bitrate: plan.audioKbps * 1000 }))) {
      const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
      registerAacEncoder();
    }

    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: async (track: InputVideoTrack) => ({
        codec: 'avc',
        bitrate: plan.videoKbps * 1000,
        // Sized by the short side, whichever way the phone was held.
        ...((await track.getDisplayWidth()) >= (await track.getDisplayHeight())
          ? { width: plan.width }
          : { height: plan.height }),
        // A key frame every 2 s: seekable in any player, cheap in bits.
        keyFrameInterval: 2,
        // Not 'prefer-hardware': a device with no hardware H.264 encoder (a VM,
        // headless Chrome) then refuses outright, where 'no-preference' falls
        // back to the browser's own native encoder, still far faster than wasm.
        hardwareAcceleration: 'no-preference',
        forceTranscode: true,
      }),
      audio: plan.audioKbps === 0
        ? { discard: true }
        : { codec: 'aac', bitrate: plan.audioKbps * 1000, forceTranscode: true },
    });
    // A discarded VIDEO track means this path cannot read the source.
    if (!conversion.isValid || conversion.discardedTracks.some((d) => d.track.type === 'video')) {
      console.warn('[video] conversion not possible:', conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join('; '));
      return null;
    }
    conversion.onProgress = (p) => plan.onProgress?.(p);
    await conversion.execute();
    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
    if (!buffer || buffer.byteLength === 0) return null;
    return new Blob([buffer], { type: 'video/mp4' });
  } catch (err) {
    // Said once in the console, so a fallback is diagnosable without being noisy.
    console.warn('[video] device encoder unavailable, falling back to ffmpeg.wasm:', err);
    return null;
  }
}
