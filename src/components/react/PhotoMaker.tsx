import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PRESETS, DIGITAL_DPI, clampView, coverScale, digitalPhoto, mmToPx, printSheet, renderFrame,
  type PhotoPreset, type View,
} from '../../tools/image/passport-photo';
import { personMatte, replaceBackground } from '../../tools/image/segment';
import { bytes } from '../../lib/format';
import { exactBytes, targetLabel } from '../../lib/fit-size';
import { localePath, type Locale } from '../../i18n/paths';
import { valueBeforeHydration, filesBeforeHydration } from './hydration';

const TEXT = {
  en: {
    preset: 'Photo type',
    presets: {
      'my-passport-child': 'Malaysian passport, child under 4 (35×50 mm, white)',
      'spa-myresume': 'SPA MyRésumé profile photo (35×50 mm, white, under 1 MB)',
      'custom': 'Custom size',
    } as Record<string, string>,
    width: 'Width', height: 'Height', mm: 'mm',
    drop: 'Drop a photo here, or browse',
    dropSub: 'JPG, PNG or WebP. It never leaves your device',
    another: 'Use a different photo',
    frameLabel: 'Photo preview. Drag to move, scroll or pinch to zoom, or use the arrow keys and plus and minus.',
    guide: 'Line the top of the head and the chin up with the dashed guide, with the face centred.',
    zoom: 'Zoom',
    reset: 'Reset',
    background: 'Background',
    bgKeep: 'Keep the original',
    bgWhite: 'Replace with white',
    bgBlue: 'Replace with light blue',
    bgRed: 'Replace with red',
    downloading: (p: number) => `Downloading the background model, once (${p}%)`,
    removing: 'Separating you from the background',
    bgFailed: 'Background replacement failed.',
    retry: 'Try again',
    checks: 'Checks',
    size: (w: number, h: number, pw: number, ph: number) => `${w} × ${h} mm, ${pw} × ${ph} px at ${DIGITAL_DPI} dpi`,
    bgDone: (name: string) => `Background replaced with ${name}`,
    bgWarn: 'Background unchanged: it must already be plain white',
    under: (limit: string, size: string) => `Under ${limit}: ${size}`,
    over: (limit: string, size: string) => `Still over ${limit}: ${size}`,
    savePhoto: 'Save photo (JPG)',
    saveSheet: 'Save 4R print sheet (JPG)',
    sheetNote: (n: number) => `${n} copies on a 6×4 inch sheet. Ask the shop to print at actual size, without cropping.`,
    preparing: 'Preparing files…',
    source: 'Source',
    white: 'white', blue: 'light blue', red: 'red',
    readError: 'That file could not be opened as an image.',
    compress: 'Need a smaller file for another form? Compress image',
  },
  ms: {
    preset: 'Jenis gambar',
    presets: {
      'my-passport-child': 'Pasport Malaysia, kanak-kanak bawah 4 tahun (35×50 mm, putih)',
      'spa-myresume': 'Gambar profil SPA MyRésumé (35×50 mm, putih, bawah 1 MB)',
      'custom': 'Saiz tersuai',
    },
    width: 'Lebar', height: 'Tinggi', mm: 'mm',
    drop: 'Lepaskan gambar di sini, atau semak imbas',
    dropSub: 'JPG, PNG atau WebP. Ia tidak pernah meninggalkan peranti anda',
    another: 'Guna gambar lain',
    frameLabel: 'Pratonton gambar. Seret untuk mengalih, tatal atau cubit untuk zum, atau guna kekunci anak panah serta tambah dan tolak.',
    guide: 'Selaraskan bahagian atas kepala dan dagu dengan garis putus-putus, dengan muka di tengah.',
    zoom: 'Zum',
    reset: 'Set semula',
    background: 'Latar belakang',
    bgKeep: 'Kekalkan yang asal',
    bgWhite: 'Tukar kepada putih',
    bgBlue: 'Tukar kepada biru muda',
    bgRed: 'Tukar kepada merah',
    downloading: (p: number) => `Memuat turun model latar belakang, sekali sahaja (${p}%)`,
    removing: 'Memisahkan anda daripada latar belakang',
    bgFailed: 'Penukaran latar belakang gagal.',
    retry: 'Cuba lagi',
    checks: 'Semakan',
    size: (w: number, h: number, pw: number, ph: number) => `${w} × ${h} mm, ${pw} × ${ph} px pada ${DIGITAL_DPI} dpi`,
    bgDone: (name: string) => `Latar belakang ditukar kepada ${name}`,
    bgWarn: 'Latar belakang tidak diubah: ia mesti sudah putih kosong',
    under: (limit: string, size: string) => `Bawah ${limit}: ${size}`,
    over: (limit: string, size: string) => `Masih melebihi ${limit}: ${size}`,
    savePhoto: 'Simpan gambar (JPG)',
    saveSheet: 'Simpan helaian cetak 4R (JPG)',
    sheetNote: (n: number) => `${n} salinan pada helaian 6×4 inci. Minta kedai mencetak pada saiz sebenar, tanpa dipotong.`,
    preparing: 'Menyediakan fail…',
    source: 'Sumber',
    white: 'putih', blue: 'biru muda', red: 'merah',
    readError: 'Fail itu tidak dapat dibuka sebagai imej.',
    compress: 'Perlukan fail lebih kecil untuk borang lain? Mampat imej',
  },
} satisfies Record<Locale, unknown>;

const COLORS = { white: '#ffffff', blue: '#cfe3f5', red: '#c8102e' } as const;
type Background = 'keep' | keyof typeof COLORS;

/** Longest side kept after loading; a 48 MP phone photo is far more than 600 dpi needs. */
const MAX_EDGE = 3000;
/** Preview width in CSS pixels. */
const PREVIEW_W = 264;

type Src = HTMLCanvasElement | OffscreenCanvas | ImageBitmap;

interface Outputs {
  photo: { url: string; size: number; w: number; h: number; fits: boolean };
  sheet: { url: string; size: number; copies: number };
}

export default function PhotoMaker({ locale = 'en', accept }: { locale?: Locale; accept: string }) {
  const t = TEXT[locale];
  const [presetId, setPresetId] = useState(() => valueBeforeHydration('photo-preset', PRESETS[0]!.id));
  const [custom, setCustom] = useState({ w: 35, h: 50 });
  const [source, setSource] = useState<Src | null>(null);
  const [rawView, setView] = useState<View>({ zoom: 1, cx: 0, cy: 0 });
  const [background, setBackground] = useState<Background>('keep');
  const [matte, setMatte] = useState<ReturnType<typeof renderFrame> | null>(null);
  const [matteState, setMatteState] = useState<{ name: 'idle' } | { name: 'busy'; label: string } | { name: 'error'; message: string }>({ name: 'idle' });
  const [outputs, setOutputs] = useState<Outputs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const urls = useRef<string[]>([]);

  const base = PRESETS.find((p) => p.id === presetId)!;
  const preset: PhotoPreset = presetId === 'custom' ? { ...base, widthMm: custom.w, heightMm: custom.h } : base;
  const previewH = Math.round((PREVIEW_W * preset.heightMm) / preset.widthMm);
  const bgColor = background === 'keep' ? null : COLORS[background];

  // The image actually framed: the original, or the original on a new
  // background. (segment.ts is small; only the model inside it is lazy.)
  const composite = useMemo(
    () => (source && matte && bgColor ? replaceBackground(source, matte, bgColor) : null),
    [source, matte, bgColor],
  );
  const framed: Src | null = composite ?? source;

  // The frame must stay inside the image, including after the frame's shape
  // changes (custom size), so the stored view is clamped on every read.
  const view = source ? clampView(rawView, source.width, source.height, preset.widthMm, preset.heightMm) : rawView;

  useEffect(() => () => { for (const u of urls.current) URL.revokeObjectURL(u); }, []);

  // A photo picked before hydration fired its change event with no listener.
  const [early] = useState(() => filesBeforeHydration('photo-file')[0]);
  useEffect(() => {
    if (early) void load(early);
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw the preview and the guide.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !framed) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(PREVIEW_W * dpr);
    canvas.height = Math.round(previewH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const frame = renderFrame(framed, view, canvas.width, canvas.height, bgColor);
    ctx.drawImage(frame, 0, 0);

    // Guide: an oval from crown to chin at the preset's face height.
    const W = canvas.width;
    const H = canvas.height;
    const faceH = H * preset.face;
    const top = H * (1 - preset.face) * 0.33;
    ctx.save();
    ctx.setLineDash([6 * dpr, 5 * dpr]);
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = 'rgba(255, 145, 231, 0.95)';
    ctx.beginPath();
    ctx.ellipse(W / 2, top + faceH / 2, faceH * 0.36, faceH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = 'rgba(255, 145, 231, 0.6)';
    for (const y of [top, top + faceH]) {
      ctx.beginPath(); ctx.moveTo(W * 0.2, y); ctx.lineTo(W * 0.8, y); ctx.stroke();
    }
    ctx.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framed, view.zoom, view.cx, view.cy, previewH, preset.face, bgColor]);

  // Build the downloadable files once the framing has settled.
  useEffect(() => {
    if (!framed) return;
    let live = true;
    const timer = setTimeout(async () => {
      const [photo, sheet] = await Promise.all([
        digitalPhoto(framed, view, preset, bgColor),
        printSheet(framed, view, preset, bgColor),
      ]);
      if (!live) return;
      for (const u of urls.current) URL.revokeObjectURL(u);
      const photoUrl = URL.createObjectURL(photo.blob);
      const sheetUrl = URL.createObjectURL(sheet.blob);
      urls.current = [photoUrl, sheetUrl];
      setOutputs({
        photo: { url: photoUrl, size: photo.blob.size, w: photo.width, h: photo.height, fits: photo.fits },
        sheet: { url: sheetUrl, size: sheet.blob.size, copies: sheet.copies },
      });
    }, 350);
    return () => { live = false; clearTimeout(timer); };
    // `preset` is rebuilt every render; its fields are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framed, view.zoom, view.cx, view.cy, bgColor, preset.widthMm, preset.heightMm, preset.maxBytes]);

  async function load(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      let bitmap = await createImageBitmap(file);
      const long = Math.max(bitmap.width, bitmap.height);
      if (long > MAX_EDGE) {
        const k = MAX_EDGE / long;
        const smaller = await createImageBitmap(bitmap, {
          resizeWidth: Math.round(bitmap.width * k), resizeHeight: Math.round(bitmap.height * k), resizeQuality: 'high',
        });
        bitmap.close();
        bitmap = smaller;
      }
      setMatte(null);
      setMatteState({ name: 'idle' });
      setOutputs(null);
      setSource(bitmap);
      setView(clampView({ zoom: 1, cx: bitmap.width / 2, cy: bitmap.height / 2 }, bitmap.width, bitmap.height, preset.widthMm, preset.heightMm));
      if (background !== 'keep') void segment(bitmap);
    } catch {
      setError(t.readError);
    }
  }

  const segment = useCallback(async (src: Src) => {
    setMatteState({ name: 'busy', label: t.downloading(0) });
    try {
      const m = await personMatte(src, (f, stage) => setMatteState({
        name: 'busy', label: stage === 'download' ? t.downloading(Math.round(f * 100)) : t.removing,
      }));
      setMatte(m);
      setMatteState({ name: 'idle' });
    } catch (err) {
      setMatteState({ name: 'error', message: err instanceof Error ? err.message : t.bgFailed });
    }
  }, [t]);

  function chooseBackground(next: Background) {
    setBackground(next);
    if (next !== 'keep' && source && !matte && matteState.name !== 'busy') void segment(source);
  }

  function choosePreset(id: string) {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    // A preset that requires white starts on white; the model only loads
    // once there is a photo to run it on.
    if (p?.background === '#ffffff' && background !== 'keep') chooseBackground('white');
  }

  // ─── Direct manipulation ──────────────────────────────────────────────────
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const pan = useCallback((dx: number, dy: number) => {
    if (!source) return;
    setView((v) => {
      const s = coverScale(source.width, source.height, PREVIEW_W, previewH) * v.zoom;
      return clampView({ ...v, cx: v.cx - dx / s, cy: v.cy - dy / s }, source.width, source.height, PREVIEW_W, previewH);
    });
  }, [source, previewH]);

  const zoomTo = useCallback((zoom: number) => {
    if (!source) return;
    setView((v) => clampView({ ...v, zoom }, source.width, source.height, PREVIEW_W, previewH));
  }, [source, previewH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => source ? clampView({ ...v, zoom: v.zoom * Math.exp(-e.deltaY * 0.0015) }, source.width, source.height, PREVIEW_W, previewH) : v);
    };
    // Non-passive so the page does not scroll while zooming the photo.
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [source, previewH]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: view.zoom };
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      zoomTo(pinch.current.zoom * (Math.hypot(a!.x - b!.x, a!.y - b!.y) / pinch.current.dist));
    } else if (pointers.current.size === 1) {
      pan(e.clientX - prev.x, e.clientY - prev.y);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    const step = e.shiftKey ? 20 : 4;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    if (moves[e.key]) { e.preventDefault(); pan(...moves[e.key]!); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(view.zoom * 1.08); }
    else if (e.key === '-') { e.preventDefault(); zoomTo(view.zoom / 1.08); }
  }

  const bgName = background === 'keep' ? '' : t[background];
  const limit = preset.maxBytes ? targetLabel(preset.maxBytes / 1000) : null;
  const inputCls = 'w-20 rounded border border-border bg-surface px-2 py-1.5 font-mono text-sm tabular-nums';

  return (
    <section className="flex flex-col gap-5">
      <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="photo-preset" className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted">{t.preset}</label>
          <select id="photo-preset" value={presetId} onChange={(e) => choosePreset(e.target.value)} className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-sm">
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{(t.presets as Record<string, string>)[p.id]}</option>)}
          </select>
          {preset.source && (
            <p className="mt-1 text-xs text-muted">
              {t.source}:{' '}
              <a className="underline decoration-border underline-offset-2 hover:text-accent" href={preset.source.url} rel="noopener noreferrer">{preset.source.title}</a>
              {' · '}{preset.source.checked}
            </p>
          )}
        </div>
        {presetId === 'custom' && (
          <div className="flex items-end gap-3 sm:col-span-2">
            {(['w', 'h'] as const).map((k) => (
              <div key={k}>
                <label htmlFor={`photo-${k}`} className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted">{k === 'w' ? t.width : t.height}</label>
                <div className="flex items-center gap-1.5">
                  <input
                    id={`photo-${k}`} type="number" min={20} max={100} inputMode="numeric" value={custom[k]}
                    onChange={(e) => {
                      const n = Math.round(Number(e.target.value));
                      if (n >= 20 && n <= 100) setCustom((c) => ({ ...c, [k]: n }));
                    }}
                    className={inputCls}
                  />
                  <span className="text-xs text-muted">{t.mm}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted">{t.background}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(['keep', 'white', ...(preset.background ? [] : ['blue', 'red'])] as Background[]).map((b) => (
              <label key={b} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="photo-bg" value={b} checked={background === b} onChange={() => chooseBackground(b)} className="accent-[var(--accent)]" />
                {b === 'keep' ? t.bgKeep : b === 'white' ? t.bgWhite : b === 'blue' ? t.bgBlue : t.bgRed}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <input ref={inputRef} id="photo-file" type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void load(e.target.files?.[0])} />

      {!source ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void load(e.dataTransfer?.files?.[0]); }}
          className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-[120ms] ${
            dragging ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:border-border-strong'
          }`}
        >
          <span className="text-sm font-medium">{t.drop}</span>
          <span className="text-xs text-muted">{t.dropSub}</span>
        </button>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3">
            <canvas
              ref={canvasRef}
              role="img"
              tabIndex={0}
              aria-label={t.frameLabel}
              aria-describedby="photo-guide"
              style={{ width: PREVIEW_W, height: previewH, touchAction: 'none' }}
              className="cursor-grab rounded border border-border bg-sunken outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
            />
            <div className="flex w-full items-center gap-2" style={{ maxWidth: PREVIEW_W }}>
              <label htmlFor="photo-zoom" className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.zoom}</label>
              <input id="photo-zoom" type="range" min={1} max={4} step={0.01} value={Math.min(4, view.zoom)} onChange={(e) => zoomTo(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" />
              <button type="button" onClick={() => source && setView(clampView({ zoom: 1, cx: source.width / 2, cy: source.height / 2 }, source.width, source.height, PREVIEW_W, previewH))} className="rounded border border-border px-2 py-0.5 text-2xs text-muted hover:text-text">{t.reset}</button>
            </div>
            <p id="photo-guide" className="text-xs leading-snug text-muted" style={{ maxWidth: PREVIEW_W }}>{t.guide}</p>
          </div>

          <div className="flex flex-col gap-4" aria-live="polite">
            {matteState.name === 'busy' && (
              <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">{matteState.label}…</p>
            )}
            {matteState.name === 'error' && (
              <div className="flex items-start gap-3 rounded-lg border border-err bg-err-subtle px-4 py-3">
                <p data-status-message className="flex-1 text-sm text-err">{matteState.message}</p>
                <button type="button" onClick={() => source && void segment(source)} className="shrink-0 rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-text">{t.retry}</button>
              </div>
            )}

            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">{t.checks}</p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex gap-2"><span className="text-ok" aria-hidden="true">✓</span>
                  <span data-numeric>{t.size(preset.widthMm, preset.heightMm, mmToPx(preset.widthMm, DIGITAL_DPI), mmToPx(preset.heightMm, DIGITAL_DPI))}</span></li>
                {bgColor && composite
                  ? <li className="flex gap-2"><span className="text-ok" aria-hidden="true">✓</span><span>{t.bgDone(bgName)}</span></li>
                  : preset.background && <li className="flex gap-2"><span className="text-muted" aria-hidden="true">!</span><span className="text-muted">{t.bgWarn}</span></li>}
                {limit && outputs && (
                  <li className="flex gap-2">
                    <span className={outputs.photo.fits ? 'text-ok' : 'text-err'} aria-hidden="true">{outputs.photo.fits ? '✓' : '!'}</span>
                    <span data-numeric>{(outputs.photo.fits ? t.under : t.over)(limit, exactBytes(outputs.photo.size))}</span>
                  </li>
                )}
              </ul>
            </div>

            {outputs ? (
              <div className="flex flex-col gap-2">
                <a href={outputs.photo.url} download="photo-35x50.jpg" data-testid="save-photo" className="flex items-center justify-between gap-3 rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover">
                  <span>{t.savePhoto}</span><span data-numeric className="text-2xs opacity-80">{outputs.photo.w}×{outputs.photo.h} · {bytes(outputs.photo.size)}</span>
                </a>
                <a href={outputs.sheet.url} download="photo-4r-sheet.jpg" data-testid="save-sheet" className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent">
                  <span>{t.saveSheet}</span><span data-numeric className="text-2xs text-muted">1800×1200 · {bytes(outputs.sheet.size)}</span>
                </a>
                <p className="text-xs leading-snug text-muted">{t.sheetNote(outputs.sheet.copies)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">{t.preparing}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-2xs">
              <button type="button" onClick={() => inputRef.current?.click()} className="rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-text">{t.another}</button>
              <a href={localePath(locale, '/image/compress')} className="text-muted underline decoration-border underline-offset-2 hover:text-accent">{t.compress}</a>
            </div>
          </div>
        </div>
      )}

      {error && <p data-status-message className="rounded-lg border border-err bg-err-subtle px-4 py-3 text-sm text-err">{error}</p>}
    </section>
  );
}
