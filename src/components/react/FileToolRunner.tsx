import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileToolResult, OptionSpec, OptionValues, ToolMeta } from '../../tools/types';
import { defaultOptions, ToolError } from '../../tools/types';
import { runFileTool, type RunHandle } from '../../tools/run-tool';
import { bytes, duration } from '../../lib/format';
import OptionsPanel from './OptionsPanel';

type Phase =
  | { name: 'idle' }
  | { name: 'running'; progress: number; label?: string }
  | { name: 'done'; result: FileToolResult; elapsed: number; size: number; url: string }
  | { name: 'error'; message: string };

interface Props {
  tool: Pick<ToolMeta, 'category' | 'slug' | 'name' | 'accept' | 'multiple' | 'heavy'> & { options?: OptionSpec[] };
}

/**
 * How long typing or dragging must pause before the tool re-runs. Without
 * this, every keystroke in "Pages" started a run, and a run in progress used
 * to disable the field, so it lost focus after the first character.
 */
const SETTLE_MS = 400;

export default function FileToolRunner({ tool }: Props) {
  const id = `${tool.category}/${tool.slug}`;
  const specs = tool.options ?? [];

  const inputId = `${tool.category}-${tool.slug}-file`;
  // A file picked before the island hydrated fired its change event with no
  // listener attached, so nothing ever ran. Pick it up from the DOM instead.
  const [files, setFiles] = useState<File[]>(() => pickedBeforeHydration(inputId, tool.multiple));
  const [options, setOptions] = useState<OptionValues>(() => defaultOptions(specs));
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
      const handle = runFileTool(id, selected, opts, (progress, label) => {
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
          : 'Something went wrong running this tool.',
      });
    }
  }, [id]);

  // Run once for a file that was chosen before hydration (see `files` above).
  const startedEarly = useRef(false);
  useEffect(() => {
    if (startedEarly.current || files.length === 0) return;
    startedEarly.current = true;
    // execute() is async: its state writes happen in its own continuation,
    // exactly as when a file is picked normally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void execute(files, options);
  }, [execute, files, options]);

  const busy = phase.name === 'running';

  /** Selecting files starts the work immediately. There is no Run button. */
  const accept = useCallback((list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    // A heavy job cannot be interrupted part-way (ffmpeg has no cancel), and
    // starting a second one on the same engine would corrupt both.
    if (busy && tool.heavy) return;
    const selected = tool.multiple ? picked : picked.slice(0, 1);
    setFiles(selected);
    void execute(selected, options);
  }, [busy, execute, options, tool.heavy, tool.multiple]);

  function changeOption(key: string, value: string | number | boolean) {
    const next = { ...options, [key]: value };
    setOptions(next);
    if (files.length === 0) return;

    if (tool.heavy) {
      setStale(true);
      return;
    }

    // Discrete choices apply at once; typed and dragged values wait for a
    // pause so a half-typed "1-" is never run.
    const kind = specs.find((s) => s.key === key)?.kind;
    clearTimeout(settleTimer.current);
    if (kind === 'select' || kind === 'toggle') void execute(files, next);
    else settleTimer.current = setTimeout(() => void execute(files, next), SETTLE_MS);
  }

  function reset() {
    runId.current++;
    clearTimeout(settleTimer.current);
    handleRef.current?.cancel();
    handleRef.current = null;
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
          dragging ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:border-border-strong'
        } aria-disabled:cursor-wait`}
      >
        <span className="text-sm font-medium">
          {dragging ? 'Drop to start' : files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : `Drop ${tool.multiple ? 'files' : 'a file'} here, or browse`}
        </span>
        <span className="text-2xs text-muted">
          {files.length > 0
            ? files.map((f) => f.name).join(', ').slice(0, 90)
            : 'Runs the moment the file lands. There is no upload step'}
        </span>
      </button>

      <p className="-mt-2 text-2xs text-muted">
        Runs entirely in your browser.{' '}
        <a href="/privacy" className="underline decoration-border underline-offset-2 transition-colors hover:text-accent">
          Verify it in your network tab
        </a>
        .
      </p>

      {specs.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <OptionsPanel specs={specs} values={options} onChange={changeOption} />
        </div>
      )}

      {stale && !busy && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-sm text-muted">Settings changed. This tool is slow, so it waits for you.</p>
          <button
            type="button"
            onClick={() => void execute(files, options)}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on transition-colors duration-[120ms] hover:bg-accent-hover"
          >
            Run again with these settings
          </button>
        </div>
      )}

      <div aria-live="polite" aria-atomic="true">
        {busy && (
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span>{phase.label ?? 'Working'}…</span>
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-border bg-surface px-4 py-3">
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
                Save
              </a>
              <button type="button" onClick={reset} className="rounded border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text">
                Clear
              </button>
            </div>
          </div>
        )}

        {phase.name === 'error' && (
          <div className="flex items-start gap-3 rounded-lg border border-err bg-err-subtle px-4 py-3">
            <span className="text-err" aria-hidden="true">!</span>
            <p className="flex-1 text-sm text-err">{phase.message}</p>
            <button type="button" onClick={reset} className="shrink-0 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-text">
              Clear
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
