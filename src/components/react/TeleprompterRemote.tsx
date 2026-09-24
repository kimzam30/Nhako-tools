import { useEffect, useRef, useState } from 'react';
import { cleanRoomCode, clock, isRoomCode, parseState, type Action, type PrompterState, type RemoteMessage } from '../../tools/media/teleprompter';
import type { RelayStatus, Room } from '../../lib/relay';
import type { Locale } from '../../i18n/paths';
import { PROMPTER_TEXT } from './teleprompter-text';

const KEY = 'nhako.remote';

/**
 * The phone side of the remote. The room code comes from the address's
 * fragment (#CODE), which browsers never send to a server, or is typed in.
 * It is remembered for this tab only, so a reload stays connected.
 */
export default function TeleprompterRemote({ locale = 'en' }: { locale?: Locale }) {
  const t = PROMPTER_TEXT[locale].remotePage;
  const unit = PROMPTER_TEXT[locale].wpmUnit;
  const [code, setCode] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [bad, setBad] = useState(false);
  const [status, setStatus] = useState<RelayStatus>('connecting');
  const [state, setState] = useState<PrompterState | null>(null);
  const [seen, setSeen] = useState(0);
  const [now, setNow] = useState(Date.now());
  const room = useRef<Room | null>(null);

  useEffect(() => {
    // The page's inline script moved the code out of the address bar.
    let saved = (window as unknown as { __nhakoRoom?: string }).__nhakoRoom ?? location.hash.slice(1);
    if (!saved) { try { saved = sessionStorage.getItem(KEY) ?? ''; } catch { saved = ''; } }
    const c = cleanRoomCode(decodeURIComponent(saved));
    if (isRoomCode(c)) setCode(c);
  }, []);

  useEffect(() => {
    if (!code) return;
    let live = true;
    let hello: ReturnType<typeof setInterval> | undefined;
    void import('../../lib/relay').then(({ openRoom }) => {
      if (!live) return;
      const r = openRoom(code, (payload) => {
        const s = parseState(payload);
        if (s) { setState(s); setSeen(Date.now()); }
      }, setStatus);
      room.current = r;
      const say = () => r.send({ t: 'hello' } satisfies RemoteMessage);
      say();
      hello = setInterval(say, 5000);
    });
    // A phone remote is useless if the phone locks mid-take.
    let lock: { release(): Promise<void> } | null = null;
    void (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } })
      .wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => undefined);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      live = false;
      clearInterval(hello);
      clearInterval(tick);
      room.current?.close();
      room.current = null;
      void lock?.release().catch(() => undefined);
    };
  }, [code]);

  const cmd = (a: Action) => {
    room.current?.send({ t: 'cmd', a } satisfies RemoteMessage);
    navigator.vibrate?.(15);
  };

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = cleanRoomCode(draft);
    if (!isRoomCode(c)) { setBad(true); return; }
    setBad(false);
    try { sessionStorage.setItem(KEY, c); } catch { /* storage blocked */ }
    setCode(c);
  }

  if (!code) {
    return (
      <form onSubmit={join} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{t.codeLabel}</span>
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false}
            inputMode="text" maxLength={14} aria-describedby="code-help"
            className="rounded border border-border bg-bg px-3 py-3 text-center font-mono text-2xl tracking-[0.2em]" data-testid="code"
          />
          <span id="code-help" className="text-xs text-muted">{t.codeHelp}</span>
        </label>
        {bad && <p role="alert" className="text-sm text-err">{t.badCode}</p>}
        <button type="submit" className="min-h-12 rounded-lg bg-accent px-4 py-3 font-semibold text-accent-on hover:bg-accent-hover">{t.join}</button>
      </form>
    );
  }

  const connected = seen > 0 && now - seen < 12_000;
  const line = status === 'offline' ? t.offline : connected ? t.found : seen > 0 ? t.lost : t.searching;
  const big = 'flex min-h-20 items-center justify-center rounded-xl border border-border bg-surface px-3 text-base font-medium active:bg-sunken disabled:opacity-40';

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" data-testid="remote-status" className={`rounded-lg px-3 py-2 text-sm ${connected ? 'bg-accent-subtle' : 'bg-sunken text-muted'}`}>
        {line}
        {connected && state && (
          <span className="ml-2 font-mono tabular-nums">
            {state.playing ? t.playing : t.paused}, {state.wpm} {unit}, {t.left(clock(state.remaining))}
          </span>
        )}
      </p>
      {connected && state && state.section >= 0 && <p className="truncate text-sm text-muted">{state.sections[state.section]}</p>}
      {connected && state && (
        <div className="h-1.5 overflow-hidden rounded bg-sunken" aria-hidden="true">
          <div className="h-full bg-accent" style={{ width: `${state.progress * 100}%` }} />
        </div>
      )}

      <button type="button" onClick={() => cmd('toggle')} disabled={!connected} className="flex min-h-36 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-accent-on active:bg-accent-hover disabled:opacity-40" data-testid="rc-toggle">
        {t.playPause}
      </button>
      <div className="grid grid-cols-3 gap-3">
        <button type="button" onClick={() => cmd('slower')} disabled={!connected} className={big} aria-label={`−10 ${unit}`}>−</button>
        <span className="flex items-center justify-center font-mono text-lg tabular-nums" data-testid="rc-wpm">{state?.wpm ?? '--'}</span>
        <button type="button" onClick={() => cmd('faster')} disabled={!connected} className={big} aria-label={`+10 ${unit}`} data-testid="rc-faster">+</button>
        <button type="button" onClick={() => cmd('back')} disabled={!connected} className={big}>{t.back}</button>
        <button type="button" onClick={() => cmd('restart')} disabled={!connected} className={big}>{t.restart}</button>
        <button type="button" onClick={() => cmd('forward')} disabled={!connected} className={big}>{t.forward}</button>
        {(state?.sections.length ?? 0) > 0 && (
          <>
            <button type="button" onClick={() => cmd('prev')} disabled={!connected} className={big}>{t.prev}</button>
            <span />
            <button type="button" onClick={() => cmd('next')} disabled={!connected} className={big}>{t.next}</button>
          </>
        )}
      </div>
      {state?.canRecord && (
        <button type="button" onClick={() => cmd('record')} disabled={!connected} className={`${big} ${state.recording ? 'border-red-600 text-red-600' : ''}`}>
          {state.recording ? `● ${t.stopRecording}` : t.record}
        </button>
      )}
      <button type="button" onClick={() => { try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } setCode(null); setState(null); setSeen(0); }} className="self-start text-xs text-muted underline">
        {t.leave}
      </button>
    </div>
  );
}
