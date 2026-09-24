import type { ToolModule } from './types';

/**
 * Lazy implementation map.
 *
 * Each entry is a dynamic import, so a tool's dependencies (pdf-lib, ffmpeg,
 * transformers.js) only enter the network when that tool is actually used.
 * The old build imported all four statically at the top of ToolPage.jsx, so
 * opening the word counter downloaded the Whisper runtime.
 *
 * Keys must match `${category}/${slug}` in the registry, asserted by
 * loaders.test.ts, which fails the build if a tool has no implementation or an
 * implementation has no tool.
 */
export const LOADERS: Record<string, () => Promise<ToolModule>> = {
  'pdf/merge': () => import('./pdf/merge'),
  'pdf/split': () => import('./pdf/split'),
  'pdf/compress': () => import('./pdf/compress'),
  'pdf/to-image': () => import('./pdf/to-image'),
  'pdf/to-text': () => import('./pdf/to-text'),
  'pdf/rotate': () => import('./pdf/rotate'),
  'pdf/watermark': () => import('./pdf/watermark'),
  'pdf/jpg-to-pdf': () => import('./pdf/jpg-to-pdf'),
  'pdf/page-numbers': () => import('./pdf/page-numbers'),
  'pdf/crop': () => import('./pdf/crop'),
  'pdf/protect': () => import('./pdf/protect'),
  'pdf/unlock': () => import('./pdf/unlock'),
  'pdf/ocr': () => import('./pdf/ocr'),
  'pdf/to-word': () => import('./pdf/to-word'),
  'pdf/office-to-pdf': () => import('./pdf/office-to-pdf'),
  'pdf/remove-pages': () => import('./pdf/remove-pages'),
  'pdf/extract-pages': () => import('./pdf/extract-pages'),
  'pdf/n-up': () => import('./pdf/n-up'),
  'pdf/grayscale': () => import('./pdf/grayscale'),
  'pdf/repair': () => import('./pdf/repair'),
  'pdf/to-powerpoint': () => import('./pdf/to-powerpoint'),

  'media/compress-video': () => import('./media/compress-video'),
  'media/extract-audio': () => import('./media/extract-audio'),
  'media/transcribe': () => import('./media/transcribe'),

  'image/compress': () => import('./image/compress'),
  'image/convert': () => import('./image/convert'),
  'image/resize': () => import('./image/resize'),
  'image/rotate': () => import('./image/rotate'),
  'image/watermark': () => import('./image/watermark'),
  'image/heic-to-jpg': () => import('./image/heic'),
  'image/remove-metadata': () => import('./image/remove-metadata'),
  'image/ocr': () => import('./image/ocr'),
  'image/remove-background': () => import('./image/remove-background'),

  'dev/json': () => import('./dev/json'),
  'dev/jwt': () => import('./dev/jwt'),
  'dev/base64': () => import('./dev/base64'),
  'dev/word-count': () => import('./dev/word-count'),
  'dev/hash': () => import('./dev/hash'),
  'dev/uuid': () => import('./dev/uuid'),
  'dev/qr': () => import('./dev/qr'),
  'dev/diff': () => import('./dev/diff'),
  'dev/css-shadow': () => import('./dev/css-shadow'),
};

export async function loadTool(id: string): Promise<ToolModule> {
  const loader = LOADERS[id];
  if (!loader) throw new Error(`No implementation registered for "${id}"`);
  return loader();
}
