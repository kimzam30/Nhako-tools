import { ToolError } from '../types';
import { surface } from '../../lib/canvas';

/**
 * Person matting with MODNet (Apache-2.0, Xenova/modnet, quantised: 6.6 MB),
 * run on the device through the same self-hosted ONNX runtime as Audio to
 * text. The model file is the only download, from Hugging Face, and only when
 * someone asks for a new background.
 *
 * Pre-processing follows the model's preprocessor_config.json by hand
 * (shortest edge 512, both sides a multiple of 32, pixels scaled to -1..1)
 * rather than trusting an older transformers.js release to honour
 * `size_divisibility`, which MODNet's layers need.
 */

type Canvas = ReturnType<typeof surface>;
type Model = { (inputs: Record<string, unknown>): Promise<Record<string, { data: Float32Array; dims: number[] }>> };

let modelPromise: Promise<{ model: Model; Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown }> | null = null;

async function loadModel(onProgress?: (fraction: number) => void) {
  modelPromise ??= (async () => {
    const { AutoModel, Tensor, env } = await import('@xenova/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.backends.onnx.wasm.wasmPaths = __ORT_BASE__;
    // One thread: this runtime's threaded build spawns workers from code that
    // does not survive bundling ("g is not defined"), and falls back anyway.
    env.backends.onnx.wasm.numThreads = 1;
    const model = await AutoModel.from_pretrained('Xenova/modnet', {
      quantized: true,
      progress_callback: (d: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (d.status === 'progress' && d.file?.endsWith('.onnx') && d.total) onProgress?.((d.loaded ?? 0) / d.total);
      },
    });
    return { model: model as unknown as Model, Tensor: Tensor as never };
  })();
  try {
    return await modelPromise;
  } catch (err) {
    modelPromise = null; // let a later attempt retry, e.g. after going back online
    throw err;
  }
}

/** Largest side the matte is computed at; it is upscaled to the photo after. */
const WORK_EDGE = 512;

function workSize(w: number, h: number) {
  const scale = WORK_EDGE / Math.min(w, h);
  const round32 = (n: number) => Math.max(32, Math.round((n * scale) / 32) * 32);
  return { w: round32(w), h: round32(h) };
}

/**
 * A canvas the size of `src` whose alpha is the person (1) versus the
 * background (0). Draw it with 'destination-in' to cut the person out.
 */
export async function personMatte(
  src: CanvasImageSource & { width: number; height: number },
  onProgress?: (fraction: number, stage: 'download' | 'run') => void,
): Promise<Canvas> {
  let loaded;
  try {
    loaded = await loadModel((f) => onProgress?.(f, 'download'));
  } catch {
    throw new ToolError('Could not download the background model. Check your connection and try again.');
  }
  onProgress?.(1, 'run');

  const { w, h } = workSize(src.width, src.height);
  const small = surface(w, h);
  const sctx = small.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  sctx.drawImage(src, 0, 0, w, h);
  const rgba = sctx.getImageData(0, 0, w, h).data;

  // HWC RGBA bytes -> CHW floats in -1..1 (mean 0.5, std 0.5).
  const input = new Float32Array(3 * w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    input[i] = rgba[p]! / 127.5 - 1;
    input[w * h + i] = rgba[p + 1]! / 127.5 - 1;
    input[2 * w * h + i] = rgba[p + 2]! / 127.5 - 1;
  }

  const outputs = await loaded.model({ input: new loaded.Tensor('float32', input, [1, 3, h, w]) });
  const matte = Object.values(outputs)[0];
  if (!matte) throw new ToolError('The background model returned nothing.');

  const mask = surface(w, h);
  const mctx = mask.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const img = mctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, matte.data[i]!)) * 255);
  mctx.putImageData(img, 0, 0);

  // Scale the matte up to the photo; smoothing gives soft, natural edges.
  const full = surface(src.width, src.height);
  const fctx = full.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(mask, 0, 0, src.width, src.height);
  return full;
}

/** The photo with its background replaced by a flat colour. */
export function replaceBackground(
  src: CanvasImageSource & { width: number; height: number },
  matte: Canvas,
  color: string,
): Canvas {
  const cut = surface(src.width, src.height);
  const cctx = cut.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  cctx.drawImage(src, 0, 0);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(matte, 0, 0);

  const out = surface(src.width, src.height);
  const octx = out.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  octx.fillStyle = color;
  octx.fillRect(0, 0, src.width, src.height);
  octx.drawImage(cut, 0, 0);
  return out;
}
