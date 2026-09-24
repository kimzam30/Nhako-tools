import PixelSprite from './PixelSprite';

/**
 * The NeraOS boot screen, shrunk to one row: a flapping butterfly, the step
 * message in the pixel face, and the striped bar that fills in six steps.
 *
 * `progress` is 0 to 1 when the job can measure itself, and undefined when it
 * cannot, in which case the bar is full and the stripes march instead of
 * pretending to a number nobody has.
 */
export default function NeraLoader({ label, progress }: { label: string; progress?: number }) {
  const measured = progress !== undefined;
  return (
    <div className="nera-load" data-loading>
      <span className="flap grid h-9 w-10 shrink-0 place-items-center">
        <PixelSprite name="butterfly" scale={2} />
      </span>
      <div className="nera-load-body">
        <div className="flex items-baseline justify-between gap-4">
          <p className="nera-msg">{label}…</p>
          {measured && <span data-numeric className="nera-pct">{Math.round(progress * 100)}%</span>}
        </div>
        <div className="nera-bar">
          <div
            className="nera-fill"
            data-indeterminate={measured ? undefined : ''}
            style={measured ? { width: `${progress * 100}%` } : undefined}
          />
        </div>
      </div>
    </div>
  );
}

/** A busy button's label, with the same butterfly flapping beside it. */
export function BusyLabel({ label }: { label: string }) {
  return (
    <span className="nera-inline">
      <span className="flap"><PixelSprite name="butterfly" scale={1} /></span>
      {label}
    </span>
  );
}
