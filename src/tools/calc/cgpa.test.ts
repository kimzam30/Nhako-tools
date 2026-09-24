import { describe, it, expect } from 'vitest';
import { UM_SCALE, SOURCES, cgpa, gpa, needed, round2, totals } from './cgpa';

/**
 * The scale is pinned row by row against Universiti Malaya's 2024/2025
 * handbook (SOURCES.um). The arithmetic is checked against a worked example
 * done by hand, not against this module's own output.
 */

const point = (g: string) => UM_SCALE.find((r) => r.grade === g)!.point;

describe('Universiti Malaya grade scale', () => {
  it('matches the published table exactly', () => {
    expect(UM_SCALE.map((r) => `${r.grade} ${r.point.toFixed(2)}`)).toEqual([
      'A+ 4.00', 'A 4.00', 'A- 3.70', 'B+ 3.30', 'B 3.00', 'B- 2.70',
      'C+ 2.30', 'C 2.00', 'C- 1.70', 'D+ 1.30', 'D 1.00', 'F 0.00',
    ]);
  });

  it('records where and when it was checked', () => {
    expect(SOURCES.um.url).toMatch(/^https:\/\/ebook\.um\.edu\.my\//);
    expect(SOURCES.um.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('worked example', () => {
  // 3 cr A (4.0) + 3 cr B+ (3.3) + 4 cr C (2.0) + 2 cr A- (3.7)
  // = 12 + 9.9 + 8 + 7.4 = 37.3 quality points over 12 credits.
  const semester = [
    { credits: 3, point: point('A') },
    { credits: 3, point: point('B+') },
    { credits: 4, point: point('C') },
    { credits: 2, point: point('A-') },
  ];

  it('totals credits and quality points', () => {
    const t = totals(semester);
    expect(t.credits).toBe(12);
    expect(round2(t.points)).toBe(37.3);
  });

  it('gives a semester GPA of 3.11', () => {
    expect(round2(gpa(semester)!)).toBe(3.11); // 37.3 / 12 = 3.1083
  });

  it('weights the previous CGPA by its credits: 3.21 over 36 becomes 3.18', () => {
    // (3.21 x 36 + 37.3) / 48 = (115.56 + 37.3) / 48 = 3.1846
    expect(round2(cgpa({ cgpa: 3.21, credits: 36 }, semester)!)).toBe(3.18);
  });

  it('works out the GPA needed for a 3.30 over 18 more credits: 3.61', () => {
    // (3.30 x 66 - 152.86) / 18 = (217.8 - 152.86) / 18 = 3.6078
    const current = { cgpa: (115.56 + 37.3) / 48, credits: 48 };
    const plan = needed(current, 3.3, 18)!;
    expect(round2(plan.gpa)).toBe(3.61);
    expect(plan.reachable).toBe(true);
  });

  it('says when a target is out of reach this semester', () => {
    expect(needed({ cgpa: 2.5, credits: 90 }, 3.5, 18)!.reachable).toBe(false);
  });

  it('still names a minimum when above the target: 3.80 over 60 needs 2.50 to hold 3.50', () => {
    // (3.5 x 78 - 3.8 x 60) / 18 = (273 - 228) / 18 = 2.5
    const plan = needed({ cgpa: 3.8, credits: 60 }, 3.5, 18)!;
    expect(round2(plan.gpa)).toBe(2.5);
    expect(plan.alreadyThere).toBe(false);
  });

  it('only calls a target safe when even 0.00 next semester keeps it', () => {
    // (2.0 x 123 - 3.9 x 120) / 3 is below zero.
    expect(needed({ cgpa: 3.9, credits: 120 }, 2.0, 3)!.alreadyThere).toBe(true);
  });
});

describe('edge cases', () => {
  it('has no GPA without graded credits', () => {
    expect(gpa([])).toBeNull();
    expect(cgpa(null, [])).toBeNull();
  });

  it('ignores zero-credit and malformed rows rather than dividing by them', () => {
    expect(gpa([{ credits: 0, point: 4 }, { credits: 3, point: 3 }, { credits: Number.NaN, point: 4 }])).toBe(3);
  });

  it('treats a first semester as the whole CGPA', () => {
    expect(cgpa(null, [{ credits: 3, point: 3.7 }])).toBeCloseTo(3.7, 10);
  });
});
