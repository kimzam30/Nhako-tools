import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { sayer, type Say } from '../say';
import { stripMetadata, UnsupportedFormat, type Found } from './metadata';

const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

/** "GPS location 3.13901, 101.68685; camera Apple iPhone 15; taken 2026:09:01 10:22:11" */
export function describe(found: Found, say: Say): string {
  const parts: string[] = [];
  if (found.gps) parts.push(say('GPS location', 'lokasi GPS') + ` ${found.gps.lat.toFixed(5)}, ${found.gps.lon.toFixed(5)}`);
  if (found.camera) parts.push(say('camera', 'kamera') + ` ${found.camera}`);
  if (found.taken) parts.push(say('taken', 'diambil') + ` ${found.taken}`);
  if (found.software) parts.push(say('software', 'perisian') + ` ${found.software}`);
  return parts.join('; ');
}

const cleanName = (name: string) => name.replace(/(\.[^./]+)$/, '-clean$1');

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  if (files.length === 0) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));

  const out: { name: string; blob: Blob; found: Found }[] = [];
  for (const [i, file] of files.entries()) {
    let result;
    try {
      result = stripMetadata(new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      if (err instanceof UnsupportedFormat) {
        throw new ToolError(say(
          `"${file.name}" is not JPG, PNG or WebP. Convert it first.`,
          `"${file.name}" bukan JPG, PNG atau WebP. Tukarkannya dahulu.`,
        ));
      }
      throw err;
    }
    out.push({ name: cleanName(file.name), blob: bytesToBlob(result.bytes, MIME[result.format]), found: result.found });
    ctx.onProgress((i + 1) / files.length);
  }

  const fields = out.reduce((n, o) => n + o.found.fields, 0);
  const withGps = out.filter((o) => o.found.gps).length;
  const nothing = say('No metadata found. The file is unchanged', 'Tiada metadata ditemui. Fail tidak diubah');

  if (out.length === 1) {
    const only = out[0]!;
    const detail = describe(only.found, say);
    return {
      blob: only.blob,
      filename: only.name,
      summary: fields === 0 ? nothing : [
        say(`Removed ${fields} field${fields === 1 ? '' : 's'}, image untouched`, `${fields} medan dibuang, imej tidak diubah`),
        detail,
      ].filter(Boolean).join('; '),
    };
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const o of out) zip.file(o.name, o.blob);
  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    filename: 'clean-images.zip',
    summary: fields === 0 ? nothing : say(
      `${out.length} images, ${fields} fields removed${withGps ? `, ${withGps} had a GPS location` : ''}`,
      `${out.length} imej, ${fields} medan dibuang${withGps ? `, ${withGps} ada lokasi GPS` : ''}`,
    ),
  };
};
