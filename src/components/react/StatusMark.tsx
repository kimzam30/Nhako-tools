/**
 * The done / failed mark, drawn rather than popped.
 *
 * Geometry follows the tool marks in src/tools/marks.ts: a 24 unit grid and a
 * 1.5 stroke, butt caps, miter joins. It is the same hand, so the confirmation
 * reads as part of the instrument and not as a borrowed icon set.
 *
 * `pathLength={1}` on every drawn element is what lets motion.css animate them
 * with a dash offset of exactly 1, whatever the real arc or line length is.
 * Without it each keyframe would have to carry a number measured off this
 * geometry, and moving a vertex by a unit would silently break the timing.
 *
 * The element is aria-hidden throughout. The live region in the runner already
 * announces the outcome in words, and a screen reader gaining "image" here
 * would be hearing the same fact twice.
 */
export default function StatusMark({ kind }: { kind: 'done' | 'error' }) {
  const stroke = kind === 'done' ? 'var(--ok)' : 'var(--err)';

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0 overflow-visible"
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <circle data-status-ring cx="12" cy="12" r="10.25" pathLength={1} />

      {kind === 'done' ? (
        <path data-status-mark d="M7 12.4l3.4 3.4L17 8.9" pathLength={1} />
      ) : (
        <>
          <path data-status-mark d="M12 6.6v7.1" pathLength={1} />
          {/* Drawn as a zero-length stroke so it inherits the same cap and
              colour as the bar instead of needing a separate fill. */}
          <path data-status-dot d="M12 17.3h0.01" strokeLinecap="round" strokeWidth={2} />
        </>
      )}
    </svg>
  );
}
