import { ToolError, type FileRun } from '../types';
import { withFiles, onFFmpegProgress } from '../../lib/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export const run: FileRun = async (files, opts, ctx) => {
  const file = files[0];
  if (!file) throw new ToolError('No file selected.');

  const bitrate = String(opts.bitrate ?? '192');
  const input = 'input.bin';
  const output = 'output.mp3';

  onFFmpegProgress((fraction) => ctx.onProgress(fraction, 'Extracting'));

  const data = await withFiles({ [input]: await fetchFile(file) }, [output], async (ffmpeg) => {
    const code = await ffmpeg.exec(['-i', input, '-vn', '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`, output]);
    if (code !== 0) throw new ToolError('Could not extract audio. The file may have no audio track.');
    return ffmpeg.readFile(output);
  });

  const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: 'audio/mpeg' });
  return {
    blob,
    filename: file.name.replace(/\.[^/.]+$/, '') + '.mp3',
    summary: `${(blob.size / 1024 / 1024).toFixed(1)} MB at ${bitrate} kbps`,
  };
};
