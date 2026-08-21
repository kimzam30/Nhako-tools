import { describe, it, expect } from 'vitest';
import { WORKER_TOOLS } from './worker-tools';
import { LOADERS } from '../tools/loaders';

describe('worker tool map', () => {
  it('only lists tools that exist in the main registry', () => {
    for (const id of Object.keys(WORKER_TOOLS)) {
      expect(Object.keys(LOADERS), `${id} is not a real tool`).toContain(id);
    }
  });

  it('lists only DOM-free tools', () => {
    // Anything needing a canvas, ffmpeg or an AudioContext must stay on the
    // main thread; putting it here would fail at runtime inside the worker.
    const domBound = ['pdf/to-image', 'pdf/compress', 'image/', 'media/'];
    for (const id of Object.keys(WORKER_TOOLS)) {
      for (const prefix of domBound) {
        expect(id.startsWith(prefix), `${id} needs the DOM`).toBe(false);
      }
    }
  });
});
