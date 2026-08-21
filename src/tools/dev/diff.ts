import type { TextRun } from '../types';

export const run: TextRun = async (input, opts, inputB = '') => {
  const { diffLines, diffWords, diffChars } = await import('diff');
  const granularity = String(opts.granularity ?? 'line');
  const options = { ignoreWhitespace: Boolean(opts.ignoreWhitespace) };

  const parts =
    granularity === 'word' ? diffWords(input, inputB, options)
    : granularity === 'char' ? diffChars(input, inputB)
    : diffLines(input, inputB, options);

  let added = 0;
  let removed = 0;
  const out: string[] = [];

  for (const part of parts) {
    const lines = part.value.replace(/\n$/, '').split('\n');
    if (part.added) {
      added += granularity === 'line' ? lines.length : 1;
      for (const l of lines) out.push(`+ ${l}`);
    } else if (part.removed) {
      removed += granularity === 'line' ? lines.length : 1;
      for (const l of lines) out.push(`- ${l}`);
    } else if (granularity === 'line') {
      for (const l of lines) out.push(`  ${l}`);
    } else {
      out.push(`  ${part.value}`);
    }
  }

  return {
    output: added === 0 && removed === 0 ? 'The two inputs are identical.' : out.join('\n'),
    stats: [
      { label: 'Added', value: `+${added}` },
      { label: 'Removed', value: `-${removed}` },
      { label: 'Compared by', value: granularity },
    ],
  };
};
