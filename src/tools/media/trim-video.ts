import { ToolError, type FileRun } from '../types';
import { withFiles, onFFmpegProgress, probeDuration } from '../../lib/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { sayer } from '../say';
import { assertFits } from '../../lib/memory';
import { formatTime, parseTime } from './timecode';

/**
 * Trim a video, and optionally remove its sound.
 *
 * MP4 and MOV go through mediabunny on the device's own video encoder: it
 * copies the stream where the cut lands on a keyframe and re-encodes only
 * what it must, so the cut is exact to the frame and fast. Anything else, or
 * a browser without WebCodecs, falls back to an ffmpeg stream copy, which is
 * instant but can only start on a keyframe; the summary says which happened.
 */

const EXACT_INPUTS = new Set(['mp4', 'm4v', 'mov']);

/** Exact trim with mediabunny, or null when this browser cannot do it. */
async function exactTrim(file: File, start: number, end: number | null, mute: boolean, onProgress: (f: number) => void): Promise<Blob | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return null;
  try {
    const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS } = await import('mediabunny');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: { hardwareAcceleration: 'no-preference' },
      audio: mute ? { discard: true } : {},
      trim: { start, ...(end !== null ? { end } : {}) },
      // Copy only where that keeps the cut exact; re-encode the rest.
      copy: { boundaryTolerance: 0 },
      showWarnings: false,
    });
    if (!conversion.isValid || conversion.discardedTracks.some((d) => d.track.type === 'video')) return null;
    conversion.onProgress = onProgress;
    await conversion.execute();
    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
    return buffer && buffer.byteLength > 0 ? new Blob([buffer], { type: 'video/mp4' }) : null;
  } catch (err) {
    console.warn('[trim] exact path unavailable, falling back to a keyframe cut:', err);
    return null;
  }
}

const CONTAINERS: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' };

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));

  const start = parseTime(String(opts.start ?? '')) ?? 0;
  const end = parseTime(String(opts.end ?? ''));
  const mute = Boolean(opts.mute);
  if (Number.isNaN(start) || (end !== null && Number.isNaN(end))) {
    throw new ToolError(say(
      'Times must look like 90, 1:30 or 1:02:30.',
      'Masa mesti seperti 90, 1:30 atau 1:02:30.',
    ));
  }
  if (end !== null && end <= start) {
    throw new ToolError(say('The end must come after the start.', 'Penghujung mesti selepas permulaan.'));
  }
  if (start === 0 && end === null && !mute) {
    throw new ToolError(say(
      'Set a start or end time, or tick Remove sound: as it stands the video would come back unchanged.',
      'Tetapkan masa mula atau tamat, atau tandakan Buang bunyi: jika tidak, video akan kembali tanpa perubahan.',
    ));
  }

  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'mp4').toLowerCase();
  const outExt = CONTAINERS[ext] ? ext : 'mp4';
  const duration = await probeDuration(file, (label) => ctx.onProgress(0.02, label), say).catch(() => NaN);
  if (Number.isFinite(duration) && start >= duration) {
    throw new ToolError(say(
      `The video is only ${formatTime(duration)} long, so it cannot start at ${formatTime(start)}.`,
      `Video ini hanya ${formatTime(duration)} panjang, jadi ia tidak boleh bermula pada ${formatTime(start)}.`,
    ));
  }

  const to = end ?? (Number.isFinite(duration) ? duration : null);
  const span = to === null ? say(`from ${formatTime(start)}`, `dari ${formatTime(start)}`) : `${formatTime(start)}–${formatTime(to)}`;
  const base = file.name.replace(/\.[^/.]+$/, '') + (mute ? '-muted' : '') + (start || end !== null ? '-trimmed' : '');
  const describe = (blob: Blob, how: string) => [
    start || end !== null ? span : '', mute ? say('sound removed', 'bunyi dibuang') : '', how, `${(blob.size / 1e6).toFixed(1)} MB`,
  ].filter(Boolean).join(', ');

  if (EXACT_INPUTS.has(ext)) {
    const exact = await exactTrim(file, start, end, mute, (f) => ctx.onProgress(f, say('Trimming on this device', 'Memotong pada peranti ini')));
    if (exact) return { blob: exact, filename: `${base}.mp4`, summary: describe(exact, say('cut exactly', 'dipotong tepat')) };
  }

  assertFits(file.size * 2.2, say('This video', 'Video ini'), say);
  onFFmpegProgress((fraction) => ctx.onProgress(fraction, say('Trimming', 'Memotong')));

  const input = `input.${ext}`;
  const output = `output.${outExt}`;
  const args = [
    ...(start > 0 ? ['-ss', String(start)] : []),
    // A length, not '-to': after an input seek, ffmpeg counts '-to' from the
    // new start, so '-to 6' after '-ss 2' would keep 2-8, not 2-6.
    ...(end !== null ? ['-t', String(end - start)] : []),
    '-i', input,
    '-map', '0:v?', ...(mute ? [] : ['-map', '0:a?']),
    '-c', 'copy', ...(mute ? ['-an'] : []),
    '-avoid_negative_ts', 'make_zero',
    ...(outExt === 'mp4' || outExt === 'm4v' || outExt === 'mov' ? ['-movflags', '+faststart'] : []),
    output,
  ];
  const data = await withFiles({ [input]: await fetchFile(file) }, [output], async (ffmpeg) => {
    const code = await ffmpeg.exec(args);
    if (code !== 0) throw new ToolError(say(
      'Could not trim this video. Its format may not allow cutting without re-encoding; try converting it to MP4 first.',
      'Tidak dapat memotong video ini. Formatnya mungkin tidak membenarkan pemotongan tanpa pengekodan semula; cuba tukar ke MP4 dahulu.',
    ));
    return ffmpeg.readFile(output);
  });
  onFFmpegProgress(null);

  const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: CONTAINERS[outExt] ?? 'video/mp4' });
  if (blob.size < 1024) {
    throw new ToolError(say(
      'The result came out empty. Check that the start time is inside the video.',
      'Hasilnya kosong. Semak bahawa masa mula berada dalam video.',
    ));
  }
  return {
    blob,
    filename: `${base}.${outExt}`,
    summary: describe(blob, start > 0 ? say('cut at the nearest keyframe, so it may start a little early', 'dipotong pada bingkai utama terdekat, jadi mungkin bermula lebih awal sedikit') : ''),
  };
};
