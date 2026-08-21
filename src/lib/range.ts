import { ToolError } from '../tools/types';

/**
 * Parse a human page range ("1-5, 8, 11-13") into zero-based indices.
 * An empty string means "everything", which is the common case.
 */
export function parsePageRange(input: string, pageCount: number): number[] {
  const spec = input.trim();
  if (spec === '') return Array.from({ length: pageCount }, (_, i) => i);

  const pages = new Set<number>();
  for (const rawPart of spec.split(',')) {
    const part = rawPart.trim();
    if (part === '') continue;

    const match = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) throw new ToolError(`"${part}" is not a page or a range. Use something like 1-5, 8, 11-13.`);

    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);

    if (start < 1) throw new ToolError('Pages are numbered from 1.');
    if (start > pageCount || end > pageCount) {
      throw new ToolError(`This document has ${pageCount} page${pageCount === 1 ? '' : 's'}, so "${part}" is out of range.`);
    }
    if (end < start) throw new ToolError(`"${part}" runs backwards. Write it as ${end}-${start}.`);

    for (let p = start; p <= end; p++) pages.add(p - 1);
  }

  if (pages.size === 0) throw new ToolError('No pages selected.');
  return [...pages].sort((a, b) => a - b);
}
