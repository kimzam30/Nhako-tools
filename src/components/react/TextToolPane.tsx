import { useCallback, useEffect, useRef, useState } from 'react';
import type { OptionSpec, OptionValues, TextToolResult, ToolMeta } from '../../tools/types';
import { defaultOptions, ToolError } from '../../tools/types';
import { loadTool } from '../../tools/loaders';
import OptionsPanel from './OptionsPanel';
import { optionsBeforeHydration } from './hydration';
import CopyButton from './CopyButton';
import HighlightedOutput from './HighlightedOutput';
import type { Locale } from '../../i18n/paths';
import { islandText } from '../../i18n/island';

interface Props {
  tool: Pick<ToolMeta, 'category' | 'slug' | 'name' | 'kind' | 'generator'> & { options?: OptionSpec[] };
  locale?: Locale;
}

export default function TextToolPane({ tool, locale = 'en' }: Props) {
  const t = islandText(locale);
  const id = `${tool.category}/${tool.slug}`;
  const specs = tool.options ?? [];
  const twoInputs = tool.kind === 'text2';

  const inputId = `${tool.category}-${tool.slug}-input`;
  const inputBId = `${tool.category}-${tool.slug}-input-b`;
  // Start from whatever is already in the server-rendered textarea. Anything
  // typed or pasted before the island hydrated stayed on screen but was never
  // processed (reproduced in WebKit), because state started empty.
  const [input, setInput] = useState(() => typedBeforeHydration(inputId));
  const [inputB, setInputB] = useState(() => typedBeforeHydration(inputBId));
  // Seeded from the page as rendered, so a choice made before hydration counts.
  const [options, setOptions] = useState<OptionValues>(() => optionsBeforeHydration(specs, defaultOptions(specs)));
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
      setError(err instanceof ToolError || err instanceof Error ? err.message : t.inputError);
    }
  }, [id, t]);

  // Whether there is anything to run is derived, never stored: writing it to
  // state would mean a synchronous setState on mount for every text tool.
  const idle = !tool.generator && input.trim() === '';

  useEffect(() => {
    if (idle) return;
    // `compute` is async and writes state only from a continuation, after
    // awaiting the tool module and its result, never synchronously during the
    // effect. The lint rule's static analysis cannot see across the await, so
    // it reports a cascading render that cannot happen here. Running an async
    // transform when its inputs change is exactly what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void compute(input, inputB, options);
  }, [compute, idle, input, inputB, options]);

  const output = idle ? '' : result?.output ?? '';
  const shownError = idle ? null : error;

  // What a screen reader hears. The whole output pane used to be a live
  // region, so every keystroke announced a half-typed error and then read the
  // entire formatted document aloud. Now one short summary is announced once
  // typing pauses.
  const summary = idle ? '' : shownError
    ? `${t.errorPrefix} ${shownError}`
    : result ? `${t.outputUpdated} ${(result.stats ?? []).map((s) => `${s.label} ${s.value}`).join(', ')}` : '';
  const announced = useSettled(summary, 700);

  return (
    <section className="flex flex-col gap-4">
      {specs.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <OptionsPanel specs={specs} values={options} onChange={(k, v) => setOptions((o) => ({ ...o, [k]: v }))} rangeText={t.numberRange} />
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">{announced}</p>

      <div className={`grid gap-4 ${tool.generator ? '' : 'lg:grid-cols-2'}`}>
        {!tool.generator && (
          <div className="flex flex-col gap-4">
            <Pane title={twoInputs ? t.original : t.input}>
              <textarea
                id={inputId}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                spellCheck={false}
                aria-label={twoInputs ? t.originalText : t.input}
                placeholder={t.placeholders[id] ?? t.placeholderDefault}
                className="h-full min-h-56 w-full resize-y bg-transparent p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted"
              />
            </Pane>
            {twoInputs && (
              <Pane title={t.changed}>
                <textarea
                  id={inputBId}
                  value={inputB}
                  onChange={(e) => setInputB(e.target.value)}
                  spellCheck={false}
                  aria-label={t.changedText}
                  placeholder={t.comparePlaceholder}
                  className="h-full min-h-56 w-full resize-y bg-transparent p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted"
                />
              </Pane>
            )}
          </div>
        )}

        <Pane
          title={t.output}
          action={output && result?.language !== 'image' ? <CopyButton text={output} label={t.copy} copiedLabel={t.copied} announce={t.copiedAnnounce} /> : null}
        >
          <div className="min-h-56 overflow-auto">
            {shownError ? (
              <p className="p-3 font-mono text-xs leading-relaxed text-err">{shownError}</p>
            ) : result?.language === 'image' && output ? (
              <div className="flex flex-col items-center gap-3 p-4">
                <img src={output} alt={t.qrAlt} className="max-w-full rounded bg-white p-2" width={256} height={256} />
                <a href={output} download="qr-code.png" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover">
                  {t.savePng}
                </a>
              </div>
            ) : output ? (
              <>
                {result?.preview && (
                  <div className="border-b border-border p-6">
                    <div className="mx-auto size-20 rounded-md bg-bg" style={{ boxShadow: result.preview.replace('box-shadow: ', '') }} />
                  </div>
                )}
                <HighlightedOutput text={output} language={result?.language ?? 'text'} segments={result?.segments} />
              </>
            ) : (
              <p className="p-3 font-mono text-xs text-muted">{t.outputHere}</p>
            )}
          </div>
        </Pane>
      </div>

      {/*
        The readout is present from first paint rather than appearing once there
        is something to say. Empty it reads as a gauge at rest; filled it is the
        same shell with real numbers in it. Previously it was mounted only when
        a result existed, so the panel popped into being mid-typing and the page
        looked unfinished until you used it.
      */}
      {!shownError && (() => {
        const live = !idle && result?.stats && result.stats.length > 0;
        const fields = live
          ? result.stats!
          : [{ label: t.resultChars, value: '--' }, { label: t.resultTime, value: '--' }];
        return (
          <dl
            aria-hidden={live ? undefined : true}
            className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border border-border bg-sunken px-4 py-3 shadow-[inset_0_1px_0_var(--edge)]"
          >
            {fields.map((s) => (
              <div key={s.label} className="flex items-baseline gap-2">
                <dt className="text-2xs uppercase tracking-wider text-muted">{s.label}</dt>
                <dd data-numeric className={live ? 'text-sm' : 'text-sm text-muted opacity-60'}>{s.value}</dd>
              </div>
            ))}
          </dl>
        );
      })()}
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

/** `value`, but only once it has stopped changing for `ms`. */
function useSettled(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/** The live value of a server-rendered field, or '' during SSR. */
function typedBeforeHydration(id: string): string {
  if (typeof document === 'undefined') return '';
  const el = document.getElementById(id);
  return el instanceof HTMLTextAreaElement ? el.value : '';
}
