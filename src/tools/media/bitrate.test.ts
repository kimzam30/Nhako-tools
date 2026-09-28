import { describe, it, expect } from 'vitest';
import { fitResolution, HEADROOM, planBitrate } from './bitrate';
import { ToolError } from '../types';

describe('video bitrate planning', () => {
  it('lands on the requested size', () => {
    const plan = planBitrate(60, 15, 128);
    // Aimed just under, never over: 1 MB is 1,000,000 bytes here.
    expect(plan.predictedMB).toBeLessThanOrEqual(15 * HEADROOM + 1e-9);
    expect(plan.predictedMB).toBeGreaterThan(15 * HEADROOM - 0.01);
  });

  it('is accurate for audio bitrates other than 128 (the old bug)', () => {
    // The previous build hardcoded a 128 kbps assumption while passing
    // `-c:a copy`. With 320 kbps source audio it overshot by (320-128) kbps
    // for the whole duration. Every one of these must land on target.
    for (const audioKbps of [64, 96, 128, 192, 320]) {
      const plan = planBitrate(120, 25, audioKbps);
      expect(plan.predictedMB, `audio ${audioKbps}k`).toBeCloseTo(25 * HEADROOM, 1);
      // Flooring must never push the plan OVER the target. Undershooting by
      // up to 1 kbps is fine, overshooting defeats the point of a target size.
      expect(plan.predictedMB, `audio ${audioKbps}k`).toBeLessThanOrEqual(25);
      expect(plan.videoKbps + plan.audioKbps).toBeGreaterThan((25 * 8000 * HEADROOM) / 120 - 1);
    }
  });

  it('accounts for removed audio by giving the budget to video', () => {
    const withAudio = planBitrate(60, 10, 128);
    const without = planBitrate(60, 10, 0);
    expect(without.videoKbps).toBeGreaterThan(withAudio.videoKbps);
    expect(without.predictedMB).toBeCloseTo(10 * HEADROOM, 1);
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

  it('the real 8 MB case lands under 8,000,000 bytes', () => {
    // 60 s at 8 MB came out at 8,340,000 bytes when 1 MB meant 1024 x 1024.
    const plan = planBitrate(60, 8, 128);
    expect(((plan.videoKbps + plan.audioKbps) * 1000 / 8) * 60).toBeLessThan(8_000_000);
  });
});

describe('fitResolution', () => {
  it('keeps the source size when the bitrate can fill it', () => {
    expect(fitResolution(1280, 720, 30, 2500)).toEqual({ width: 1280, height: 720 });
  });
  it('steps a starved 1080p60 phone clip down to 720p', () => {
    expect(fitResolution(1920, 1080, 60, 2000)).toEqual({ width: 1280, height: 720 });
  });
  it('works on portrait video by its short side, and keeps sizes even', () => {
    const r = fitResolution(1080, 1920, 30, 900);
    expect(r.width % 2 + r.height % 2).toBe(0);
    expect(r.width).toBeLessThan(r.height);
    expect(r.width).toBeLessThanOrEqual(720);
  });
  it('never goes below 240p and never enlarges', () => {
    expect(fitResolution(1920, 1080, 30, 10).height).toBe(240);
    expect(fitResolution(320, 240, 30, 50000)).toEqual({ width: 320, height: 240 });
  });
});
