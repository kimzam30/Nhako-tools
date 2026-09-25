import { DropLabel } from './DropLabel';
import { useEffect, useRef, useState } from 'react';
import '@fontsource/dancing-script/latin-400.css';
import { stamp, type Placement } from '../../tools/pdf/sign';
import { openForPreview, renderPage, type RenderedPage } from '../../lib/pdf-render';
import { bytes } from '../../lib/format';
import { filesBeforeHydration } from './hydration';
import type { Locale } from '../../i18n/paths';
import { BusyLabel } from './NeraLoader';

const TEXT = {
  en: {
    drop: 'Drop a PDF here, or browse', tap: 'Choose a PDF', dropSub: 'Your signature never leaves this page',
    draw: 'Draw', type: 'Type', upload: 'Image',
    drawHint: 'Sign in the box with a mouse, finger or stylus.', clear: 'Clear',
    name: 'Your name', namePlaceholder: 'Nur Aisyah binti Ahmad',
    image: 'Choose a photo or scan of your signature', whiteOut: 'Make a white background transparent',
    color: 'Ink', black: 'Black', blue: 'Blue',
    place: 'Click a page to place your signature.', ready: 'Signature ready',
    addDate: "Add today's date", nothing: 'Create a signature above first.',
    placed: (n: number) => `${n} placed`, remove: 'Remove', signature: 'Signature', date: 'Date',
    boxLabel: (what: string, page: number) => `${what} on page ${page}. Arrow keys move it, plus and minus resize it, Delete removes it.`,
    save: 'Save signed PDF', saving: 'Signing…', another: 'Use a different PDF',
    locked: 'This PDF is password-protected. Unlock it first.', bad: 'That file could not be read as a PDF.',
    page: (n: number) => `Page ${n}`,
  },
  ms: {
    drop: 'Lepaskan PDF di sini, atau semak imbas', tap: 'Pilih satu PDF', dropSub: 'Tandatangan anda tidak pernah meninggalkan halaman ini',
    draw: 'Lukis', type: 'Taip', upload: 'Imej',
    drawHint: 'Tandatangan dalam kotak dengan tetikus, jari atau stilus.', clear: 'Padam',
    name: 'Nama anda', namePlaceholder: 'Nur Aisyah binti Ahmad',
    image: 'Pilih gambar atau imbasan tandatangan anda', whiteOut: 'Jadikan latar putih lutsinar',
    color: 'Dakwat', black: 'Hitam', blue: 'Biru',
    place: 'Klik pada halaman untuk meletakkan tandatangan anda.', ready: 'Tandatangan sedia',
    addDate: 'Tambah tarikh hari ini', nothing: 'Buat tandatangan di atas dahulu.',
    placed: (n: number) => `${n} diletakkan`, remove: 'Buang', signature: 'Tandatangan', date: 'Tarikh',
    boxLabel: (what: string, page: number) => `${what} pada halaman ${page}. Kekunci anak panah mengalihkannya, tambah dan tolak mengubah saiz, Delete membuangnya.`,
    save: 'Simpan PDF bertandatangan', saving: 'Menandatangani…', another: 'Guna PDF lain',
    locked: 'PDF ini dilindungi kata laluan. Buka kuncinya dahulu.', bad: 'Fail itu tidak dapat dibaca sebagai PDF.',
    page: (n: number) => `Halaman ${n}`,
  },
} satisfies Record<Locale, unknown>;

const INK = { black: '#111114', blue: '#1a3a8f' } as const;
type Ink = keyof typeof INK;
type Mode = 'draw' | 'type' | 'upload';

interface Stamp { png: Uint8Array; url: string; aspect: number }
/** A placement in PAGE-FRACTION units (0..1), so it survives any preview width. */
interface Placed { id: number; page: number; x: number; y: number; w: number; stamp: Stamp; kind: 'signature' | 'date' }

/** Crop a canvas to its drawn pixels (plus a little air) and encode as PNG. */
async function trimToPng(canvas: HTMLCanvasElement): Promise<Stamp | null> {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  const w = Math.min(width, maxX + pad) - Math.max(0, minX - pad);
  const h = Math.min(height, maxY + pad) - Math.max(0, minY - pad);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d')!.drawImage(canvas, Math.max(0, minX - pad), Math.max(0, minY - pad), w, h, 0, 0, w, h);
  const blob = await new Promise<Blob>((r) => out.toBlob((b) => r(b!), 'image/png'));
  return { png: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob), aspect: w / h };
}

export default function SignPdf({ locale = 'en', accept }: { locale?: Locale; accept: string }) {
  const t = TEXT[locale];
  const [pdf, setPdf] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [mode, setMode] = useState<Mode>('draw');
  const [ink, setInk] = useState<Ink>('black');
  const [name, setName] = useState('');
  const [whiteOut, setWhiteOut] = useState(true);
  const [signature, setSignature] = useState<Stamp | null>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [output, setOutput] = useState<{ url: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropZone, setDropZone] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [early] = useState(() => filesBeforeHydration('sign-file'));
  const padRef = useRef<HTMLCanvasElement>(null);
  const urls = useRef<string[]>([]);
  const nextId = useRef(1);
  const track = (u: string) => { urls.current.push(u); return u; };

  useEffect(() => () => { for (const u of urls.current) URL.revokeObjectURL(u); }, []);

  async function load(file: File | undefined) {
    if (!file) return;
    setError(null);
    const data = new Uint8Array(await file.arrayBuffer());
    let doc;
    try {
      doc = await openForPreview(data);
    } catch (err) {
      setError((err as Error)?.name === 'PasswordException' ? t.locked : t.bad);
      return;
    }
    setPdf({ name: file.name, bytes: data });
    setPlaced([]);
    setOutput(null);
    setPages([]);
    const width = Math.min(720, (document.querySelector('main')?.clientWidth ?? 720) - 32);
    for (let i = 1; i <= doc.numPages; i++) {
      const r = await renderPage(doc, i, width);
      track(r.url);
      setPages((prev) => [...prev, r]);
    }
    void doc.destroy();
  }

  // ─── Drawing pad ───────────────────────────────────────────────────────────
  const drawing = useRef<{ last: { x: number; y: number } | null }>({ last: null });

  function padPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function padDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current.last = padPoint(e);
  }

  function padMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const last = drawing.current.last;
    if (!last) return;
    const p = padPoint(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.strokeStyle = INK[ink];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Faster strokes draw thinner, like a real pen.
    const speed = Math.hypot(p.x - last.x, p.y - last.y);
    ctx.lineWidth = Math.max(2.2, 5 - speed / 18);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    drawing.current.last = p;
  }

  async function padUp() {
    drawing.current.last = null;
    if (padRef.current) {
      const s = await trimToPng(padRef.current);
      if (s) { track(s.url); setSignature(s); }
    }
  }

  function clearPad() {
    const c = padRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setSignature(null);
  }

  // ─── Typed signature ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'type') return;
    let live = true;
    void (async () => {
      const text = name.trim();
      if (!text) { if (live) setSignature(null); return; }
      await document.fonts.load('96px "Dancing Script"');
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d')!;
      ctx.font = '96px "Dancing Script"';
      c.width = Math.ceil(ctx.measureText(text).width) + 40;
      c.height = 150;
      ctx.font = '96px "Dancing Script"';
      ctx.fillStyle = INK[ink];
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 20, 75);
      const s = await trimToPng(c);
      if (live && s) { track(s.url); setSignature(s); }
    })();
    return () => { live = false; };
  }, [mode, name, ink]);

  // Switching modes clears the current signature, so a half-made one from
  // another tab is never the one placed.
  function chooseMode(m: Mode) {
    setMode(m);
    setSignature(null);
  }

  async function uploadSignature(file: File | undefined) {
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / bitmap.width);
    const c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    if (whiteOut) {
      // Paper to transparent: fade out light pixels so a photographed
      // signature does not stamp a white rectangle onto the page.
      const img = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const light = (img.data[i]! + img.data[i + 1]! + img.data[i + 2]!) / 3;
        if (light > 200) img.data[i + 3] = 0;
        else if (light > 150) img.data[i + 3] = Math.round(((200 - light) / 50) * 255);
      }
      ctx.putImageData(img, 0, 0);
    }
    const s = await trimToPng(c);
    if (s) { track(s.url); setSignature(s); }
  }

  async function dateStamp(): Promise<Stamp> {
    const d = new Date();
    const text = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const c = document.createElement('canvas');
    c.width = 520; c.height = 110;
    const ctx = c.getContext('2d')!;
    ctx.font = '600 64px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    ctx.fillStyle = INK[ink];
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 10, 55);
    const s = (await trimToPng(c))!;
    track(s.url);
    return s;
  }

  // ─── Placing ───────────────────────────────────────────────────────────────
  function placeAt(page: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!signature || e.target !== e.currentTarget.querySelector('img')) return;
    const r = e.currentTarget.getBoundingClientRect();
    const w = 0.3;
    const x = (e.clientX - r.left) / r.width - w / 2;
    const y = (e.clientY - r.top) / r.height - (w / signature.aspect) * (r.width / r.height) / 2;
    setPlaced((prev) => [...prev, { id: nextId.current++, page, x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1), w, stamp: signature, kind: 'signature' }]);
    setOutput(null);
  }

  async function addDate() {
    const s = await dateStamp();
    const page = placed.length ? placed[placed.length - 1]!.page : 0;
    setPlaced((prev) => [...prev, { id: nextId.current++, page, x: 0.6, y: 0.85, w: 0.2, stamp: s, kind: 'date' }]);
    setOutput(null);
  }

  const update = (id: number, patch: Partial<Placed>) => {
    setPlaced((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setOutput(null);
  };

  function dragBox(e: React.PointerEvent<HTMLElement>, p: Placed, resize: boolean) {
    e.preventDefault();
    e.stopPropagation();
    const pageEl = (e.currentTarget as HTMLElement).closest('[data-page]') as HTMLElement;
    const rect = pageEl.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, px: p.x, py: p.y, w: p.w };
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / rect.width;
      const dy = (ev.clientY - start.y) / rect.height;
      if (resize) update(p.id, { w: clamp(start.w + dx, 0.05, 1 - start.px) });
      else update(p.id, { x: clamp(start.px + dx, 0, 1 - p.w), y: clamp(start.py + dy, 0, 0.98) });
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function boxKey(e: React.KeyboardEvent<HTMLElement>, p: Placed) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const k = e.key;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); setPlaced((prev) => prev.filter((x) => x.id !== p.id)); return; }
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[k]) { e.preventDefault(); update(p.id, { x: clamp(p.x + moves[k]![0], 0, 1 - p.w), y: clamp(p.y + moves[k]![1], 0, 0.98) }); }
    else if (k === '+' || k === '=') { e.preventDefault(); update(p.id, { w: clamp(p.w * 1.1, 0.05, 1 - p.x) }); }
    else if (k === '-') { e.preventDefault(); update(p.id, { w: clamp(p.w / 1.1, 0.05, 1) }); }
  }

  async function save() {
    if (!pdf) return;
    setBusy(true);
    try {
      const placements: Placement[] = placed.map((p) => {
        const pg = pages[p.page]!;
        const width = p.w * pg.widthPt;
        return {
          page: p.page,
          rect: { x: p.x * pg.widthPt, y: p.y * pg.heightPt, width, height: width / p.stamp.aspect },
          png: p.stamp.png,
        };
      });
      const out = await stamp(pdf.bytes, placements);
      const copy = new Uint8Array(out.byteLength); copy.set(out);
      const url = track(URL.createObjectURL(new Blob([copy], { type: 'application/pdf' })));
      setOutput({ url, size: out.byteLength });
    } catch {
      setError(t.bad);
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button" role="tab" aria-selected={mode === m} onClick={() => chooseMode(m)}
      className={`rounded px-3 py-1.5 text-sm transition-colors ${mode === m ? 'bg-sunken font-medium text-text' : 'text-muted hover:text-text'}`}
    >{label}</button>
  );

  // A file picked before hydration fired its change event with no listener.
  useEffect(() => {
    if (early.length) void load(early[0]);
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pdf) {
    return (
      <section>
        <input ref={fileRef} id="sign-file" type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void load(e.target.files?.[0])} />
        <button
          type="button" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDropZone(true); }}
          onDragLeave={() => setDropZone(false)}
          onDrop={(e) => { e.preventDefault(); setDropZone(false); void load(e.dataTransfer?.files?.[0]); }}
          className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-[120ms] ${dropZone ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:border-border-strong'}`}
        >
          <span className="text-sm font-medium"><DropLabel drop={t.drop} tap={t.tap} /></span>
          <span className="text-xs text-muted">{t.dropSub}</span>
        </button>
        {error && <p data-status-message className="mt-4 rounded-lg border border-err bg-err-subtle px-4 py-3 text-sm text-err">{error}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <input ref={fileRef} id="sign-file" type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void load(e.target.files?.[0])} />

      <div className="sticky top-16 z-10 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="flex gap-1">{tab('draw', t.draw)}{tab('type', t.type)}{tab('upload', t.upload)}</div>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            {t.color}
            <select value={ink} onChange={(e) => setInk(e.target.value as Ink)} className="rounded border border-border bg-surface px-2 py-1 text-xs">
              <option value="black">{t.black}</option>
              <option value="blue">{t.blue}</option>
            </select>
          </label>
        </div>

        {mode === 'draw' && (
          <div className="flex items-end gap-3">
            <canvas
              ref={padRef} width={900} height={260} aria-label={t.drawHint}
              onPointerDown={padDown} onPointerMove={padMove} onPointerUp={() => void padUp()} onPointerCancel={() => void padUp()}
              style={{ touchAction: 'none' }}
              className="h-24 w-full max-w-md cursor-crosshair rounded border border-dashed border-border-strong bg-white"
            />
            <button type="button" onClick={clearPad} className="rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-text">{t.clear}</button>
          </div>
        )}
        {mode === 'type' && (
          <div className="flex flex-col gap-2">
            <label htmlFor="sign-name" className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.name}</label>
            <input id="sign-name" type="text" autoComplete="name" value={name} placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} className="w-full max-w-md rounded border border-border bg-surface px-2.5 py-1.5 text-sm" />
          </div>
        )}
        {mode === 'upload' && (
          <div className="flex flex-col gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted">{t.image}</span>
              <input type="file" accept="image/*" onChange={(e) => void uploadSignature(e.target.files?.[0])} className="text-xs" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={whiteOut} onChange={(e) => setWhiteOut(e.target.checked)} className="accent-[var(--accent)]" />
              {t.whiteOut}
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          {signature
            ? <span className="flex items-center gap-2 text-xs text-muted"><img src={signature.url} alt="" className="h-8 w-auto rounded bg-white px-1" />{t.place}</span>
            : <span className="text-xs text-muted">{t.nothing}</span>}
          <button type="button" onClick={() => void addDate()} className="rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-text">{t.addDate}</button>
          <span data-numeric className="text-2xs text-muted">{t.placed(placed.length)}</span>
          <button type="button" disabled={busy || placed.length === 0} onClick={() => void save()} className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on hover:bg-accent-hover disabled:opacity-50">{busy ? <BusyLabel label={t.saving} /> : t.save}</button>
        </div>
      </div>

      <div aria-live="polite">
        {output && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <span className="text-ok" aria-hidden="true">✓</span>
            <span data-numeric className="flex-1 text-sm">{pdf.name.replace(/\.pdf$/i, '')}-signed.pdf, {bytes(output.size)}</span>
            <a href={output.url} download={`${pdf.name.replace(/\.pdf$/i, '')}-signed.pdf`} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on hover:bg-accent-hover">{locale === 'ms' ? 'Simpan' : 'Save'}</a>
          </div>
        )}
      </div>
      {error && <p data-status-message className="rounded-lg border border-err bg-err-subtle px-4 py-3 text-sm text-err">{error}</p>}

      <div className="flex flex-col items-center gap-6">
        {pages.map((pg, i) => (
          <figure key={pg.url} className="flex w-full flex-col items-center gap-1">
            <div
              data-page={i}
              onClick={(e) => placeAt(i, e)}
              className={`relative w-full max-w-[720px] overflow-hidden rounded border border-border bg-white shadow-sm ${signature ? 'cursor-copy' : ''}`}
              style={{ aspectRatio: `${pg.widthPt} / ${pg.heightPt}` }}
            >
              <img src={pg.url} alt={t.page(i + 1)} className="block h-full w-full select-none" draggable={false} />
              {placed.filter((p) => p.page === i).map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-label={t.boxLabel(p.kind === 'date' ? t.date : t.signature, i + 1)}
                  onPointerDown={(e) => dragBox(e, p, false)}
                  onKeyDown={(e) => boxKey(e, p)}
                  className="group absolute cursor-move outline-1 outline-accent hover:outline focus-visible:outline-2"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, aspectRatio: String(p.stamp.aspect), touchAction: 'none' }}
                >
                  <img src={p.stamp.url} alt="" className="pointer-events-none h-full w-full" draggable={false} />
                  <span
                    aria-hidden="true"
                    onPointerDown={(e) => dragBox(e, p, true)}
                    className="absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-sm border border-accent bg-bg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                  <button
                    type="button" tabIndex={-1} aria-hidden="true"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setPlaced((prev) => prev.filter((x) => x.id !== p.id)); }}
                    className="absolute -top-2.5 -right-2.5 grid size-5 place-items-center rounded bg-accent text-2xs text-accent-on opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  >✕</button>
                </div>
              ))}
            </div>
            <figcaption data-numeric className="text-2xs text-muted">{i + 1} / {pages.length}</figcaption>
          </figure>
        ))}
      </div>

      <button type="button" onClick={() => fileRef.current?.click()} className="self-start rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-text">{t.another}</button>
    </section>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
