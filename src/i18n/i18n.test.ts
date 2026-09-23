import { describe, it, expect } from 'vitest';
import { TOOLS } from '../tools/registry';
import { toolId, CATEGORIES } from '../tools/types';
import { groupsIn } from '../tools/groups';
import { MS, MS_GROUPS, localizeTool, groupLabel } from './tools';
import { localePath, localeFromPath } from './index';
import { LOCALES } from './paths';
import { ui } from './ui';

describe('Malay translations are complete', () => {
  it('covers every tool, and nothing that is not a tool', () => {
    const ids = TOOLS.map(toolId);
    for (const id of ids) expect(MS[id], `no Malay text for ${id}`).toBeDefined();
    for (const id of Object.keys(MS)) expect(ids, `${id} is translated but not registered`).toContain(id);
  });

  it('translates every option, every choice and every variant', () => {
    for (const tool of TOOLS) {
      const id = toolId(tool);
      const text = MS[id]!;
      for (const o of tool.options ?? []) {
        expect(text.options?.[o.key]?.label, `${id}.${o.key}`).toBeTruthy();
        if (o.help) expect(text.options?.[o.key]?.help, `${id}.${o.key} help`).toBeTruthy();
        if (o.kind === 'select') {
          for (const c of o.choices) expect(text.options?.[o.key]?.choices?.[c.value], `${id}.${o.key}=${c.value}`).toBeTruthy();
        }
      }
      for (const v of tool.variants ?? []) expect(text.variants?.[v.slug]?.name, `${id}/${v.slug}`).toBeTruthy();
      expect(text.limits?.length ?? 0, `${id} limits`).toBe(tool.limits?.length ?? 0);
    }
  });

  it('keeps Malay meta descriptions in the same range as English', () => {
    for (const tool of TOOLS) {
      const t = localizeTool(tool, 'ms');
      const all = [t.description, ...(t.variants ?? []).map((v) => v.description)];
      for (const d of all) {
        expect(d.length, `${toolId(tool)}: ${d}`).toBeGreaterThan(70);
        expect(d.length, `${toolId(tool)}: ${d}`).toBeLessThan(185);
      }
    }
  });

  it('keeps English keywords so a search in either language finds the tool', () => {
    const merge = localizeTool(TOOLS.find((t) => toolId(t) === 'pdf/merge')!, 'ms');
    expect(merge.keywords).toContain('merge');
    expect(merge.keywords).toContain('gabung');
  });
});

describe('locale paths', () => {
  it('maps English paths to /ms and back', () => {
    expect(localePath('en', '/pdf/merge')).toBe('/pdf/merge');
    expect(localePath('ms', '/pdf/merge')).toBe('/ms/pdf/merge');
    expect(localePath('ms', '/')).toBe('/ms');
    expect(localeFromPath('/ms/pdf/merge')).toBe('ms');
    expect(localeFromPath('/ms')).toBe('ms');
    expect(localeFromPath('/msword')).toBe('en');
    expect(localeFromPath('/pdf/merge')).toBe('en');
  });
});

describe('Malay job-group labels are complete', () => {
  const defined = CATEGORIES.flatMap((c) => groupsIn(c).map((g) => `${c}/${g.id}`));

  it('translates every group that exists', () => {
    for (const key of defined) {
      expect(MS_GROUPS[key], `${key} has no Malay label`).toBeTruthy();
    }
  });

  it('translates nothing that is not a group', () => {
    // A stale key here is a label nobody sees and nobody notices is wrong.
    for (const key of Object.keys(MS_GROUPS)) {
      expect(defined, `${key} is not a real group`).toContain(key);
    }
  });

  it('returns the Malay label for ms and the English one for en', () => {
    expect(groupLabel('pdf', 'organise', 'ms')).toBe('Susun halaman');
    expect(groupLabel('pdf', 'organise', 'en')).toBe('Organise pages');
  });

  it('gives every category an intro in both locales', () => {
    for (const c of CATEGORIES) {
      for (const locale of LOCALES) {
        expect(ui(locale).categoryIntro[c]?.trim().length, `${c} ${locale}`).toBeGreaterThan(40);
      }
    }
  });
});
