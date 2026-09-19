import { ToolError, type FileRun } from '../types';
import { surface, toBlob, replaceExtension, type Encodable } from '../../lib/canvas';
import { sayer } from '../say';
import { bundle } from './output';

type Heif = {
  HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] };
};
interface HeifImage {
  get_width(): number;
  get_height(): number;
  is_primary?(): boolean;
  display(target: ImageData, done: (result: ImageData | null) => void): void;
}

let lib: Promise<Heif> | null = null;

/**
 * libheif (LGPL-3.0), self-hosted and loaded only when the browser cannot
 * decode HEIC itself. Safari can, so on an iPhone this never downloads.
 */
function libheif(): Promise<Heif> {
  lib ??= (async () => {
    const [{ default: factory }, wasm] = await Promise.all([
      import('libheif-js/libheif-wasm/libheif.js') as unknown as Promise<{
        default: (o: { wasmBinary: ArrayBuffer }) => Promise<Heif>;
      }>,
      // This build compiles its WebAssembly synchronously, which browsers
      // only allow for bytes already in hand, so fetch the binary first.
      fetch(`${__LIBHEIF_BASE__}libheif.wasm`).then((r) => {
        if (!r.ok) throw new Error(`libheif.wasm: ${r.status}`);
        return r.arrayBuffer();
      }),
    ]);
    return factory({ wasmBinary: wasm });
  })();
  lib.catch(() => { lib = null; });
  return lib;
}

async function decodeHeic(file: File): Promise<ImageBitmap | ImageData> {
  try {
    return await createImageBitmap(file); // Safari, and any browser that learns HEIC
  } catch { /* fall through to libheif */ }
  const heif = await libheif();
  const images = new heif.HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()));
  const image = images.find((im) => im.is_primary?.()) ?? images[0];
  if (!image) throw new Error('empty');
  const w = image.get_width();
  const h = image.get_height();
  return new Promise((resolve, reject) => {
    image.display(new ImageData(w, h), (data) => (data ? resolve(data) : reject(new Error('decode'))));
  });
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  if (files.length === 0) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const mime = (opts.format === 'png' ? 'image/png' : 'image/jpeg') as Encodable;
  const ext = mime === 'image/png' ? 'png' : 'jpg';

  const out: { name: string; blob: Blob }[] = [];
  for (const [i, file] of files.entries()) {
    ctx.onProgress(i / files.length, say(`Decoding ${file.name}`, `Menyahkod ${file.name}`));
    let image;
    try {
      image = await decodeHeic(file);
    } catch {
      throw new ToolError(say(
        `Could not read "${file.name}" as a HEIC photo.`,
        `"${file.name}" tidak dapat dibaca sebagai gambar HEIC.`,
      ));
    }
    const canvas = surface(image.width, image.height);
    const c = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    if (image instanceof ImageData) c.putImageData(image, 0, 0);
    else { c.drawImage(image, 0, 0); image.close(); }
    out.push({ name: replaceExtension(file.name, ext), blob: await toBlob(canvas, mime, Number(opts.quality ?? 92) / 100) });
    ctx.onProgress((i + 1) / files.length);
  }

  const result = await bundle(out, 'converted-photos.zip');
  return {
    blob: result.blob,
    filename: result.name,
    summary: say(`${out.length} photo${out.length === 1 ? '' : 's'} converted to ${ext.toUpperCase()}`, `${out.length} gambar ditukar ke ${ext.toUpperCase()}`),
  };
};
