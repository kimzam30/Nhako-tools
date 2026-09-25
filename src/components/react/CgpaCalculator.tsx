import { useState } from 'react';
import { UM_SCALE, cgpa, gpa, needed, round2, totals, SOURCES } from '../../tools/calc/cgpa';
import type { Locale } from '../../i18n/paths';
import { valueBeforeHydration } from './hydration';

const TEXT = {
  en: {
    previous: 'Before this semester',
    previousHelp: 'Leave empty if this is your first semester.',
    prevCgpa: 'Current CGPA',
    prevCredits: 'Credits completed',
    semester: 'This semester',
    course: 'Course',
    coursePlaceholder: (n: number) => `Course ${n}`,
    credits: 'Credits',
    grade: 'Grade',
    noGrade: 'Grade',
    add: 'Add a course',
    remove: (name: string) => `Remove ${name}`,
    gpa: 'Semester GPA',
    newCgpa: 'New CGPA',
    totalCredits: (n: number) => `${n} credits in total`,
    points: (n: number) => `${n} quality points this semester`,
    pickGrades: 'Pick a grade for at least one course.',
    plan: 'Plan ahead',
    target: 'Target CGPA',
    nextCredits: 'Credits next semester',
    need: (g: string) => `You need a GPA of ${g} next semester.`,
    already: 'You are safe: even a GPA of 0.00 next semester keeps you at or above it.',
    unreachable: (g: string) => `That needs ${g}, above a perfect 4.00. Aim over more semesters.`,
    planHint: 'Uses your new CGPA and credits from above.',
    scale: 'Grade points',
    scaleHelp: 'Universiti Malaya\'s published table. Universities differ, so change any point to match your own handbook.',
    reset: 'Reset to Universiti Malaya',
    source: 'Source',
    summary: (g: string, c: string) => `Semester GPA ${g}, CGPA ${c}`,
  },
  ms: {
    previous: 'Sebelum semester ini',
    previousHelp: 'Biarkan kosong jika ini semester pertama anda.',
    prevCgpa: 'PNGK semasa',
    prevCredits: 'Kredit telah diambil',
    semester: 'Semester ini',
    course: 'Kursus',
    coursePlaceholder: (n: number) => `Kursus ${n}`,
    credits: 'Kredit',
    grade: 'Gred',
    noGrade: 'Gred',
    add: 'Tambah kursus',
    remove: (name: string) => `Buang ${name}`,
    gpa: 'PNG semester',
    newCgpa: 'PNGK baharu',
    totalCredits: (n: number) => `${n} kredit keseluruhan`,
    points: (n: number) => `${n} mata nilai semester ini`,
    pickGrades: 'Pilih gred untuk sekurang-kurangnya satu kursus.',
    plan: 'Rancang ke hadapan',
    target: 'PNGK sasaran',
    nextCredits: 'Kredit semester depan',
    need: (g: string) => `Anda perlukan PNG ${g} semester depan.`,
    already: 'Anda selamat: PNG 0.00 semester depan pun masih mengekalkan anda pada atau melebihi sasaran.',
    unreachable: (g: string) => `Itu memerlukan ${g}, melebihi 4.00 penuh. Sasarkan dalam beberapa semester.`,
    planHint: 'Menggunakan PNGK baharu dan kredit anda di atas.',
    scale: 'Mata gred',
    scaleHelp: 'Jadual terbitan Universiti Malaya. Setiap universiti berbeza, jadi ubah mana-mana mata mengikut buku panduan anda.',
    reset: 'Set semula kepada Universiti Malaya',
    source: 'Sumber',
    summary: (g: string, c: string) => `PNG semester ${g}, PNGK ${c}`,
  },
} satisfies Record<Locale, unknown>;

interface Row { key: number; name: string; credits: string; grade: string }

const field = 'w-full rounded border border-border bg-surface px-2.5 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent';
const label = 'mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted';
const num = (s: string) => {
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
};
const fmt = (v: number | null) => (v === null ? '--' : round2(v).toFixed(2));

const STARTING_ROWS = 4;

export default function CgpaCalculator({ locale = 'en' }: { locale?: Locale }) {
  const t = TEXT[locale];
  const [points, setPoints] = useState<Record<string, number>>(() => Object.fromEntries(UM_SCALE.map((g) => [g.grade, g.point])));
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: STARTING_ROWS }, (_, i) => ({
    key: i,
    name: valueBeforeHydration(`course-${i}-name`, ''),
    credits: valueBeforeHydration(`course-${i}-credits`, '3'),
    grade: valueBeforeHydration(`course-${i}-grade`, ''),
  })));
  const [nextKey, setNextKey] = useState(STARTING_ROWS);
  const [prevCgpa, setPrevCgpa] = useState(() => valueBeforeHydration('prev-cgpa', ''));
  const [prevCredits, setPrevCredits] = useState(() => valueBeforeHydration('prev-credits', ''));
  const [target, setTarget] = useState(() => valueBeforeHydration('target-cgpa', '3.50'));
  const [nextCredits, setNextCredits] = useState(() => valueBeforeHydration('next-credits', '18'));

  const courses = rows
    .filter((r) => r.grade && num(r.credits) > 0)
    .map((r) => ({ credits: num(r.credits), point: points[r.grade] ?? 0 }));
  const semester = gpa(courses);
  const pc = num(prevCgpa);
  const pcr = num(prevCredits);
  const previous = pc >= 0 && pc <= 4 && pcr > 0 ? { cgpa: pc, credits: pcr } : null;
  const overall = cgpa(previous, courses);
  const sem = totals(courses);
  const allCredits = (previous?.credits ?? 0) + sem.credits;
  const plan = overall !== null ? needed({ cgpa: overall, credits: allCredits }, num(target), num(nextCredits)) : null;

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className={label}>{t.previous}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prev-cgpa" className="mb-1 block text-xs text-muted">{t.prevCgpa}</label>
              <input id="prev-cgpa" inputMode="decimal" autoComplete="off" placeholder="3.21" value={prevCgpa} onInput={(e) => setPrevCgpa(e.currentTarget.value)} className={`${field} tabular-nums`} />
            </div>
            <div>
              <label htmlFor="prev-credits" className="mb-1 block text-xs text-muted">{t.prevCredits}</label>
              <input id="prev-credits" inputMode="numeric" autoComplete="off" placeholder="36" value={prevCredits} onInput={(e) => setPrevCredits(e.currentTarget.value)} className={`${field} tabular-nums`} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">{t.previousHelp}</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className={label}>{t.semester}</p>
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_6rem_2.25rem] items-center gap-x-2 gap-y-2" role="group" aria-label={t.semester}>
            <span className="text-xs text-muted">{t.course}</span>
            <span className="text-xs text-muted">{t.credits}</span>
            <span className="text-xs text-muted">{t.grade}</span>
            <span aria-hidden="true" />
            {rows.map((r, i) => {
              const name = r.name.trim() || t.coursePlaceholder(i + 1);
              return (
                <div key={r.key} className="contents" data-course-row>
                  <input id={`course-${r.key}-name`} aria-label={`${t.course} ${i + 1}`} placeholder={t.coursePlaceholder(i + 1)} autoComplete="off" value={r.name} onInput={(e) => update(r.key, { name: e.currentTarget.value })} className={field} />
                  <input id={`course-${r.key}-credits`} aria-label={`${t.credits}, ${name}`} inputMode="numeric" autoComplete="off" value={r.credits} onInput={(e) => update(r.key, { credits: e.currentTarget.value })} className={`${field} tabular-nums`} />
                  <select id={`course-${r.key}-grade`} aria-label={`${t.grade}, ${name}`} value={r.grade} onChange={(e) => update(r.key, { grade: e.currentTarget.value })} className={field}>
                    <option value="">{t.noGrade}</option>
                    {UM_SCALE.map((g) => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
                  </select>
                  <button
                    type="button" aria-label={t.remove(name)} disabled={rows.length === 1}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="grid size-9 place-items-center rounded border border-border text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-40 pointer-coarse:size-11"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { setRows((rs) => [...rs, { key: nextKey, name: '', credits: '3', grade: '' }]); setNextKey((k) => k + 1); }}
            className="mt-3 rounded border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text pointer-coarse:min-h-11"
          >
            + {t.add}
          </button>
        </div>

        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-2xs font-semibold uppercase tracking-wider text-muted pointer-coarse:-my-3.5 pointer-coarse:py-3.5">{t.scale}</summary>
          <p className="mt-2 text-xs text-muted">{t.scaleHelp}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {UM_SCALE.map((g) => (
              <label key={g.grade} className="flex items-center gap-2 text-sm">
                <span className="w-7 font-semibold">{g.grade}</span>
                <input
                  aria-label={`${t.scale} ${g.grade}`} inputMode="decimal" value={String(points[g.grade])}
                  onInput={(e) => { const v = num(e.currentTarget.value); if (v >= 0 && v <= 4.5) setPoints((p) => ({ ...p, [g.grade]: v })); }}
                  className={`${field} tabular-nums`}
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setPoints(Object.fromEntries(UM_SCALE.map((g) => [g.grade, g.point])))} className="mt-3 text-xs text-muted underline decoration-border underline-offset-2 hover:text-accent pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
            {t.reset}
          </button>
          <p className="mt-2 text-xs text-muted">
            {t.source}: <a className="underline decoration-border underline-offset-2 hover:text-accent pointer-coarse:inline-block pointer-coarse:py-3.5" href={SOURCES.um.url} rel="noopener noreferrer">{SOURCES.um.title}</a>
          </p>
        </details>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <p className="sr-only" role="status" aria-live="polite">{semester !== null ? t.summary(fmt(semester), fmt(overall)) : ''}</p>
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.gpa}</p>
            <p data-testid="gpa" className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{fmt(semester)}</p>
            <p className="mt-1 text-xs text-muted tabular-nums">{t.points(round2(sem.points))}</p>
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.newCgpa}</p>
            <p data-testid="cgpa" className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{fmt(overall)}</p>
            <p className="mt-1 text-xs text-muted tabular-nums">{t.totalCredits(allCredits)}</p>
          </div>
          {semester === null && <p className="col-span-2 text-xs text-muted">{t.pickGrades}</p>}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className={label}>{t.plan}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="target-cgpa" className="mb-1 block text-xs text-muted">{t.target}</label>
              <input id="target-cgpa" inputMode="decimal" autoComplete="off" value={target} onInput={(e) => setTarget(e.currentTarget.value)} className={`${field} tabular-nums`} />
            </div>
            <div>
              <label htmlFor="next-credits" className="mb-1 block text-xs text-muted">{t.nextCredits}</label>
              <input id="next-credits" inputMode="numeric" autoComplete="off" value={nextCredits} onInput={(e) => setNextCredits(e.currentTarget.value)} className={`${field} tabular-nums`} />
            </div>
          </div>
          <p data-testid="plan" className="mt-3 text-sm">
            {plan === null ? <span className="text-muted">{t.planHint}</span>
              : plan.alreadyThere ? t.already
              : plan.reachable ? t.need(fmt(plan.gpa))
              : <span className="text-err">{t.unreachable(fmt(plan.gpa))}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
