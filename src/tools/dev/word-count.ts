import type { TextRun } from '../types';
import { sayer } from '../say';

export interface Counts {
  words: number; characters: number; charactersNoSpaces: number;
  sentences: number; paragraphs: number; lines: number;
  readingMinutes: number; speakingMinutes: number;
}

const WORDS_PER_MINUTE = 200;
const SPOKEN_WORDS_PER_MINUTE = 130;

export function count(text: string): Counts {
  const trimmed = text.trim();
  const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
  return {
    words,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    sentences: trimmed === '' ? 0 : (trimmed.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? []).length,
    paragraphs: trimmed === '' ? 0 : trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length,
    lines: text === '' ? 0 : text.split('\n').length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    speakingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / SPOKEN_WORDS_PER_MINUTE)),
  };
}

export const run: TextRun = async (input, opts) => {
  const say = sayer(opts);
  const c = count(input);
  const rows: [string, string | number][] = [
    [say('Words', 'Perkataan'), c.words],
    [say('Characters', 'Aksara'), c.characters],
    [say('Characters (no spaces)', 'Aksara (tanpa ruang)'), c.charactersNoSpaces],
    [say('Sentences', 'Ayat'), c.sentences],
    [say('Paragraphs', 'Perenggan'), c.paragraphs],
    [say('Lines', 'Baris'), c.lines],
    [say('Reading time', 'Masa membaca'), `~${c.readingMinutes} min`],
    [say('Speaking time', 'Masa bertutur'), `~${c.speakingMinutes} min`],
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  return {
    output: rows.map(([k, v]) => `${k.padEnd(width)}  ${v}`).join('\n'),
    stats: [
      { label: say('Words', 'Perkataan'), value: String(c.words) },
      { label: say('Chars', 'Aksara'), value: String(c.characters) },
      { label: say('Read', 'Baca'), value: `~${c.readingMinutes}m` },
    ],
  };
};
