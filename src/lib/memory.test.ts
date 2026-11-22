import { describe, expect, it } from 'vitest';
import { assertCanRunOffice, assertFits, deviceMemory, workingBudget } from './memory';
import { sayer } from '../tools/say';

const say = sayer({});
const GB = 1024 ** 3;

describe('memory guard', () => {
  it('reads navigator.deviceMemory, and says nothing when it is absent', () => {
    expect(deviceMemory({ deviceMemory: 4 })).toBe(4 * GB);
    expect(deviceMemory({})).toBeNull();
  });

  it('budgets a quarter of RAM, capped at the 2 GB wasm ceiling', () => {
    expect(workingBudget(4 * GB)).toBe(1 * GB);
    expect(workingBudget(8 * GB)).toBe(2 * GB);
    expect(workingBudget(null)).toBeNull();
  });

  it('refuses a job that will not fit, in words, before any work starts', () => {
    expect(() => assertFits(3 * GB, 'This video', say, 2 * GB)).toThrow(/too big to process on this device/);
    expect(() => assertFits(100 * 1024 ** 2, 'This video', say, 2 * GB)).not.toThrow();
  });

  it('never refuses when the browser does not report memory (Safari, Firefox)', () => {
    expect(() => assertFits(50 * GB, 'This video', say, null)).not.toThrow();
    expect(() => assertCanRunOffice(say, null)).not.toThrow();
  });

  it('keeps Office to PDF off devices under 4 GB, before the 77 MB download', () => {
    expect(() => assertCanRunOffice(say, 2 * GB)).toThrow(/at least 4 GB/);
    expect(() => assertCanRunOffice(say, 8 * GB)).not.toThrow();
  });
});
