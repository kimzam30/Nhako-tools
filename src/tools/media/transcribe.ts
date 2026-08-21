import { ToolError, type FileRun } from '../types';

/** Decode any audio/video file to the 16 kHz mono float array Whisper expects. */
async function toMonoPCM(file: File): Promise<Float32Array> {
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
    throw new ToolError('Could not decode the audio. Try extracting the audio track first, then transcribing that.');
  } finally {
    await context.close();
  }
}

export const run: FileRun = async (files, _opts, ctx) => {
  const file = files[0];
  if (!file) throw new ToolError('No file selected.');

  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  ctx.onProgress(0, 'Loading model');
  const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
    progress_callback: (data: { status: string; progress?: number }) => {
      if (data.status === 'progress' && typeof data.progress === 'number') {
        ctx.onProgress(data.progress / 200, 'Downloading model (once)');
      }
    },
  });

  ctx.onProgress(0.55, 'Decoding audio');
  const audio = await toMonoPCM(file);

  ctx.onProgress(0.65, 'Transcribing');
  const result = await transcriber(audio, { chunk_length_s: 30, stride_length_s: 5 });
  const text = (Array.isArray(result) ? result[0]?.text : result.text) ?? '';
  ctx.onProgress(1);

  if (!text.trim()) throw new ToolError('No speech was detected in that file.');

  const minutes = audio.length / 16000 / 60;
  return {
    blob: new Blob([text.trim()], { type: 'text/plain;charset=utf-8' }),
    filename: file.name.replace(/\.[^/.]+$/, '') + '-transcript.txt',
    summary: `${minutes.toFixed(1)} min · ${text.trim().split(/\s+/).length} words`,
  };
};
