/**
 * Malaysian statutory payroll contributions: EPF, SOCSO (including LINDUNG
 * 24 Jam) and EIS, for an employee below 60.
 *
 * Every number here was checked against the official source on the date in
 * SOURCES, and payroll-my.test.ts pins the published rows. These rates change
 * by act of Parliament, so when one changes: update the data, the source date,
 * and the tests, in that order.
 */

export const SOURCES = {
  epf: {
    title: 'KWSP, EPF Act 1991 Third Schedule, Part A (effective October 2025 wages)',
    url: 'https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution',
    checked: '2026-09-18',
  },
  socso: {
    title: 'PERKESO, Act 4 contribution table including LINDUNG 24 Jam / SKBBK (effective 1 June 2026)',
    url: 'https://www.perkeso.gov.my/images/lindung/lindung-24-jam/JadualCarumanBaharuTermasukSKBBK.pdf',
    checked: '2026-09-18',
  },
  eis: {
    title: 'PERKESO, Act 800 EIS contribution table (wage ceiling RM6,000 from 1 October 2024)',
    url: 'https://www.perkeso.gov.my/images/dokumen/101024%20-%20Kadar%20Caruman%20Akta%20800.pdf',
    checked: '2026-09-18',
  },
  pcb: {
    title: 'LHDN, Specification for MTD calculations using computerised calculation 2026',
    url: 'https://www.hasil.gov.my/wp-content/uploads/spesifikasi-kaedah-pengiraan-berkomputer-pcb-2026.pdf',
    checked: '2026-09-18',
  },
} as const;

export interface Contribution {
  employee: number;
  employer: number;
}

/** Round a ringgit amount to whole sen, removing binary float noise. */
const sen = (rm: number) => Math.round(rm * 100) / 100;

/**
 * The top of the EPF wage band that `wage` falls in.
 *
 * Third Schedule Part A: nil up to RM10, then RM20 bands to RM5,000, then
 * RM100 bands to RM20,000. Every one of the 401 published rows equals the
 * rate applied to the band's upper limit, rounded up to the next ringgit
 * (verified row by row against the PDF on 2026-09-18).
 */
function epfBandTop(wage: number): number {
  if (wage <= 20) return 20;
  if (wage <= 5000) return Math.ceil(wage / 20) * 20;
  return Math.ceil(wage / 100) * 100;
}

/** Rate x amount, rounded up to the next ringgit, ignoring float noise. */
const ceilRinggit = (rate: number, amount: number) => Math.ceil(Math.round(rate * amount * 1e4) / 1e4);

/**
 * EPF for a Malaysian citizen or PR below 60 (Third Schedule Part A).
 * Employer pays 13% on wages up to RM5,000 and 12% above; employee 11%.
 * Above RM20,000 the schedule stops and the exact percentage applies,
 * "rounded to the next ringgit".
 */
export function epf(wage: number): Contribution {
  if (!(wage > 10)) return { employee: 0, employer: 0 };
  const base = wage > 20_000 ? wage : epfBandTop(wage);
  const employerRate = wage > 5000 ? 0.12 : 0.13;
  return { employee: ceilRinggit(0.11, base), employer: ceilRinggit(employerRate, base) };
}

/**
 * SOCSO wage bands shared by Act 4 and Act 800: the upper limit of each of the
 * first 64 rows. Row 65 ("wages above RM6,000") repeats row 64.
 */
const BAND_TOPS: readonly number[] = [
  30, 50, 70, 100, 140, 200, 300, 400,
  ...Array.from({ length: 56 }, (_, i) => 500 + i * 100), // 500 ... 6000
];

/** Index of the SOCSO/EIS band for `wage`, capped at the RM6,000 ceiling. */
export function socsoBand(wage: number): number {
  const i = BAND_TOPS.findIndex((top) => wage <= top);
  return i === -1 ? BAND_TOPS.length - 1 : i;
}

/**
 * Act 4, first category (employment injury + invalidity), for employees below
 * 60, from the PERKESO table effective 1 June 2026. Columns: employer share,
 * employee invalidity share, employee LINDUNG 24 Jam (SKBBK) share. All in
 * sen, copied from the published table, one row per band in BAND_TOPS.
 */
const SOCSO_ROWS_SEN: readonly (readonly [number, number, number])[] = [
  [40, 10, 20], [70, 20, 30], [110, 30, 50], [150, 40, 65], [210, 60, 90],
  [295, 85, 125], [435, 125, 185], [615, 175, 265], [785, 225, 335], [965, 275, 415],
  [1135, 325, 485], [1315, 375, 565], [1485, 425, 635], [1665, 475, 715], [1835, 525, 785],
  [2015, 575, 865], [2185, 625, 935], [2365, 675, 1015], [2535, 725, 1085], [2715, 775, 1165],
  [2885, 825, 1235], [3065, 875, 1315], [3235, 925, 1385], [3415, 975, 1465], [3585, 1025, 1535],
  [3765, 1075, 1615], [3935, 1125, 1685], [4115, 1175, 1765], [4285, 1225, 1835], [4465, 1275, 1915],
  [4635, 1325, 1985], [4815, 1375, 2065], [4985, 1425, 2135], [5165, 1475, 2215], [5335, 1525, 2285],
  [5515, 1575, 2365], [5685, 1625, 2435], [5865, 1675, 2515], [6035, 1725, 2585], [6215, 1775, 2665],
  [6385, 1825, 2735], [6565, 1875, 2815], [6735, 1925, 2885], [6915, 1975, 2965], [7085, 2025, 3035],
  [7265, 2075, 3115], [7435, 2125, 3185], [7615, 2175, 3265], [7785, 2225, 3335], [7965, 2275, 3415],
  [8135, 2325, 3485], [8315, 2375, 3565], [8485, 2425, 3635], [8665, 2475, 3715], [8835, 2525, 3785],
  [9015, 2575, 3865], [9185, 2625, 3935], [9365, 2675, 4015], [9535, 2725, 4085], [9715, 2775, 4165],
  [9885, 2825, 4235], [10065, 2875, 4315], [10235, 2925, 4385], [10415, 2975, 4465],
];

export interface SocsoContribution extends Contribution {
  /** The employee share split into its two schemes, for display. */
  employeeInvalidity: number;
  employeeLindung24: number;
}

export function socso(wage: number): SocsoContribution {
  if (!(wage > 0)) return { employee: 0, employer: 0, employeeInvalidity: 0, employeeLindung24: 0 };
  const [er, inv, l24] = SOCSO_ROWS_SEN[socsoBand(wage)]!;
  return {
    employer: er / 100,
    employeeInvalidity: inv / 100,
    employeeLindung24: l24 / 100,
    employee: (inv + l24) / 100,
  };
}

/**
 * EIS (Act 800), same bands. The first nine rows are listed; from the
 * RM500-600 band on, each row is 0.2% of the band midpoint, which gives the
 * published RM1.10 ... RM11.90 exactly (all 65 rows read off the table).
 */
const EIS_FIRST_SEN = [5, 10, 15, 20, 25, 35, 50, 70, 90];

export function eis(wage: number): Contribution {
  if (!(wage > 0)) return { employee: 0, employer: 0 };
  const band = socsoBand(wage);
  const each = band < EIS_FIRST_SEN.length
    ? EIS_FIRST_SEN[band]! / 100
    : sen(0.002 * (BAND_TOPS[band]! - 50));
  return { employee: each, employer: each };
}
