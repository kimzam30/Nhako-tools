import { useEffect, useRef, useState } from 'react';
import { assemble, type PagePick } from '../../tools/pdf/organize';
import { openForPreview, renderPage } from '../../lib/pdf-render';
import { bytes } from '../../lib/format';
import { filesBeforeHydration } from './hydration';
import type { Locale } from '../../i18n/paths';

const TEXT = {
  en: {
    drop: 'Drop PDFs here, or browse',
    dropSub: 'Every page appears as a thumbnail. Nothing is uploaded',
    add: 'Add another PDF',
    pages: (n: number) => `${n} page${n === 1 ? '' : 's'}`,
    page: (n: number, file: string) => `Page ${n} of ${file}`,
    earlier: 'Move earlier', later: 'Move later',
    left: 'Rotate anticlockwise', right: 'Rotate clockwise', remove: 'Remove page',
    save: 'Save PDF', saving: 'Building the PDF…', reset: 'Start over',
    hint: 'Drag pages to reorder, or use the buttons on each page.',
    empty: 'Every page has been removed. Add a PDF or start over.',
    locked: (f: string) => `"${f}" is password-protected. Unlock it first.`,
    bad: (f: string) => `"${f}" could not be read as a PDF.`,
    moved: (n: number, at: number) => `Page moved to position ${at} of ${n}.`,
  },
  ms: {
    drop: 'Lepaskan PDF di sini, atau semak imbas',
    dropSub: 'Setiap halaman dipaparkan sebagai lakaran kecil. Tiada muat naik',
    add: 'Tambah PDF lain',
    pages: (n: number) => `${n} halaman`,
    page: (n: number, file: string) => `Halaman ${n} daripada ${file}`,
    earlier: 'Alih ke depan', later: 'Alih ke belakang',
    left: 'Putar lawan jam', right: 'Putar ikut jam', remove: 'Buang halaman',
    save: 'Simpan PDF', saving: 'Membina PDF…', reset: 'Mula semula',
    hint: 'Seret halaman untuk menyusun semula, atau guna butang pada setiap halaman.',
    empty: 'Semua halaman telah dibuang. Tambah PDF atau mula semula.',
    locked: (f: string) => `"${f}" dilindungi kata laluan. Buka kuncinya dahulu.`,
    bad: (f: string) => `"${f}" tidak dapat dibaca sebagai PDF.`,
    moved: (n: number, at: number) => `Halaman dialih ke kedudukan ${at} daripada ${n}.`,
  },
} satisfies Record<Locale, unknown>;

interface Item extends PagePick { id: string; thumb?: string; label: string }
interface Source { name: string; bytes: Uint8Array }

const THUMB_W = 132;

export default function OrganizePdf({ locale = 'en', accept }: { locale?: Locale; accept: string }) {
  const t = TEXT[locale];
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<{ url: string; size: number } | null>(null);
  const [announce, setAnnounce] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [early] = useState(() => filesBeforeHydration('organize-file'));
  const urls = useRef<string[]>([]);

  useEffect(() => () => { for (const u of urls.current) URL.revokeObjectURL(u); }, []);

  // Any edit makes a previous save stale.
  const edit = (next: Item[]) => { setItems(next); setOutput(null); };

  async function add(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setError(null);
    let nextSources = sources;
    for (const file of files) {
      const data = new Uint8Array(await file.arrayBuffer());
      let doc;
      try {
        doc = await openForPreview(data);
      } catch (err) {
        setError((err as Error)?.name === 'PasswordException' ? t.locked(file.name) : t.bad(file.name));
        continue;
      }
      const sourceIndex = nextSources.length;
      nextSources = [...nextSources, { name: file.name, bytes: data }];
      setSources(nextSources);
      const fresh: Item[] = Array.from({ length: doc.numPages }, (_, i) => ({
        id: `${sourceIndex}-${i}`, source: sourceIndex, index: i, turn: 0, label: t.page(i + 1, file.name),
      }));
      setItems((prev) => [...prev, ...fresh]);
      setOutput(null);
      // Thumbnails fill in one by one; the grid is usable before they finish.
      for (let i = 0; i < doc.numPages; i++) {
        const r = await renderPage(doc, i + 1, THUMB_W);
        urls.current.push(r.url);
        setItems((prev) => prev.map((it) => (it.id === `${sourceIndex}-${i}` ? { ...it, thumb: r.url } : it)));
      }
      void doc.destroy();
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  function move(id: string, delta: number) {
    const from = items.findIndex((it) => it.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    edit(next);
    setAnnounce(t.moved(next.length, to + 1));
    // Keep keyboard focus on the same button after the card moves.
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-card="${id}"] [data-move="${delta < 0 ? 'earlier' : 'later'}"]`)?.focus());
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = items.filter((it) => it.id !== dragId);
    const at = next.findIndex((it) => it.id === targetId);
    next.splice(at, 0, items.find((it) => it.id === dragId)!);
    edit(next);
    setDragId(null);
  }

  async function save() {
    setBusy(true);
    try {
      const pdf = await assemble(sources.map((s) => s.bytes), items);
      const copy = new Uint8Array(pdf.byteLength); copy.set(pdf);
      const url = URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }));
      urls.current.push(url);
      setOutput({ url, size: pdf.byteLength });
    } catch {
      setError(t.bad(sources[0]?.name ?? 'PDF'));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSources([]); setItems([]); setOutput(null); setError(null);
  }

  const icon = 'grid size-6 place-items-center rounded border border-border bg-bg text-xs text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-30';
  const fileInput = (
    <input ref={inputRef} id="organize-file" type="file" accept={accept} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void add(e.target.files)} />
  );

  // A file picked before hydration fired its change event with no listener.
  useEffect(() => {
    if (early.length) void add(early);
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (sources.length === 0) {
    return (
      <section>
        {fileInput}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDropZone(true); }}
          onDragLeave={() => setDropZone(false)}
          onDrop={(e) => { e.preventDefault(); setDropZone(false); void add(e.dataTransfer?.files ?? null); }}
          className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-[120ms] ${dropZone ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:border-border-strong'}`}
        >
          <span className="text-sm font-medium">{t.drop}</span>
          <span className="text-xs text-muted">{t.dropSub}</span>
        </button>
        {error && <p className="mt-4 rounded-lg border border-err bg-err-subtle px-4 py-3 text-sm text-err">{error}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {fileInput}
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span data-numeric className="text-sm">{t.pages(items.length)}</span>
        <span className="hidden text-xs text-muted sm:inline">{t.hint}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-text">{t.add}</button>
          <button type="button" onClick={reset} className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-text">{t.reset}</button>
          <button type="button" disabled={busy || items.length === 0} onClick={() => void save()} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on hover:bg-accent-hover disabled:opacity-50">{busy ? t.saving : t.save}</button>
        </div>
      </div>

      <div aria-live="polite">
        {output && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <span className="text-ok" aria-hidden="true">✓</span>
            <span data-numeric className="flex-1 text-sm">organized.pdf · {t.pages(items.length)} · {bytes(output.size)}</span>
            <a href={output.url} download="organized.pdf" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on hover:bg-accent-hover">{locale === 'ms' ? 'Simpan' : 'Save'}</a>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg border border-err bg-err-subtle px-4 py-3 text-sm text-err">{error}</p>}
      {items.length === 0 && <p className="text-sm text-muted">{t.empty}</p>}

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label={t.pages(items.length)}>
        {items.map((it, i) => (
          <li
            key={it.id}
            data-card={it.id}
            draggable
            onDragStart={(e) => { setDragId(it.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { if (dragId) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); dropOn(it.id); }}
            onDragEnd={() => setDragId(null)}
            className={`flex flex-col gap-2 rounded-lg border bg-surface p-2 transition-colors ${dragId === it.id ? 'border-accent opacity-60' : 'border-border'}`}
          >
            <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded bg-sunken">
              {it.thumb
                ? <img src={it.thumb} alt={it.label} className="max-h-full max-w-full shadow-sm transition-transform duration-150" style={{ transform: `rotate(${it.turn}deg)${it.turn % 180 ? ' scale(0.75)' : ''}` }} draggable={false} />
                : <span className="text-2xs text-muted">…</span>}
            </div>
            <span data-numeric className="truncate text-2xs text-muted" title={it.label}>{i + 1} · {it.label}</span>
            <div className="flex items-center justify-between">
              <div className="contents">
                <button type="button" data-move="earlier" className={icon} aria-label={`${t.earlier}: ${it.label}`} disabled={i === 0} onClick={() => move(it.id, -1)}>←</button>
                <button type="button" data-move="later" className={icon} aria-label={`${t.later}: ${it.label}`} disabled={i === items.length - 1} onClick={() => move(it.id, 1)}>→</button>
                <button type="button" className={icon} aria-label={`${t.left}: ${it.label}`} onClick={() => edit(items.map((x) => (x.id === it.id ? { ...x, turn: (x.turn + 270) % 360 } : x)))}>↺</button>
                <button type="button" className={icon} aria-label={`${t.right}: ${it.label}`} onClick={() => edit(items.map((x) => (x.id === it.id ? { ...x, turn: (x.turn + 90) % 360 } : x)))}>↻</button>
                <button type="button" className={icon} aria-label={`${t.remove}: ${it.label}`} onClick={() => edit(items.filter((x) => x.id !== it.id))}>✕</button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
