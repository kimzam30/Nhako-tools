import { describe, it, expect } from 'vitest';
import { searchTools } from './search';
import { TOOLS } from '../../tools/registry';
import { toolId } from '../../tools/types';
import { buildSearchIndex } from '../../tools/search-index';

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
      ['jpg to pdf', 'pdf/jpg-to-pdf'],
      ['heic', 'image/heic-to-jpg'],
      ['exif', 'image/remove-metadata'],
      ['password', 'pdf/protect'],
      ['signature', 'pdf/sign'],
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

describe('presets are findable', () => {
  const index = buildSearchIndex('en');
  const find = (q: string) => searchTools(index, q);

  it('resolves a size that used to match nothing', () => {
    // The whole point of this change: /pdf/compress/500kb existed as a page
    // and the palette could not reach it.
    const hrefs = find('500kb').map((r) => r.href);
    expect(hrefs).toContain('/pdf/compress/500kb');
    expect(hrefs).toContain('/image/compress/500kb');
  });

  it('resolves the same size written with a space, or as a bare number', () => {
    expect(find('500 kb').map((r) => r.href)).toContain('/pdf/compress/500kb');
    expect(find('200').map((r) => r.href)).toContain('/pdf/compress/200kb');
  });

  it('finds the Office presets by application name', () => {
    expect(find('word to pdf')[0]?.href).toBe('/pdf/office-to-pdf/word');
    expect(find('powerpoint').map((r) => r.href)).toContain('/pdf/office-to-pdf/powerpoint');
  });

  it('lists a tool above its own presets', () => {
    const results = find('compress pdf');
    const tool = results.findIndex((r) => r.href === '/pdf/compress');
    const preset = results.findIndex((r) => r.href === '/pdf/compress/500kb');
    expect(tool).toBeGreaterThanOrEqual(0);
    expect(preset).toBeGreaterThan(tool);
  });

  it('indexes every tool and every preset exactly once', () => {
    const expected = TOOLS.length + TOOLS.reduce((n, t) => n + (t.variants?.length ?? 0), 0);
    expect(index).toHaveLength(expected);
    expect(new Set(index.map((r) => r.id)).size).toBe(expected);
  });

  it('still finds Audio to Text from "transcribe"', () => {
    // The behaviour presets must not regress.
    expect(find('transcribe')[0]?.href).toBe('/media/transcribe');
  });

  it('builds Malay hrefs under /ms', () => {
    const ms = buildSearchIndex('ms');
    expect(ms.every((r) => r.href.startsWith('/ms/'))).toBe(true);
    expect(searchTools(ms, '500kb').map((r) => r.href)).toContain('/ms/pdf/compress/500kb');
  });
});
