import { useCallback, useEffect, useRef, useState } from 'react';
import { runFileTool, type RunHandle } from '../../tools/run-tool';
import { ToolError, defaultOptions, type FileToolResult, type OptionSpec, type OptionValues } from '../../tools/types';
import FileStage, { DropZone, stage, useThumbnails, type Staged } from './FileStage';
import OptionsPanel from './OptionsPanel';
import ResultPreview from './ResultPreview';
import { ResultBar, ErrorBar, type Finished } from './ResultBar';
import { filesBeforeHydration } from './hydration';
import { islandText } from '../../i18n/island';
import type { Locale } from '../../i18n/paths';

/**
 * JPG to PDF, where the order of the photos is the order of the document.
 *
 * Same staging as Merge PDF, and for a sharper reason: a phone hands over a
 * multi-select in whatever order it likes, so a set of receipts or a scanned
 * contract arrived shuffled and there was no way to tell until the PDF was
 * open in a reader. The page settings sit beside the queue rather than above
 * an empty drop zone, so they are chosen while the photos are on screen.
 */

const TEXT = {
  en: {
    drop: 'Drop photos here, or browse',
    dropSub: 'Arrange them first. Nothing is uploaded, and nothing runs until you say so',
    build: 'Make the PDF',
    working: 'Building the PDF…',
    none: 'Add at least one photo.',
    notImage: (f: string) => `"${f}" is not an image, so it was left out.`,
    ready: (n: number) => `${n} photo${n === 1 ? '' : 's'} ready.`,
    settings: 'Page settings',
  },
  ms: {
    drop: 'Lepaskan foto di sini, atau semak imbas',
    dropSub: 'Susun dahulu. Tiada muat naik, dan tiada apa-apa berjalan sehingga anda memintanya',
    build: 'Hasilkan PDF',
    working: 'Membina PDF…',
    none: 'Tambah sekurang-kurangnya satu foto.',
    notImage: (f: string) => `"${f}" bukan imej, jadi ia ditinggalkan.`,
    ready: (n: number) => `${n} foto sedia.`,
    settings: 'Tetapan halaman',
  },
} satisfies Record<Locale, unknown>;

const INPUT_ID = 'jpg-to-pdf-file';
const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);

export default function JpgToPdf({ locale = 'en', accept, options }: {
  locale?: Locale; accept: string; options: OptionSpec[];
}) {
  const t = TEXT[locale];
  const ui = islandText(locale);

  const [items, setItems] = useState<Staged[]>(() => filesBeforeHydration(INPUT_ID).filter(isImage).map(stage));
  const [values, setValues] = useState<OptionValues>(() => defaultOptions(options));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Finished | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const replace = useCallback((next: Staged[]) => {
    setItems(next);
    setDone(null);
    setError(null);
  }, []);

  const add = useCallback((list: FileList | File[] | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    const good = picked.filter(isImage);
    const bad = picked.find((f) => !isImage(f));
    setError(bad ? t.notImage(bad.name) : null);
    if (good.length === 0) return;
    setItems((prev) => [...prev, ...good.map(stage)]);
    setDone(null);
    setAnnounce(t.ready(good.length + items.length));
    if (inputRef.current) inputRef.current.value = '';
  }, [items.length, t]);

  useEffect(() => {
    if (items.length > 0) setAnnounce(t.ready(items.length));
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A page setting changed: the last PDF no longer reflects the settings. */
  function changeOption(key: string, value: string | number | boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDone(null);
  }

  async function build() {
    if (items.length === 0) { setError(t.none); return; }
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const handle = runFileTool('pdf/jpg-to-pdf', items.map((it) => it.file), { ...values, locale }, () => {});
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
        <DropZone onPick={() => inputRef.current?.click()} onFiles={add} title={t.drop} subtitle={t.dropSub} />
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
              onClick={() => void build()}
              disabled={busy}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on transition-colors duration-[120ms] hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? t.working : t.build}
            </button>
            <button type="button" onClick={clear} className="rounded border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text">
              {ui.clear}
            </button>
          </>
        }
      />

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted">{t.settings}</h2>
        <OptionsPanel specs={options} values={values} onChange={changeOption} rangeText={ui.numberRange} />
      </div>

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
