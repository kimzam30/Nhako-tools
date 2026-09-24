import { useEffect, useRef, useState } from 'react';
import { bytes } from '../../lib/format';
import type { Locale } from '../../i18n/paths';

/**
 * Shows what the tool actually produced, decoded from the output blob itself.
 *
 * This is the whole reason one component can serve ten tools. Nothing here
 * knows what a watermark or a rotation is; it renders the bytes that came back.
 * Because every file tool re-runs on an option change, rendering the output IS
 * the live preview of the adjustment, and Rotate PDF, Watermark PDF, Add page
 * numbers, Resize image, Rotate image, Watermark image and Remove background
 * all get one for free. A tool that changes what it emits cannot drift away
 * from its own preview, because there is only one artefact.
 *
 * It renders the real thing rather than a re-simulation of the settings, so
 * what is on screen is a decode of the exact bytes the Save button hands over.
 * A preview that agreed with the sliders but not with the file would be worse
 * than no preview at all.
 */

type View =
  | { kind: 'pdf'; url: string; pages: number; page: number; width: number; height: number }
  | { kind: 'image'; url: string; width: number; height: number; alpha: boolean }
  | { kind: 'zip'; entries: { name: string; size: number }[]; total: number }
  | { kind: 'none' };

const TEXT = {
  en: {
    label: 'Preview',
    ofOutput: 'This is the file Save will hand you.',
    page: (n: number, of: number) => `Page ${n} of ${of}`,
    prev: 'Previous page',
    next: 'Next page',
    building: 'Drawing the preview…',
    failed: 'This output cannot be previewed, but it saved correctly.',
    files: (n: number) => `${n} file${n === 1 ? '' : 's'} inside`,
    andMore: (n: number) => `and ${n} more`,
    transparent: 'Checkered areas are transparent.',
  },
  ms: {
    label: 'Pratonton',
    ofOutput: 'Ini fail yang akan diberikan oleh Simpan.',
    page: (n: number, of: number) => `Halaman ${n} daripada ${of}`,
    prev: 'Halaman sebelum',
    next: 'Halaman seterusnya',
    building: 'Melukis pratonton…',
    failed: 'Output ini tidak boleh dipratonton, tetapi ia disimpan dengan betul.',
    files: (n: number) => `${n} fail di dalam`,
    andMore: (n: number) => `dan ${n} lagi`,
    transparent: 'Kawasan berpetak adalah lutsinar.',
  },
} satisfies Record<Locale, unknown>;

/** Enough to judge a watermark or a crop, cheap enough to redraw on a drag. */
const PAGE_W = 460;

/** A PDF this long gets a pager and nothing more; thumbnailing it all would
 *  cost more than the tool that produced it. */
const MAX_LISTED = 8;

export default function ResultPreview({ blob, locale = 'en' }: { blob: Blob; locale?: Locale }) {
  const t = TEXT[locale];
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(true);

  // pdf.js holds native memory until destroy(), and a slider drag can produce
  // a new document every 400ms, so the previous one is always torn down.
  const docRef = useRef<{ destroy(): void } | null>(null);
  const urls = useRef<string[]>([]);
  // Bumped on every new blob; a render that finishes after its blob was
  // replaced compares this and drops its result instead of painting it.
  const ticket = useRef(0);

  const track = (url: string) => { urls.current.push(url); return url; };
  const release = () => {
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current = [];
  };

  useEffect(() => {
    const mine = ++ticket.current;
    let cancelled = false;
    setBusy(true);

    void (async () => {
      const previous = docRef.current;
      docRef.current = null;
      previous?.destroy();
      release();

      try {
        const next = await describe(blob, mine, ticket, docRef, track);
        if (cancelled || mine !== ticket.current) return;
        setView(next);
      } catch {
        if (cancelled || mine !== ticket.current) return;
        setView({ kind: 'none' });
      } finally {
        if (!cancelled && mine === ticket.current) setBusy(false);
      }
    })();

    return () => { cancelled = true; };
  }, [blob]);

  // Unmount only. Paging reuses the open document, so it must not be torn
  // down by the effect above, which is keyed on the blob.
  useEffect(() => () => { docRef.current?.destroy(); release(); }, []);

  async function goToPage(n: number) {
    if (!view || view.kind !== 'pdf' || !docRef.current) return;
    const mine = ticket.current;
    const { renderPage } = await import('../../lib/pdf-render');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await renderPage(docRef.current as any, n, PAGE_W);
    if (mine !== ticket.current) { URL.revokeObjectURL(r.url); return; }
    setView({ ...view, url: track(r.url), page: n, width: r.widthPt, height: r.heightPt });
  }

  if (!view && busy) {
    return (
      <Shell t={t} kind="pending">
        <p className="py-10 text-center text-xs text-muted">{t.building}</p>
      </Shell>
    );
  }

  if (!view || view.kind === 'none') {
    return (
      <Shell t={t} kind="none">
        <p className="py-6 text-center text-xs text-muted">{t.failed}</p>
      </Shell>
    );
  }

  if (view.kind === 'zip') {
    const shown = view.entries.slice(0, MAX_LISTED);
    return (
      <Shell t={t} kind="zip" note={t.files(view.total)}>
        <ul className="divide-y divide-border">
          {shown.map((e) => (
            <li key={e.name} className="flex items-baseline justify-between gap-4 py-1.5">
              <span className="truncate text-xs" title={e.name}>{e.name}</span>
              <span data-numeric className="shrink-0 text-2xs text-muted">{bytes(e.size)}</span>
            </li>
          ))}
          {view.total > shown.length && (
            <li className="py-1.5 text-2xs text-muted">{t.andMore(view.total - shown.length)}</li>
          )}
        </ul>
      </Shell>
    );
  }

  if (view.kind === 'image') {
    return (
      <Shell t={t} kind="image" note={`${view.width} × ${view.height}`}>
        <div
          className="grid min-h-40 place-items-center overflow-hidden rounded bg-sunken p-2"
          // A transparent cutout is the entire output of Remove background, and
          // on a plain panel it is invisible: the result would look identical
          // whether the tool worked or silently did nothing.
          style={view.alpha ? { backgroundImage: CHECKER, backgroundSize: '16px 16px' } : undefined}
        >
          <img src={view.url} alt="" className="max-h-[26rem] max-w-full object-contain" />
        </div>
        {view.alpha && <p className="mt-2 text-2xs text-muted">{t.transparent}</p>}
      </Shell>
    );
  }

  return (
    <Shell t={t} kind="pdf" note={view.pages > 1 ? t.page(view.page, view.pages) : undefined}>
      <div className="grid place-items-center overflow-hidden rounded bg-sunken p-2">
        <img
          src={view.url}
          alt=""
          className="max-h-[30rem] max-w-full object-contain shadow-sm"
          // Held at the page's own aspect ratio so paging between a portrait
          // and a landscape page does not jump the panel's height around.
          style={{ aspectRatio: `${view.width} / ${view.height}` }}
        />
      </div>

      {view.pages > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-2">
          <PageButton label={t.prev} disabled={view.page <= 1} onClick={() => void goToPage(view.page - 1)}>←</PageButton>
          <span data-page-indicator data-numeric className="min-w-24 text-center text-2xs text-muted">
            {view.page} / {view.pages}
          </span>
          <PageButton label={t.next} disabled={view.page >= view.pages} onClick={() => void goToPage(view.page + 1)}>→</PageButton>
        </div>
      )}
    </Shell>
  );
}

function Shell({ t, kind, note, children }: {
  t: typeof TEXT['en']; kind: string; note?: string; children: React.ReactNode;
}) {
  return (
    /* `data-result-preview` names what was decoded, so a test can assert that
       a PDF tool previewed a PDF rather than merely that some panel appeared. */
    <section data-result-preview={kind} className="basis-full rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.label}</h2>
        <p data-numeric className="text-2xs text-muted">{note ?? t.ofOutput}</p>
      </div>
      {children}
    </section>
  );
}

function PageButton({ label, disabled, onClick, children }: {
  label: string; disabled: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="grid size-7 place-items-center rounded border border-border text-xs text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-30 pointer-coarse:size-11"
    >
      {children}
    </button>
  );
}

const CHECKER =
  'repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%)';

async function describe(
  blob: Blob,
  mine: number,
  ticket: { current: number },
  docRef: { current: { destroy(): void } | null },
  track: (url: string) => string,
): Promise<View> {
  const type = blob.type;

  if (type === 'application/pdf') {
    const { openForPreview, renderPage } = await import('../../lib/pdf-render');
    const doc = await openForPreview(new Uint8Array(await blob.arrayBuffer()));
    if (mine !== ticket.current) { void doc.destroy(); return { kind: 'none' }; }
    docRef.current = doc;
    const r = await renderPage(doc, 1, PAGE_W);
    return { kind: 'pdf', url: track(r.url), pages: doc.numPages, page: 1, width: r.widthPt, height: r.heightPt };
  }

  if (type.startsWith('image/') && type !== 'image/heic' && type !== 'image/heif') {
    const bmp = await createImageBitmap(blob);
    const alpha = await hasAlpha(bmp);
    const out: View = {
      kind: 'image', url: track(URL.createObjectURL(blob)),
      width: bmp.width, height: bmp.height, alpha,
    };
    bmp.close();
    return out;
  }

  if (type === 'application/zip' || type === 'application/x-zip-compressed') {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    const entries: { name: string; size: number }[] = [];
    zip.forEach((path, file) => {
      if (file.dir) return;
      // _data carries the uncompressed length; it is the only size JSZip
      // exposes without inflating every entry, which on a 200-page split
      // would cost more than the split did.
      const size = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
      entries.push({ name: path, size });
    });
    return { kind: 'zip', entries, total: entries.length };
  }

  return { kind: 'none' };
}

/**
 * Whether any pixel is not fully opaque.
 *
 * Sampled on a small draw rather than at full size: a 6000px photo would cost
 * 144MB of image data to answer a yes/no question, and downscaling cannot turn
 * a transparent region opaque.
 */
async function hasAlpha(bmp: ImageBitmap): Promise<boolean> {
  const w = Math.max(1, Math.min(96, bmp.width));
  const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(bmp, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) return true;
  return false;
}
