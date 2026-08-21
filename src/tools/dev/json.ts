import { ToolError, type TextRun } from '../types';

/** Turn a character offset into a 1-indexed line/column. */
function lineCol(text: string, pos: number): { line: number; col: number } {
  const upto = text.slice(0, pos);
  const line = upto.split('\n').length;
  const col = pos - (upto.lastIndexOf('\n') + 1) + 1;
  return { line, col };
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortDeep(v)]),
    );
  }
  return value;
}

function countNodes(value: unknown): { keys: number; depth: number } {
  let keys = 0;
  const walk = (v: unknown, d: number): number => {
    if (Array.isArray(v)) return v.reduce<number>((m, x) => Math.max(m, walk(x, d + 1)), d);
    if (v && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      keys += entries.length;
      return entries.reduce((m, [, x]) => Math.max(m, walk(x, d + 1)), d);
    }
    return d;
  };
  const depth = walk(value, 0);
  return { keys, depth };
}

/**
 * V8 emits two different shapes. Most carry an explicit location:
 *   Expected ':' after property name in JSON at position 5 (line 1 column 6)
 * but the "Unexpected token" variant carries none:
 *   Unexpected token '}', "{ ... }" is not valid JSON
 * Use V8's own line/column when it gives one, derive it from `position` when
 * that is all there is, and otherwise report cleanly rather than inventing a
 * location that might be wrong.
 */
export function explainParseError(err: unknown, input: string): string {
  const raw = err instanceof Error ? err.message : String(err);

  const explicit = raw.match(/\(line (\d+) column (\d+)\)/);
  if (explicit) {
    const head = raw.slice(0, raw.indexOf(' in JSON at position'));
    return `${head} at line ${explicit[1]}, column ${explicit[2]}`;
  }

  const pos = raw.match(/position (\d+)/);
  if (pos?.[1]) {
    const { line, col } = lineCol(input, Number(pos[1]));
    return `${raw.replace(/ in JSON at position \d+.*/, '')} at line ${line}, column ${col}`;
  }

  if (/Unexpected end of JSON input/.test(raw)) {
    const { line } = lineCol(input, input.length);
    return `Unexpected end of input. The document is incomplete, ending at line ${line}.`;
  }

  // "Unexpected token 'X', \"...\" is not valid JSON" — strip the echoed source.
  const token = raw.match(/Unexpected token '(.+?)'/);
  if (token) return `Unexpected ${token[1] === '}' ? "'}'" : `token '${token[1]}'`}. Check for a trailing comma or a missing value.`;

  return raw;
}

export const run: TextRun = async (input, opts) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    throw new ToolError(explainParseError(err, input));
  }

  const value = opts.sortKeys ? sortDeep(parsed) : parsed;
  const indentOpt = String(opts.indent ?? '2');
  const indent = indentOpt === 'tab' ? '\t' : Number(indentOpt);
  const output = JSON.stringify(value, null, indent === 0 ? undefined : indent) ?? '';

  const { keys, depth } = countNodes(parsed);
  const saved = input.length - output.length;

  return {
    output,
    language: 'json',
    stats: [
      { label: 'Keys', value: String(keys) },
      { label: 'Depth', value: String(depth) },
      { label: 'Size', value: `${output.length} B` },
      ...(saved > 0 ? [{ label: 'Saved', value: `${saved} B` }] : []),
    ],
  };
};
