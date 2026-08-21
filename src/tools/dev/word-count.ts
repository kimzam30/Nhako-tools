import type { TextRun } from '../types';

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

export const run: TextRun = async (input) => {
  const c = count(input);
  const rows: [string, string | number][] = [
    ['Words', c.words], ['Characters', c.characters], ['Characters (no spaces)', c.charactersNoSpaces],
    ['Sentences', c.sentences], ['Paragraphs', c.paragraphs], ['Lines', c.lines],
    ['Reading time', `~${c.readingMinutes} min`], ['Speaking time', `~${c.speakingMinutes} min`],
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  return {
    output: rows.map(([k, v]) => `${k.padEnd(width)}  ${v}`).join('\n'),
    stats: [
      { label: 'Words', value: String(c.words) },
      { label: 'Chars', value: String(c.characters) },
      { label: 'Read', value: `~${c.readingMinutes}m` },
    ],
  };
};
