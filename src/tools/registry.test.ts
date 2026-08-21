import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOOLS, TOOLS_BY_ID } from './registry';
import { toolId, CATEGORIES } from './types';

describe('registry integrity', () => {
  it('has no duplicate ids', () => {
    // The old build listed `convert-pdf` twice in ALL_TOOLS. Because pages are
    // now generated from this array, a duplicate would be a silent collision —
    // so it fails here instead.
    const ids = TOOLS.map(toolId);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('uses only known categories', () => {
    for (const t of TOOLS) expect(CATEGORIES).toContain(t.category);
  });

  it('uses URL-safe lowercase slugs', () => {
    for (const t of TOOLS) expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('resolves every related-tool reference', () => {
    // A related link pointing at a tool that does not exist would render a
    // dead internal link on a page whose whole retention model is those links.
    for (const t of TOOLS) {
      for (const rel of t.related ?? []) {
        expect(TOOLS_BY_ID.has(rel), `${toolId(t)} -> ${rel}`).toBe(true);
      }
    }
  });

  it('never lists itself as related', () => {
    for (const t of TOOLS) expect(t.related ?? []).not.toContain(toolId(t));
  });

  it('gives every file tool an accept filter', () => {
    for (const t of TOOLS.filter((x) => x.kind === 'file')) {
      expect(t.accept, `${toolId(t)} has no accept`).toBeTruthy();
    }
  });

  it('does not put file-only fields on text tools', () => {
    for (const t of TOOLS.filter((x) => x.kind !== 'file')) {
      expect(t.accept).toBeUndefined();
      expect(t.multiple).toBeUndefined();
    }
  });

  it('gives every option a unique key within its tool', () => {
    for (const t of TOOLS) {
      const keys = (t.options ?? []).map((o) => o.key);
      expect(keys, toolId(t)).toHaveLength(new Set(keys).size);
    }
  });

  it('keeps every numeric option default inside its own range', () => {
    for (const t of TOOLS) {
      for (const o of t.options ?? []) {
        if (o.kind === 'number' || o.kind === 'range') {
          expect(o.default, `${toolId(t)}.${o.key}`).toBeGreaterThanOrEqual(o.min);
          expect(o.default, `${toolId(t)}.${o.key}`).toBeLessThanOrEqual(o.max);
        }
      }
    }
  });

  it('keeps every select default among its own choices', () => {
    for (const t of TOOLS) {
      for (const o of t.options ?? []) {
        if (o.kind === 'select') {
          expect(o.choices.map((c) => c.value), `${toolId(t)}.${o.key}`).toContain(o.default);
        }
      }
    }
  });
});

describe('search metadata', () => {
  it('keeps meta descriptions in a sensible range for a search result', () => {
    for (const t of TOOLS) {
      expect(t.description.length, `${toolId(t)} is ${t.description.length} chars`).toBeGreaterThan(70);
      expect(t.description.length, `${toolId(t)} is ${t.description.length} chars`).toBeLessThan(185);
    }
  });

  it('gives every tool keywords for the command palette', () => {
    for (const t of TOOLS) expect(t.keywords.length, toolId(t)).toBeGreaterThanOrEqual(4);
  });

  it('finds Audio to Text when searching "transcribe"', () => {
    // The old homepage searched only name and description, so this failed.
    const hit = TOOLS.find((t) => t.keywords.includes('transcribe'));
    expect(hit?.slug).toBe('transcribe');
  });

  it('states honest limits on every tool that has a real one', () => {
    // Every tool here has a genuine constraint; a missing `limits` means
    // someone shipped marketing copy instead of documentation.
    for (const t of TOOLS) expect(t.limits?.length ?? 0, toolId(t)).toBeGreaterThan(0);
  });
});

describe('vercel.json redirects', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
    redirects: { source: string; destination: string; permanent: boolean }[];
  };

  it('points every legacy URL at a tool that exists', () => {
    for (const r of config.redirects) {
      const id = r.destination.replace(/^\//, '');
      expect(TOOLS_BY_ID.has(id), `${r.source} -> ${r.destination} (missing)`).toBe(true);
    }
  });

  it('covers every slug the old site shipped', () => {
    // Straight from the old Home.jsx ALL_TOOLS + ToolPage.jsx dispatch.
    const legacy = [
      'merge-pdf', 'split-pdf', 'compress-pdf', 'convert-pdf', 'edit-pdf',
      'video-size-compress', 'audio-to-text', 'extract-assets',
      'json-formatter', 'jwt-decoder', 'base64-converter', 'css-generator', 'word-counter',
    ];
    const covered = new Set(config.redirects.map((r) => r.source.replace('/tool/', '')));
    for (const slug of legacy) expect(covered.has(slug), `no redirect for /tool/${slug}`).toBe(true);
  });

  it('uses permanent redirects so search equity transfers', () => {
    for (const r of config.redirects) expect(r.permanent).toBe(true);
  });
});
