import { describe, it, expect } from 'vitest';
import { searchTools } from './search';
import { TOOLS } from '../../tools/registry';
import { toolId } from '../../tools/types';

const index = TOOLS.map((t) => ({
  id: toolId(t), name: t.name, category: t.category, blurb: t.blurb, keywords: [...t.keywords],
}));

describe('tool search', () => {
  it('returns everything for an empty query', () => {
    expect(searchTools(index, '')).toHaveLength(TOOLS.length);
  });

  it('finds Audio to Text by a keyword, not just its name', () => {
    // The exact failure of the old homepage search.
    expect(searchTools(index, 'transcribe')[0]?.id).toBe('media/transcribe');
  });

  it('finds tools by common phrasings people actually search', () => {
    const cases: [string, string][] = [
      ['pdf to jpg', 'pdf/to-image'],
      ['combine', 'pdf/merge'],
      ['shrink video', 'media/compress-video'],
      ['jwt', 'dev/jwt'],
      ['guid', 'dev/uuid'],
      ['tinypng', 'image/compress'],
      ['box shadow', 'dev/css-shadow'],
      ['checksum', 'dev/hash'],
    ];
    for (const [query, expected] of cases) {
      expect(searchTools(index, query)[0]?.id, query).toBe(expected);
    }
  });

  it('ranks an exact name match first', () => {
    expect(searchTools(index, 'Merge PDF')[0]?.id).toBe('pdf/merge');
  });

  it('requires every term to match', () => {
    expect(searchTools(index, 'merge nonexistentword')).toHaveLength(0);
  });

  it('is case insensitive', () => {
    expect(searchTools(index, 'JSON')[0]?.id).toBe('dev/json');
  });

  it('matches by category name', () => {
    expect(searchTools(index, 'image').length).toBeGreaterThanOrEqual(3);
  });
});
