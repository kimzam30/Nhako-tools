import { TOOLS } from './registry';
import { toolId } from './types';
import { categoryLabel, localizeTool, localizeVariant, localePath, type Locale } from '../i18n';
import type { SearchableTool } from '../components/react/search';

export interface IndexedTool extends SearchableTool {
  href: string;
}

/**
 * Everything the command palette can find, in one language.
 *
 * Lives here rather than inline in CommandPalette.astro so it can be tested:
 * the gap this exists to close ("500kb" matching nothing) was invisible
 * precisely because the index was built in a template where no test could
 * reach it.
 */
export function buildSearchIndex(locale: Locale): IndexedTool[] {
  return TOOLS.flatMap((raw) => {
    const tool = localizeTool(raw, locale);
    const category = categoryLabel(tool.category, locale);
    const id = toolId(tool);

    const entry: IndexedTool = {
      id,
      name: tool.name,
      category,
      blurb: tool.blurb,
      keywords: tool.keywords,
      href: localePath(locale, `/${id}`),
    };

    // Presets are real pages with their own titles, so they belong in the
    // index. Their keywords carry the slug and the short label both split and
    // joined, because someone types "500kb", "500 kb" or just "500" and means
    // the same page.
    const presets = (raw.variants ?? []).map((v): IndexedTool => {
      const short = v.short.toLowerCase();
      const localized = localizeVariant(raw, v, locale);
      return {
        id: `${id}/${v.slug}`,
        name: localized.name,
        category,
        blurb: localized.blurb,
        keywords: [...tool.keywords, v.slug, ...short.split(/\s+/), short.replace(/\s+/g, '')],
        href: localePath(locale, `/${id}/${v.slug}`),
        parent: tool.name,
      };
    });

    return [entry, ...presets];
  });
}
