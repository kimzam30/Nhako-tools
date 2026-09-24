import { ToolError, type FileRun } from '../types';
import { sayer, type Say } from '../say';

/**
 * Whisper checkpoints by language and speed, all Apache-2.0, 8-bit, from
 * Hugging Face. English uses the English-only models, which are more
 * accurate for their size; everything else uses the multilingual ones.
 * Download sizes are the encoder plus the merged decoder.
 */
export const WHISPER = {
  en: { fast: 'Xenova/whisper-tiny.en', accurate: 'Xenova/whisper-base.en' },
  other: { fast: 'Xenova/whisper-base', accurate: 'Xenova/whisper-small' },
} as const;

export function whisperModel(language: string, quality: string): string {
  const q = quality === 'accurate' ? 'accurate' : 'fast';
  return language === 'en' ? WHISPER.en[q] : WHISPER.other[q];
}

/** Whisper's own name for a language, or undefined to let it detect. */
export const whisperLanguage = (language: string): string | undefined =>
  language === 'ms' ? 'malay' : undefined;

/** Decode any audio/video file to the 16 kHz mono float array Whisper expects. */
async function toMonoPCM(file: File, say: Say): Promise<Float32Array> {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioCtx({ sampleRate: 16000 });
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
    // Average the channels rather than discarding all but the first, which
    // loses anything panned hard to one side.
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const mono = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) mono[i] = (left[i]! + right[i]!) / 2;
    return mono;
  } catch {
    throw new ToolError(say(
      'Could not decode the audio. Try extracting the audio track first, then transcribing that.',
      'Audio tidak dapat dinyahkod. Cuba ekstrak trek audio dahulu, kemudian transkripsikan itu.',
    ));
  } finally {
    await context.close();
  }
}

type Progress = (data: { status: string; file?: string; loaded?: number; total?: number }) => void;
type Transcriber = ((audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>) & { dispose(): Promise<void> };
let loaded: { model: string; pipe: Promise<Transcriber> } | null = null;

/**
 * One pipeline at a time, kept between runs. Building a fresh one per file
 * leaked its ONNX sessions: the WebAssembly heap filled after a handful of
 * files with the 250 MB model and every later run failed ("OrtRun() error
 * code 6"). A different model frees the old one first.
 */
async function loadPipeline(pipeline: (task: string, model: string, opts: object) => Promise<unknown>, model: string, onProgress: Progress): Promise<Transcriber> {
  if (loaded?.model === model) return loaded.pipe;
  const previous = loaded;
  loaded = null;
  if (previous) await (await previous.pipe.catch(() => null))?.dispose();
  const pipe = pipeline('automatic-speech-recognition', model, { progress_callback: onProgress }) as Promise<Transcriber>;
  loaded = { model, pipe };
  pipe.catch(() => { if (loaded?.pipe === pipe) loaded = null; });
  return pipe;
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const language = String(opts.language ?? 'en');
  const model = whisperModel(language, String(opts.quality ?? 'fast'));

  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  // Self-hosted ONNX runtime (scripts/vendor.mjs). By default transformers.js
  // pulls it from cdn.jsdelivr.net, a second third party the privacy page
  // did not mention.
  env.backends.onnx.wasm.wasmPaths = __ORT_BASE__;
  // One thread: this runtime's threaded build spawns workers from code that
  // does not survive bundling ("g is not defined"), and falls back anyway.
  env.backends.onnx.wasm.numThreads = 1;

  ctx.onProgress(0, say('Loading model', 'Memuatkan model'));
  // Progress arrives per file (config, tokenizer, encoder, decoder), each
  // running 0 to 100%. Reporting each one directly made the bar run up and
  // snap back four times. Sum bytes across files instead, and never go back.
  const downloads = new Map<string, { loaded: number; total: number }>();
  let shown = 0;
  const transcriber = await loadPipeline(pipeline as never, model, (data) => {
    if (data.status !== 'progress' || !data.file || !data.total) return;
    downloads.set(data.file, { loaded: data.loaded ?? 0, total: data.total });
    let loaded = 0;
    let total = 0;
    for (const f of downloads.values()) { loaded += f.loaded; total += f.total; }
    shown = Math.max(shown, (loaded / total) * 0.5); // download is the first half
    ctx.onProgress(shown, say('Downloading model (once)', 'Memuat turun model (sekali)'));
  });

  ctx.onProgress(0.55, say('Decoding audio', 'Menyahkod audio'));
  const audio = await toMonoPCM(file, say);

  ctx.onProgress(0.65, say('Transcribing', 'Mentranskripsi'));
  // English-only models take no language; for the others, name it (Malay)
  // or leave it out, and Whisper detects it from the first 30 seconds.
  const lang = model.endsWith('.en') ? {} : { task: 'transcribe', ...(whisperLanguage(language) ? { language: whisperLanguage(language) } : {}) };
  const result = await transcriber(audio, { chunk_length_s: 30, stride_length_s: 5, ...lang });
  const text = (Array.isArray(result) ? result[0]?.text : result.text) ?? '';
  ctx.onProgress(1);

  if (!text.trim()) throw new ToolError(say('No speech was detected in that file.', 'Tiada pertuturan dikesan dalam fail itu.'));

  const minutes = audio.length / 16000 / 60;
  return {
    blob: new Blob([text.trim()], { type: 'text/plain;charset=utf-8' }),
    filename: file.name.replace(/\.[^/.]+$/, '') + '-transcript.txt',
    summary: say(`${minutes.toFixed(1)} min, ${text.trim().split(/\s+/).length} words`, `${minutes.toFixed(1)} min, ${text.trim().split(/\s+/).length} perkataan`),
    text: text.trim(),
  };
};
