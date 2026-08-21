/**
 * Zero-dependency syntax highlighting.
 *
 * The old README advertised "syntax highlighting" for the JSON formatter, but
 * the output was a plain read-only <textarea>. This is the real thing at a
 * fraction of the cost of pulling in an editor.
 */

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

export default function HighlightedOutput({ text, language }: { text: string; language: string }) {
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

  if (text.includes('\n') && /^[+-] /m.test(text)) {
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
