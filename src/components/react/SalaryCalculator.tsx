import { useEffect, useState } from 'react';
import { takeHome, type Household, type TakeHomeInput } from '../../tools/calc/take-home';
import type { Locale } from '../../i18n/paths';
import { valueBeforeHydration } from './hydration';

const TEXT = {
  en: {
    salary: 'Monthly salary',
    salaryHelp: 'Basic pay plus fixed allowances, before any deduction.',
    household: 'Household',
    households: {
      'single': 'Single',
      'spouse-no-income': 'Married, spouse has no income',
      'spouse-working': 'Married, spouse works',
      'single-parent': 'Divorced, widowed, or adopted child',
    } as Record<Household, string>,
    children: 'Children under 18',
    childrenStudying: 'Children 18+ in diploma or degree study',
    childrenStudyingHelp: 'Diploma or higher in Malaysia, or degree abroad. Counts as four children for relief.',
    childrenDisabled: 'Disabled children',
    childrenDisabledHelp: 'Certified by JKM. Counts as four children for relief.',
    disabledSelf: 'I am a registered disabled person',
    disabledSpouse: 'My spouse is a registered disabled person',
    zakat: 'Zakat deducted from salary',
    zakatHelp: 'Monthly. Zakat is subtracted from PCB, ringgit for ringgit.',
    youGet: 'Take-home pay',
    perMonth: 'a month',
    perYear: (v: string) => `${v} a year`,
    deductions: 'Your deductions',
    employerPays: 'Your employer also pays',
    gross: 'Gross salary',
    epf: 'EPF',
    socso: 'SOCSO',
    socsoSplit: (inv: string, l24: string) => `${inv} invalidity + ${l24} LINDUNG 24 Jam`,
    eis: 'EIS',
    pcb: 'PCB (income tax)',
    zakatRow: 'Zakat',
    net: 'Take-home pay',
    cost: 'Total cost to employer',
    summary: (net: string, pcb: string) => `Take-home pay ${net}. PCB ${pcb}.`,
    decrease: 'Decrease',
    increase: 'Increase',
  },
  ms: {
    salary: 'Gaji bulanan',
    salaryHelp: 'Gaji pokok serta elaun tetap, sebelum sebarang potongan.',
    household: 'Isi rumah',
    households: {
      'single': 'Bujang',
      'spouse-no-income': 'Berkahwin, pasangan tiada pendapatan',
      'spouse-working': 'Berkahwin, pasangan bekerja',
      'single-parent': 'Bercerai, balu/duda, atau anak angkat',
    },
    children: 'Anak bawah 18 tahun',
    childrenStudying: 'Anak 18+ belajar diploma atau ijazah',
    childrenStudyingHelp: 'Diploma ke atas di Malaysia, atau ijazah di luar negara. Dikira sebagai empat anak untuk pelepasan.',
    childrenDisabled: 'Anak kurang upaya',
    childrenDisabledHelp: 'Disahkan oleh JKM. Dikira sebagai empat anak untuk pelepasan.',
    disabledSelf: 'Saya orang kurang upaya berdaftar',
    disabledSpouse: 'Pasangan saya orang kurang upaya berdaftar',
    zakat: 'Zakat dipotong daripada gaji',
    zakatHelp: 'Bulanan. Zakat ditolak daripada PCB, ringgit demi ringgit.',
    youGet: 'Gaji bersih',
    perMonth: 'sebulan',
    perYear: (v: string) => `${v} setahun`,
    deductions: 'Potongan anda',
    employerPays: 'Majikan anda juga membayar',
    gross: 'Gaji kasar',
    epf: 'KWSP',
    socso: 'PERKESO',
    socsoSplit: (inv: string, l24: string) => `${inv} keilatan + ${l24} LINDUNG 24 Jam`,
    eis: 'SIP',
    pcb: 'PCB (cukai pendapatan)',
    zakatRow: 'Zakat',
    net: 'Gaji bersih',
    cost: 'Jumlah kos majikan',
    summary: (net: string, pcb: string) => `Gaji bersih ${net}. PCB ${pcb}.`,
    decrease: 'Kurangkan',
    increase: 'Tambah',
  },
} satisfies Record<Locale, unknown>;

const rm = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "5,000", "5000.50" -> number. Anything unreadable is treated as 0. */
function parseMoney(raw: string): number {
  const n = Number(raw.replace(/[,\s]/g, '').replace(/^RM/i, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const field = 'w-full rounded border border-border bg-surface px-2.5 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent';
const label = 'mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted';

export default function SalaryCalculator({ locale = 'en' }: { locale?: Locale }) {
  const t = TEXT[locale];
  const [salary, setSalary] = useState(() => valueBeforeHydration('salary', '5,000'));
  const [household, setHousehold] = useState(() => valueBeforeHydration('household', 'single') as Household);
  const count = (id: string) => Math.max(0, Math.floor(Number(valueBeforeHydration(id, '0')) || 0));
  const [children, setChildren] = useState(() => count('children'));
  const [childrenStudying, setChildrenStudying] = useState(() => count('children-studying'));
  const [childrenDisabled, setChildrenDisabled] = useState(() => count('children-disabled'));
  const [disabledSelf, setDisabledSelf] = useState(false);
  const [disabledSpouse, setDisabledSpouse] = useState(false);
  const [zakat, setZakat] = useState(() => valueBeforeHydration('zakat', '0'));

  // A few table lookups and one formula: recomputing on every render is
  // cheaper than any memoisation bookkeeping.
  const input: TakeHomeInput = {
    gross: parseMoney(salary), household, children, childrenStudying, childrenDisabled,
    disabledSelf, disabledSpouse, zakat: parseMoney(zakat),
  };
  const r = takeHome(input);

  const single = household === 'single';
  const summary = useSettled(t.summary(rm(r.net), rm(r.pcb)), 700);

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 self-start rounded-lg border border-border bg-surface p-4">
        <div>
          <label htmlFor="salary" className={label}>{t.salary}</label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted" aria-hidden="true">RM</span>
            <input
              id="salary" type="text" inputMode="decimal" autoComplete="off"
              value={salary} onChange={(e) => setSalary(e.target.value)}
              aria-describedby="salary-help"
              className={`${field} font-mono tabular-nums`}
            />
          </div>
          <p id="salary-help" className="mt-1 text-xs leading-snug text-muted">{t.salaryHelp}</p>
        </div>

        <div>
          <label htmlFor="household" className={label}>{t.household}</label>
          <select id="household" value={household} onChange={(e) => setHousehold(e.target.value as Household)} className={field}>
            {(Object.keys(t.households) as Household[]).map((h) => <option key={h} value={h}>{t.households[h]}</option>)}
          </select>
        </div>

        {!single && (
          <div className="grid gap-3">
            <Counter id="children" label={t.children} value={children} onChange={setChildren} less={t.decrease} more={t.increase} />
            <Counter id="children-studying" label={t.childrenStudying} help={t.childrenStudyingHelp} value={childrenStudying} onChange={setChildrenStudying} less={t.decrease} more={t.increase} />
            <Counter id="children-disabled" label={t.childrenDisabled} help={t.childrenDisabledHelp} value={childrenDisabled} onChange={setChildrenDisabled} less={t.decrease} more={t.increase} />
          </div>
        )}

        <div className="grid gap-2">
          <Check id="disabled-self" label={t.disabledSelf} checked={disabledSelf} onChange={setDisabledSelf} />
          {household === 'spouse-no-income' && (
            <Check id="disabled-spouse" label={t.disabledSpouse} checked={disabledSpouse} onChange={setDisabledSpouse} />
          )}
        </div>

        <div>
          <label htmlFor="zakat" className={label}>{t.zakat}</label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted" aria-hidden="true">RM</span>
            <input
              id="zakat" type="text" inputMode="decimal" autoComplete="off"
              value={zakat} onChange={(e) => setZakat(e.target.value)}
              aria-describedby="zakat-help"
              className={`${field} font-mono tabular-nums`}
            />
          </div>
          <p id="zakat-help" className="mt-1 text-xs leading-snug text-muted">{t.zakatHelp}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <p className="sr-only" role="status" aria-live="polite">{summary}</p>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.youGet}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span data-numeric data-testid="net-pay" className="text-3xl font-bold tracking-tight">{rm(r.net)}</span>
            <span className="text-sm text-muted">{t.perMonth}</span>
          </p>
          <p data-numeric className="mt-1 text-2xs text-muted">{t.perYear(rm(r.net * 12))}</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">{t.deductions}</p>
          <dl className="divide-y divide-border text-sm">
            <Row label={t.gross} value={rm(r.gross)} />
            <Row label={t.epf} value={`− ${rm(r.epf.employee)}`} />
            <Row label={t.socso} value={`− ${rm(r.socso.employee)}`} note={t.socsoSplit(rm(r.socso.employeeInvalidity), rm(r.socso.employeeLindung24))} />
            <Row label={t.eis} value={`− ${rm(r.eis.employee)}`} />
            <Row label={t.pcb} value={`− ${rm(r.pcb)}`} testId="pcb" />
            {r.zakat > 0 && <Row label={t.zakatRow} value={`− ${rm(r.zakat)}`} />}
            <Row label={t.net} value={rm(r.net)} strong />
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">{t.employerPays}</p>
          <dl className="divide-y divide-border text-sm">
            <Row label={t.epf} value={rm(r.epf.employer)} />
            <Row label={t.socso} value={rm(r.socso.employer)} />
            <Row label={t.eis} value={rm(r.eis.employer)} />
            <Row label={t.cost} value={rm(r.employerCost)} strong />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, note, strong, testId }: { label: string; value: string; note?: string; strong?: boolean; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className={strong ? 'font-semibold' : 'text-muted'}>
        {label}
        {note && <span data-numeric className="block text-2xs text-muted">{note}</span>}
      </dt>
      <dd data-numeric data-testid={testId} className={`whitespace-nowrap tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  );
}

function Counter({ id, label: text, help, value, onChange, less, more }: {
  id: string; label: string; help?: string; value: number; onChange: (n: number) => void; less: string; more: string;
}) {
  const btn = 'grid size-7 place-items-center rounded border border-border text-sm transition-colors hover:border-border-strong disabled:opacity-40 pointer-coarse:size-11';
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm">{text}</label>
        <div className="flex items-center gap-1.5">
          <button type="button" className={btn} aria-label={`${less}: ${text}`} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
          <input
            id={id} type="number" min={0} max={20} inputMode="numeric" value={value}
            onChange={(e) => onChange(Math.max(0, Math.min(20, Math.floor(Number(e.target.value) || 0))))}
            className="w-12 rounded border border-border bg-surface px-1.5 py-1 text-center font-mono text-sm tabular-nums"
          />
          <button type="button" className={btn} aria-label={`${more}: ${text}`} disabled={value >= 20} onClick={() => onChange(Math.min(20, value + 1))}>+</button>
        </div>
      </div>
      {help && <p className="mt-1 text-xs leading-snug text-muted">{help}</p>}
    </div>
  );
}

function Check({ id, label: text, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm pointer-coarse:min-h-11">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {text}
    </label>
  );
}

/** `value`, but only once it has stopped changing for `ms`. */
function useSettled(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}
