import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOOLS, TOOLS_BY_ID } from './registry';
import { toolId, CATEGORIES } from './types';
import { GROUPS, GROUP_THRESHOLD, groupsIn, hasGroups } from './groups';
import { MARKS } from './marks';

describe('registry integrity', () => {
  it('has no duplicate ids', () => {
    // The old build listed `convert-pdf` twice in ALL_TOOLS. Because pages are
    // now generated from this array, a duplicate would be a silent collision:
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
    for (const t of TOOLS.filter((x) => x.kind === 'text' || x.kind === 'text2')) {
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

describe('preset pages', () => {
  it('gives every variant a unique URL-safe slug and only real option values', () => {
    for (const t of TOOLS) {
      const slugs = (t.variants ?? []).map((v) => v.slug);
      expect(slugs, toolId(t)).toHaveLength(new Set(slugs).size);
      for (const v of t.variants ?? []) {
        expect(v.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(v.description.length, `${toolId(t)}/${v.slug}`).toBeGreaterThan(70);
        expect(v.description.length, `${toolId(t)}/${v.slug}`).toBeLessThan(185);
        for (const [key, value] of Object.entries(v.defaults)) {
          const spec = t.options?.find((o) => o.key === key);
          expect(spec, `${toolId(t)}/${v.slug}: no option "${key}"`).toBeDefined();
          if (spec?.kind === 'select') expect(spec.choices.map((c) => c.value), `${toolId(t)}/${v.slug}.${key}`).toContain(value);
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

describe('browse taxonomy', () => {
  const ids = (category: string) => groupsIn(category as never).map((g) => g.id);

  it('groups every tool in a grouped category', () => {
    // The failure this prevents: a tool added to PDF with no group quietly
    // disappearing from the browse layer, or reinstating the flat wall of 18
    // that this taxonomy exists to break up.
    for (const t of TOOLS) {
      if (!hasGroups(t.category)) continue;
      expect(t.group, `${toolId(t)} has no group`).toBeTruthy();
      expect(ids(t.category), `${toolId(t)} -> ${t.group}`).toContain(t.group);
    }
  });

  it('leaves tools in a flat category ungrouped', () => {
    for (const t of TOOLS) {
      if (hasGroups(t.category)) continue;
      expect(t.group, `${toolId(t)} is in a flat category but has a group`).toBeUndefined();
    }
  });

  it('defines groups for every category over the threshold', () => {
    // A category that grows past the threshold fails here until its groups are
    // written, rather than silently reverting to one undifferentiated list.
    for (const c of CATEGORIES) {
      const count = TOOLS.filter((t) => t.category === c).length;
      if (count <= GROUP_THRESHOLD) continue;
      expect(groupsIn(c).length, `${c} has ${count} tools and needs groups`).toBeGreaterThan(0);
    }
  });

  it('declares no groups for a category under the threshold', () => {
    for (const c of CATEGORIES) {
      const count = TOOLS.filter((t) => t.category === c).length;
      if (count > GROUP_THRESHOLD) continue;
      expect(groupsIn(c).length, `${c} has only ${count} tools; a heading over them is noise`).toBe(0);
    }
  });

  it('keeps every category within six groups', () => {
    // Six headings is about the limit of what is scannable at a glance. A
    // seventh means the taxonomy needs re-cutting, which is a decision to make
    // deliberately rather than by adding one more line.
    for (const c of CATEGORIES) {
      expect(groupsIn(c).length, `${c} has too many groups`).toBeLessThanOrEqual(6);
    }
  });

  it('gives every group a unique id and a real label within its category', () => {
    for (const c of CATEGORIES) {
      const list = groupsIn(c);
      expect(list.map((g) => g.id)).toHaveLength(new Set(list.map((g) => g.id)).size);
      for (const g of list) {
        expect(g.id, `${c}/${g.id}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(g.label.trim().length, `${c}/${g.id} has no label`).toBeGreaterThan(0);
      }
    }
  });

  it('leaves no group empty', () => {
    // An empty heading on a category page is a dead end for whoever reads it.
    for (const c of CATEGORIES) {
      for (const g of groupsIn(c)) {
        const members = TOOLS.filter((t) => t.category === c && t.group === g.id);
        const crossed = TOOLS.filter((t) =>
          (t.alsoIn ?? []).some((r) => r.category === c && r.group === g.id));
        expect(members.length + crossed.length, `${c}/${g.id} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('resolves every cross-listing to a real group in another category', () => {
    for (const t of TOOLS) {
      for (const ref of t.alsoIn ?? []) {
        const where = `${toolId(t)} -> ${ref.category}/${ref.group}`;
        expect(CATEGORIES, where).toContain(ref.category);
        expect(ids(ref.category), where).toContain(ref.group);
      }
    }
  });

  it('never cross-lists a tool into its own category', () => {
    // That would render the same tool twice on one page.
    for (const t of TOOLS) {
      for (const ref of t.alsoIn ?? []) {
        expect(ref.category, `${toolId(t)} -> ${ref.category}/${ref.group}`).not.toBe(t.category);
      }
    }
  });

  it('never lists the same cross-listing twice', () => {
    for (const t of TOOLS) {
      const refs = (t.alsoIn ?? []).map((r) => `${r.category}/${r.group}`);
      expect(refs, toolId(t)).toHaveLength(new Set(refs).size);
    }
  });

  it('keeps cross-listing out of the canonical model', () => {
    // alsoIn is a browse-surface hint and nothing else. The URL, the
    // breadcrumb, the sitemap and the palette each know exactly one home per
    // tool, and that stays true however many places a tool is shown. A group
    // ref is an object precisely so it can never be mistaken for a tool id:
    // 'image/convert' is both a real tool and a real group, and pdf/to-image
    // legitimately carries the tool in `related` while cross-listing into the
    // group.
    for (const t of TOOLS) {
      if (!t.alsoIn?.length) continue;
      expect(TOOLS_BY_ID.get(toolId(t)), toolId(t)).toBe(t);
      const homes = TOOLS.filter((x) => toolId(x) === toolId(t));
      expect(homes, `${toolId(t)} must have exactly one home`).toHaveLength(1);
    }
  });

  it('gives every preset a short chip label', () => {
    // The chip shows `short`; the accessible name stays the full `name`. A
    // missing or long short label is the difference between a tidy row of
    // five chips and a wrapped paragraph of them.
    for (const t of TOOLS) {
      for (const v of t.variants ?? []) {
        const where = `${toolId(t)}/${v.slug}`;
        expect(v.short?.trim(), `${where} has no short label`).toBeTruthy();
        expect(v.short.length, `${where} short label is too long`).toBeLessThanOrEqual(14);
        expect(v.name.length, `${where} name should be the long form`).toBeGreaterThan(v.short.length);
      }
    }
  });

  it('declares groups only for categories that exist', () => {
    for (const c of Object.keys(GROUPS)) expect(CATEGORIES).toContain(c);
  });
});

describe('tool marks', () => {
  /**
   * A tool without a mark would render a blank gutter in every catalogue row,
   * which is the kind of silent gap the registry exists to make impossible.
   * Same spirit as the group-threshold assertion: adding a tool should fail the
   * build until its mark is drawn.
   */
  it('every tool in the registry has a mark', () => {
    expect(TOOLS.filter((t) => !MARKS[toolId(t)]).map(toolId)).toEqual([]);
  });

  it('has no mark for a tool that does not exist', () => {
    const ids = new Set(TOOLS.map(toolId));
    expect(Object.keys(MARKS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('no two tools share an identical drawing', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [id, d] of Object.entries(MARKS)) {
      const prev = seen.get(d);
      if (prev) clashes.push(`${prev} = ${id}`);
      else seen.set(d, id);
    }
    expect(clashes).toEqual([]);
  });
});
