/**
 * A drop zone's call to action, in the words that fit the pointer.
 *
 * "Drop a file here, or browse" describes a mouse. A phone or tablet held in
 * the hand has nothing to drag, so on a coarse pointer the same zone shows the
 * one thing a thumb can do, as a filled button: "Choose a PDF". Pure CSS, so
 * it is right on the first paint and never flips after hydration. The hidden
 * form is display:none, so a screen reader hears only the one that shows.
 */
export function DropLabel({ drop, tap }: { drop: string; tap: string }) {
  return (
    <>
      <span className="pointer-coarse:hidden">{drop}</span>
      {tap && (
        <span className="hidden h-11 items-center rounded-lg bg-accent px-5 text-base font-semibold text-accent-on pointer-coarse:inline-flex">
          {tap}
        </span>
      )}
    </>
  );
}
