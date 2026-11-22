import { ToolError, type FileRun } from '../types';
import { withFiles, onFFmpegProgress } from '../../lib/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { sayer } from '../say';
import { assertFits } from '../../lib/memory';
import { formatTime, parseTime } from './timecode';

/**
 * Video to GIF, the way people expect it to look: one palette built for the
 * clip (palettegen), then applied with light dithering (paletteuse), so skin
 * and skies do not band the way a fixed 256-colour palette makes them.
 */

export const MAX_SECONDS = 30;

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));

  const start = parseTime(String(opts.start ?? '')) ?? 0;
  const length = Number(opts.length ?? 5);
  const width = Number(opts.width ?? 480);
  const fps = Number(opts.fps ?? 12);
  if (Number.isNaN(start)) {
    throw new ToolError(say('The start must look like 90, 1:30 or 1:02:30.', 'Masa mula mesti seperti 90, 1:30 atau 1:02:30.'));
  }
  if (!(length > 0 && length <= MAX_SECONDS)) {
    throw new ToolError(say(
      `A GIF can be up to ${MAX_SECONDS} seconds long here. Longer GIFs get too large to share.`,
      `GIF boleh sehingga ${MAX_SECONDS} saat di sini. GIF lebih panjang menjadi terlalu besar untuk dikongsi.`,
    ));
  }

  assertFits(file.size * 2.2, say('This video', 'Video ini'), say);
  onFFmpegProgress((fraction) => ctx.onProgress(fraction, say('Making the GIF', 'Membuat GIF')));

  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'mp4').toLowerCase();
  const input = `input.${ext}`;
  const output = 'output.gif';
  const filter = `fps=${fps},scale=${width}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`;
  const data = await withFiles({ [input]: await fetchFile(file) }, [output], async (ffmpeg) => {
    const code = await ffmpeg.exec([
      ...(start > 0 ? ['-ss', String(start)] : []),
      '-t', String(length), '-i', input, '-vf', filter, '-loop', '0', output,
    ]);
    if (code !== 0) throw new ToolError(say(
      'Could not make a GIF from this video. It may be damaged or in a format the browser engine cannot read.',
      'Tidak dapat membuat GIF daripada video ini. Ia mungkin rosak atau dalam format yang tidak dapat dibaca.',
    ));
    return ffmpeg.readFile(output);
  });
  onFFmpegProgress(null);

  const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: 'image/gif' });
  if (blob.size < 100) {
    throw new ToolError(say(
      'The GIF came out empty. Check that the start time is inside the video.',
      'GIF kosong. Semak bahawa masa mula berada dalam video.',
    ));
  }
  return {
    blob,
    filename: file.name.replace(/\.[^/.]+$/, '') + '.gif',
    summary: say(
      `${length} s from ${formatTime(start)}, ${width} px wide at ${fps} fps, ${(blob.size / 1e6).toFixed(1)} MB`,
      `${length} saat dari ${formatTime(start)}, lebar ${width} px pada ${fps} fps, ${(blob.size / 1e6).toFixed(1)} MB`,
    ),
  };
};
