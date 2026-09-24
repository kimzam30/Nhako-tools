import { ToolError, type FileRun } from '../types';
import { withFiles, onFFmpegProgress } from '../../lib/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { sayer } from '../say';

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));

  const bitrate = String(opts.bitrate ?? '192');
  const input = 'input.bin';
  const output = 'output.mp3';

  onFFmpegProgress((fraction) => ctx.onProgress(fraction, say('Extracting', 'Mengeluarkan')));

  const data = await withFiles({ [input]: await fetchFile(file) }, [output], async (ffmpeg) => {
    const code = await ffmpeg.exec(['-i', input, '-vn', '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`, output]);
    if (code !== 0) throw new ToolError(say(
      'Could not extract audio. The file may have no audio track.',
      'Tidak dapat mengeluarkan audio. Fail mungkin tiada trek audio.',
    ));
    return ffmpeg.readFile(output);
  });

  const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: 'audio/mpeg' });
  return {
    blob,
    filename: file.name.replace(/\.[^/.]+$/, '') + '.mp3',
    summary: say(`${(blob.size / 1024 / 1024).toFixed(1)} MB at ${bitrate} kbps`, `${(blob.size / 1024 / 1024).toFixed(1)} MB pada ${bitrate} kbps`),
  };
};
