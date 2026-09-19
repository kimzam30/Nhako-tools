import type JSZipType from 'jszip';
import { formatOf, type Encodable } from '../../lib/canvas';

/** Keep the file's own format where a canvas can write it; otherwise JPG. */
export function sameFormat(file: File): Encodable {
  const own = formatOf(file);
  return own && own !== 'image/avif' ? own : 'image/jpeg';
}

/** One file as itself, several as a ZIP. */
export async function bundle(items: { name: string; blob: Blob }[], zipName: string) {
  if (items.length === 1) return items[0]!;
  const JSZip = (await import('jszip')).default as typeof JSZipType;
  const zip = new JSZip();
  for (const it of items) zip.file(it.name, it.blob);
  return { name: zipName, blob: await zip.generateAsync({ type: 'blob' }) };
}
