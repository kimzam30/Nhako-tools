export interface SearchableTool {
  id: string;
  name: string;
  category: string;
  blurb: string;
  keywords: string[];
  /**
   * Set on a preset (a tool variant with its own page), naming the tool it
   * belongs to. Presets were absent from the index entirely, so typing the
   * thing people actually search for, "500kb", returned nothing while
   * /pdf/compress/500kb sat there unlinked. Presence of this field also breaks
   * ties towards the parent tool, so "compress pdf" lists the tool first and
   * its five sizes under it rather than burying it among them.
   */
  parent?: string;
}

/**
 * Rank tools against a query across name, blurb AND keywords.
 *
 * The old homepage matched only name and description, so searching
 * "transcribe" found nothing even though Audio to Text is exactly that.
 */
export function searchTools<T extends SearchableTool>(tools: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...tools];
  const terms = q.split(/\s+/);

  const scored = tools
    .map((tool) => {
      const name = tool.name.toLowerCase();
      const keywords = tool.keywords.map((k) => k.toLowerCase());
      const parent = tool.parent?.toLowerCase() ?? '';
      const haystack = `${name} ${tool.blurb.toLowerCase()} ${keywords.join(' ')} ${tool.category} ${parent}`;

      // The whole query as a phrase outranks the same words in another order:
      // "pdf to jpg" and "JPG to PDF" share every word but not the meaning.
      let score = 0;
      if (name === q) score += 400;
      else if (name.includes(q)) score += 200;
      if (keywords.includes(q)) score += 150;
      else if (keywords.some((k) => k.includes(q))) score += 60;
      for (const term of terms) {
        if (!haystack.includes(term)) return null;
        if (name === term) score += 100;
        else if (name.startsWith(term)) score += 50;
        else if (name.includes(term)) score += 25;
        if (keywords.some((k) => k === term)) score += 40;
        else if (keywords.some((k) => k.startsWith(term))) score += 15;
      }
      // A preset never outranks the tool it belongs to on an equal match.
      if (tool.parent) score -= 10;
      return { tool, score };
    })
    .filter((x): x is { tool: T; score: number } => x !== null);

  return scored.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name)).map((x) => x.tool);
}
