import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileToolResult, OptionSpec, OptionValues, ToolMeta } from '../../tools/types';
import { defaultOptions, ToolError } from '../../tools/types';
import { runFileTool, type RunHandle } from '../../tools/run-tool';
import OptionsPanel from './OptionsPanel';
import FilePreview from './FilePreview';
import ResultPreview from './ResultPreview';
import { ResultBar, ErrorBar } from './ResultBar';
import { optionsBeforeHydration } from './hydration';
import { localePath, type Locale } from '../../i18n/paths';
import { islandText } from '../../i18n/island';

/** A finished run, kept apart from the phase so it can outlive the next one. */
interface Done { result: FileToolResult; elapsed: number; size: number; url: string }

type Phase =
  | { name: 'idle' }
  | { name: 'running'; progress: number; label?: string }
  | ({ name: 'done' } & Done)
  | { name: 'error'; message: string };

interface Props {
  tool: Pick<ToolMeta, 'category' | 'slug' | 'name' | 'accept' | 'multiple' | 'heavy' | 'stageFirst'> & { options?: OptionSpec[] };
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

/** Wording for the empty preview pane. The filled one words itself. */
const PREVIEW_TEXT = {
  en: { label: 'Preview', waiting: 'Your result appears here, and follows every setting you change.' },
  ms: { label: 'Pratonton', waiting: 'Hasil anda muncul di sini, dan mengikut setiap tetapan yang anda ubah.' },
} satisfies Record<Locale, unknown>;

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
  /**
   * The last successful run, kept while the next one is in flight.
   *
   * Without it the preview panel unmounted on every option change and came
   * back a few hundred milliseconds later, so dragging the opacity slider on
   * Watermark PDF strobed the page rather than showing the watermark fading.
   * The held copy stays on screen, dimmed, until its replacement is ready.
   */
  const [held, setHeld] = useState<Done | null>(null);
  /**
   * The name the user typed, minus the extension, or null for the tool's own.
   * It survives a re-run: renaming the output and then nudging a slider must
   * not silently put the tool's default name back on the Save button.
   */
  const [rename, setRename] = useState<string | null>(null);
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
      const done: Done = { result, elapsed: performance.now() - started, size: result.blob.size, url };
      setHeld(done);
      setPhase({ name: 'done', ...done });
    } catch (err) {
      if (ticket !== runId.current) return;
      // The held preview goes with it. A page range that no longer parses
      // leaves the previous output on screen, and showing it beside the error
      // would state that the settings now on the panel produced that file.
      setHeld(null);
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
  const tPreview = PREVIEW_TEXT[locale];

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
    // A different input means a different output: neither the old preview nor
    // a name typed for the previous file carries over.
    setHeld(null);
    setRename(null);
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
    setHeld(null);
    setRename(null);
    setPhase({ name: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    /*
      TWO COLUMNS ON A WIDE SCREEN: THE CONTROLS, AND WHAT THEY PRODUCE.

      The preview has to sit beside the settings, not under them. Under them it
      is below the fold on every tool with more than two controls, so adjusting
      an opacity slider means dragging, scrolling down to look, scrolling back
      up to drag again. Beside them, the slider and its effect are in one view
      and the loop closes.

      The right column is sticky, so a long options panel or a long file list
      cannot scroll the preview away from the control being adjusted.
    */
    <section className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-5">
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

      <p className="-mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted">
        <span>
          {t.runsInBrowser}{' '}
          <a href={localePath(locale, '/privacy')} className="underline decoration-border underline-offset-2 transition-colors hover:text-accent">
            {t.verifyNetwork}
          </a>
          .
        </span>
        {/* Batch support, stated rather than left to be inferred from a plural. */}
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-2xs">
          {tool.multiple ? t.multiYes : t.multiNo}
        </span>
      </p>

      {/* What was handed to the tool, beside what came back out of it. */}
      {files.length > 0 && <FilePreview files={files} locale={locale} />}

      {/*
        `stageFirst` tools keep their settings back until there is something to
        apply them to. See ToolMeta.stageFirst for why this is opt-in. The
        panel is not merely disabled: a greyed-out form still asks you to read
        five settings you cannot use yet.
      */}
      {specs.length > 0 && (!tool.stageFirst || files.length > 0) && (
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
          <ResultBar
            done={{ result: phase.result, url: phase.url, size: phase.size, elapsed: phase.elapsed }}
            name={rename}
            onRename={setRename}
            onClear={reset}
            t={t}
            idBase={inputId}
          />
        )}

        {phase.name === 'error' && (
          <ErrorBar message={phase.message} onClear={reset} t={t} />
        )}
      </div>
      </div>

      {/*
        The output preview sits OUTSIDE the live region above.

        Inside it, every re-render of the canvas would be announced, so dragging
        a slider would read the whole panel out again on each settle. The result
        row states the outcome in words; this shows it.

        It is fed by `held`, not by `phase`, so it survives a re-run and dims
        instead of disappearing. See the comment on `held`.
      */}
      <div className="mt-5 lg:mt-0 lg:sticky lg:top-20">
        {held ? (
          <div className={`transition-opacity duration-200 ${busy ? 'opacity-50' : 'opacity-100'}`}>
            <ResultPreview blob={held.result.blob} locale={locale} />
          </div>
        ) : (
          /*
            The pane is present before there is anything in it, for the same
            reason the result readout is: the column is reserved, so nothing
            jumps when the first result lands, and an empty labelled frame
            reads as "ready" where a gap reads as "unfinished".

            aria-hidden, because it states nothing the live region does not.
          */
          <section
            aria-hidden="true"
            className="hidden rounded-lg border border-dashed border-border bg-sunken p-3 lg:block"
          >
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">{tPreview.label}</p>
            <div className="grid min-h-56 place-items-center rounded bg-bg/40">
              <p className="px-6 text-center text-xs text-muted">{tPreview.waiting}</p>
            </div>
          </section>
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
