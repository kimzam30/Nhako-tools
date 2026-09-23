import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileToolResult, OptionSpec, OptionValues, ToolMeta } from '../../tools/types';
import { defaultOptions, ToolError } from '../../tools/types';
import { runFileTool, type RunHandle } from '../../tools/run-tool';
import { bytes, duration } from '../../lib/format';
import OptionsPanel from './OptionsPanel';
import CopyButton from './CopyButton';
import { optionsBeforeHydration } from './hydration';
import { localePath, type Locale } from '../../i18n/paths';
import { islandText } from '../../i18n/island';

type Phase =
  | { name: 'idle' }
  | { name: 'running'; progress: number; label?: string }
  | { name: 'done'; result: FileToolResult; elapsed: number; size: number; url: string }
  | { name: 'error'; message: string };

interface Props {
  tool: Pick<ToolMeta, 'category' | 'slug' | 'name' | 'accept' | 'multiple' | 'heavy'> & { options?: OptionSpec[] };
  locale?: Locale;
  /** A preset page's starting values, e.g. { target: '500' }. */
  initialOptions?: OptionValues;
}

/**
 * How long typing or dragging must pause before the tool re-runs. Without
 * this, every keystroke in "Pages" started a run, and a run in progress used
 * to disable the field, so it lost focus after the first character.
 */
const SETTLE_MS = 400;

export default function FileToolRunner({ tool, locale = 'en', initialOptions }: Props) {
  const id = `${tool.category}/${tool.slug}`;
  const t = islandText(locale);
  const specs = tool.options ?? [];

  const inputId = `${tool.category}-${tool.slug}-file`;
  // A file picked before the island hydrated fired its change event with no
  // listener attached, so nothing ever ran. Pick it up from the DOM instead.
  const [files, setFiles] = useState<File[]>(() => pickedBeforeHydration(inputId, tool.multiple));
  // Seeded from the page as rendered, so a choice made before hydration counts.
  const [options, setOptions] = useState<OptionValues>(() => optionsBeforeHydration(specs, { ...defaultOptions(specs), ...initialOptions }));
  // The latest files and options, readable from event handlers that fire
  // before the next render. Picking a file and immediately typing a page range
  // used to read the previous render's "no files", skip the re-run, and leave
  // the result for the old settings on screen.
  const filesRef = useRef(files);
  const optionsRef = useRef(options);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [dragging, setDragging] = useState(false);
  // Heavy tools (minutes of ffmpeg or Whisper) never re-run on their own
  // when a setting changes; they wait for an explicit click.
  const [stale, setStale] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const downloadRef = useRef<string | null>(null);
  const handleRef = useRef<RunHandle | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const runId = useRef(0);

  // Revoke the last object URL and stop any work on unmount. Leaking these
  // keeps whole output files alive in memory.
  useEffect(() => () => {
    if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
    handleRef.current?.cancel();
    clearTimeout(settleTimer.current);
  }, []);

  const execute = useCallback(async (selected: File[], opts: OptionValues) => {
    if (selected.length === 0) return;
    clearTimeout(settleTimer.current);
    handleRef.current?.cancel(); // a newer run supersedes the old one
    const ticket = ++runId.current;
    const started = performance.now();
    setStale(false);
    setPhase({ name: 'running', progress: 0 });

    try {
      // CPU-bound tools run in a worker so a 200-page split no longer freezes
      // the tab; the rest run inline because they need the DOM. runFileTool
      // decides, and falls back to inline if the worker cannot start.
      // The locale rides along with the options so a tool can word its own
      // summary and errors in the page's language.
      const handle = runFileTool(id, selected, { ...opts, locale }, (progress, label) => {
        if (ticket === runId.current) setPhase({ name: 'running', progress, label });
      });
      handleRef.current = handle;
      const result = await handle.result;

      if (ticket !== runId.current) return; // superseded by a newer run
      if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
      const url = URL.createObjectURL(result.blob);
      downloadRef.current = url;
      setPhase({ name: 'done', result, elapsed: performance.now() - started, size: result.blob.size, url });
    } catch (err) {
      if (ticket !== runId.current) return;
      // Inline, never alert(). The old build used alert() seven times over.
      setPhase({
        name: 'error',
        message: err instanceof ToolError || err instanceof Error
          ? err.message
          : t.genericError,
      });
    }
  }, [id, locale, t]);

  // Run once for a file that was chosen before hydration (see `files` above).
  // Mount only: this used to re-run whenever `files` changed, so a file picked
  // normally ran a second time here with the previous render's options, and
  // that run cancelled the pending one for a page range typed straight after.
  // The refs hold whatever was chosen or typed since, not the first render's.
  useEffect(() => {
    if (filesRef.current.length === 0) return;
    // execute() is async: its state writes happen in its own continuation,
    // exactly as when a file is picked normally.
    void execute(filesRef.current, optionsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = phase.name === 'running';

  /** Selecting files starts the work immediately. There is no Run button. */
  const accept = useCallback((list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    // A heavy job cannot be interrupted part-way (ffmpeg has no cancel), and
    // starting a second one on the same engine would corrupt both.
    if (busy && tool.heavy) return;
    const selected = tool.multiple ? picked : picked.slice(0, 1);
    filesRef.current = selected;
    setFiles(selected);
    void execute(selected, optionsRef.current);
  }, [busy, execute, tool.heavy, tool.multiple]);

  function changeOption(key: string, value: string | number | boolean) {
    const next = { ...optionsRef.current, [key]: value };
    optionsRef.current = next;
    setOptions(next);
    const current = filesRef.current;
    if (current.length === 0) return;

    if (tool.heavy) {
      setStale(true);
      return;
    }

    // Discrete choices apply at once; typed and dragged values wait for a
    // pause so a half-typed "1-" is never run.
    const kind = specs.find((s) => s.key === key)?.kind;
    clearTimeout(settleTimer.current);
    if (kind === 'select' || kind === 'toggle') void execute(current, next);
    else settleTimer.current = setTimeout(() => void execute(filesRef.current, optionsRef.current), SETTLE_MS);
  }

  function reset() {
    runId.current++;
    clearTimeout(settleTimer.current);
    handleRef.current?.cancel();
    handleRef.current = null;
    filesRef.current = [];
    setFiles([]);
    setStale(false);
    setPhase({ name: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <section className="flex flex-col gap-5">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={tool.accept}
        multiple={tool.multiple}
        onChange={(e) => accept(e.target.files)}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/*
        A real <button>, not the <div onClick> the old build used, which had no
        tabIndex, no role and no key handler, so keyboard users could not open
        the file picker at all. It is never `disabled`: a disabled button drops
        drag events, and the browser then opens the dropped file itself,
        navigating away from the page.
      */}
      <button
        type="button"
        onClick={() => { if (!(busy && tool.heavy)) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer?.files ?? null); }}
        aria-disabled={busy && tool.heavy ? true : undefined}
        className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-[120ms] ${
          dragging ? 'border-accent bg-accent-subtle' : 'border-border bg-sunken shadow-[inset_0_1px_0_var(--edge)] hover:border-border-strong'
        } aria-disabled:cursor-wait`}
      >
        <span className="text-sm font-medium">
          {dragging ? t.dropToStart : files.length > 0 ? t.filesSelected(files.length) : t.dropHere(Boolean(tool.multiple))}
        </span>
        <span className="text-xs text-muted">
          {files.length > 0
            ? files.map((f) => f.name).join(', ').slice(0, 90)
            : t.runsOnLand}
        </span>
      </button>

      <p className="-mt-2 text-xs text-muted">
        {t.runsInBrowser}{' '}
        <a href={localePath(locale, '/privacy')} className="underline decoration-border underline-offset-2 transition-colors hover:text-accent">
          {t.verifyNetwork}
        </a>
        .
      </p>

      {specs.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <OptionsPanel specs={specs} values={options} onChange={changeOption} rangeText={t.numberRange} />
        </div>
      )}

      {stale && !busy && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-sunken px-4 py-3 shadow-[inset_0_1px_0_var(--edge)]">
          <p className="text-sm text-muted">{t.settingsChanged}</p>
          <button
            type="button"
            onClick={() => void execute(files, options)}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on transition-colors duration-[120ms] hover:bg-accent-hover"
          >
            {t.runAgain}
          </button>
        </div>
      )}

      {/*
        THE RESULT REGION IS PRESENT FROM FIRST PAINT.

        It reads as a gauge at rest, not as a disabled form: a greyed-out button
        says "you cannot use this yet", a readout at zero says "ready, waiting
        for input", which is the same fact told the way this product wants it
        told. It is also why the page stops looking unfinished before anyone has
        dropped anything, and why CLS stays 0: the space was never going to
        change. --edge gives it a machined inset rather than a drop shadow.

        aria-hidden, because the live region below announces the real result and
        a screen reader does not need to hear three dashes first.
      */}
      {phase.name === 'idle' && (
        <div
          aria-hidden="true"
          className="rounded-lg border border-border bg-sunken px-4 py-3 shadow-[inset_0_1px_0_var(--edge)]"
        >
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">{t.resultLabel}</p>
          <dl className="space-y-1">
            {[t.resultOut, t.resultSize, t.resultTime].map((field) => (
              <div key={field} className="flex items-baseline gap-3">
                <dt data-numeric className="w-12 shrink-0 text-xs text-muted">{field}</dt>
                <dd data-numeric className="text-xs text-muted opacity-60">--</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div aria-live="polite" aria-atomic="true">
        {busy && (
          <div className="rounded-lg border border-border bg-sunken px-4 py-3 shadow-[inset_0_1px_0_var(--edge)]">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span>{phase.label ?? t.working}…</span>
              {/* Only heavy tools get a bar; a bar on a 400ms task feels slower. */}
              {tool.heavy && <span data-numeric className="text-xs text-muted">{Math.round(phase.progress * 100)}%</span>}
            </div>
            {tool.heavy && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken">
                <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${phase.progress * 100}%` }} />
              </div>
            )}
          </div>
        )}

        {phase.name === 'done' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-border bg-sunken px-4 py-3 shadow-[inset_0_1px_0_var(--edge)]">
            <span className="text-ok" aria-hidden="true">✓</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{phase.result.filename}</p>
              <p data-numeric className="text-2xs text-muted">
                {[phase.result.summary, bytes(phase.size), duration(phase.elapsed)].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={phase.url}
                download={phase.result.filename}
                className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on transition-colors duration-[120ms] hover:bg-accent-hover"
              >
                {t.save}
              </a>
              <button type="button" onClick={reset} className="rounded border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text">
                {t.clear}
              </button>
            </div>
            {phase.result.text !== undefined && (
              <div className="basis-full">
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor={`${inputId}-text`} className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.output}</label>
                  <CopyButton text={phase.result.text} label={t.copy} copiedLabel={t.copied} announce={t.copiedAnnounce} />
                </div>
                <textarea
                  id={`${inputId}-text`} readOnly value={phase.result.text} rows={10}
                  className="w-full resize-y rounded border border-border bg-bg p-3 font-mono text-xs leading-relaxed"
                />
              </div>
            )}
          </div>
        )}

        {phase.name === 'error' && (
          <div className="flex items-start gap-3 rounded-lg border border-err bg-err-subtle px-4 py-3">
            <span className="text-err" aria-hidden="true">!</span>
            <p className="flex-1 text-sm text-err">{phase.message}</p>
            <button type="button" onClick={reset} className="shrink-0 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-text">
              {t.clear}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Files already chosen in the server-rendered input, or none during SSR. */
function pickedBeforeHydration(id: string, multiple?: boolean): File[] {
  if (typeof document === 'undefined') return [];
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement) || !el.files) return [];
  const picked = Array.from(el.files);
  return multiple ? picked : picked.slice(0, 1);
}
