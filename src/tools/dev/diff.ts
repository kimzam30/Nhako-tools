import type { DiffSegment, TextRun } from '../types';
import { sayer } from '../say';

type Part = { value: string; added?: boolean; removed?: boolean };

const words = (s: string) => (s.trim() === '' ? 0 : s.trim().split(/\s+/).length);

/**
 * jsdiff's character diff has no whitespace option, so the toggle used to be
 * silently ignored in that mode. Whitespace-only removals are dropped and
 * whitespace-only additions become unchanged text.
 */
function dropWhitespaceChanges(parts: Part[]): Part[] {
  return parts
    .filter((p) => !(p.removed && p.value.trim() === ''))
    .map((p) => (p.added && p.value.trim() === '' ? { value: p.value } : p));
}

export const run: TextRun = async (input, opts, inputB = '') => {
  const say = sayer(opts);
  const { diffLines, diffWords, diffChars } = await import('diff');
  const granularity = String(opts.granularity ?? 'line');
  const ignoreWhitespace = Boolean(opts.ignoreWhitespace);

  let parts: Part[] =
    granularity === 'word' ? diffWords(input, inputB, { ignoreWhitespace })
    : granularity === 'char' ? diffChars(input, inputB)
    : diffLines(input, inputB, { ignoreWhitespace });
  if (granularity === 'char' && ignoreWhitespace) parts = dropWhitespaceChanges(parts);

  const changed = parts.some((p) => p.added || p.removed);

  if (granularity === 'line') {
    let added = 0;
    let removed = 0;
    const out: string[] = [];
    for (const part of parts) {
      const lines = part.value.replace(/\n$/, '').split('\n');
      const marker = part.added ? '+' : part.removed ? '-' : ' ';
      if (part.added) added += lines.length;
      if (part.removed) removed += lines.length;
      for (const l of lines) out.push(`${marker} ${l}`);
    }
    return {
      output: changed ? out.join('\n') : say('The two inputs are identical.', 'Kedua-dua input adalah sama.'),
      language: changed ? 'diff' : 'text',
      stats: [
        { label: say('Added', 'Ditambah'), value: say(`+${added} line${added === 1 ? '' : 's'}`, `+${added} baris`) },
        { label: say('Removed', 'Dibuang'), value: say(`-${removed} line${removed === 1 ? '' : 's'}`, `-${removed} baris`) },
        { label: say('Compared by', 'Dibanding mengikut'), value: say('line', 'baris') },
      ],
    };
  }

  // Word and character diffs are marked inline, where the change actually
  // is. They used to be split one fragment per line, which scattered a
  // one-word edit across three lines.
  const count = granularity === 'word' ? words : (s: string) => [...s].length;
  const unit = granularity === 'word' ? 'word' : 'character';
  const unitMs = granularity === 'word' ? 'perkataan' : 'aksara';
  let added = 0;
  let removed = 0;
  const segments: DiffSegment[] = [];
  for (const part of parts) {
    if (part.added) added += count(part.value);
    if (part.removed) removed += count(part.value);
    segments.push({ text: part.value, kind: part.added ? 'add' : part.removed ? 'del' : 'same' });
  }

  // Copyable plain text uses the wdiff convention: [-removed-]{+added+}.
  const output = segments
    .map((s) => (s.kind === 'add' ? `{+${s.text}+}` : s.kind === 'del' ? `[-${s.text}-]` : s.text))
    .join('');

  return {
    output: changed ? output : say('The two inputs are identical.', 'Kedua-dua input adalah sama.'),
    language: changed ? 'diff-inline' : 'text',
    segments: changed ? segments : undefined,
    stats: [
      { label: say('Added', 'Ditambah'), value: say(`+${added} ${unit}${added === 1 ? '' : 's'}`, `+${added} ${unitMs}`) },
      { label: say('Removed', 'Dibuang'), value: say(`-${removed} ${unit}${removed === 1 ? '' : 's'}`, `-${removed} ${unitMs}`) },
      { label: say('Compared by', 'Dibanding mengikut'), value: say(granularity, unitMs) },
    ],
  };
};
