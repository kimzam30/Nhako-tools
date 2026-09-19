/**
 * Monthly Tax Deduction (PCB / MTD) for a resident employee, implemented
 * exactly as LHDN's "Specification for MTD calculations using computerised
 * calculation 2026" writes it (sections D.b.1 and D.b.2, Table 1, and the
 * rounding rules in section E). pcb.test.ts reproduces the spec's own worked
 * example (Exhibit 5) to the sen.
 *
 * Variable names follow the spec so the two can be read side by side.
 */

/** Relief amounts from section E.14 of the spec. */
export const RELIEF = {
  individual: 9000,     // D
  spouse: 4000,         // S, only when the spouse has no income (category 2)
  disabledSelf: 7000,   // DU
  disabledSpouse: 6000, // SU
  child: 2000,          // Q, per qualifying child
  epfCap: 4000,         // total qualifying EPF per year
} as const;

/**
 * Category 1: single. Category 2: married, spouse not working.
 * Category 3: married with a working spouse, divorced, widowed, or single
 * with an adopted child.
 */
export type TaxCategory = 1 | 2 | 3;

/** Table 1: [lower bound M, rate R, B for categories 1 and 3, B for category 2]. */
const TABLE_1: readonly (readonly [number, number, number, number])[] = [
  [5_000, 0.01, -400, -800],
  [20_000, 0.03, -250, -650],
  [35_000, 0.06, 600, 600],
  [50_000, 0.11, 1_500, 1_500],
  [70_000, 0.19, 3_700, 3_700],
  [100_000, 0.25, 9_400, 9_400],
  [400_000, 0.26, 84_400, 84_400],
  [600_000, 0.28, 136_400, 136_400],
  [2_000_000, 0.30, 528_400, 528_400],
];

/**
 * Rule E.1: "Calculations is limited to two decimal points only and omit the
 * subsequent figures." Rounding to micro-units first stops binary noise
 * (0.07 stored as 0.069999...) from being truncated a whole sen low.
 */
export function trunc2(x: number): number {
  return Math.trunc(Math.round(x * 1e6) / 1e4) / 100;
}

/** Rule E.2: round UP to the nearest five sen (287.02 -> 287.05, 152.06 -> 152.10). */
export function roundUp5Sen(x: number): number {
  const cents = Math.round(x * 100);
  return (cents + ((5 - (cents % 5)) % 5)) / 100;
}

/** Total tax for a year on chargeable income P: (P - M) R + B, never negative. */
export function annualTax(P: number, category: TaxCategory): number {
  let row: (typeof TABLE_1)[number] | undefined;
  for (const r of TABLE_1) if (P > r[0]) row = r;
  if (!row) return 0;
  const [M, R, B13, B2] = row;
  return trunc2((P - M) * R) + (category === 2 ? B2 : B13);
}

export interface PcbInput {
  category: TaxCategory;
  /** Qualifying children, already weighted: a child in higher education counts 4, and so on (E.14.c). */
  children: number;
  disabledSelf?: boolean;
  disabledSpouse?: boolean;
  /** Months left in the year after this one. January is 11. */
  n: number;
  /** Y and K: gross remuneration and EPF already paid this year, before this month. */
  priorGross?: number;
  priorEpf?: number;
  /** Y1 and K1: this month's normal remuneration and the EPF on it. */
  gross: number;
  epf: number;
  /** Yt and Kt: additional remuneration this month (bonus, arrears...) and its EPF. */
  additional?: number;
  additionalEpf?: number;
  /** Sigma LP and LP1: optional deductions claimed via Form TP1, before and this month. */
  priorDeductions?: number;
  deductions?: number;
  /** X: PCB already paid this year. Z: zakat already paid, excluding this month. */
  priorPcb?: number;
  priorZakat?: number;
  /** Zakat paid this month. */
  zakat?: number;
}

export interface PcbResult {
  /** P for normal remuneration only (Step 1[B]). */
  P: number;
  /** PCB on normal remuneration before zakat (Step 1[C]), after the RM10 rule and rounding. */
  normal: number;
  /** PCB on this month's additional remuneration (Step 4). */
  additional: number;
  /** What is actually deducted this month, after zakat (Step 5). */
  total: number;
}

function chargeable(input: PcbInput, withAdditional: boolean): number {
  const K = input.priorEpf ?? 0;
  // K + K1 + K2 + Kt may not exceed the yearly qualifying amount.
  const K1 = Math.min(input.epf, Math.max(0, RELIEF.epfCap - K));
  const Kt = withAdditional
    ? Math.min(input.additionalEpf ?? 0, Math.max(0, RELIEF.epfCap - K - K1))
    : 0;
  const K2 = input.n > 0 ? Math.min(trunc2((RELIEF.epfCap - (K + K1 + Kt)) / input.n), K1) : 0;
  const Yt = withAdditional ? input.additional ?? 0 : 0;

  const income =
    (input.priorGross ?? 0) - K
    + (input.gross - K1)
    + trunc2((input.gross - K2) * input.n)
    + (Yt - Kt);

  const reliefs =
    RELIEF.individual
    + (input.category === 2 ? RELIEF.spouse : 0)
    + (input.disabledSelf ? RELIEF.disabledSelf : 0)
    + (input.disabledSpouse ? RELIEF.disabledSpouse : 0)
    + (input.category === 1 ? 0 : RELIEF.child * input.children)
    + (input.priorDeductions ?? 0)
    + (input.deductions ?? 0);

  return trunc2(income - reliefs);
}

export function pcb(input: PcbInput): PcbResult {
  const X = input.priorPcb ?? 0;
  const Z = input.priorZakat ?? 0;
  const zakat = input.zakat ?? 0;

  // Step 1: PCB on normal remuneration for the current month.
  const P = chargeable(input, false);
  const raw = trunc2((annualTax(P, input.category) - (Z + X)) / (input.n + 1));
  // Rule E.3: under RM10 before zakat, nothing is deducted.
  const normal = raw < 10 ? 0 : roundUp5Sen(raw);
  // Steps 2 to 4: only when there is additional remuneration this month.
  let additional = 0;
  if ((input.additional ?? 0) > 0) {
    const yearMtd = X + normal * (input.n + 1); // Step 1[E]
    const yearTax = annualTax(chargeable(input, true), input.category); // Steps 2 and 3
    const extra = trunc2(yearTax - (yearMtd + Z)); // Step 4
    additional = extra < 10 ? 0 : roundUp5Sen(extra);
  }

  // Step 5, with rule E.4 (after zakat, whatever is left is deducted, even
  // under RM10) and table E.5(ii): zakat beyond the normal PCB also offsets
  // the PCB on additional remuneration (15.00 - 20.00 + 32.55 = 27.55).
  const total = Math.max(0, roundUp5Sen(normal - zakat + additional));

  return { P, normal, additional, total };
}
