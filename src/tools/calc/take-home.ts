import { epf, eis, socso, type Contribution, type SocsoContribution } from './payroll-my';
import { pcb, type TaxCategory } from './pcb';

export type Household = 'single' | 'spouse-no-income' | 'spouse-working' | 'single-parent';

export interface TakeHomeInput {
  /** Monthly salary, before any deduction, in ringgit. */
  gross: number;
  household: Household;
  /** Children under 18. */
  children: number;
  /** Children 18 and over in full-time diploma (or higher) study in Malaysia, or degree study abroad. */
  childrenStudying: number;
  /** Children certified disabled by JKM. */
  childrenDisabled: number;
  disabledSelf: boolean;
  disabledSpouse: boolean;
  /** Zakat deducted from salary each month. */
  zakat: number;
}

export interface TakeHome {
  gross: number;
  epf: Contribution;
  socso: SocsoContribution;
  eis: Contribution;
  pcb: number;
  zakat: number;
  /** Salary after every employee deduction. */
  net: number;
  /** Salary plus the employer's EPF, SOCSO and EIS. */
  employerCost: number;
}

const CATEGORY: Record<Household, TaxCategory> = {
  'single': 1,
  'spouse-no-income': 2,
  'spouse-working': 3,
  'single-parent': 3,
};

/**
 * Spec E.14.c counts some children as several: a child 18+ in higher
 * education or a disabled child is relief "as if the employee has 4 children".
 */
export function qualifyingChildren(i: Pick<TakeHomeInput, 'children' | 'childrenStudying' | 'childrenDisabled'>): number {
  const whole = (n: number) => Math.max(0, Math.floor(n || 0));
  return whole(i.children) + 4 * whole(i.childrenStudying) + 4 * whole(i.childrenDisabled);
}

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * A regular month for an employee below 60 on a steady salary, PCB computed
 * as LHDN's formula gives it for January with nothing paid yet. With a steady
 * salary that is also every later month's figure (the spec's own example
 * gives RM110.00 in both January and February).
 */
export function takeHome(input: TakeHomeInput): TakeHome {
  const gross = Math.max(0, input.gross || 0);
  const e = epf(gross);
  const s = socso(gross);
  const i = eis(gross);
  const zakat = Math.max(0, input.zakat || 0);

  const tax = gross > 0
    ? pcb({
      category: CATEGORY[input.household],
      children: qualifyingChildren(input),
      disabledSelf: input.disabledSelf,
      // "A further deduction" on top of spouse relief (E.14.f), so only
      // where spouse relief itself applies.
      disabledSpouse: input.disabledSpouse && input.household === 'spouse-no-income',
      n: 11,
      gross,
      epf: e.employee,
      zakat,
    }).total
    : 0;

  return {
    gross,
    epf: e,
    socso: s,
    eis: i,
    pcb: tax,
    zakat,
    net: money(gross - e.employee - s.employee - i.employee - tax - zakat),
    employerCost: money(gross + e.employer + s.employer + i.employer),
  };
}
