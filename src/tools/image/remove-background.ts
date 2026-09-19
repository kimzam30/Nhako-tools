import { ToolError, type FileRun } from '../types';
import { surface, toBlob } from '../../lib/canvas';
import { sayer } from '../say';
import { cachedDownload } from '../../lib/model-cache';
import type * as OrtModule from 'onnxruntime-web';

/**
 * Background removal on the device, with the site's own ONNX runtime. Two
 * openly licensed ISNet models, each 8-bit, about 45 MB:
 *
 *   - "general": ISNet general-use from the DIS project (Apache-2.0), the
 *     model behind rembg's general mode. Trained on everyday objects.
 *   - "person": ormbg (Apache-2.0), trained on people, cleaner on hair and
 *     outlines of people, weaker on objects.
 *
 * BRIA's RMBG models are better known but licensed for non-commercial use
 * only, so they are not an option here.
 *
 * The chosen model is the one download from a third party, from Hugging Face,
 * pinned to an exact revision so what runs never changes without a code
 * change. It is kept in the browser's cache after the first use.
 */
export const MODELS = {
  general: {
    url: 'https://huggingface.co/Ko033/isnet-general-use-onnx/resolve/5349b617911fd60c619b52f32e2b593517b78df3/onnx/model_quantized.onnx',
    // x / 255 - 0.5, and a min-max stretch of the output, as rembg does.
    offset: 0.5,
    stretch: true,
  },
  person: {
    url: 'https://huggingface.co/onnx-community/ormbg-ONNX/resolve/034e2d884afbab897e10e78fc5bb566b29533fd6/onnx/model_quantized.onnx',
    // x / 255, output used as is (its preprocessor_config.json).
    offset: 0,
    stretch: false,
  },
} as const;
export type ModelKind = keyof typeof MODELS;
const SIDE = 1024;

type Ort = typeof OrtModule;
const sessions = new Map<ModelKind, Promise<{ ort: Ort; run: (input: Float32Array) => Promise<Float32Array> }>>();

async function load(kind: ModelKind, onProgress: (f: number) => void) {
  let session = sessions.get(kind);
  if (!session) {
    session = (async () => {
      const ort = await import('onnxruntime-web');
      ort.env.wasm.wasmPaths = __ORT_BASE__;
      // One thread: this runtime's threaded build spawns workers from code that
      // does not survive bundling ("g is not defined"), and falls back anyway.
      ort.env.wasm.numThreads = 1;
      const bytes = await cachedDownload(MODELS[kind].url, onProgress);
      const s = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      const [inputName] = s.inputNames;
      const [outputName] = s.outputNames;
      return {
        ort,
        run: async (input: Float32Array) => {
          const out = await s.run({ [inputName!]: new ort.Tensor('float32', input, [1, 3, SIDE, SIDE]) });
          return out[outputName!]!.data as Float32Array;
        },
      };
    })();
    sessions.set(kind, session);
  }
  try {
    return await session;
  } catch (err) {
    sessions.delete(kind); // let a later attempt retry, e.g. after going back online
    throw err;
  }
}

/**
 * A canvas the size of the image whose alpha is the subject (opaque) against
 * the background (clear). The model sees a 1024 × 1024 squeeze of the image;
 * its mask is stretched back, smoothed by the browser's scaler.
 */
export async function subjectMatte(
  bitmap: ImageBitmap,
  kind: ModelKind,
  onProgress: (fraction: number, stage: 'download' | 'run') => void,
) {
  const { offset, stretch } = MODELS[kind];
  const model = await load(kind, (f) => onProgress(f, 'download'));
  onProgress(0, 'run');

  const small = surface(SIDE, SIDE);
  const sctx = small.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  sctx.drawImage(bitmap, 0, 0, SIDE, SIDE);
  const rgba = sctx.getImageData(0, 0, SIDE, SIDE).data;
  // HWC bytes to CHW floats, as each model was trained.
  const n = SIDE * SIDE;
  const input = new Float32Array(3 * n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    input[i] = rgba[p]! / 255 - offset;
    input[n + i] = rgba[p + 1]! / 255 - offset;
    input[2 * n + i] = rgba[p + 2]! / 255 - offset;
  }
  const mask = await model.run(input);
  let lo = 0;
  let span = 1;
  if (stretch) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < n; i++) { const v = mask[i]!; if (v < min) min = v; if (v > max) max = v; }
    lo = min;
    span = max - min || 1;
  }

  const m = surface(SIDE, SIDE);
  const mctx = m.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const img = mctx.createImageData(SIDE, SIDE);
  for (let i = 0; i < n; i++) {
    img.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, (mask[i]! - lo) / span)) * 255);
  }
  mctx.putImageData(img, 0, 0);

  const matte = surface(bitmap.width, bitmap.height);
  const out = matte.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  out.imageSmoothingQuality = 'high';
  out.drawImage(m, 0, 0, bitmap.width, bitmap.height);
  onProgress(1, 'run');
  return matte;
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  if (files.length === 0) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const background = String(opts.background ?? 'transparent');
  const kind: ModelKind = opts.subject === 'person' ? 'person' : 'general';
  const fill = background === 'white' ? '#ffffff' : background === 'black' ? '#000000' : null;

  const outputs: { blob: Blob; name: string }[] = [];
  for (const [i, file] of files.entries()) {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new ToolError(say(`"${file.name}" could not be opened as an image.`, `"${file.name}" tidak dapat dibuka sebagai imej.`));
    }
    let matte;
    try {
      matte = await subjectMatte(bitmap, kind, (f, stage) => ctx.onProgress(
        (i + (stage === 'run' ? 0.5 + f / 2 : f / 2)) / files.length,
        stage === 'download' ? say('Downloading the model (once)', 'Memuat turun model (sekali)') : say('Finding the subject', 'Mencari subjek'),
      ));
    } catch (err) {
      if (err instanceof ToolError) throw err;
      throw new ToolError(say('Could not download the background model. Check your connection and try again.', 'Model latar belakang tidak dapat dimuat turun. Semak sambungan anda dan cuba lagi.'));
    }

    // Cut the subject out: the photo, kept where the matte is opaque.
    const cut = surface(bitmap.width, bitmap.height);
    const c = cut.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    c.drawImage(bitmap, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(matte, 0, 0);
    bitmap.close();

    let final = cut;
    if (fill) {
      final = surface(cut.width, cut.height);
      const f = final.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      f.fillStyle = fill;
      f.fillRect(0, 0, cut.width, cut.height);
      f.drawImage(cut, 0, 0);
    }
    const type = fill ? 'image/jpeg' : 'image/png';
    const blob = await toBlob(final, type, 0.92);
    outputs.push({ blob, name: `${file.name.replace(/\.[^.]+$/, '')}-no-bg.${fill ? 'jpg' : 'png'}` });
  }

  const summary = say(`${outputs.length} image${outputs.length === 1 ? '' : 's'}`, `${outputs.length} imej`);
  if (outputs.length === 1) return { blob: outputs[0]!.blob, filename: outputs[0]!.name, summary };
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const o of outputs) zip.file(o.name, o.blob);
  return { blob: await zip.generateAsync({ type: 'blob' }), filename: 'no-background.zip', summary };
};
