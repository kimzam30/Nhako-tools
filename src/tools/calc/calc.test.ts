import { describe, it, expect } from 'vitest';
import { epf, socso, eis, socsoBand } from './payroll-my';
import { pcb, annualTax, trunc2, roundUp5Sen } from './pcb';
import { takeHome, qualifyingChildren } from './take-home';

/**
 * Every expected value below is copied from an official document, never from
 * this code's own output. Sources and dates are in payroll-my.ts SOURCES.
 */

describe('EPF, Third Schedule Part A', () => {
  it.each([
    // [wage, employer, employee], rows read from the KWSP PDF
    [5, 0, 0],
    [15, 3, 3],          // 10.01 to 20.00
    [35, 6, 5],          // 20.01 to 40.00
    [210, 29, 25],       // 200.01 to 220.00
    [670, 89, 75],       // 660.01 to 680.00
    [5000, 650, 550],    // last 13% row
    [5000.01, 612, 561], // 5,000.01 to 5,100.00, employer drops to 12%
    [20000, 2400, 2200], // last row of the table
  ])('RM%s -> employer %s, employee %s', (wage, employer, employee) => {
    expect(epf(wage)).toEqual({ employer, employee });
  });

  it('uses the exact percentage above RM20,000, rounded up to the next ringgit', () => {
    // 11% of 25,000.50 = 2,750.055 -> 2,751; 12% = 3,000.06 -> 3,001.
    expect(epf(25000.5)).toEqual({ employee: 2751, employer: 3001 });
  });
});

describe('SOCSO with LINDUNG 24 Jam, from 1 June 2026', () => {
  it('matches the first, a middle and the ceiling rows of the PERKESO table', () => {
    // Row 1: wages to RM30.
    expect(socso(30)).toMatchObject({ employer: 0.4, employeeInvalidity: 0.1, employeeLindung24: 0.2, employee: 0.3 });
    // Row 34: RM2,900 to RM3,000.
    expect(socso(3000)).toMatchObject({ employer: 51.65, employeeInvalidity: 14.75, employeeLindung24: 22.15 });
    // Rows 64 and 65: the RM6,000 ceiling.
    const top = { employer: 104.15, employeeInvalidity: 29.75, employeeLindung24: 44.65 };
    expect(socso(6000)).toMatchObject(top);
    expect(socso(15000)).toMatchObject(top);
  });

  it('puts a wage exactly on a band edge in the lower band', () => {
    // "exceeds RM100 but not more than RM140": RM100 is still row 4.
    expect(socsoBand(100)).toBe(3);
    expect(socsoBand(100.01)).toBe(4);
  });
});

describe('EIS, Act 800', () => {
  it.each([
    [30, 0.05], [90, 0.2], [450, 0.9], [550, 1.1], [1000, 1.9],
    [2850, 5.7], [4650, 9.3], [5950, 11.9], [6000, 11.9], [9000, 11.9],
  ])('RM%s -> RM%s each', (wage, each) => {
    expect(eis(wage)).toEqual({ employee: each, employer: each });
  });
});

describe('PCB rounding rules (spec section E)', () => {
  it('truncates to two decimals', () => expect(trunc2(123.4534)).toBe(123.45));
  it('rounds up to five sen', () => {
    expect(roundUp5Sen(287.02)).toBe(287.05);
    expect(roundUp5Sen(152.06)).toBe(152.1);
    expect(roundUp5Sen(110)).toBe(110);
  });
});

describe('PCB, LHDN Exhibit 5 worked example', () => {
  // Married, wife working (category 3), 3 children, RM5,500 a month, EPF RM605.
  const base = { category: 3 as const, children: 3, gross: 5500, epf: 605 };

  it('January: P = 47,000.07, PCB RM110.00', () => {
    const r = pcb({ ...base, n: 11 });
    expect(r.P).toBe(47000.07);
    expect(r.total).toBe(110);
  });

  it('February: P = 47,000.00, PCB RM110.00', () => {
    const r = pcb({ ...base, n: 10, priorGross: 5500, priorEpf: 605, priorPcb: 110 });
    expect(r.P).toBe(47000);
    expect(r.total).toBe(110);
  });

  it('March, with RM300 of TP1 deductions: P = 46,700.07, PCB RM108.20', () => {
    const r = pcb({ ...base, n: 9, priorGross: 11000, priorEpf: 1210, priorPcb: 220, deductions: 300 });
    expect(r.P).toBe(46700.07);
    expect(r.total).toBe(108.2);
  });

  it('April, with an RM8,250 bonus: 106.20 + 727.50 = RM833.70', () => {
    const r = pcb({
      ...base, n: 8, priorGross: 16500, priorEpf: 1815, priorPcb: 328.2,
      priorDeductions: 300, deductions: 300, additional: 8250, additionalEpf: 908,
    });
    expect(r.P).toBe(46400);
    expect(r.normal).toBe(106.2);
    expect(r.additional).toBe(727.5);
    expect(r.total).toBe(833.7);
  });

  it('total tax for the April example is RM2,011.50 on P = 54,650', () => {
    expect(annualTax(54650, 3)).toBe(2011.5);
  });
});

describe('PCB thresholds and zakat (spec E.3 to E.5)', () => {
  it('deducts nothing when PCB before zakat is under RM10', () => {
    // Single, RM2,000: P is far below the first taxable band after reliefs.
    expect(pcb({ category: 1, children: 0, n: 11, gross: 2000, epf: 220 }).total).toBe(0);
  });

  it('subtracts zakat from PCB and never goes below zero', () => {
    const without = pcb({ category: 1, children: 0, n: 11, gross: 8000, epf: 880 }).total;
    expect(without).toBeGreaterThan(100);
    const withZakat = pcb({ category: 1, children: 0, n: 11, gross: 8000, epf: 880, zakat: 100 }).total;
    expect(withZakat).toBe(roundUp5Sen(without - 100));
    expect(pcb({ category: 1, children: 0, n: 11, gross: 8000, epf: 880, zakat: 10_000 }).total).toBe(0);
  });
});

describe('take-home pay', () => {
  it('counts a child in higher education or a disabled child as four (E.14.c)', () => {
    expect(qualifyingChildren({ children: 2, childrenStudying: 1, childrenDisabled: 1 })).toBe(10);
  });

  it('adds up to the gross salary', () => {
    const r = takeHome({
      gross: 5500, household: 'spouse-working', children: 3, childrenStudying: 0,
      childrenDisabled: 0, disabledSelf: false, disabledSpouse: false, zakat: 0,
    });
    expect(r.epf.employee).toBe(605);
    expect(r.pcb).toBe(110); // same household as the LHDN example
    const deducted = r.epf.employee + r.socso.employee + r.eis.employee + r.pcb + r.zakat;
    expect(r.net).toBeCloseTo(r.gross - deducted, 2);
    expect(r.employerCost).toBeCloseTo(5500 + r.epf.employer + r.socso.employer + r.eis.employer, 2);
  });

  it('gives disabled-spouse relief only where spouse relief applies', () => {
    const common = { gross: 9000, children: 0, childrenStudying: 0, childrenDisabled: 0, disabledSelf: false, zakat: 0 };
    const working = takeHome({ ...common, household: 'spouse-working', disabledSpouse: true });
    const workingNoFlag = takeHome({ ...common, household: 'spouse-working', disabledSpouse: false });
    expect(working.pcb).toBe(workingNoFlag.pcb);
    const home = takeHome({ ...common, household: 'spouse-no-income', disabledSpouse: true });
    const homeNoFlag = takeHome({ ...common, household: 'spouse-no-income', disabledSpouse: false });
    expect(home.pcb).toBeLessThan(homeNoFlag.pcb);
  });

  it('returns zeros for no salary', () => {
    const r = takeHome({
      gross: 0, household: 'single', children: 0, childrenStudying: 0,
      childrenDisabled: 0, disabledSelf: false, disabledSpouse: false, zakat: 0,
    });
    expect(r.net).toBe(0);
    expect(r.pcb).toBe(0);
  });
});
