import { describe, it, expect } from 'vitest';
import { whisperLanguage, whisperModel } from './transcribe';

describe('transcription model choice', () => {
  it('uses English-only models for English and multilingual ones otherwise', () => {
    expect(whisperModel('en', 'fast')).toBe('Xenova/whisper-tiny.en');
    expect(whisperModel('en', 'accurate')).toBe('Xenova/whisper-base.en');
    expect(whisperModel('ms', 'fast')).toBe('Xenova/whisper-base');
    expect(whisperModel('ms', 'accurate')).toBe('Xenova/whisper-small');
    expect(whisperModel('auto', 'accurate')).toBe('Xenova/whisper-small');
  });

  it('names Malay for Whisper and leaves other languages to detection', () => {
    expect(whisperLanguage('ms')).toBe('malay');
    expect(whisperLanguage('auto')).toBeUndefined();
  });
});
