import { useEffect, useState } from 'react';
import { FEEDBACK_KINDS, MESSAGE_MAX, ROLES, prepare, sendFeedback, type FeedbackKind, type Role } from '../../lib/community';
import { community } from '../../i18n/community';
import type { Locale } from '../../i18n/paths';
import NeraLoader from './NeraLoader';
import { valueBeforeHydration } from './hydration';
import PixelSprite from './PixelSprite';
import StatusMark, { Petals } from './StatusMark';

type State =
  | { name: 'idle' }
  | { name: 'sending' }
  | { name: 'sent' }
  | { name: 'error'; message: string };

const field = 'w-full rounded border border-border bg-surface px-2.5 py-2 text-sm transition-colors hover:border-border-strong focus:border-accent';
const legend = 'mb-2 text-2xs font-semibold uppercase tracking-wider text-muted';

/** The radio in `name` a visitor ticked before the island hydrated, if any. */
function checkedBeforeHydration(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

/** An empty heart, for the ratings not reached: the same drawing, uncoloured. */
const HOLLOW = { P: 'transparent', W: 'transparent' };

/**
 * The feedback form. Links elsewhere on the site open it with the context
 * already filled in: `?kind=bug&tool=pdf/merge&from=/pdf/merge`.
 */
export default function FeedbackForm({ locale, tools }: { locale: Locale; tools: { id: string; name: string }[] }) {
  const t = community(locale);
  // Fixed names and ids, and every field seeded from the DOM: anything typed
  // or ticked before hydration stays on screen, and without this it was
  // invisible to state, so Send said the message was empty. WebKit caught it.
  const [kind, setKind] = useState<FeedbackKind>(() => (checkedBeforeHydration('fb-kind') as FeedbackKind | undefined) ?? 'suggestion');
  const [tool, setTool] = useState(() => valueBeforeHydration('fb-tool', ''));
  const [rating, setRating] = useState<number | undefined>(() => {
    const r = Number(checkedBeforeHydration('fb-rating'));
    return r >= 1 && r <= 5 ? r : undefined;
  });
  const [message, setMessage] = useState(() => valueBeforeHydration('fb-message', ''));
  const [role, setRole] = useState<Role | undefined>(() => checkedBeforeHydration('fb-role') as Role | undefined);
  const [contact, setContact] = useState(() => valueBeforeHydration('fb-contact', ''));
  const [trap, setTrap] = useState('');
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [state, setState] = useState<State>({ name: 'idle' });
  // Send is disabled in the server-rendered form. Clicked before hydration it
  // would submit natively, reloading the page and losing the message.
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setReady(true), []);

  // The page is static, so the query string is only readable once hydrated,
  // and reading it during render would hydrate against different markup.
  // Nothing has been typed yet at that point, so a frame late costs nothing.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const k = q.get('kind');
    const tl = q.get('tool');
    const f = q.get('from');
    // A link's context never overrides a choice already made on the page.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (k && (FEEDBACK_KINDS as readonly string[]).includes(k)) setKind((cur) => (cur === 'suggestion' ? (k as FeedbackKind) : cur));
    if (tl && tools.some((x) => x.id === tl)) setTool((cur) => cur || tl);
    if (f && f.startsWith('/')) setFrom(f.slice(0, 200));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [tools]);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (state.name === 'sending') return;
    const prepared = prepare({ kind, message, tool: tool || undefined, rating, contact, role, locale, page: from });
    if (!prepared.ok) {
      setState({ name: 'error', message: prepared.reason === 'long' ? t.errLong(MESSAGE_MAX) : t.errShort });
      return;
    }
    // A field no person can see. Anything that fills it is a bot, and it is
    // told it succeeded so it has no reason to try a second time.
    if (trap) { setState({ name: 'sent' }); return; }
    setState({ name: 'sending' });
    try {
      await sendFeedback(prepared.row);
      setState({ name: 'sent' });
    } catch (err) {
      const busy = err instanceof Error && /\b(400|429)\b/.test(err.message);
      setState({ name: 'error', message: busy ? t.errBusy : t.errNetwork });
    }
  }

  function again() {
    setMessage('');
    setRating(undefined);
    setState({ name: 'idle' });
  }

  if (state.name === 'sent') {
    return (
      <div aria-live="polite">
        <div data-status="done" className="nera-done relative flex items-start gap-4 overflow-hidden px-5 py-5">
          <Petals count={20} />
          <StatusMark kind="done" />
          <div className="min-w-0 flex-1">
            <p className="nera-title">{t.sentTitle}</p>
            <p className="mt-1.5 text-sm text-muted">{t.sentBody}</p>
            <button type="button" onClick={again} className="mt-4 rounded border border-border bg-bg px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text">
              {t.sendAnother}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const busy = state.name === 'sending';

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-6" noValidate>
      <fieldset>
        <legend className={legend}>{t.kindLegend}</legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_KINDS.map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center ${
                kind === k ? 'border-accent bg-accent-subtle text-text' : 'border-border text-muted hover:border-border-strong hover:text-text'
              }`}
            >
              <input type="radio" name="fb-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {t.kinds[k]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t.kindHints[kind]}</p>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className={`block ${legend}`}>{t.toolLabel}</span>
          <select id="fb-tool" value={tool} onChange={(e) => setTool(e.currentTarget.value)} className={field}>
            <option value="">{t.toolNone}</option>
            {tools.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>

        <fieldset>
          <legend className={legend}>
            {t.ratingLegend} <span className="font-normal normal-case tracking-normal">({t.ratingOptional})</span>
          </legend>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="grid size-9 cursor-pointer place-items-center rounded has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring pointer-coarse:size-11">
                <input
                  type="radio" name="fb-rating" value={n} checked={rating === n}
                  onChange={() => setRating(n)}
                  className="sr-only" aria-label={t.ratingValue(n)}
                />
                <span className={rating === n ? 'nera-pop' : ''}>
                  <PixelSprite name="heart" scale={3} colors={rating !== undefined && n <= rating ? undefined : HOLLOW} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="block">
        <span className="mb-2 flex items-baseline justify-between">
          <span className={legend.replace('mb-2 ', '')}>{t.messageLabel}</span>
          <span data-numeric className={`text-2xs ${message.length > MESSAGE_MAX ? 'text-err' : 'text-muted'}`}>{t.messageCount(message.length, MESSAGE_MAX)}</span>
        </span>
        <textarea
          id="fb-message"
          value={message}
          onInput={(e) => setMessage(e.currentTarget.value)}
          rows={6}
          required
          placeholder={t.messagePlaceholder[kind]}
          className={`${field} resize-y leading-relaxed placeholder:text-muted`}
        />
      </label>

      <fieldset>
        <legend className={legend}>
          {t.roleLegend} <span className="font-normal normal-case tracking-normal">({t.ratingOptional})</span>
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {ROLES.map((r) => (
            <label key={r} className="inline-flex cursor-pointer items-center gap-2 text-sm pointer-coarse:min-h-11">
              <input type="radio" name="fb-role" value={r} checked={role === r} onChange={() => setRole(r)} className="accent-[var(--accent)]" />
              {t.roles[r]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className={`block ${legend}`}>{t.contactLabel}</span>
        <input id="fb-contact" type="text" value={contact} onInput={(e) => setContact(e.currentTarget.value)} autoComplete="email" maxLength={200} className={`${field} max-w-md`} />
        <span className="mt-1.5 block text-xs text-muted">{t.contactHelp}</span>
      </label>

      {/* Honeypot. Off-screen rather than display:none, which some bots skip. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={trap} onInput={(e) => setTrap(e.currentTarget.value)} /></label>
      </div>

      <div aria-live="polite" className="space-y-3">
        {busy && <NeraLoader label={t.sending} />}
        {state.name === 'error' && (
          <div data-status="error" className="nera-done relative flex items-start gap-3 overflow-hidden px-4 py-3">
            <StatusMark kind="error" />
            <div className="min-w-0 flex-1">
              <p className="nera-title text-err">{t.errorTitle}</p>
              <p data-status-message className="text-sm text-err">{state.message}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy || !ready}
          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-on transition-colors duration-[120ms] hover:bg-accent-hover disabled:opacity-60 pointer-coarse:min-h-11"
        >
          {t.send}
        </button>
      </div>
    </form>
  );
}
