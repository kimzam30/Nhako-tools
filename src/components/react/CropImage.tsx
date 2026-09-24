import { useEffect, useRef, useState } from 'react';
import { RATIOS, clampRect, initialRect, type Rect } from '../../tools/image/crop';
import { surface, toBlob, replaceExtension, EXTENSION, hasAlpha, formatOf, type Encodable } from '../../lib/canvas';
import { bytes } from '../../lib/format';
import { filesBeforeHydration } from './hydration';
import { sayer } from '../../tools/say';
import type { Locale } from '../../i18n/paths';

const TEXT = {
  en: {
    drop: 'Drop an image here, or browse', dropSub: 'JPG, PNG, WebP. It never leaves your device',
    ratio: 'Shape', free: 'Free', frame: 'Crop area. Drag to move, drag a corner to resize.',
    x: 'Left', y: 'Top', w: 'Width', h: 'Height', px: 'px',
    save: 'Save', another: 'Use a different image', bad: 'That file could not be opened as an image.',
    size: (w: number, h: number) => `${w} × ${h} px`,
  },
  ms: {
    drop: 'Lepaskan imej di sini, atau semak imbas', dropSub: 'JPG, PNG, WebP. Ia tidak pernah meninggalkan peranti anda',
    ratio: 'Bentuk', free: 'Bebas', frame: 'Kawasan potongan. Seret untuk mengalih, seret penjuru untuk mengubah saiz.',
    x: 'Kiri', y: 'Atas', w: 'Lebar', h: 'Tinggi', px: 'px',
    save: 'Simpan', another: 'Guna imej lain', bad: 'Fail itu tidak dapat dibuka sebagai imej.',
    size: (w: number, h: number) => `${w} × ${h} px`,
  },
} satisfies Record<Locale, unknown>;

type Corner = 'nw' | 'ne' | 'sw' | 'se';

export default function CropImage({ locale = 'en', accept }: { locale?: Locale; accept: string }) {
  const t = TEXT[locale];
  const [image, setImage] = useState<{ bitmap: ImageBitmap; url: string; file: File } | null>(null);
  const [ratioKey, setRatioKey] = useState('free');
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [output, setOutput] = useState<{ url: string; name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [early] = useState(() => filesBeforeHydration('crop-file'));
  const stageRef = useRef<HTMLDivElement>(null);
  const outUrl = useRef<string | null>(null);

  const ratio = RATIOS[ratioKey] ?? null;
  const W = image?.bitmap.width ?? 1;
  const H = image?.bitmap.height ?? 1;

  useEffect(() => () => {
    if (outUrl.current) URL.revokeObjectURL(outUrl.current);
    if (image) URL.revokeObjectURL(image.url);
  }, [image]);

  // Build the file once the crop has settled.
  useEffect(() => {
    if (!image || rect.w === 0) return;
    let live = true;
    const timer = setTimeout(async () => {
      const own = formatOf(image.file);
      const mime: Encodable = own && own !== 'image/avif' ? own : 'image/jpeg';
      const canvas = surface(rect.w, rect.h);
      const c = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      if (!hasAlpha(mime)) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, rect.w, rect.h); }
      c.drawImage(image.bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      // toBlob throws when the browser cannot encode the source's own format,
      // which is real: Safari cannot write WebP. Unhandled, the crop simply
      // never appeared and the only trace was a console rejection.
      let blob;
      try {
        blob = await toBlob(canvas, mime, 0.92, sayer({ locale }));
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : TEXT[locale].bad);
        return;
      }
      if (!live) return;
      setError(null);
      if (outUrl.current) URL.revokeObjectURL(outUrl.current);
      outUrl.current = URL.createObjectURL(blob);
      setOutput({ url: outUrl.current, name: replaceExtension(image.file.name, EXTENSION[mime]).replace(/(\.[^.]+)$/, '-cropped$1'), size: blob.size });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [image, rect, locale]);

  async function load(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      setImage({ bitmap, url: URL.createObjectURL(file), file });
      setRect(initialRect(bitmap.width, bitmap.height, RATIOS[ratioKey] ?? null));
      setOutput(null);
    } catch {
      setError(t.bad);
    }
  }

  function chooseRatio(key: string) {
    setRatioKey(key);
    if (image) setRect(initialRect(W, H, RATIOS[key] ?? null));
  }

  /** Screen pixels to image pixels. */
  const scale = () => W / (stageRef.current?.getBoundingClientRect().width || W);

  function drag(e: React.PointerEvent, corner: Corner | null) {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, r: rect };
    const k = scale();
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) * k;
      const dy = (ev.clientY - start.y) * k;
      const r = start.r;
      if (!corner) { setRect(clampRect({ ...r, x: r.x + dx, y: r.y + dy }, W, H, ratio)); return; }
      // Resize from the dragged corner, keeping the opposite corner fixed.
      const right = r.x + r.w;
      const bottom = r.y + r.h;
      let x = corner.includes('w') ? Math.min(r.x + dx, right - 8) : r.x;
      let y = corner.includes('n') ? Math.min(r.y + dy, bottom - 8) : r.y;
      let w = corner.includes('w') ? right - x : r.w + dx;
      let h = corner.includes('n') ? bottom - y : r.h + dy;
      if (ratio) {
        if (w / h > ratio) w = h * ratio; else h = w / ratio;
        if (corner.includes('w')) x = right - w;
        if (corner.includes('n')) y = bottom - h;
      }
      x = Math.max(0, x); y = Math.max(0, y);
      w = Math.min(w, (corner.includes('w') ? right : W) - x);
      h = Math.min(h, (corner.includes('n') ? bottom : H) - y);
      setRect(clampRect({ x, y, w, h }, W, H, ratio));
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function setField(key: keyof Rect, value: number) {
    if (!Number.isFinite(value)) return;
    const next = { ...rect, [key]: value };
    // With a fixed ratio, typing one side sets the other.
    if (ratio && key === 'w') next.h = value / ratio;
    if (ratio && key === 'h') next.w = value * ratio;
    setRect(clampRect(next, W, H, ratio));
  }

  // A file picked before hydration fired its change event with no listener.
  useEffect(() => {
    if (early.length) void load(early[0]);
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!image) {
    return (
      <section>
        <input ref={fileRef} id="crop-file" type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void load(e.target.files?.[0])} />
        <button
          type="button" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDropZone(true); }}
          onDragLeave={() => setDropZone(false)}
          onDrop={(e) => { e.preventDefault(); setDropZone(false); void load(e.dataTransfer?.files?.[0]); }}
          className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-[120ms] ${dropZone ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:border-border-strong'}`}
        >
          <span className="text-sm font-medium">{t.drop}</span>
          <span className="text-xs text-muted">{t.dropSub}</span>
        </button>
        {error && <p data-status-message className="mt-4 rounded-lg border border-err bg-err-subtle px-4 py-3 text-sm text-err">{error}</p>}
      </section>
    );
  }

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const handle = 'absolute size-3.5 rounded-sm border-2 border-accent bg-bg';
  const num = 'w-20 rounded border border-border bg-surface px-2 py-1 font-mono text-sm tabular-nums';

  return (
    <section className="flex flex-col gap-4">
      <input ref={fileRef} id="crop-file" type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void load(e.target.files?.[0])} />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.ratio}</span>
          <select value={ratioKey} onChange={(e) => chooseRatio(e.target.value)} className="rounded border border-border bg-surface px-2.5 py-1.5 text-sm">
            {Object.keys(RATIOS).map((k) => <option key={k} value={k}>{k === 'free' ? t.free : k}</option>)}
          </select>
        </label>
        {(['x', 'y', 'w', 'h'] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{t[k]}</span>
            <input type="number" inputMode="numeric" min={0} value={rect[k]} onChange={(e) => setField(k, Number(e.target.value))} className={num} />
          </label>
        ))}
      </div>

      <div ref={stageRef} className="relative mx-auto w-full select-none overflow-hidden rounded border border-border" style={{ maxWidth: Math.min(720, (W / H) * 520), aspectRatio: `${W} / ${H}`, touchAction: 'none' }}>
        <img src={image.url} alt="" className="block h-full w-full" draggable={false} />
        <div
          role="group" aria-label={t.frame}
          onPointerDown={(e) => drag(e, null)}
          className="absolute cursor-move border-2 border-accent"
          style={{ left: pct(rect.x, W), top: pct(rect.y, H), width: pct(rect.w, W), height: pct(rect.h, H), boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
        >
          <span onPointerDown={(e) => drag(e, 'nw')} className={`${handle} -top-2 -left-2 cursor-nwse-resize`} />
          <span onPointerDown={(e) => drag(e, 'ne')} className={`${handle} -top-2 -right-2 cursor-nesw-resize`} />
          <span onPointerDown={(e) => drag(e, 'sw')} className={`${handle} -bottom-2 -left-2 cursor-nesw-resize`} />
          <span onPointerDown={(e) => drag(e, 'se')} className={`${handle} -right-2 -bottom-2 cursor-nwse-resize`} />
        </div>
      </div>

      {/* The error lived only in the empty state, so anything that went wrong
          after an image was loaded had nowhere to appear. */}
      {error && <p data-status-message className="rounded-lg border border-err bg-err-subtle px-4 py-3 text-sm text-err">{error}</p>}

      <div aria-live="polite" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span data-numeric className="flex-1 text-sm">{t.size(rect.w, rect.h)}{output ? `, ${bytes(output.size)}` : ''}</span>
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-text">{t.another}</button>
        {output && <a href={output.url} download={output.name} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on hover:bg-accent-hover">{t.save}</a>}
      </div>
    </section>
  );
}
