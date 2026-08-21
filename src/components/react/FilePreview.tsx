import { useEffect, useRef, useState } from 'react';
import { bytes } from '../../lib/format';

/**
 * Shows what was actually handed to the tool.
 *
 * Tools run the moment a file lands, so this is not a confirmation step; it is
 * there so the result never appears without the input it came from being
 * visible next to it. Thumbnails come from native elements wherever possible
 * (an <img>, a <video> seeked to its first frame) so the preview costs nothing.
 * PDFs are the exception and pull pdf.js in on demand.
 */

interface Meta {
  thumb?: string;
  kind: 'image' | 'video' | 'audio' | 'pdf' | 'file';
  facts: string[];
}

const KIND_LABEL: Record<Meta['kind'], string> = {
  image: 'Image', video: 'Video', audio: 'Audio', pdf: 'PDF', file: 'File',
};

function kindOf(file: File): Meta['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  return 'file';
}

async function describe(file: File): Promise<Meta> {
  const kind = kindOf(file);

  if (kind === 'image') {
    const url = URL.createObjectURL(file);
    try {
      const bmp = await createImageBitmap(file);
      const facts = [`${bmp.width} × ${bmp.height}`, bytes(file.size)];
      bmp.close();
      return { thumb: url, kind, facts };
    } catch {
      return { thumb: url, kind, facts: [bytes(file.size)] };
    }
  }

  if (kind === 'video') {
    const url = URL.createObjectURL(file);
    const facts = await new Promise<string[]>((resolve) => {
      const el = document.createElement('video');
      const done = (f: string[]) => { el.remove(); resolve(f); };
      const timer = setTimeout(() => done([bytes(file.size)]), 4000);
      el.preload = 'metadata';
      el.muted = true;
      el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px';
      el.onloadedmetadata = () => {
        clearTimeout(timer);
        const secs = Number.isFinite(el.duration) && el.duration > 0
          ? `${Math.floor(el.duration / 60)}:${String(Math.round(el.duration % 60)).padStart(2, '0')}`
          : null;
        done([`${el.videoWidth} × ${el.videoHeight}`, ...(secs ? [secs] : []), bytes(file.size)]);
      };
      el.onerror = () => { clearTimeout(timer); done([bytes(file.size)]); };
      document.body.appendChild(el);
      el.src = url;
      el.load();
    });
    return { thumb: url, kind, facts };
  }

  if (kind === 'audio') {
    return { thumb: URL.createObjectURL(file), kind, facts: [bytes(file.size)] };
  }

  if (kind === 'pdf') {
    try {
      const { loadDocument } = await import('../../lib/pdfjs');
      const doc = await loadDocument(file);
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scale = 160 / viewport.height;
      const scaled = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(scaled.width);
      canvas.height = Math.ceil(scaled.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise;
      }
      return {
        thumb: canvas.toDataURL('image/png'),
        kind,
        facts: [`${doc.numPages} page${doc.numPages === 1 ? '' : 's'}`, bytes(file.size)],
      };
    } catch {
      return { kind, facts: [bytes(file.size)] };
    }
  }

  return { kind, facts: [bytes(file.size)] };
}

export default function FilePreview({ files, nextStep }: { files: File[]; nextStep?: string }) {
  const [metas, setMetas] = useState<(Meta | null)[]>([]);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current = [];
    setMetas(files.map(() => null));

    // Only the first few are described; a 200-file batch does not need 200
    // thumbnails, and rendering them would be slower than the tool itself.
    void Promise.all(files.slice(0, 6).map(describe)).then((result) => {
      if (cancelled) {
        for (const m of result) if (m.thumb?.startsWith('blob:')) URL.revokeObjectURL(m.thumb);
        return;
      }
      urls.current = result.map((m) => m.thumb).filter((u): u is string => !!u?.startsWith('blob:'));
      setMetas(result);
    });

    return () => { cancelled = true; };
  }, [files]);

  if (files.length === 0) return null;
  const shown = files.slice(0, 6);
  const extra = files.length - shown.length;

  return (
    <section aria-label="Selected files" className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted">
          {files.length === 1 ? 'Your file' : `Your files (${files.length})`}
        </h2>
        {nextStep && <p className="text-2xs text-muted">{nextStep}</p>}
      </div>

      <ul className="flex flex-wrap gap-2.5">
        {shown.map((file, i) => {
          const meta = metas[i] ?? null;
          return (
            <li
              key={`${file.name}-${file.size}-${i}`}
              className="flex min-w-0 max-w-full items-center gap-3 rounded-md border border-border bg-bg p-2 sm:max-w-xs"
            >
              {/* Fixed box so the row never reflows when a thumbnail resolves. */}
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded bg-sunken">
                {meta?.thumb && meta.kind === 'image' && (
                  <img src={meta.thumb} alt="" className="size-full object-cover" />
                )}
                {meta?.thumb && meta.kind === 'pdf' && (
                  <img src={meta.thumb} alt="" className="size-full object-contain" />
                )}
                {meta?.thumb && meta.kind === 'video' && (
                  <video src={meta.thumb} muted playsInline preload="metadata" className="size-full object-cover" />
                )}
                {(!meta || meta.kind === 'audio' || meta.kind === 'file') && (
                  <span data-numeric className="text-[9px] uppercase tracking-wider text-muted">
                    {meta ? KIND_LABEL[meta.kind] : '…'}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-medium" title={file.name}>{file.name}</p>
                <p data-numeric className="mt-0.5 truncate text-2xs text-muted">
                  {(meta?.facts ?? [bytes(file.size)]).join(' · ')}
                </p>
              </div>
            </li>
          );
        })}

        {extra > 0 && (
          <li className="flex items-center rounded-md border border-dashed border-border px-3 text-2xs text-muted">
            +{extra} more
          </li>
        )}
      </ul>
    </section>
  );
}
