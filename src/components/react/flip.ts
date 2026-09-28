import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * FLIP: when the children of `ref` change places, each one springs from
 * where it was to where it now is, instead of jumping there. Reordering a
 * staged file with its arrow buttons, dropping a dragged page, removing a
 * card and closing the gap: all of it moves, the way a UICollectionView
 * batch update does.
 *
 * Children opt in with `data-flip="<stable id>"`. Runs after every render and
 * only animates what actually moved, so it costs one layout read per child
 * per render. The movement is on `translate`, which leaves the element's
 * own `transform` and `scale` (the press feedback) alone.
 */
export function useFlip(ref: RefObject<HTMLElement | null>): void {
  const last = useRef(new Map<string, { left: number; top: number }>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const spring = getComputedStyle(document.documentElement).getPropertyValue('--spring-snappy').trim() || 'ease-out';
    const next = new Map<string, { left: number; top: number }>();
    for (const child of Array.from(root.querySelectorAll<HTMLElement>(':scope > [data-flip]'))) {
      const id = child.dataset.flip!;
      // Layout position, not getBoundingClientRect: that includes an arrival
      // or FLIP animation still running, so every re-render mid-animation
      // (a drag starting) read as a move and set off spurious animations
      // under the pointer, and a drop could land on the wrong card.
      const now = { left: child.offsetLeft, top: child.offsetTop };
      next.set(id, now);
      const was = last.current.get(id);
      if (!was || reduced) continue;
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      child.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 600, easing: spring });
    }
    last.current = next;
  });
}
