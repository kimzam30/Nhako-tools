import { useCallback, useEffect, useRef, useState } from 'react';
import type { OptionSpec, OptionValues, TextToolResult, ToolMeta } from '../../tools/types';
import { defaultOptions, ToolError } from '../../tools/types';
import { loadTool } from '../../tools/loaders';
import OptionsPanel from './OptionsPanel';
import CopyButton from './CopyButton';
import HighlightedOutput from './HighlightedOutput';

interface Props {
  tool: Pick<ToolMeta, 'category' | 'slug' | 'name' | 'kind' | 'generator'> & { options?: OptionSpec[] };
}

export default function TextToolPane({ tool }: Props) {
  const id = `${tool.category}/${tool.slug}`;
  const specs = tool.options ?? [];
  const twoInputs = tool.kind === 'text2';

  const [input, setInput] = useState('');
  const [inputB, setInputB] = useState('');
  const [options, setOptions] = useState<OptionValues>(() => defaultOptions(specs));
  const [result, setResult] = useState<TextToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const compute = useCallback(async (a: string, b: string, opts: OptionValues) => {
    const ticket = ++runId.current;
    try {
      const mod = await loadTool(id);
      const out = await (mod.run as (i: string, o: OptionValues, i2?: string) => Promise<TextToolResult>)(a, opts, b);
      if (ticket !== runId.current) return;
      setResult(out);
      setError(null);
    } catch (err) {
      if (ticket !== runId.current) return;
      setResult(null);
      setError(err instanceof ToolError || err instanceof Error ? err.message : 'Could not process that input.');
    }
  }, [id]);

  // Whether there is anything to run is derived, never stored: writing it to
  // state would mean a synchronous setState on mount for every text tool.
  const idle = !tool.generator && input.trim() === '';

  useEffect(() => {
    if (idle) return;
    // `compute` is async and writes state only from a continuation, after
    // awaiting the tool module and its result — never synchronously during the
    // effect. The lint rule's static analysis cannot see across the await, so
    // it reports a cascading render that cannot happen here. Running an async
    // transform when its inputs change is exactly what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void compute(input, inputB, options);
  }, [compute, idle, input, inputB, options]);

  const output = idle ? '' : result?.output ?? '';
  const shownError = idle ? null : error;

  return (
    <section className="flex flex-col gap-4">
      {specs.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <OptionsPanel specs={specs} values={options} onChange={(k, v) => setOptions((o) => ({ ...o, [k]: v }))} />
        </div>
      )}

      <div className={`grid gap-4 ${tool.generator ? '' : 'lg:grid-cols-2'}`}>
        {!tool.generator && (
          <div className="flex flex-col gap-4">
            <Pane title={twoInputs ? 'Original' : 'Input'}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                spellCheck={false}
                aria-label={twoInputs ? 'Original text' : 'Input'}
                placeholder={placeholderFor(id)}
                className="h-full min-h-56 w-full resize-y bg-transparent p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted"
              />
            </Pane>
            {twoInputs && (
              <Pane title="Changed">
                <textarea
                  value={inputB}
                  onChange={(e) => setInputB(e.target.value)}
                  spellCheck={false}
                  aria-label="Changed text"
                  placeholder="Paste the version to compare against…"
                  className="h-full min-h-56 w-full resize-y bg-transparent p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted"
                />
              </Pane>
            )}
          </div>
        )}

        <Pane
          title="Output"
          action={output && result?.language !== 'image' ? <CopyButton text={output} /> : null}
        >
          <div className="min-h-56 overflow-auto" aria-live="polite">
            {shownError ? (
              <p className="p-3 font-mono text-xs leading-relaxed text-err">{shownError}</p>
            ) : result?.language === 'image' && output ? (
              <div className="flex flex-col items-center gap-3 p-4">
                <img src={output} alt="Generated QR code" className="max-w-full rounded bg-white p-2" width={256} height={256} />
                <a href={output} download="qr-code.png" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover">
                  Save PNG
                </a>
              </div>
            ) : output ? (
              <>
                {result?.preview && (
                  <div className="border-b border-border p-6">
                    <div className="mx-auto size-20 rounded-md bg-bg" style={{ boxShadow: result.preview.replace('box-shadow: ', '') }} />
                  </div>
                )}
                <HighlightedOutput text={output} language={result?.language ?? 'text'} />
              </>
            ) : (
              <p className="p-3 font-mono text-xs text-muted">Output appears here as you type.</p>
            )}
          </div>
        </Pane>
      </div>

      {result?.stats && result.stats.length > 0 && !shownError && !idle && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3">
          {result.stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2">
              <dt className="text-2xs uppercase tracking-wider text-muted">{s.label}</dt>
              <dd data-numeric className="text-sm">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Pane({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface focus-within:border-border-strong">
      <div className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function placeholderFor(id: string): string {
  const map: Record<string, string> = {
    'dev/json': '{ "paste": "your JSON here" }',
    'dev/jwt': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
    'dev/base64': 'Paste text to encode, or Base64 to decode…',
    'dev/word-count': 'Start typing. Counts update live.',
    'dev/hash': 'Text to hash…',
    'dev/qr': 'https://example.com',
    'dev/diff': 'Paste the original text…',
  };
  return map[id] ?? 'Paste your input here…';
}
