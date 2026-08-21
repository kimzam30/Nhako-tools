import { describe, it, expect } from 'vitest';
import { planBitrate } from './bitrate';
import { ToolError } from '../types';

describe('video bitrate planning', () => {
  it('lands on the requested size', () => {
    const plan = planBitrate(60, 15, 128);
    expect(plan.predictedMB).toBeCloseTo(15, 1);
  });

  it('is accurate for audio bitrates other than 128 — the old bug', () => {
    // The previous build hardcoded a 128 kbps assumption while passing
    // `-c:a copy`. With 320 kbps source audio it overshot by (320-128) kbps
    // for the whole duration. Every one of these must land on target.
    for (const audioKbps of [64, 96, 128, 192, 320]) {
      const plan = planBitrate(120, 25, audioKbps);
      expect(plan.predictedMB, `audio ${audioKbps}k`).toBeCloseTo(25, 1);
      // Flooring must never push the plan OVER the target — undershooting by
      // up to 1 kbps is fine, overshooting defeats the point of a target size.
      expect(plan.predictedMB, `audio ${audioKbps}k`).toBeLessThanOrEqual(25);
      expect(plan.videoKbps + plan.audioKbps).toBeGreaterThan((25 * 8192) / 120 - 1);
    }
  });

  it('accounts for removed audio by giving the budget to video', () => {
    const withAudio = planBitrate(60, 10, 128);
    const without = planBitrate(60, 10, 0);
    expect(without.videoKbps).toBeGreaterThan(withAudio.videoKbps);
    expect(without.predictedMB).toBeCloseTo(10, 1);
  });

  it('scales with duration', () => {
    expect(planBitrate(30, 10, 128).videoKbps).toBeGreaterThan(planBitrate(300, 10, 128).videoKbps);
  });

  it('rejects an unreadable duration rather than producing NaN', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => planBitrate(bad, 15, 128), String(bad)).toThrow(ToolError);
    }
  });

  it('rejects an empty or nonsensical target size', () => {
    // Clearing the old number input yielded NaN and a useless generic alert.
    for (const bad of [0, -1, Number.NaN]) {
      expect(() => planBitrate(60, bad, 128), String(bad)).toThrow(/larger than 0/);
    }
  });

  it('refuses an impossible target and names a workable one', () => {
    const err = (() => { try { planBitrate(600, 1, 128); } catch (e) { return e as Error; } return null; })();
    expect(err).toBeInstanceOf(ToolError);
    expect(err?.message).toMatch(/smallest workable target/);
    // The suggestion it gives must itself be achievable.
    const suggested = Number(err?.message.match(/about (\d+) MB/)?.[1]);
    expect(() => planBitrate(600, suggested, 128)).not.toThrow();
  });
});
