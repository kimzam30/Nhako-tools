import { describe, it, expect } from 'vitest';
import { POPULAR, popularLinks } from './popular';

describe('popular shortcuts', () => {
  it('resolve to real tools and presets in both languages', () => {
    for (const locale of ['en', 'ms'] as const) {
      const links = popularLinks(locale);
      expect(links).toHaveLength(POPULAR.length);
      for (const l of links) expect(l.name.length).toBeGreaterThan(2);
    }
  });

  it('link to the Malay page from the Malay homepage', () => {
    expect(popularLinks('ms')[0]!.href).toBe('/ms/pdf/compress/500kb');
    expect(popularLinks('en')[0]!.href).toBe('/pdf/compress/500kb');
  });

  it('stay short enough to read at a glance', () => {
    expect(POPULAR.length).toBeLessThanOrEqual(8);
  });
});
