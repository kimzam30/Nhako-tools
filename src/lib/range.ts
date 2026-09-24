import { ToolError } from '../tools/types';
import { sayer, type Say } from '../tools/say';

/** English on its own, for callers with no locale to hand (the unit tests). */
const englishOnly: Say = sayer({});

/**
 * Parse a human page range ("1-5, 8, 11-13") into zero-based indices.
 * An empty string means "everything", which is the common case.
 *
 * `say` is what puts these messages in the language of the page: the Pages
 * field appears on four tools, and its complaints used to arrive in English
 * on a page that was otherwise entirely Malay.
 */
export function parsePageRange(input: string, pageCount: number, say: Say = englishOnly): number[] {
  const spec = input.trim();
  if (spec === '') return Array.from({ length: pageCount }, (_, i) => i);

  const pages = new Set<number>();
  for (const rawPart of spec.split(',')) {
    const part = rawPart.trim();
    if (part === '') continue;

    const match = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) throw new ToolError(say(
      `"${part}" is not a page or a range. Use something like 1-5, 8, 11-13.`,
      `"${part}" bukan halaman atau julat. Gunakan sesuatu seperti 1-5, 8, 11-13.`,
    ));

    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);

    if (start < 1) throw new ToolError(say('Pages are numbered from 1.', 'Halaman dinomborkan bermula dari 1.'));
    if (start > pageCount || end > pageCount) {
      throw new ToolError(say(
        `This document has ${pageCount} page${pageCount === 1 ? '' : 's'}, so "${part}" is out of range.`,
        `Dokumen ini mempunyai ${pageCount} halaman, jadi "${part}" di luar julat.`,
      ));
    }
    if (end < start) throw new ToolError(say(
      `"${part}" runs backwards. Write it as ${end}-${start}.`,
      `"${part}" terbalik. Tulis sebagai ${end}-${start}.`,
    ));

    for (let p = start; p <= end; p++) pages.add(p - 1);
  }

  if (pages.size === 0) throw new ToolError(say('No pages selected.', 'Tiada halaman dipilih.'));
  return [...pages].sort((a, b) => a - b);
}
