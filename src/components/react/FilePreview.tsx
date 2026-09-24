import { useEffect, useRef, useState } from 'react';
import { bytes } from '../../lib/format';
import { describeFile, KIND_LABEL, type Meta } from './file-thumb';
import type { Locale } from '../../i18n/paths';

/**
 * Shows what was actually handed to the tool.
 *
 * Tools run the moment a file lands, so this is not a confirmation step; it is
 * there so the result never appears without the input it came from being
 * visible next to it. The thumbnailing itself lives in ./file-thumb, shared
 * with the staging grid in Merge PDF and JPG to PDF.
 */

/* Kind labels above are format names and read the same in both languages, so
   only the surrounding sentences are translated. */
const TEXT = {
  en: {
    region: 'Selected files',
    one: 'Your file',
    many: (n: number) => `Your files (${n})`,
    pages: (n: number) => `${n} page${n === 1 ? '' : 's'}`,
    more: (n: number) => `+${n} more`,
  },
  ms: {
    region: 'Fail yang dipilih',
    one: 'Fail anda',
    many: (n: number) => `Fail anda (${n})`,
    pages: (n: number) => `${n} halaman`,
    more: (n: number) => `+${n} lagi`,
  },
} satisfies Record<Locale, unknown>;

export default function FilePreview({ files, nextStep, locale = 'en' }: {
  files: File[]; nextStep?: string; locale?: Locale;
}) {
  const t = TEXT[locale];
  // Descriptions are stored with the file list they describe, so a new list
  // shows placeholders immediately without a synchronous reset in the effect.
  const [described, setDescribed] = useState<{ files: File[]; metas: Meta[] }>({ files: [], metas: [] });
  const metas: (Meta | null)[] = described.files === files ? described.metas : [];
  const urls = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current = [];

    // Only the first few are described; a 200-file batch does not need 200
    // thumbnails, and rendering them would be slower than the tool itself.
    void Promise.all(files.slice(0, 6).map((f) => describeFile(f, t))).then((result) => {
      if (cancelled) {
        for (const m of result) if (m.thumb?.startsWith('blob:')) URL.revokeObjectURL(m.thumb);
        return;
      }
      urls.current = result.map((m) => m.thumb).filter((u): u is string => !!u?.startsWith('blob:'));
      setDescribed({ files, metas: result });
    });

    return () => { cancelled = true; };
    // `t` is derived from `locale` and is constant for the life of the island.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  if (files.length === 0) return null;
  const shown = files.slice(0, 6);
  const extra = files.length - shown.length;

  return (
    <section aria-label={t.region} className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted">
          {files.length === 1 ? t.one : t.many(files.length)}
        </h2>
        {nextStep && <p className="text-xs text-muted">{nextStep}</p>}
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
                  <span data-numeric className="text-2xs uppercase tracking-wider text-muted">
                    {meta ? KIND_LABEL[meta.kind] : '…'}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-medium" title={file.name}>{file.name}</p>
                <p data-numeric className="mt-0.5 truncate text-2xs text-muted">
                  {(meta?.facts ?? [bytes(file.size)]).join(', ')}
                </p>
              </div>
            </li>
          );
        })}

        {extra > 0 && (
          <li className="flex items-center rounded-md border border-dashed border-border px-3 text-xs text-muted">
            {t.more(extra)}
          </li>
        )}
      </ul>
    </section>
  );
}
