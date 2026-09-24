import { useEffect, useRef, useState } from 'react';
import { runFileTool, type RunHandle } from '../../tools/run-tool';
import { ToolError, type FileToolResult } from '../../tools/types';
import { openForPreview, renderPage } from '../../lib/pdf-render';
import { DropZone } from './FileStage';
import ResultPreview from './ResultPreview';
import { ResultBar, ErrorBar, type Finished } from './ResultBar';
import { filesBeforeHydration } from './hydration';
import { islandText } from '../../i18n/island';
import type { Locale } from '../../i18n/paths';
import { BusyLabel } from './NeraLoader';

/**
 * Split PDF, with the pages on screen and a tick box on each one.
 *
 * The tool used to be a drop zone and a text field reading "all, or 1-5, 8,
 * 11-13". That asks you to know, in advance and without looking, which pages
 * you want, and to express it in a syntax. For the common job (keep these
 * four, drop the rest) it was unusable without opening the PDF in something
 * else first.
 *
 * The page range still exists underneath: the ticks are compiled back into
 * exactly the same string the engine already understood, so nothing about
 * splitting changed, only how the pages get chosen.
 */

const TEXT = {
  en: {
    drop: 'Drop a PDF here, or browse',
    dropSub: 'Every page appears with a tick box. Nothing is uploaded',
    drawing: 'Drawing the pages…',
    selected: (n: number, of: number) => `${n} of ${of} pages selected`,
    all: 'Select all',
    none: 'Select none',
    invert: 'Invert',
    odd: 'Odd pages',
    even: 'Even pages',
    page: (n: number) => `Page ${n}`,
    how: 'How to split',
    each: 'One file per page',
    eachHelp: 'Each selected page becomes its own PDF, delivered as a ZIP.',
    one: 'All selected pages in one PDF',
    oneHelp: 'Keeps the chosen pages together, in order, as a single file.',
    split: 'Split',
    working: 'Splitting…',
    needOne: 'Tick at least one page.',
    startOver: 'Start over',
    locked: (f: string) => `"${f}" is password-protected. Unlock it first.`,
    bad: (f: string) => `"${f}" could not be read as a PDF.`,
  },
  ms: {
    drop: 'Lepaskan satu PDF di sini, atau semak imbas',
    dropSub: 'Setiap halaman dipaparkan dengan kotak tanda. Tiada muat naik',
    drawing: 'Melukis halaman…',
    selected: (n: number, of: number) => `${n} daripada ${of} halaman dipilih`,
    all: 'Pilih semua',
    none: 'Pilih tiada',
    invert: 'Songsangkan',
    odd: 'Halaman ganjil',
    even: 'Halaman genap',
    page: (n: number) => `Halaman ${n}`,
    how: 'Cara membahagi',
    each: 'Satu fail bagi setiap halaman',
    eachHelp: 'Setiap halaman yang dipilih menjadi PDF tersendiri, dihantar sebagai ZIP.',
    one: 'Semua halaman dipilih dalam satu PDF',
    oneHelp: 'Mengekalkan halaman yang dipilih bersama, mengikut susunan, sebagai satu fail.',
    split: 'Bahagi',
    working: 'Membahagi…',
    needOne: 'Tandakan sekurang-kurangnya satu halaman.',
    startOver: 'Mula semula',
    locked: (f: string) => `"${f}" dilindungi kata laluan. Buka kuncinya dahulu.`,
    bad: (f: string) => `"${f}" tidak dapat dibaca sebagai PDF.`,
  },
} satisfies Record<Locale, unknown>;

const INPUT_ID = 'split-file';
const THUMB_W = 150;

/**
 * Ticked page numbers, compiled into the range syntax the engine already
 * speaks: [1,2,3,7,9,10] becomes "1-3, 7, 9-10". Runs of one stay single, so
 * the string is also the one a person would have typed.
 */
export function toRange(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i]!;
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) { end = sorted[++i]!; }
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    i++;
  }
  return parts.join(', ');
}

export default function SplitPdf({ locale = 'en', accept }: { locale?: Locale; accept: string }) {
  const t = TEXT[locale];
  const ui = islandText(locale);

  const [file, setFile] = useState<File | null>(() => filesBeforeHydration(INPUT_ID)[0] ?? null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [pages, setPages] = useState(0);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<'each' | 'one'>('each');
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Finished | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rename, setRename] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);
  const handleRef = useRef<RunHandle | null>(null);
  const thumbUrls = useRef<string[]>([]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    for (const u of thumbUrls.current) URL.revokeObjectURL(u);
    handleRef.current?.cancel();
  }, []);

  // Draw every page of whatever file is loaded.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setDrawing(true);
    setError(null);

    void (async () => {
      let doc;
      try {
        doc = await openForPreview(new Uint8Array(await file.arrayBuffer()));
      } catch (err) {
        if (cancelled) return;
        setError((err as Error)?.name === 'PasswordException' ? t.locked(file.name) : t.bad(file.name));
        setDrawing(false);
        return;
      }
      if (cancelled) { void doc.destroy(); return; }

      setPages(doc.numPages);
      // Everything ticked to begin with: "split every page" was the old
      // default when the range was left empty, so the page opens on the same
      // behaviour it always had.
      setPicked(new Set(Array.from({ length: doc.numPages }, (_, i) => i + 1)));
      setThumbs(new Array(doc.numPages).fill(''));

      for (let i = 1; i <= doc.numPages; i++) {
        const r = await renderPage(doc, i, THUMB_W);
        if (cancelled) { URL.revokeObjectURL(r.url); break; }
        thumbUrls.current.push(r.url);
        // One at a time, so a long document is usable before it finishes.
        setThumbs((prev) => { const next = [...prev]; next[i - 1] = r.url; return next; });
      }
      void doc.destroy();
      if (!cancelled) setDrawing(false);
    })();

    return () => { cancelled = true; };
    // `t` is derived from `locale` and constant for the island's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function accept_(list: FileList | File[] | null) {
    const next = Array.from(list ?? [])[0];
    if (!next) return;
    for (const u of thumbUrls.current) URL.revokeObjectURL(u);
    thumbUrls.current = [];
    setThumbs([]); setPages(0); setPicked(new Set());
    setDone(null); setError(null); setRename(null);
    setFile(next);
    if (inputRef.current) inputRef.current.value = '';
  }

  /** Any change to the selection makes a previous result stale. */
  function select(next: Set<number>) {
    setPicked(next);
    setDone(null);
  }

  const toggle = (n: number) => {
    const next = new Set(picked);
    if (next.has(n)) next.delete(n); else next.add(n);
    select(next);
  };

  const all = () => select(new Set(Array.from({ length: pages }, (_, i) => i + 1)));
  const none = () => select(new Set());
  const invert = () => select(new Set(
    Array.from({ length: pages }, (_, i) => i + 1).filter((n) => !picked.has(n))));
  const only = (test: (n: number) => boolean) => select(new Set(
    Array.from({ length: pages }, (_, i) => i + 1).filter(test)));

  async function split() {
    if (!file) return;
    if (picked.size === 0) { setError(t.needOne); return; }
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const range = toRange([...picked]);
      const handle = runFileTool('pdf/split', [file], { range, mode, locale }, () => {});
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
    for (const u of thumbUrls.current) URL.revokeObjectURL(u);
    thumbUrls.current = [];
    setFile(null); setThumbs([]); setPages(0); setPicked(new Set());
    setDone(null); setError(null); setRename(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const fileInput = (
    <input
      ref={inputRef} id={INPUT_ID} type="file" accept={accept}
      className="sr-only" tabIndex={-1} aria-hidden="true"
      onChange={(e) => accept_(e.target.files)}
    />
  );

  if (!file) {
    return (
      <section className="flex flex-col gap-4">
        {fileInput}
        <DropZone onPick={() => inputRef.current?.click()} onFiles={accept_} title={t.drop} subtitle={t.dropSub} />
        {error && <ErrorBar message={error} onClear={() => setError(null)} t={ui} />}
      </section>
    );
  }

  const chip = 'rounded border border-border px-2.5 py-1 text-2xs text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-40';
  /**
   * Nothing can be selected until the document has been opened and its length
   * is known.
   *
   * The controls used to be live from the moment a file was chosen, while the
   * pages were still being counted. A click in that window set a selection,
   * and then the open finished and seeded "everything ticked" straight over
   * the top of it. On a short PDF the window is a few milliseconds; on a 200
   * page scan it is long enough to lose a deliberate choice.
   */
  const ready = pages > 0;

  return (
    <section className="flex flex-col gap-4">
      {fileInput}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span data-selected-count data-numeric className="text-sm font-medium" role="status" aria-live="polite">
          {t.selected(picked.size, pages)}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip} disabled={!ready} onClick={all}>{t.all}</button>
          <button type="button" className={chip} disabled={!ready} onClick={none}>{t.none}</button>
          <button type="button" className={chip} disabled={!ready} onClick={invert}>{t.invert}</button>
          <button type="button" className={chip} disabled={!ready} onClick={() => only((n) => n % 2 === 1)}>{t.odd}</button>
          <button type="button" className={chip} disabled={!ready} onClick={() => only((n) => n % 2 === 0)}>{t.even}</button>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button" onClick={() => void split()} disabled={busy || !ready || picked.size === 0}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on transition-colors duration-[120ms] hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? <BusyLabel label={t.working} /> : t.split}
          </button>
          <button type="button" onClick={clear} className="rounded border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text">
            {t.startOver}
          </button>
        </div>
      </div>

      {/*
        The two meanings of "split", stated rather than assumed. The tool only
        ever did the first, and the second was reachable only by splitting into
        every page and merging most of them back.
      */}
      <fieldset className="rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 text-2xs font-semibold uppercase tracking-wider text-muted">{t.how}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([['each', t.each, t.eachHelp], ['one', t.one, t.oneHelp]] as const).map(([value, label, help]) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-2.5 rounded-md border p-3 transition-colors ${
                mode === value ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border-strong'
              }`}
            >
              <input
                type="radio" name="split-mode" value={value} checked={mode === value}
                onChange={() => { setMode(value); setDone(null); }}
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="mt-0.5 block text-2xs leading-snug text-muted">{help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {drawing && <p className="text-xs text-muted">{t.drawing}</p>}

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => {
          const on = picked.has(n);
          return (
            <li key={n}>
              {/*
                The whole card is the control. A tick box alone is a 16px
                target next to a 150px picture of the thing it refers to, and
                on a phone that is the difference between usable and not.
              */}
              <label
                data-page-card={n}
                data-picked={on || undefined}
                className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-2 transition-colors ${
                  on ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded bg-sunken">
                  {thumbs[n - 1]
                    ? <img src={thumbs[n - 1]} alt="" className="max-h-full max-w-full object-contain shadow-sm" />
                    : <span className="text-2xs text-muted">…</span>}

                  <span
                    data-position
                    data-numeric
                    className="absolute left-1 top-1 grid min-w-6 place-items-center rounded bg-accent px-1.5 py-0.5 font-mono text-xs font-bold text-accent-on shadow-sm"
                  >
                    {n}
                  </span>
                </div>

                <span className="flex items-center gap-2">
                  <input
                    type="checkbox" checked={on} onChange={() => toggle(n)}
                    aria-label={t.page(n)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  <span className="truncate text-2xs text-muted">{t.page(n)}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ol>

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
