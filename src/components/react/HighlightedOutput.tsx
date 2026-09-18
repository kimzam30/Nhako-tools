/**
 * Zero-dependency syntax highlighting.
 *
 * The old README advertised "syntax highlighting" for the JSON formatter, but
 * the output was a plain read-only <textarea>. This is the real thing at a
 * fraction of the cost of pulling in an editor.
 */

import type { DiffSegment } from '../../tools/types';

type Token = { text: string; className: string };

const JSON_PATTERN =
  /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\],])/g;

function tokenizeJson(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(JSON_PATTERN)) {
    const index = m.index;
    if (index > last) tokens.push({ text: text.slice(last, index), className: '' });
    const className =
      m[1] ? 'text-accent' :
      m[2] ? 'text-ok' :
      m[3] ? 'text-[var(--pink-500)]' :
      m[4] ? 'text-warn' :
      m[5] ? 'text-muted' :
      'text-muted';
    tokens.push({ text: m[0], className });
    last = index + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), className: '' });
  return tokens;
}

/** Diff output is line-oriented: colour by the +/- marker. */
function diffLineClass(line: string): string {
  if (line.startsWith('+')) return 'text-ok';
  if (line.startsWith('-')) return 'text-err';
  return '';
}

export default function HighlightedOutput({ text, language, segments }: { text: string; language: string; segments?: DiffSegment[] }) {
  if (language === 'diff-inline' && segments) {
    // Colour alone would fail colour-blind readers, so removals are also
    // struck through and additions underlined. Screen readers get the change
    // spelled out (naming <ins>/<del> with aria-label is prohibited by ARIA).
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed">
        <code>
          {segments.map((s, i) =>
            s.kind === 'add' ? <ins key={i} className="bg-ok/10 text-ok underline decoration-1 underline-offset-2"><span className="sr-only">[added: </span>{s.text}<span className="sr-only">]</span></ins>
            : s.kind === 'del' ? <del key={i} className="bg-err/10 text-err line-through"><span className="sr-only">[removed: </span>{s.text}<span className="sr-only">]</span></del>
            : <span key={i}>{s.text}</span>)}
        </code>
      </pre>
    );
  }

  if (language === 'json') {
    return (
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        <code>
          {tokenizeJson(text).map((t, i) => (
            <span key={i} className={t.className}>{t.text}</span>
          ))}
        </code>
      </pre>
    );
  }

  if (language === 'diff') {
    return (
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        <code>
          {text.split('\n').map((line, i) => (
            <span key={i} className={`block ${diffLineClass(line)}`}>{line || '\u00a0'}</span>
          ))}
        </code>
      </pre>
    );
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed">
      <code>{text}</code>
    </pre>
  );
}
