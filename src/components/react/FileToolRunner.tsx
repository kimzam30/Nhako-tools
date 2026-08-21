import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileToolResult, OptionSpec, OptionValues, ToolMeta } from '../../tools/types';
import { defaultOptions, ToolError } from '../../tools/types';
import { runFileTool } from '../../tools/run-tool';
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

export default function FileToolRunner({ tool }: Props) {
  const id = `${tool.category}/${tool.slug}`;
  const specs = tool.options ?? [];

  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<OptionValues>(() => defaultOptions(specs));
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const downloadRef = useRef<string | null>(null);
  const runId = useRef(0);

  // Revoke the previous object URL whenever a new result replaces it, and on
  // unmount. Leaking these keeps whole output files alive in memory.
  useEffect(() => () => { if (downloadRef.current) URL.revokeObjectURL(downloadRef.current); }, []);

  const execute = useCallback(async (selected: File[], opts: OptionValues) => {
    if (selected.length === 0) return;
    const ticket = ++runId.current;
    const started = performance.now();
    setPhase({ name: 'running', progress: 0 });

    try {
      // CPU-bound tools run in a worker so a 200-page split no longer freezes
      // the tab; the rest run inline because they need the DOM. runFileTool
      // decides, and falls back to inline if the worker cannot start.
      const handle = runFileTool(id, selected, opts, (progress, label) => {
        if (ticket === runId.current) setPhase({ name: 'running', progress, label });
      });
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

  /** Selecting files starts the work immediately — there is no Run button. */
  const accept = useCallback((list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    const selected = tool.multiple ? picked : picked.slice(0, 1);
    setFiles(selected);
    void execute(selected, options);
  }, [execute, options, tool.multiple]);

  function changeOption(key: string, value: string | number | boolean) {
    const next = { ...options, [key]: value };
    setOptions(next);
    if (files.length > 0) void execute(files, next); // re-run with the new setting
  }

  function reset() {
    runId.current++;
    setFiles([]);
    setPhase({ name: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  }

  const busy = phase.name === 'running';

  return (
    <section className="flex flex-col gap-5">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={tool.accept}
        multiple={tool.multiple}
        onChange={(e) => accept(e.target.files)}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/*
        A real <button>, not the <div onClick> the old build used — which had no
        tabIndex, no role and no key handler, so keyboard users could not open
        the file picker at all.
      */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
        disabled={busy}
        className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-[120ms] ${
          dragging ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:border-border-strong'
        } disabled:cursor-wait`}
      >
        <span className="text-sm font-medium">
          {dragging ? 'Drop to start' : files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : `Drop ${tool.multiple ? 'files' : 'a file'} here, or browse`}
        </span>
        <span className="text-2xs text-muted">
          {files.length > 0
            ? files.map((f) => f.name).join(', ').slice(0, 90)
            : 'Runs the moment the file lands — there is no upload step'}
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
          <OptionsPanel specs={specs} values={options} onChange={changeOption} disabled={busy} />
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
