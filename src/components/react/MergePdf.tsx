import { useCallback, useEffect, useRef, useState } from 'react';
import { runFileTool, type RunHandle } from '../../tools/run-tool';
import { ToolError, type FileToolResult } from '../../tools/types';
import FileStage, { DropZone, stage, useThumbnails, type Staged } from './FileStage';
import ResultPreview from './ResultPreview';
import { ResultBar, ErrorBar, type Finished } from './ResultBar';
import { filesBeforeHydration } from './hydration';
import { islandText } from '../../i18n/island';
import type { Locale } from '../../i18n/paths';
import { BusyLabel } from './NeraLoader';

/**
 * Merge PDF, with somewhere to put the files down first.
 *
 * The tool used to be a bare drop zone that combined "in the order you drop
 * them" and showed no list at all, so the order was decided by the order the
 * operating system happened to hand over a multi-select, and the only way to
 * change it was to start again. The engine is unchanged: it still merges the
 * array it is given, in order. What is new is that the array is now something
 * the user can see and rearrange before anything runs.
 */

const TEXT = {
  en: {
    drop: 'Drop PDFs here, or browse', tap: 'Choose PDFs',
    dropSub: 'Put them in order first. Nothing is uploaded, and nothing runs until you say so',
    combine: 'Combine into one PDF',
    working: 'Combining…',
    needTwo: 'Add at least two PDFs to combine.',
    notPdf: (f: string) => `"${f}" is not a PDF, so it was left out.`,
    ready: (n: number) => `${n} PDFs ready to combine.`,
  },
  ms: {
    drop: 'Lepaskan PDF di sini, atau semak imbas', tap: 'Pilih PDF',
    dropSub: 'Susun dahulu. Tiada muat naik, dan tiada apa-apa berjalan sehingga anda memintanya',
    combine: 'Gabungkan menjadi satu PDF',
    working: 'Menggabungkan…',
    needTwo: 'Tambah sekurang-kurangnya dua PDF untuk digabungkan.',
    notPdf: (f: string) => `"${f}" bukan PDF, jadi ia ditinggalkan.`,
    ready: (n: number) => `${n} PDF sedia untuk digabungkan.`,
  },
} satisfies Record<Locale, unknown>;

const INPUT_ID = 'merge-file';
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export default function MergePdf({ locale = 'en', accept }: { locale?: Locale; accept: string }) {
  const t = TEXT[locale];
  const ui = islandText(locale);

  // Files picked before hydration go through the same rule as `add` below:
  // a non-PDF among them is named, not silently dropped. Filtering here alone
  // lost the message whenever hydration was slow (seen under test load).
  const [early] = useState(() => filesBeforeHydration(INPUT_ID));
  const [items, setItems] = useState<Staged[]>(() => early.filter(isPdf).map(stage));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Finished | null>(null);
  const [error, setError] = useState<string | null>(() => {
    const bad = early.find((f) => !isPdf(f));
    return bad ? t.notPdf(bad.name) : null;
  });
  const [rename, setRename] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);
  const handleRef = useRef<RunHandle | null>(null);

  useThumbnails(items, setItems, locale);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    handleRef.current?.cancel();
  }, []);

  /** Any change to the queue makes a previous result stale. */
  const replace = useCallback((next: Staged[]) => {
    setItems(next);
    setDone(null);
    setError(null);
  }, []);

  const add = useCallback((list: FileList | File[] | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    const good = picked.filter(isPdf);
    const bad = picked.find((f) => !isPdf(f));
    // Named, not silently dropped: a .docx in the selection is a mistake worth
    // hearing about, and the old build simply ignored it.
    setError(bad ? t.notPdf(bad.name) : null);
    if (good.length === 0) return;
    setItems((prev) => [...prev, ...good.map(stage)]);
    setDone(null);
    setAnnounce(t.ready(good.length + items.length));
    if (inputRef.current) inputRef.current.value = '';
  }, [items.length, t]);

  // A file picked before hydration fired its change event with no listener.
  useEffect(() => {
    if (items.length > 0) setAnnounce(t.ready(items.length));
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function combine() {
    if (items.length < 2) { setError(t.needTwo); return; }
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const handle = runFileTool('pdf/merge', items.map((it) => it.file), { locale }, () => {});
      handleRef.current = handle;
      const result: FileToolResult = await handle.result;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(result.blob);
      urlRef.current = url;
      setDone({ result, url, size: result.blob.size, elapsed: performance.now() - started });
    } catch (err) {
      setError(err instanceof ToolError || err instanceof Error ? err.message : ui.genericError);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    handleRef.current?.cancel();
    handleRef.current = null;
    setItems([]);
    setDone(null);
    setError(null);
    setRename(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const fileInput = (
    <input
      ref={inputRef} id={INPUT_ID} type="file" accept={accept} multiple
      className="sr-only" tabIndex={-1} aria-hidden="true"
      onChange={(e) => add(e.target.files)}
    />
  );

  if (items.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        {fileInput}
        <DropZone
          onPick={() => inputRef.current?.click()}
          onFiles={add}
          title={t.drop}
          tap={t.tap}
          subtitle={t.dropSub}
        />
        {error && <ErrorBar message={error} onClear={() => setError(null)} t={ui} />}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {fileInput}
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      <FileStage
        items={items}
        setItems={replace}
        onAdd={() => inputRef.current?.click()}
        onAnnounce={setAnnounce}
        locale={locale}
        toolbar={
          <>
            <button
              type="button"
              onClick={() => void combine()}
              disabled={busy || items.length < 2}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on transition-colors duration-[120ms] hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? <BusyLabel label={t.working} /> : t.combine}
            </button>
            <button type="button" onClick={clear} className="rounded border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text">
              {ui.clear}
            </button>
          </>
        }
      />

      <div aria-live="polite" aria-atomic="true">
        {done && (
          <ResultBar done={done} name={rename} onRename={setRename} onClear={clear} t={ui} idBase={INPUT_ID} />
        )}
        {error && <ErrorBar message={error} onClear={() => setError(null)} t={ui} />}
      </div>

      {done && <ResultPreview blob={done.result.blob} locale={locale} />}
    </section>
  );
}
