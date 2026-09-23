import type { Category } from './types';

/**
 * Job groups: the browse taxonomy.
 *
 * A category is sub-grouped only when it holds more than GROUP_THRESHOLD tools.
 * Below that a heading over two rows costs scanning effort and returns nothing,
 * so Media (4) and Calculators (1) declare no groups and render flat.
 *
 * Labels name the job in the words someone would use out loud. If a label needs
 * explaining, the grouping is wrong. See
 * .design/tool-findability/INFORMATION_ARCHITECTURE.md for the full rationale.
 *
 * English lives here beside CATEGORY_LABEL; Malay lives in src/i18n/tools.ts
 * beside CATEGORY_MS, and i18n.test.ts fails on a missing translation.
 */

export interface ToolGroup {
  /** Stable id used by ToolMeta.group and ToolMeta.alsoIn. Never shown. */
  id: string;
  label: string;
}

/**
 * Above this many tools in a category, browse surfaces render job groups.
 * It is a rule rather than a per-category flag so a category that grows past
 * it starts being grouped without anyone remembering to switch it on. A
 * category crossing it with ungrouped tools fails registry.test.ts.
 */
export const GROUP_THRESHOLD = 6;

/**
 * Ordered. This array is the ordering authority for every browse surface:
 * the homepage, the category page and anything added later.
 *
 * Six is the practical ceiling. A category needing a seventh group is a signal
 * to re-cut the taxonomy, not to add a heading, and registry.test.ts enforces
 * that ceiling so the decision cannot be made by accident.
 */
export const GROUPS: Partial<Record<Category, readonly ToolGroup[]>> = {
  pdf: [
    { id: 'organise', label: 'Organise pages' },
    { id: 'create', label: 'Create a PDF' },
    { id: 'extract', label: 'Convert and extract' },
    { id: 'mark-up', label: 'Edit and sign' },
    { id: 'shrink', label: 'Reduce file size' },
    { id: 'secure', label: 'Password and permissions' },
  ],
  image: [
    { id: 'shrink', label: 'Reduce file size' },
    { id: 'convert', label: 'Convert' },
    { id: 'transform', label: 'Resize, crop and rotate' },
    { id: 'edit', label: 'Edit a photo' },
    { id: 'clean', label: 'Extract and clean' },
    { id: 'create', label: 'Create' },
  ],
  dev: [
    { id: 'text', label: 'Text and code' },
    { id: 'encode', label: 'Encode and hash' },
    { id: 'generate', label: 'Generate' },
  ],
};

/** Empty for a flat category, which is the signal not to render headings. */
export const groupsIn = (category: Category): readonly ToolGroup[] => GROUPS[category] ?? [];

export const hasGroups = (category: Category): boolean => groupsIn(category).length > 0;

export const groupLabel = (category: Category, id: string): string =>
  groupsIn(category).find((g) => g.id === id)?.label ?? id;

/**
 * Category order in the nav: catalogue weight, heaviest first.
 *
 * Calculators is deliberately absent. One tool does not earn a slot in a row
 * of five, and it stays reachable from the homepage, the footer and the
 * Malaysia page. Phase 5 of the expansion plan fills it, at which point it
 * belongs here.
 */
export const NAV_CATEGORIES: readonly Category[] = ['pdf', 'image', 'media', 'dev'];
