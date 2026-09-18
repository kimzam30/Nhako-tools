import { useState } from 'react';
import type { OptionSpec, OptionValues } from '../../tools/types';

/**
 * One generic renderer for every tool's options, driven by the declarative
 * spec in the registry. Adding an option to a tool is a data change, not a
 * component change.
 */
export default function OptionsPanel({
  specs, values, onChange, disabled,
}: {
  specs: OptionSpec[];
  values: OptionValues;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled?: boolean;
}) {
  // Toggles always span the full width, so only the others decide the layout.
  const columned = specs.filter((s) => s.kind !== 'toggle').length > 1;

  return (
    <div className={`grid gap-x-6 gap-y-4 ${columned ? 'sm:grid-cols-2' : 'max-w-sm'}`}>
      {specs.map((spec) => {
        const id = `opt-${spec.key}`;
        const value = values[spec.key];
        return (
          <div key={spec.key} className={spec.kind === 'toggle' ? 'sm:col-span-2' : ''}>
            {spec.kind === 'toggle' ? (
              <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5">
                <input
                  id={id} type="checkbox" disabled={disabled}
                  checked={Boolean(value)}
                  onChange={(e) => onChange(spec.key, e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                <span className="text-sm">{spec.label}</span>
                {spec.help && <span className="text-2xs text-muted">{spec.help}</span>}
              </label>
            ) : (
              <>
                <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{spec.label}</span>
                  {spec.kind === 'range' && (
                    <output htmlFor={id} className="text-2xs text-text">{String(value)}{spec.suffix ?? ''}</output>
                  )}
                </label>

                {spec.kind === 'select' && (
                  <select
                    id={id} disabled={disabled} value={String(value)}
                    onChange={(e) => onChange(spec.key, e.target.value)}
                    className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-sm transition-colors hover:border-border-strong"
                  >
                    {spec.choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                )}

                {spec.kind === 'range' && (
                  <input
                    id={id} type="range" disabled={disabled}
                    min={spec.min} max={spec.max} step={spec.step ?? 1}
                    value={Number(value)}
                    onChange={(e) => onChange(spec.key, Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                )}

                {spec.kind === 'number' && (
                  <div className="flex items-center gap-2">
                    <NumberField spec={spec} id={id} value={Number(value)} disabled={disabled} onCommit={(n) => onChange(spec.key, n)} />
                    {spec.suffix && <span className="text-xs text-muted">{spec.suffix}</span>}
                  </div>
                )}

                {spec.kind === 'text' && (
                  <input
                    id={id} type="text" disabled={disabled}
                    value={String(value)} placeholder={spec.placeholder}
                    onChange={(e) => onChange(spec.key, e.target.value)}
                    className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-sm transition-colors hover:border-border-strong"
                  />
                )}

                {spec.help && <p className="mt-1 text-2xs leading-snug text-muted">{spec.help}</p>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

type NumberSpec = Extract<OptionSpec, { kind: 'number' }>;

/**
 * A number input that keeps what is typed separately from what is committed.
 *
 * Binding the input straight to the committed number meant clearing it
 * snapped the field to the minimum mid-edit, and every intermediate value
 * ("1" on the way to "15") was sent to the tool. Only a complete, in-range
 * number is committed; anything else is shown as invalid and left alone.
 */
function NumberField({ spec, id, value, disabled, onCommit }: {
  spec: NumberSpec; id: string; value: number; disabled?: boolean; onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [committed, setCommitted] = useState(value);

  // The value changed from outside (not from typing here): follow it.
  if (value !== committed) {
    setCommitted(value);
    setDraft(String(value));
  }

  const n = Number(draft);
  const valid = draft.trim() !== '' && Number.isFinite(n) && n >= spec.min && n <= spec.max;
  const errorId = `${id}-error`;

  return (
    <>
      <input
        id={id} type="number" inputMode="decimal" disabled={disabled}
        min={spec.min} max={spec.max} step={spec.step ?? 1}
        value={draft}
        aria-invalid={valid ? undefined : true}
        aria-describedby={valid ? undefined : errorId}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const next = Number(raw);
          if (raw.trim() !== '' && Number.isFinite(next) && next >= spec.min && next <= spec.max) {
            setCommitted(next);
            onCommit(next);
          }
        }}
        // Leaving the field with an unusable value restores the last good one.
        onBlur={() => { if (!valid) setDraft(String(committed)); }}
        className="w-28 rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-sm tabular-nums transition-colors hover:border-border-strong aria-invalid:border-err"
      />
      {!valid && (
        <span id={errorId} className="text-2xs text-err">
          {spec.min} to {spec.max}
        </span>
      )}
    </>
  );
}
