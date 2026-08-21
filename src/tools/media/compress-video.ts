import { ToolError, type FileRun } from '../types';
import { withFiles, onFFmpegProgress, probeDuration } from '../../lib/ffmpeg';
import { planBitrate } from './bitrate';
import { fetchFile } from '@ffmpeg/util';

export const run: FileRun = async (files, opts, ctx) => {
  const file = files[0];
  if (!file) throw new ToolError('No file selected.');

  const duration = await probeDuration(file, (label) => ctx.onProgress(0, label));
  const audioChoice = String(opts.audio ?? '128');
  const audioKbps = audioChoice === 'none' ? 0 : Number(audioChoice);
  const plan = planBitrate(duration, Number(opts.targetMB), audioKbps);

  const input = 'input.mp4';
  const output = 'output.mp4';

  onFFmpegProgress((fraction) => ctx.onProgress(fraction, 'Encoding'));

  const data = await withFiles({ [input]: await fetchFile(file) }, [output], async (ffmpeg) => {
    // Audio is re-encoded to a known bitrate rather than copied, so the size
    // arithmetic in planBitrate is actually true of the output.
    const args = [
      '-i', input,
      '-c:v', 'libx264', '-b:v', `${plan.videoKbps}k`,
      '-preset', 'medium',
      ...(audioKbps === 0 ? ['-an'] : ['-c:a', 'aac', '-b:a', `${audioKbps}k`]),
      '-movflags', '+faststart',
      output,
    ];
    if ((await ffmpeg.exec(args)) !== 0) {
      throw new ToolError('The encoder failed on this file. It may use an unsupported codec.');
    }
    return ffmpeg.readFile(output);
  });

  const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: 'video/mp4' });
  const actualMB = blob.size / (1024 * 1024);

  return {
    blob,
    filename: file.name.replace(/\.[^/.]+$/, '') + '-compressed.mp4',
    summary: `${actualMB.toFixed(1)} MB · target was ${opts.targetMB} MB · ${plan.videoKbps}k video`,
  };
};
