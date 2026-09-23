import { useEffect, useRef, useState } from 'react';
import { applyFilter, detectPage, flatSize, pageFor, placeImage, warp, type Filter, type Point, type Quad } from '../../tools/pdf/scan';
import { bytes } from '../../lib/format';
import type { Locale } from '../../i18n/paths';
import { filesBeforeHydration } from './hydration';

const TEXT = {
  en: {
    camera: 'Take a photo', choose: 'Choose photos', drop: 'or drop photos of pages here',
    help: 'Lay the page on a darker surface in good light. Each page is found, straightened and cleaned up on your device.',
    pages: (n: number) => `${n} page${n === 1 ? '' : 's'}`,
    edit: 'Adjust', done: 'Done', remove: 'Remove', up: 'Move earlier', down: 'Move later',
    rotate: 'Rotate', filter: 'Look', filters: { enhance: 'Clean (grey)', bw: 'Black and white', original: 'Original colour' } as Record<Filter, string>,
    paper: 'Page size', papers: { a4: 'A4', letter: 'Letter', fit: 'Same as the photo' },
    save: 'Save PDF', making: 'Making the PDF…', working: 'Working…',
    corners: 'Drag the corners onto the page\'s corners, or select one and use the arrow keys.',
    corner: (i: number) => ['Top-left corner', 'Top-right corner', 'Bottom-right corner', 'Bottom-left corner'][i]!,
    reset: 'Whole photo', bad: (name: string) => `"${name}" could not be opened as an image.`,
    page: (n: number) => `Page ${n}`,
  },
  ms: {
    camera: 'Ambil gambar', choose: 'Pilih gambar', drop: 'atau lepaskan gambar halaman di sini',
    help: 'Letakkan halaman di atas permukaan yang lebih gelap dalam cahaya yang baik. Setiap halaman dicari, diluruskan dan dibersihkan pada peranti anda.',
    pages: (n: number) => `${n} halaman`,
    edit: 'Laras', done: 'Selesai', remove: 'Buang', up: 'Alih ke depan', down: 'Alih ke belakang',
    rotate: 'Putar', filter: 'Rupa', filters: { enhance: 'Bersih (kelabu)', bw: 'Hitam putih', original: 'Warna asal' },
    paper: 'Saiz halaman', papers: { a4: 'A4', letter: 'Letter', fit: 'Sama seperti gambar' },
    save: 'Simpan PDF', making: 'Membuat PDF…', working: 'Sedang diproses…',
    corners: 'Seret penjuru ke penjuru halaman, atau pilih satu dan gunakan kekunci anak panah.',
    corner: (i: number) => ['Penjuru kiri atas', 'Penjuru kanan atas', 'Penjuru kanan bawah', 'Penjuru kiri bawah'][i]!,
    reset: 'Seluruh gambar', bad: (name: string) => `"${name}" tidak dapat dibuka sebagai imej.`,
    page: (n: number) => `Halaman ${n}`,
  },
} satisfies Record<Locale, unknown>;

/** Photos are worked on at up to this size; plenty for a page at 200+ dpi. */
const WORK_SIDE = 3000;

interface Page {
  id: string;
  name: string;
  source: HTMLCanvasElement;
  preview: string;
  quad: Quad;
  turn: 0 | 90 | 180 | 270;
  filter: Filter;
  result?: { url: string; blob: Blob; width: number; height: number };
}

let seq = 0;

async function loadSource(file: File): Promise<{ canvas: HTMLCanvasElement; preview: string; quad: Quad }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, WORK_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Detect on a small copy: the page is a big shape, and this is 50x faster.
  const s = Math.min(1, 400 / Math.max(canvas.width, canvas.height));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(canvas.width * s));
  small.height = Math.max(1, Math.round(canvas.height * s));
  const sc = small.getContext('2d')!;
  sc.drawImage(canvas, 0, 0, small.width, small.height);
  // ImageData's fields are getters: spreading it would copy nothing.
  const img = sc.getImageData(0, 0, small.width, small.height);
  const found = detectPage({ data: img.data, width: img.width, height: img.height });
  const quad = found.map((p) => ({ x: p.x / s, y: p.y / s })) as Quad;
  const preview = await new Promise<string>((resolve) => small.toBlob((b) => resolve(URL.createObjectURL(b!)), 'image/jpeg', 0.8));
  return { canvas, preview, quad };
}

async function render(page: Page): Promise<NonNullable<Page['result']>> {
  const src = page.source.getContext('2d')!.getImageData(0, 0, page.source.width, page.source.height);
  const { width, height } = flatSize(page.quad);
  const flat = { data: warp(src, page.quad, width, height), width, height };
  applyFilter(flat, page.filter);
  const flatCanvas = document.createElement('canvas');
  flatCanvas.width = width;
  flatCanvas.height = height;
  flatCanvas.getContext('2d')!.putImageData(new ImageData(flat.data as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  const sideways = page.turn === 90 || page.turn === 270;
  const out = document.createElement('canvas');
  out.width = sideways ? height : width;
  out.height = sideways ? width : height;
  const c = out.getContext('2d')!;
  c.translate(out.width / 2, out.height / 2);
  c.rotate((page.turn * Math.PI) / 180);
  c.drawImage(flatCanvas, -width / 2, -height / 2);
  // Black and white compresses best, and stays crisp, as PNG.
  const type = page.filter === 'bw' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve) => out.toBlob((b) => resolve(b!), type, 0.85));
  return { url: URL.createObjectURL(blob), blob, width: out.width, height: out.height };
}

export default function ScanToPdf({ locale = 'en' }: { locale?: Locale }) {
  const t = TEXT[locale];
  const [pages, setPages] = useState<Page[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('enhance');
  const [paper, setPaper] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ url: string; size: number } | null>(null);
  const [dropZone, setDropZone] = useState(false);
  const chooseRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [early] = useState(() => [...filesBeforeHydration('scan-choose'), ...filesBeforeHydration('scan-camera')]);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  useEffect(() => () => {
    for (const p of pagesRef.current) { URL.revokeObjectURL(p.preview); if (p.result) URL.revokeObjectURL(p.result.url); }
  }, []);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);

  // A photo picked before hydration fired its change event with no listener.
  useEffect(() => {
    if (early.length) void add(early);
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(list: FileList | File[] | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!files.length) return;
    setError(null);
    setOutput(null);
    for (const file of files) {
      setBusy(t.working);
      try {
        const { canvas, preview, quad } = await loadSource(file);
        const page: Page = { id: `p${++seq}`, name: file.name, source: canvas, preview, quad, turn: 0, filter };
        page.result = await render(page);
        setPages((prev) => [...prev, page]);
      } catch {
        setError(t.bad(file.name));
      }
    }
    setBusy(null);
    if (chooseRef.current) chooseRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  async function update(id: string, change: Partial<Page>) {
    const page = pagesRef.current.find((p) => p.id === id);
    if (!page) return;
    const next = { ...page, ...change };
    setBusy(t.working);
    const result = await render(next);
    if (page.result) URL.revokeObjectURL(page.result.url);
    setPages((prev) => prev.map((p) => (p.id === id ? { ...next, result } : p)));
    setOutput(null);
    setBusy(null);
  }

  function remove(id: string) {
    const page = pages.find((p) => p.id === id);
    if (page) { URL.revokeObjectURL(page.preview); if (page.result) URL.revokeObjectURL(page.result.url); }
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (editing === id) setEditing(null);
    setOutput(null);
  }

  function move(id: string, delta: number) {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    setOutput(null);
  }

  async function save() {
    setBusy(t.making);
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    for (const p of pages) {
      if (!p.result) continue;
      const data = new Uint8Array(await p.result.blob.arrayBuffer());
      const img = p.result.blob.type === 'image/png' ? await doc.embedPng(data) : await doc.embedJpg(data);
      const size = pageFor(p.result.width, p.result.height, paper);
      const page = doc.addPage([size.width, size.height]);
      const at = placeImage(p.result.width, p.result.height, size, 0);
      page.drawImage(img, at);
    }
    const out = await doc.save();
    const blob = new Blob([out as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
    setOutput({ url: URL.createObjectURL(blob), size: blob.size });
    setBusy(null);
  }

  const editPage = pages.find((p) => p.id === editing);
  const small = 'rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-40';
  const field = 'rounded border border-border bg-surface px-2.5 py-1.5 text-sm';
  const label = 'text-2xs font-semibold uppercase tracking-wider text-muted';

  return (
    <section className="flex flex-col gap-4">
      <input ref={chooseRef} id="scan-choose" type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void add(e.target.files)} />
      <input ref={cameraRef} id="scan-camera" type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void add(e.target.files)} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDropZone(true); }}
        onDragLeave={() => setDropZone(false)}
        onDrop={(e) => { e.preventDefault(); setDropZone(false); void add(e.dataTransfer?.files ?? null); }}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${dropZone ? 'border-accent bg-accent-subtle' : 'border-border bg-surface'}`}
      >
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => cameraRef.current?.click()} className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover">{t.camera}</button>
          <button type="button" onClick={() => chooseRef.current?.click()} className="min-h-11 rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold hover:border-accent">{t.choose}</button>
        </div>
        <p className="text-xs text-muted">{t.drop}</p>
        <p className="max-w-md text-xs leading-snug text-muted">{t.help}</p>
      </div>

      {error && <p role="alert" className="rounded-lg border border-err bg-err-subtle px-4 py-3 text-sm text-err">{error}</p>}
      <p aria-live="polite" className="sr-only">{busy ?? ''}</p>

      {pages.length > 0 && (
        <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
          <label className="flex flex-col gap-1.5">
            <span className={label}>{t.filter}</span>
            <select value={filter} className={field} onChange={(e) => {
              const f = e.target.value as Filter;
              setFilter(f);
              // A new look applies to every page, one after another.
              void (async () => { for (const p of pagesRef.current) await update(p.id, { filter: f }); })();
            }}>
              {(['enhance', 'bw', 'original'] as const).map((f) => <option key={f} value={f}>{t.filters[f]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>{t.paper}</span>
            <select value={paper} className={field} onChange={(e) => { setPaper(e.target.value as typeof paper); setOutput(null); }}>
              {(['a4', 'letter', 'fit'] as const).map((k) => <option key={k} value={k}>{t.papers[k]}</option>)}
            </select>
          </label>
          <span data-numeric className="flex-1 text-sm text-muted">{t.pages(pages.length)}{busy ? ` · ${busy}` : ''}</span>
          {output ? (
            <a href={output.url} download="scan.pdf" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover">{t.save} · {bytes(output.size)}</a>
          ) : (
            <button type="button" onClick={() => void save()} disabled={Boolean(busy)} className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-50" data-testid="make-pdf">{t.save}</button>
          )}
        </div>
      )}

      {editPage && <CornerEditor key={editPage.id} page={editPage} t={t} onApply={(quad) => void update(editPage.id, { quad })} onClose={() => setEditing(null)} />}

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pages.map((p, i) => (
          <li key={p.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2">
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-sunken">
              {p.result && <img src={p.result.url} alt={t.page(i + 1)} className="max-h-full max-w-full object-contain" />}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span data-numeric className="mr-auto text-xs text-muted">{i + 1}</span>
              <button type="button" onClick={() => setEditing(editing === p.id ? null : p.id)} className={small} aria-pressed={editing === p.id} aria-label={`${t.edit}: ${t.page(i + 1)}`}>{t.edit}</button>
              <button type="button" onClick={() => void update(p.id, { turn: (((p.turn + 90) % 360) as Page['turn']) })} className={small} aria-label={`${t.rotate}: ${t.page(i + 1)}`}>⟳</button>
              <button type="button" onClick={() => move(p.id, -1)} disabled={i === 0} className={small} aria-label={`${t.up}: ${t.page(i + 1)}`}>↑</button>
              <button type="button" onClick={() => move(p.id, 1)} disabled={i === pages.length - 1} className={small} aria-label={`${t.down}: ${t.page(i + 1)}`}>↓</button>
              <button type="button" onClick={() => remove(p.id)} className={small} aria-label={`${t.remove}: ${t.page(i + 1)}`}>✕</button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The photo with the page's four corners, draggable and keyboard-movable. */
function CornerEditor({ page, t, onApply, onClose }: { page: Page; t: (typeof TEXT)['en']; onApply: (q: Quad) => void; onClose: () => void }) {
  const [quad, setQuad] = useState<Quad>(page.quad);
  // The latest corners, for handlers that fire faster than renders.
  const latest = useRef<Quad>(page.quad);
  const applyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stage = useRef<HTMLDivElement>(null);
  const W = page.source.width;
  const H = page.source.height;
  useEffect(() => () => clearTimeout(applyTimer.current), []);

  const clamp = (p: Point): Point => ({ x: Math.min(W, Math.max(0, p.x)), y: Math.min(H, Math.max(0, p.y)) });
  const show = (next: Quad) => { latest.current = next; setQuad(next); };

  function drag(e: React.PointerEvent, i: number) {
    e.preventDefault();
    const rect = stage.current!.getBoundingClientRect();
    const k = W / rect.width;
    const onMove = (ev: PointerEvent) => {
      const p = clamp({ x: (ev.clientX - rect.left) * k, y: (ev.clientY - rect.top) * k });
      show(latest.current.map((q, j) => (j === i ? p : q)) as Quad);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onApply(latest.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function key(e: React.KeyboardEvent, i: number) {
    const step = (e.shiftKey ? 0.05 : 0.01) * Math.max(W, H);
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    // From the latest corners, not this render's: held-down keys repeat
    // faster than the page re-renders, and each press must count.
    const from = latest.current[i]!;
    show(latest.current.map((q, j) => (j === i ? clamp({ x: from.x + d[0]!, y: from.y + d[1]! }) : q)) as Quad);
    // Straightening the page is heavy: do it once the keys stop.
    clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(() => onApply(latest.current), 350);
  }

  const pct = (p: Point) => ({ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` });
  const whole: Quad = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];

  return (
    <div className="rounded-lg border border-accent bg-surface p-4">
      <p className="mb-3 text-sm text-muted">{t.corners}</p>
      <div ref={stage} className="relative mx-auto w-full select-none" style={{ maxWidth: Math.min(640, (W / H) * 520), aspectRatio: `${W} / ${H}`, touchAction: 'none' }}>
        <img src={page.preview} alt="" className="block h-full w-full rounded" draggable={false} />
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <polygon points={quad.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(236,72,153,0.15)" stroke="rgb(236,72,153)" strokeWidth={Math.max(W, H) / 250} />
        </svg>
        {quad.map((p, i) => (
          <button
            key={i} type="button" aria-label={t.corner(i)}
            onPointerDown={(e) => drag(e, i)} onKeyDown={(e) => key(e, i)}
            className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow focus-visible:ring-4"
            style={pct(p)} data-corner={i}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { show(whole); onApply(whole); }} className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-text">{t.reset}</button>
        <button type="button" onClick={onClose} className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on hover:bg-accent-hover">{t.done}</button>
      </div>
    </div>
  );
}
