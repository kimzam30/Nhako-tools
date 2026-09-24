import { useEffect, useRef, useState } from 'react';
import { describeFile, KIND_LABEL, type Meta } from './file-thumb';
import { useDragOrder, dragClass, DROP_GAP } from './drag-order';
import type { Locale } from '../../i18n/paths';

/**
 * A staging area for files, in an order the user controls.
 *
 * Merge PDF and JPG to PDF both take several files and both care about the
 * order, and neither used to show you either one. Merge combined "in the order
 * you dropped them" with no list on screen, so the only way to change the
 * order was to start again and drop them in a different sequence; JPG to PDF
 * had the same problem with photos, where the order IS the document.
 *
 * Nothing here uploads or converts. It is a place to put files down, look at
 * them, and arrange them before anything happens, which is the whole of what
 * was missing.
 */

export interface Staged {
  id: string;
  file: File;
  meta?: Meta;
}

const TEXT = {
  en: {
    region: 'Files to combine',
    heading: 'In this order',
    add: 'Add more',
    remove: 'Remove',
    earlier: 'Move earlier',
    later: 'Move later',
    pages: (n: number) => `${n} page${n === 1 ? '' : 's'}`,
    hint: 'Drag to reorder, or use the arrows on each file.',
    moved: (label: string, at: number, of: number) => `${label} moved to position ${at} of ${of}.`,
    lifted: (label: string) => `${label} lifted. Drop it on another file to place it there.`,
    cancelled: 'Move cancelled. Nothing changed.',
    removed: (label: string) => `${label} removed.`,
  },
  ms: {
    region: 'Fail untuk digabungkan',
    heading: 'Dalam susunan ini',
    add: 'Tambah lagi',
    remove: 'Buang',
    earlier: 'Alih ke depan',
    later: 'Alih ke belakang',
    pages: (n: number) => `${n} halaman`,
    hint: 'Seret untuk menyusun semula, atau guna anak panah pada setiap fail.',
    moved: (label: string, at: number, of: number) => `${label} dialih ke kedudukan ${at} daripada ${of}.`,
    lifted: (label: string) => `${label} diangkat. Lepaskan pada fail lain untuk meletakkannya di situ.`,
    cancelled: 'Pergerakan dibatalkan. Tiada apa-apa berubah.',
    removed: (label: string) => `${label} dibuang.`,
  },
} satisfies Record<Locale, unknown>;

let seq = 0;
/** Ids are minted, not derived from the name: the same file can be added twice
 *  on purpose (a cover sheet before and after an insert). */
export const stage = (file: File): Staged => ({ id: `f${++seq}`, file });

export default function FileStage({
  items, setItems, onAdd, onAnnounce, locale = 'en', toolbar,
}: {
  items: Staged[];
  setItems: (next: Staged[]) => void;
  /** Opens the file picker. Owned by the parent, which owns the input. */
  onAdd: () => void;
  onAnnounce: (message: string) => void;
  locale?: Locale;
  /** The parent's build controls, shown across the head of the grid. */
  toolbar?: React.ReactNode;
}) {
  const t = TEXT[locale];

  const drag = useDragOrder(items, {
    onDrop: (next, moved, at) => {
      setItems(next);
      onAnnounce(t.moved(moved.file.name, at + 1, next.length));
    },
    onLift: (it) => onAnnounce(t.lifted(it.file.name)),
    onCancel: () => onAnnounce(t.cancelled),
  });

  useEffect(() => () => drag.dispose(), [drag]);

  function move(id: string, delta: number) {
    const from = items.findIndex((it) => it.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    setItems(next);
    onAnnounce(t.moved(it!.file.name, to + 1, next.length));
    // Keep keyboard focus on the same control after the card moves.
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(
        `[data-stage-card="${id}"] [data-move="${delta < 0 ? 'earlier' : 'later'}"]`,
      )?.focus());
  }

  function remove(it: Staged) {
    setItems(items.filter((x) => x.id !== it.id));
    onAnnounce(t.removed(it.file.name));
  }

  const icon = 'grid size-6 place-items-center rounded border border-border bg-bg text-xs text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-30';

  return (
    <section aria-label={t.region} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span data-numeric className="text-sm font-medium">{t.heading}</span>
        <span className="hidden text-xs text-muted sm:inline">{t.hint}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={onAdd} className="rounded border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text">
            {t.add}
          </button>
          {toolbar}
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((it, i) => (
          <li
            key={it.id}
            data-stage-card={it.id}
            {...drag.props(it)}
            className={`relative flex cursor-grab flex-col gap-2 rounded-lg border bg-surface p-2 transition-[border-color,opacity,box-shadow] duration-150 active:cursor-grabbing ${dragClass(drag.dragId === it.id, drag.landed === it.id)}`}
          >
            {drag.over?.id === it.id && drag.dragId !== null && drag.dragId !== it.id && (
              <span aria-hidden="true" className={`${DROP_GAP} ${drag.over.after ? '-right-1.5' : '-left-1.5'}`} />
            )}

            <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded bg-sunken">
              {it.meta?.thumb && it.meta.kind !== 'file' && it.meta.kind !== 'audio'
                ? <img src={it.meta.thumb} alt="" className="max-h-full max-w-full object-contain shadow-sm" draggable={false} />
                : <span className="text-2xs uppercase tracking-wider text-muted">
                    {it.meta ? KIND_LABEL[it.meta.kind] : '…'}
                  </span>}

              {/* The position, on the thing it describes. Same chip as Organize
                  PDF, because it answers the same question. */}
              <span
                data-position
                data-numeric
                className="absolute left-1 top-1 grid min-w-6 place-items-center rounded bg-accent px-1.5 py-0.5 font-mono text-xs font-bold text-accent-on shadow-sm"
              >
                {i + 1}
              </span>
            </div>

            <span className="truncate text-2xs font-medium" title={it.file.name}>{it.file.name}</span>
            <span data-numeric className="truncate text-2xs text-muted">
              {(it.meta?.facts ?? []).join(', ')}
            </span>

            <div className="flex items-center gap-1">
              <button type="button" data-move="earlier" className={icon} aria-label={`${t.earlier}: ${it.file.name}`} disabled={i === 0} onClick={() => move(it.id, -1)}>←</button>
              <button type="button" data-move="later" className={icon} aria-label={`${t.later}: ${it.file.name}`} disabled={i === items.length - 1} onClick={() => move(it.id, 1)}>→</button>
              <button type="button" className={`${icon} ml-auto`} aria-label={`${t.remove}: ${it.file.name}`} onClick={() => remove(it)}>✕</button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Fill in thumbnails for anything newly staged.
 *
 * Kept out of the component so the parent owns the file list and this only
 * ever adds to it. Object URLs are tracked here and revoked on unmount.
 *
 * The work runs on a QUEUE outside the effect, not inside it. Describing a
 * file writes it back into `items`, which re-runs the effect, and an effect
 * that cancelled its own in-flight loop on re-render therefore stopped after
 * the first file every time: the rest were already marked as started, so they
 * were never picked up again and three staged PDFs showed one thumbnail and
 * two placeholders. Only unmount stops the queue now.
 */
export function useThumbnails(
  items: Staged[],
  setItems: (update: (prev: Staged[]) => Staged[]) => void,
  locale: Locale,
) {
  const t = TEXT[locale];
  const started = useRef(new Set<string>());
  const queue = useRef<Staged[]>([]);
  const running = useRef(false);
  const dead = useRef(false);
  const urls = useRef<string[]>([]);

  useEffect(() => () => {
    dead.current = true;
    for (const u of urls.current) URL.revokeObjectURL(u);
  }, []);

  useEffect(() => {
    const pending = items.filter((it) => !it.meta && !started.current.has(it.id));
    if (pending.length === 0) return;
    for (const it of pending) started.current.add(it.id);
    queue.current.push(...pending);
    if (running.current) return;

    running.current = true;
    void (async () => {
      while (queue.current.length > 0) {
        const it = queue.current.shift()!;
        let meta;
        try {
          meta = await describeFile(it.file, t);
        } catch {
          continue; // a file that cannot be described still stages fine
        }
        if (dead.current) {
          if (meta.thumb?.startsWith('blob:')) URL.revokeObjectURL(meta.thumb);
          return;
        }
        if (meta.thumb?.startsWith('blob:')) urls.current.push(meta.thumb);
        // Written back one at a time, so a batch of forty photos shows its
        // first thumbnails at once rather than staying blank until the last
        // one is decoded.
        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, meta } : x)));
      }
      running.current = false;
    })();
    // `t` is derived from `locale` and constant for the island's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, setItems]);
}

/** A shared empty state, so all three staging tools open the same way. */
export function DropZone({ onPick, onFiles, title, subtitle }: {
  onPick: () => void;
  onFiles: (files: FileList | null) => void;
  title: string;
  subtitle: string;
}) {
  const [hot, setHot] = useState(false);
  return (
    <button
      type="button"
      onClick={onPick}
      onDragOver={(e) => { e.preventDefault(); setHot(true); }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => { e.preventDefault(); setHot(false); onFiles(e.dataTransfer?.files ?? null); }}
      className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-[120ms] ${
        hot ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:border-border-strong'
      }`}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted">{subtitle}</span>
    </button>
  );
}
