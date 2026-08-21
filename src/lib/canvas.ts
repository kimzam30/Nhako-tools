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

export async function toBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  type: Encodable,
  quality?: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    const blob = await canvas.convertToBlob({ type, quality });
    // Browsers silently fall back to PNG for formats they cannot encode.
    if (type === 'image/avif' && blob.type !== 'image/avif') {
      throw new ToolError('This browser cannot encode AVIF. Try WebP instead.');
    }
    return blob;
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new ToolError('Encoding failed.'))),
      type,
      quality,
    );
  });
}

/** Draw a bitmap into a canvas of the given size using smooth resampling. */
export function draw(bitmap: ImageBitmap, width: number, height: number) {
  const canvas = surface(width, height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new ToolError('Could not get a drawing context.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

export const EXTENSION: Record<Encodable, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
};

export const replaceExtension = (name: string, ext: string) => `${name.replace(/\.[^/.]+$/, '')}.${ext}`;
