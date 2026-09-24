/**
 * GPA and CGPA on the 4.00 scale Malaysian universities use.
 *
 * Grade points are data, not assumptions: the preset below is copied from the
 * university's own published table on the date in SOURCES, and cgpa.test.ts
 * pins every row. Universities differ (a D+ is 1.30 at one and 1.33 at
 * another), so the calculator lets a student edit any point to match their
 * own handbook, and says so.
 *
 * GPA   = sum(credits x grade point) / sum(credits), for one semester.
 * CGPA  = the same sum over every graded course so far, which is why the
 *         previous CGPA must be weighted by the credits it was earned over,
 *         never simply averaged with the new GPA.
 */

export const SOURCES = {
  um: {
    title: 'Universiti Malaya, Faculty of Science Handbook, Academic Session 2024/2025: University grades',
    url: 'https://ebook.um.edu.my/fsains/FINAL_HANDBOOK_20242025/files/basic-html/page15.html',
    checked: '2026-09-25',
  },
} as const;

export interface GradeRow { grade: string; point: number; marks: string }

/** Universiti Malaya, from SOURCES.um. Note A and A+ both carry 4.00. */
export const UM_SCALE: readonly GradeRow[] = [
  { grade: 'A+', point: 4.0, marks: '90-100' },
  { grade: 'A', point: 4.0, marks: '80-89.99' },
  { grade: 'A-', point: 3.7, marks: '75-79.99' },
  { grade: 'B+', point: 3.3, marks: '70-74.99' },
  { grade: 'B', point: 3.0, marks: '65-69.99' },
  { grade: 'B-', point: 2.7, marks: '60-64.99' },
  { grade: 'C+', point: 2.3, marks: '55-59.99' },
  { grade: 'C', point: 2.0, marks: '50-54.99' },
  { grade: 'C-', point: 1.7, marks: '45-49.99' },
  { grade: 'D+', point: 1.3, marks: '40-44.99' },
  { grade: 'D', point: 1.0, marks: '35-39.99' },
  { grade: 'F', point: 0.0, marks: '0-34.99' },
];

export interface Course { credits: number; point: number }

/** Two decimals, rounded half up, the way transcripts print a GPA. */
export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Credits and quality points (credits x grade point) for a set of courses. */
export function totals(courses: readonly Course[]) {
  let credits = 0;
  let points = 0;
  for (const c of courses) {
    if (!(c.credits > 0) || !Number.isFinite(c.point)) continue;
    credits += c.credits;
    points += c.credits * c.point;
  }
  return { credits, points };
}

/** Semester GPA, or null with no graded credits. */
export function gpa(courses: readonly Course[]): number | null {
  const t = totals(courses);
  return t.credits > 0 ? t.points / t.credits : null;
}

/** New CGPA from the previous CGPA, the credits it covered, and this semester. */
export function cgpa(previous: { cgpa: number; credits: number } | null, courses: readonly Course[]): number | null {
  const t = totals(courses);
  const prevCredits = previous && previous.credits > 0 ? previous.credits : 0;
  const prevPoints = prevCredits ? previous!.cgpa * prevCredits : 0;
  const credits = prevCredits + t.credits;
  return credits > 0 ? (prevPoints + t.points) / credits : null;
}

/**
 * The GPA needed over `nextCredits` more credits to reach `target` CGPA.
 * `reachable` is false when it would take more than a perfect 4.00.
 */
export function needed(current: { cgpa: number; credits: number }, target: number, nextCredits: number) {
  if (!(nextCredits > 0)) return null;
  const required = (target * (current.credits + nextCredits) - current.cgpa * current.credits) / nextCredits;
  return { gpa: Math.max(0, required), reachable: required <= 4.0 + 1e-9, alreadyThere: required <= 0 };
}
