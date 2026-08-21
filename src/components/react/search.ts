export interface SearchableTool {
  id: string;
  name: string;
  category: string;
  blurb: string;
  keywords: string[];
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
      const haystack = `${name} ${tool.blurb.toLowerCase()} ${keywords.join(' ')} ${tool.category}`;

      let score = 0;
      for (const term of terms) {
        if (!haystack.includes(term)) return null;
        if (name === term) score += 100;
        else if (name.startsWith(term)) score += 50;
        else if (name.includes(term)) score += 25;
        if (keywords.some((k) => k === term)) score += 40;
        else if (keywords.some((k) => k.startsWith(term))) score += 15;
      }
      return { tool, score };
    })
    .filter((x): x is { tool: T; score: number } => x !== null);

  return scored.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name)).map((x) => x.tool);
}
