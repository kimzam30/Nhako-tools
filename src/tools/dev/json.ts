import { ToolError, type TextRun } from '../types';
import { sayer, type Say } from '../say';

/** English on its own, for the unit tests, which have no page locale. */
const englishOnly: Say = sayer({});

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

class SyntaxAt extends Error {
  constructor(message: string, readonly index: number) { super(message); }
}

/**
 * Find the first syntax error in `text` and describe it.
 *
 * Each engine words JSON.parse errors differently, and only V8 gives a
 * position at all: Safari says just "JSON Parse error: Expected '}'", so the
 * promised line and column never appeared there. This strict scanner locates
 * the error itself, so every browser reports the same message. It only runs
 * after JSON.parse has already failed.
 */
export function locateJsonError(text: string, say: Say = englishOnly): { message: string; index: number } | null {
  let i = 0;
  const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i]!)) i++; };
  const fail = (message: string): never => {
    throw new SyntaxAt(i >= text.length ? 'EOF' : message, i);
  };
  const found = () => say(`found ${JSON.stringify(text[i])}`, `ditemui ${JSON.stringify(text[i])}`);

  const string = () => {
    i++; // opening quote
    for (;;) {
      if (i >= text.length) fail(say('Unterminated string', 'Rentetan tidak ditamatkan'));
      const c = text[i]!;
      if (c === '"') { i++; return; }
      if (c.charCodeAt(0) < 0x20) fail(say(
        'Unescaped control character (such as a raw line break) inside a string',
        'Aksara kawalan tanpa escape (seperti pemisah baris mentah) di dalam rentetan',
      ));
      if (c === '\\') {
        const e = text[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) { i++; fail(say('Invalid \\u escape: it needs four hex digits', 'Escape \\u tidak sah: ia memerlukan empat digit heks')); }
          i += 6;
        } else if (e !== undefined && '"\\/bfnrt'.includes(e)) i += 2;
        else { i++; fail(say(`Invalid escape "\\${e ?? ''}"`, `Escape "\\${e ?? ''}" tidak sah`)); }
      } else i++;
    }
  };

  const value = (): void => {
    ws();
    const c = text[i];
    if (c === undefined) fail('EOF');
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return string();
    if (c === '-' || (c! >= '0' && c! <= '9')) {
      const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
      if (!m) fail(say('Invalid number', 'Nombor tidak sah'));
      i += m![0].length;
      return;
    }
    for (const word of ['true', 'false', 'null']) {
      if (text.startsWith(word, i)) { i += word.length; return; }
    }
    fail(c === "'"
      ? say('Strings must use double quotes, not single quotes', 'Rentetan mesti menggunakan tanda petik berganda, bukan tunggal')
      : say(`Expected a value, ${found()}`, `Menjangkakan satu nilai, ${found()}`));
  };

  const object = () => {
    i++; ws();
    if (text[i] === '}') { i++; return; }
    for (;;) {
      ws();
      if (text[i] !== '"') fail(text[i] === "'"
        ? say('Property names must use double quotes, not single quotes', 'Nama sifat mesti menggunakan tanda petik berganda, bukan tunggal')
        : say(`Expected a double-quoted property name, ${found()}`, `Menjangkakan nama sifat dalam petik berganda, ${found()}`));
      string(); ws();
      if (text[i] !== ':') fail(say(`Expected ':' after the property name, ${found()}`, `Menjangkakan ':' selepas nama sifat, ${found()}`));
      i++; value(); ws();
      if (text[i] === '}') { i++; return; }
      if (text[i] !== ',') fail(say(`Expected ',' or '}' after the property value, ${found()}`, `Menjangkakan ',' atau '}' selepas nilai sifat, ${found()}`));
      i++; ws();
      if (text[i] === '}') fail(say("Trailing comma before '}'. JSON does not allow one", "Koma berlebihan sebelum '}'. JSON tidak membenarkannya"));
    }
  };

  const array = () => {
    i++; ws();
    if (text[i] === ']') { i++; return; }
    for (;;) {
      value(); ws();
      if (text[i] === ']') { i++; return; }
      if (text[i] !== ',') fail(say(`Expected ',' or ']' after the array element, ${found()}`, `Menjangkakan ',' atau ']' selepas elemen tatasusunan, ${found()}`));
      i++; ws();
      if (text[i] === ']') fail(say("Trailing comma before ']'. JSON does not allow one", "Koma berlebihan sebelum ']'. JSON tidak membenarkannya"));
    }
  };

  try {
    value(); ws();
    if (i < text.length) fail(say(`Unexpected content after the JSON value, ${found()}`, `Kandungan tidak dijangka selepas nilai JSON, ${found()}`));
    return null;
  } catch (err) {
    if (err instanceof SyntaxAt) return { message: err.message, index: err.index };
    return null; // e.g. absurd nesting depth: fall back to the engine's message
  }
}

/** Turn a failed parse into a message with a real line and column. */
export function explainParseError(err: unknown, input: string, say: Say = englishOnly): string {
  const located = locateJsonError(input, say);
  if (located?.message === 'EOF') {
    const { line } = lineCol(input, input.length);
    return say(
      `Unexpected end of input. The document is incomplete, ending at line ${line}.`,
      `Input tamat secara tidak dijangka. Dokumen tidak lengkap, berakhir di baris ${line}.`,
    );
  }
  if (located) {
    const { line, col } = lineCol(input, located.index);
    return say(
      `${located.message} at line ${line}, column ${col}.`,
      `${located.message} di baris ${line}, lajur ${col}.`,
    );
  }
  // Not located (should not happen): the engine's own words, trimmed so a
  // long document is never echoed back inside the message.
  const raw = err instanceof Error ? err.message : String(err);
  return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
}

const TOKEN = /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/**
 * Parse without changing any number.
 *
 * JSON.parse turns every number into a double, so 12345678901234567890
 * became 12345678901234567000 and 1.10 became 1.1: a formatter silently
 * editing the data. Any literal that would not survive the round trip is
 * swapped for a unique placeholder string before parsing, and swapped back
 * verbatim after stringifying. `input` must already be known-valid JSON, so
 * outside string literals the pattern can only ever match a number.
 */
function parsePreservingNumbers(input: string): { value: unknown; restore: (json: string) => string } {
  const nonce = Math.random().toString(36).slice(2);
  const literals: string[] = [];
  const substituted = input.replace(TOKEN, (match) => {
    if (match.startsWith('"') || String(Number(match)) === match) return match;
    literals.push(match);
    // The JSON escape, not a raw NUL: raw control characters are invalid JSON.
    return `"\\u0000${nonce}:${literals.length - 1}"`;
  });
  if (literals.length === 0) return { value: JSON.parse(input), restore: (json) => json };

  const placeholder = new RegExp(`"\\\\u0000${nonce}:(\\d+)"`, 'g');
  return {
    value: JSON.parse(substituted),
    restore: (json) => json.replace(placeholder, (_, i: string) => literals[Number(i)]!),
  };
}

export const run: TextRun = async (input, opts) => {
  const say = sayer(opts);
  try {
    JSON.parse(input);
  } catch (err) {
    throw new ToolError(explainParseError(err, input, say));
  }
  const { value: parsed, restore } = parsePreservingNumbers(input);

  const value = opts.sortKeys ? sortDeep(parsed) : parsed;
  const indentOpt = String(opts.indent ?? '2');
  const indent = indentOpt === 'tab' ? '\t' : Number(indentOpt);
  const output = restore(JSON.stringify(value, null, indent === 0 ? undefined : indent) ?? '');

  const { keys, depth } = countNodes(parsed);
  const saved = input.length - output.length;

  return {
    output,
    language: 'json',
    stats: [
      { label: say('Keys', 'Kunci'), value: String(keys) },
      { label: say('Depth', 'Kedalaman'), value: String(depth) },
      { label: say('Size', 'Saiz'), value: `${output.length} B` },
      ...(saved > 0 ? [{ label: say('Saved', 'Dijimatkan'), value: `${saved} B` }] : []),
    ],
  };
};
