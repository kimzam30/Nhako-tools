import type { FileToolResult } from '../../tools/types';
import { bytes, duration } from '../../lib/format';
import StatusMark from './StatusMark';
import CopyButton from './CopyButton';
import type { IslandStrings } from '../../i18n/island';

/**
 * The finished state: what came out, what it will be called, and Save.
 *
 * Shared by the generic file runner and by every tool with its own interface,
 * so a job that ends in Merge PDF ends the way a job in Rotate PDF ends. Before
 * this, each bespoke tool drew its own result row and they had drifted: some
 * printed the filename, some did not, none of them let you change it, and only
 * the generic one said anything more than a tick.
 */

export interface Finished {
  result: FileToolResult;
  url: string;
  size: number;
  /** Milliseconds the work took, or undefined to leave the timing unstated. */
  elapsed?: number;
}

export function ResultBar({ done, name, onRename, onClear, t, idBase }: {
  done: Finished;
  /** The stem the user typed, or null for the tool's own name. */
  name: string | null;
  onRename: (value: string) => void;
  onClear: () => void;
  t: IslandStrings;
  /** Prefix for the field ids, unique per tool on the page. */
  idBase: string;
}) {
  const [stem, ext] = splitName(done.result.filename);
  const saveName = `${safeStem(name ?? stem) || stem || 'output'}${ext}`;
  const facts = [
    done.result.summary,
    bytes(done.size),
    done.elapsed === undefined ? '' : duration(done.elapsed),
  ].filter(Boolean).join(' · ');

  return (
    <div
      data-status="done"
      className="relative flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-lg border border-ok bg-ok-subtle px-4 py-3"
    >
      {/* Drawn, not printed. See motion.css "Result status" for why this is
          the one thing on the critical path allowed to move. */}
      <StatusMark kind="done" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ok">{t.doneLabel}</p>
        <p data-numeric className="text-2xs text-muted">{facts}</p>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={done.url}
          download={saveName}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-on transition-colors duration-[120ms] hover:bg-accent-hover"
        >
          {t.save}
        </a>
        <button type="button" onClick={onClear} className="rounded border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text">
          {t.clear}
        </button>
      </div>

      {/*
        The name is editable HERE rather than in a dialog on the way out,
        because the browser's own save dialog is the last place a rename can
        still happen and most people never see it: a click on Save writes
        "merged.pdf" straight to Downloads. The extension is not part of the
        field. It is derived from the bytes the tool actually produced, so a
        rename cannot turn a PDF into a .txt by accident.
      */}
      <div className="basis-full">
        <label htmlFor={`${idBase}-name`} className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.fileName}</span>
          <span className="text-2xs text-muted">{t.fileNameHelp}</span>
        </label>
        <div className="flex items-stretch">
          <input
            id={`${idBase}-name`}
            value={name ?? stem}
            onChange={(e) => onRename(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-l border border-r-0 border-border bg-surface px-2.5 py-1.5 font-mono text-sm transition-colors hover:border-border-strong"
          />
          <span
            data-numeric
            className="grid shrink-0 place-items-center rounded-r border border-border bg-sunken px-2.5 font-mono text-sm text-muted"
          >
            {ext}
          </span>
        </div>
      </div>

      {done.result.text !== undefined && (
        <div className="basis-full">
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor={`${idBase}-text`} className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.output}</label>
            <CopyButton text={done.result.text} label={t.copy} copiedLabel={t.copied} announce={t.copiedAnnounce} />
          </div>
          <textarea
            id={`${idBase}-text`} readOnly value={done.result.text} rows={10}
            className="w-full resize-y rounded border border-border bg-bg p-3 font-mono text-xs leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}

/** The failed state, worded and marked the same way as the finished one. */
export function ErrorBar({ message, onClear, t }: {
  message: string; onClear: () => void; t: IslandStrings;
}) {
  return (
    <div data-status="error" className="relative flex items-start gap-3 overflow-hidden rounded-lg border border-err bg-err-subtle px-4 py-3">
      <StatusMark kind="error" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-err">{t.errorLabel}</p>
        {/* `data-status-message` is what the suite reads. The label above it is
            also .text-err, so a class-based selector picks the heading and
            never reaches what actually went wrong. */}
        <p data-status-message className="text-sm text-err">{message}</p>
      </div>
      <button type="button" onClick={onClear} className="shrink-0 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-text">
        {t.clear}
      </button>
    </div>
  );
}

/**
 * Split "merged.pdf" into ["merged", ".pdf"].
 *
 * The last dot wins, and a leading dot is not one: ".gitignore" is a name, not
 * an empty name with an extension. A name with no dot gets an empty extension
 * rather than losing its last segment.
 */
export function splitName(filename: string): [string, string] {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return [filename, ''];
  return [filename.slice(0, dot), filename.slice(dot)];
}

/**
 * What is safe to put in a `download` attribute.
 *
 * Path separators are the ones that matter: a name containing a slash is
 * either ignored or flattened depending on the browser, so the user would
 * press Save and get a file named something they did not type. The rest are
 * characters Windows refuses outright, stripped here so the same typed name
 * saves identically on every platform. Trailing dots and spaces go too, for
 * the same reason.
 */
export function safeStem(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[/\\:*?"<>|\u0000-\u001f]/g, '').replace(/[. ]+$/, '').trim().slice(0, 120);
}
