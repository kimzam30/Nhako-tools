import { ToolError, type FileRun } from '../types';
import { withFiles, onFFmpegProgress, probeDuration } from '../../lib/ffmpeg';
import { fitResolution, planBitrate } from './bitrate';
import { encodeWithWebCodecs, readVideoFacts } from './webcodecs-video';
import { fetchFile } from '@ffmpeg/util';
import { sayer } from '../say';

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));

  const facts = await readVideoFacts(file);
  const duration = facts?.duration ?? await probeDuration(file, (label) => ctx.onProgress(0, label), say);
  const audioChoice = String(opts.audio ?? '128');
  const audioKbps = audioChoice === 'none' || facts?.hasAudio === false ? 0 : Number(audioChoice);
  const targetMB = Number(opts.targetMB);
  const plan = planBitrate(duration, targetMB, audioKbps, say);
  const target = targetMB * 1_000_000;
  const size = facts ? fitResolution(facts.width, facts.height, facts.fps, plan.videoKbps) : null;
  const shrunk = facts && size && Math.min(size.width, size.height) < Math.min(facts.width, facts.height)
    ? say(`, resized to ${Math.min(size.width, size.height)}p`, `, dikecilkan ke ${Math.min(size.width, size.height)}p`)
    : '';
  const summary = (blob: Blob, videoKbps: number, engine: string) => say(
    `${(blob.size / 1e6).toFixed(1)} MB (target ${targetMB} MB)${shrunk}, ${videoKbps}k video, ${engine}`,
    `${(blob.size / 1e6).toFixed(1)} MB (sasaran ${targetMB} MB)${shrunk}, video ${videoKbps}k, ${engine}`,
  );
  const filename = file.name.replace(/\.[^/.]+$/, '') + '-compressed.mp4';

  // The device's own encoder first: many times faster than ffmpeg.wasm.
  if (facts && size) {
    const encode = (videoKbps: number, from: number, span: number) => encodeWithWebCodecs(file, {
      videoKbps, audioKbps, width: size.width, height: size.height,
      onProgress: (f) => ctx.onProgress(from + f * span, say('Encoding on this device\'s video encoder', 'Mengekod dengan pengekod video peranti ini')),
    });
    let videoKbps = plan.videoKbps;
    let blob = await encode(videoKbps, 0, 1);
    // Hardware rate control is looser than x264's. One corrective pass,
    // aimed by how far the first one missed, keeps the promise of the target.
    if (blob && blob.size > target) {
      videoKbps = Math.max(64, Math.floor((videoKbps + audioKbps) * (target * 0.97 / blob.size) - audioKbps));
      blob = await encode(videoKbps, 0.5, 0.5);
    }
    if (blob && blob.size <= target) {
      return { blob, filename, summary: summary(blob, videoKbps, say("this device's encoder", 'pengekod peranti ini')) };
    }
  }

  const input = 'input.mp4';
  const output = 'output.mp4';

  onFFmpegProgress((fraction) => ctx.onProgress(fraction, say('Encoding', 'Mengekod')));

  const data = await withFiles({ [input]: await fetchFile(file) }, [output], async (ffmpeg) => {
    // Audio is re-encoded to a known bitrate rather than copied, so the size
    // arithmetic in planBitrate is actually true of the output.
    const args = [
      '-i', input,
      '-c:v', 'libx264', '-b:v', `${plan.videoKbps}k`,
      // 8-bit 4:2:0 is what browsers, QuickTime and chat apps can play. A
      // 10-bit or 4:4:4 source (screen recordings, iPhone HDR) otherwise
      // becomes a High 4:4:4 file many players refuse. 4:2:0 needs even
      // dimensions, hence the scale.
      '-pix_fmt', 'yuv420p', '-vf', size ? `scale=${size.width}:${size.height}` : 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-preset', 'medium',
      ...(audioKbps === 0 ? ['-an'] : ['-c:a', 'aac', '-b:a', `${audioKbps}k`]),
      '-movflags', '+faststart',
      output,
    ];
    if ((await ffmpeg.exec(args)) !== 0) {
      throw new ToolError(say(
        'The encoder failed on this file. It may use an unsupported codec.',
        'Pengekod gagal pada fail ini. Ia mungkin menggunakan kodek yang tidak disokong.',
      ));
    }
    return ffmpeg.readFile(output);
  });

  const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: 'video/mp4' });
  return { blob, filename, summary: summary(blob, plan.videoKbps, 'ffmpeg') };
};
