/**
 * Group packing for the tool grids.
 *
 * A group used to own a whole row, so "Reduce file size" with one tool left
 * three quarters of the row empty, and on the homepage six such rows stacked
 * into the whitespace Kim flagged on 2026-09-25. Now every group is a subgrid
 * spanning as many columns as it has tools, so small neighbours share a row
 * in their original order (no dense packing: order carries meaning, see the
 * adjacency test in registry.test.ts) and every card still sits on the same
 * column tracks.
 *
 * Literal class strings, because Tailwind only generates classes it can see.
 */
const SM = ['sm:col-span-1', 'sm:col-span-2'];
const LG = ['lg:col-span-1', 'lg:col-span-2', 'lg:col-span-3'];
const XL = ['xl:col-span-1', 'xl:col-span-2', 'xl:col-span-3', 'xl:col-span-4'];

/** The container: the column tracks every group shares. */
export const PACK = 'grid grid-cols-1 gap-x-2.5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3';
export const PACK_XL = 'xl:grid-cols-4';

/** One group's span at each breakpoint, clamped to the columns available. */
export function span(count: number, maxCols: 3 | 4 = 4): string {
  const n = Math.max(1, count);
  const parts = [SM[Math.min(n, 2) - 1], LG[Math.min(n, 3) - 1]];
  if (maxCols === 4) parts.push(XL[Math.min(n, 4) - 1]);
  return `col-span-1 ${parts.join(' ')}`;
}

/** A group: its own grid on the parent's tracks, heading across the top. */
export const GROUP = 'grid grid-cols-subgrid content-start gap-y-2.5';
