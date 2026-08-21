import { describe, it, expect } from 'vitest';
import { LOADERS } from './loaders';
import { TOOLS } from './registry';
import { toolId } from './types';

describe('registry and implementations agree', () => {
  it('has an implementation for every registered tool', () => {
    // Without this, a registry entry would generate a page whose Run button
    // does nothing — exactly the `css-generator` failure from the old build,
    // which shipped a slug with no engine behind it.
    for (const tool of TOOLS) {
      expect(Object.keys(LOADERS), `no loader for ${toolId(tool)}`).toContain(toolId(tool));
    }
  });

  it('has no implementation without a registered tool', () => {
    const ids = new Set(TOOLS.map(toolId));
    for (const id of Object.keys(LOADERS)) {
      expect(ids.has(id), `${id} has an implementation but no registry entry`).toBe(true);
    }
  });

  it('exposes a run function from every module', async () => {
    for (const [id, load] of Object.entries(LOADERS)) {
      const mod = await load();
      expect(typeof mod.run, `${id}.run`).toBe('function');
    }
  }, 30_000);
});
