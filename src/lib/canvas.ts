import { ToolError } from '../tools/types';

export type Encodable = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';

/** Decode a file into a bitmap without blocking on a DOM <img>. */
export async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new ToolError(`Could not read "${file.name}". It may be corrupt or in a format this browser cannot decode.`);
  }
}

export function surface(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

const FORMAT_NAME: Record<Encodable, string> = {
  'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF',
};

export async function toBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  type: Encodable,
  quality?: number,
): Promise<Blob> {
  const blob = 'convertToBlob' in canvas
    ? await canvas.convertToBlob({ type, quality })
    : await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new ToolError('Encoding failed.'))),
        type,
        quality,
      );
    });

  // Browsers silently fall back to PNG for any format they cannot encode
  // (AVIF in most, WebP in Safari). Without this check the file would be PNG
  // bytes under a .webp or .avif name.
  if (blob.type !== type) {
    throw new ToolError(
      `This browser cannot encode ${FORMAT_NAME[type]}. ` +
      (type === 'image/webp' ? 'Try JPG or PNG instead.' : 'Try WebP instead.'),
    );
  }
  return blob;
}

/** JPEG has no alpha channel, so transparent pixels need a colour to become. */
export const hasAlpha = (type: Encodable) => type !== 'image/jpeg';

/**
 * Draw a bitmap into a canvas of the given size using smooth resampling.
 *
 * For formats without transparency the canvas is filled white first.
 * Otherwise transparent pixels are encoded as black, which turned every
 * transparent PNG converted to JPG into a black background.
 */
export function draw(bitmap: ImageBitmap, width: number, height: number, target?: Encodable) {
  const canvas = surface(width, height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new ToolError('Could not get a drawing context.');
  if (target && !hasAlpha(target)) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

/** The encodable format a file already is, or null (GIF, BMP, SVG, HEIC...). */
export function formatOf(file: File): Encodable | null {
  const t = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  return t in EXTENSION ? (t as Encodable) : null;
}

export const EXTENSION: Record<Encodable, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
};

export const replaceExtension = (name: string, ext: string) => `${name.replace(/\.[^/.]+$/, '')}.${ext}`;
