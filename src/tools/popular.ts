import { TOOLS } from './registry';
import { toolId } from './types';
import { localizeTool, localePath, type Locale } from '../i18n';

/**
 * The shortcuts under the homepage search: the jobs students arrive for most.
 * Editorial and ordered, like a collection. Each is a tool id, or a tool id
 * plus a preset, and popular.test.ts fails if any stops resolving.
 */
export const POPULAR: readonly { tool: string; variant?: string }[] = [
  { tool: 'pdf/compress', variant: '500kb' },
  { tool: 'pdf/merge' },
  { tool: 'pdf/jpg-to-pdf' },
  { tool: 'pdf/to-word' },
  { tool: 'pdf/n-up' },
  { tool: 'calc/cgpa' },
  { tool: 'image/passport-photo' },
];

export function popularLinks(locale: Locale): { href: string; name: string }[] {
  return POPULAR.map(({ tool, variant }) => {
    const meta = TOOLS.find((t) => toolId(t) === tool);
    if (!meta) throw new Error(`Popular link to unknown tool ${tool}`);
    const local = localizeTool(meta, locale);
    const preset = variant ? local.variants?.find((v) => v.slug === variant) : undefined;
    if (variant && !preset) throw new Error(`Popular link to unknown preset ${tool}/${variant}`);
    return {
      href: localePath(locale, `/${tool}${variant ? `/${variant}` : ''}`),
      name: preset?.name ?? local.name,
    };
  });
}
