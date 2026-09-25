import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  clock, docxXmlToScript, parseRemote, parseScript, readingSeconds, roomCode, scriptTitle,
  wpmForSeconds, WPM,
  type PrompterState, type RemoteMessage,
} from '../../tools/media/teleprompter';
import { deleteTake, listTakes, takeFile, type Take } from '../../lib/takes';
import type { RelayStatus, Room } from '../../lib/relay';
import { bytes } from '../../lib/format';
import type { Locale } from '../../i18n/paths';
import {
  loadCurrent, loadScripts, loadSettings, newId, saveCurrent, saveScripts, saveSettings,
  DEFAULTS, type SavedScript, type Settings,
} from './teleprompter-store';
import { PROMPTER_TEXT, SAMPLE } from './teleprompter-text';
import TeleprompterStage from './TeleprompterStage';
import { filesBeforeHydration, valueBeforeHydration } from './hydration';

const hasSpeech = () => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

/** Recordings listed before "Show all": enough for a morning's retakes, few enough that Start stays put. */
const TAKES_SHOWN = 3;

/** Common slot lengths: a short ad, then the usual social and briefing cuts. */
const TARGETS = [30, 60, 120, 180, 300];

export default function Teleprompter({ locale = 'en' }: { locale?: Locale }) {
  const t = PROMPTER_TEXT[locale];
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [current, setCurrent] = useState<string>('');
  // Seeded from the page, not the sample: see the load effect below.
  const [early] = useState(() => valueBeforeHydration('prompter-script', SAMPLE[locale]).replace(/\r\n?/g, '\n'));
  const [text, setText] = useState(early);
  // Hydration resets the textarea's selection, so "select all, then paste"
  // straddling it would add to the sample instead of replacing it.
  const [selection] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.getElementById('prompter-script');
    return el instanceof HTMLTextAreaElement && document.activeElement === el ? { start: el.selectionStart, end: el.selectionEnd } : null;
  });
  const [title, setTitle] = useState('');
  const [settings, setSettingsState] = useState<Settings>({ ...DEFAULTS, voiceLang: locale === 'ms' ? 'ms-MY' : 'en-US' });
  const [stage, setStage] = useState<{ record: boolean } | null>(null);
  const [takes, setTakes] = useState<(Take & { url: string | null })[]>([]);
  const [playingTake, setPlayingTake] = useState<string | null>(null);
  const [allTakes, setAllTakes] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [speechOk, setSpeechOk] = useState(true);
  // No Wake Lock means the screen dims mid-take with no explanation. Firefox
  // and a Safari older than 16.4 are the ones that land here.
  const [wakeOk, setWakeOk] = useState(true);
  // Target length, held as typed so an empty box stays empty rather than 0.
  const [targetM, setTargetM] = useState('');
  const [targetS, setTargetS] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const ready = useRef(false);

  const script = useMemo(() => parseScript(text), [text]);
  const pauses = useMemo(() => script.blocks.reduce((n, b) => n + (b.kind === 'para' ? b.items.filter((i) => i.kind === 'cue' && i.pause).length : 0), 0), [script]);

  // ─── Load what this browser remembers ────────────────────────────────
  // A layout effect runs before the browser handles any input, so nothing can
  // be typed between hydration and this load and then overwritten by it.
  useLayoutEffect(() => {
    setSpeechOk(hasSpeech());
    setWakeOk('wakeLock' in navigator);
    setSettingsState(loadSettings(locale));
    let list = loadScripts();
    if (list.length === 0) {
      list = [{ id: newId(), title: scriptTitle(SAMPLE[locale], t.untitled), text: SAMPLE[locale], updated: Date.now() }];
    }
    // Typed over the sample before the page finished loading: that is a new
    // script, not something to throw away for the saved one.
    if (early !== SAMPLE[locale].replace(/\r\n?/g, '\n')) {
      const s = { id: newId(), title: scriptTitle(early, t.untitled), text: early, updated: Date.now() };
      list = [s, ...list];
      saveCurrent(s.id);
    }
    saveScripts(list);
    const id = list.find((s) => s.id === loadCurrent())?.id ?? list[0]!.id;
    const s = list.find((x) => x.id === id)!;
    setScripts(list);
    setCurrent(id);
    setText(s.text);
    setTitle(s.title);
    ready.current = true;
    void refreshTakes();
    if (selection) {
      const el = document.getElementById('prompter-script') as HTMLTextAreaElement | null;
      el?.setSelectionRange(selection.start, selection.end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save the script as you type, a moment after you stop.
  useEffect(() => {
    if (!ready.current || !current) return;
    const id = setTimeout(() => {
      setScripts((list) => {
        const next = list.map((s) => (s.id === current ? { ...s, text, title: title.trim() || scriptTitle(text, t.untitled), updated: Date.now() } : s));
        saveScripts(next);
        return next;
      });
    }, 400);
    return () => clearTimeout(id);
  }, [text, title, current, t.untitled]);

  const setSettings = (s: Settings) => { setSettingsState(s); saveSettings(s); };
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings({ ...settings, [k]: v });

  // ─── Speed, and the target length that can drive it ──────────────────
  const words = script.words.length;
  const targetSeconds = Math.max(0, Math.round((Number(targetM) || 0) * 60 + (Number(targetS) || 0)));
  // Before clamping: what the target actually asks for, so the note below can
  // say the target is out of reach rather than silently missing it.
  const requiredWpm = targetSeconds > 0 && words > 0 ? (words / targetSeconds) * 60 : 0;
  const clearTarget = () => { setTargetM(''); setTargetS(''); };

  // A target length sets the speed, and keeps setting it as the script is edited.
  useEffect(() => {
    if (targetSeconds <= 0 || words === 0) return;
    const next = wpmForSeconds(words, targetSeconds);
    if (next !== settings.wpm) set('wpm', next);
    // `set` closes over the whole settings object, so it cannot be a dependency
    // here without re-running on every unrelated setting change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSeconds, words]);

  const targetNote = targetSeconds <= 0 ? t.targetHelp
    : words === 0 ? t.targetNoWords
    : requiredWpm > WPM.max ? t.targetTooFast(WPM.max, clock(readingSeconds(words, WPM.max)))
    : requiredWpm < WPM.min ? t.targetTooSlow(WPM.min, clock(readingSeconds(words, WPM.min)))
    : t.targetExact(clock(readingSeconds(words, settings.wpm)));

  /** A title that was made from the text keeps following it until you edit it. */
  function typed(next: string) {
    if (!title.trim() || title === scriptTitle(text, t.untitled)) setTitle(scriptTitle(next, t.untitled));
    setText(next);
  }

  function choose(id: string) {
    const s = scripts.find((x) => x.id === id);
    if (!s) return;
    setCurrent(id);
    saveCurrent(id);
    setText(s.text);
    setTitle(s.title);
  }
  function add(body = '', name = '') {
    const s: SavedScript = { id: newId(), title: name || t.untitled, text: body, updated: Date.now() };
    // From the list as it is now, not as this render saw it: an import picked
    // before hydration lands here before the loaded library has re-rendered.
    setScripts((list) => {
      const next = [s, ...list];
      saveScripts(next);
      return next;
    });
    setCurrent(s.id);
    saveCurrent(s.id);
    setText(body);
    setTitle(s.title);
  }
  function remove() {
    const s = scripts.find((x) => x.id === current);
    if (!s || !confirm(t.confirmDelete(s.title))) return;
    const next = scripts.filter((x) => x.id !== current);
    if (next.length === 0) next.push({ id: newId(), title: t.untitled, text: '', updated: Date.now() });
    setScripts(next);
    saveScripts(next);
    const first = next[0]!;
    setCurrent(first.id);
    saveCurrent(first.id);
    setText(first.text);
    setTitle(first.title);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    try {
      let body: string;
      if (/\.docx$/i.test(file.name)) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const xml = await zip.file('word/document.xml')?.async('string');
        if (!xml) throw new Error('not a docx');
        body = docxXmlToScript(xml);
      } else {
        body = await file.text();
        if (body.includes(String.fromCharCode(0))) throw new Error('binary');
      }
      add(body, file.name.replace(/\.[^.]+$/, '').slice(0, 60));
    } catch {
      setImportError(t.importFailed);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  // A file chosen for import before hydration fired its change event with no
  // listener. Runs once on mount by design.
  const [earlyImport] = useState(() => filesBeforeHydration('prompter-import')[0]);
  useEffect(() => {
    if (earlyImport) void importFile(earlyImport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Takes ───────────────────────────────────────────────────────────
  const urls = useRef<string[]>([]);
  async function refreshTakes() {
    const list = await listTakes().catch(() => []);
    const withUrls = await Promise.all(list.map(async (tk) => {
      const f = await takeFile(tk.name);
      const url = f ? URL.createObjectURL(f) : null;
      if (url) urls.current.push(url);
      return { ...tk, url };
    }));
    setTakes(withUrls);
  }
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function removeTake(name: string) {
    if (!confirm(t.confirmDeleteTake(name))) return;
    await deleteTake(name);
    await refreshTakes();
  }

  // ─── Phone remote ────────────────────────────────────────────────────
  const room = useRef<Room | null>(null);
  const handler = useRef<((m: RemoteMessage) => void) | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<RelayStatus | null>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const [now, setNow] = useState(0);

  function pair() {
    if (room.current) return;
    const c = roomCode();
    setCode(c);
    void import('../../lib/relay').then(({ openRoom }) => {
      room.current = openRoom(c, (payload) => {
        const m = parseRemote(payload);
        if (!m) return;
        setLastSeen(Date.now());
        handler.current?.(m);
      }, setStatus);
    });
  }
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, [code]);
  useEffect(() => () => room.current?.close(), []);
  // The phone says hello every few seconds; silence means it has gone.
  const phoneSeen = lastSeen > 0 && (now || Date.now()) - lastSeen < 12_000;

  const send = (s: PrompterState) => room.current?.send(s);

  // ─── Render ──────────────────────────────────────────────────────────
  const label = 'text-2xs font-semibold uppercase tracking-wider text-muted';
  const card = 'rounded-lg border border-border bg-surface p-4';
  const field = 'rounded border border-border bg-surface px-2.5 py-1.5 text-sm';
  const small = 'rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-text pointer-coarse:min-h-11 pointer-coarse:px-3.5 pointer-coarse:text-sm';
  const range = (k: 'wpm' | 'fontSize' | 'lineHeight' | 'margin' | 'guide', name: string, min: number, max: number, step: number, show: (v: number) => string, help?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className={label}>{name}</span>
        <span data-numeric className="font-mono text-xs tabular-nums">{show(settings[k])}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={settings[k]} onChange={(e) => set(k, Number(e.target.value))} className="accent-[var(--accent)]" data-setting={k} />
      {help && <span className="text-xs leading-snug text-muted">{help}</span>}
    </label>
  );

  return (
    <section className="flex flex-col gap-4">
      {/* Two columns once there is room. The left one is everything you do in
          order: write, check what you have recorded, start. The settings rail
          sits beside it, so the page is about as tall as the rail and Start
          lands on the first screen. Below lg the same order simply stacks. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
      {/* Script */}
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-40 flex-1 flex-col gap-1.5">
            <span className={label}>{t.library}</span>
            <select value={current} onChange={(e) => choose(e.target.value)} className={field} data-testid="library">
              {scripts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => add()} className={small}>{t.newScript}</button>
          <button type="button" onClick={remove} className={small}>{t.deleteScript}</button>
          <input ref={fileRef} id="prompter-import" type="file" accept=".txt,.md,.markdown,.docx,text/plain,text/markdown" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void importFile(e.target.files?.[0])} data-testid="import" />
          <button type="button" onClick={() => fileRef.current?.click()} className={small}>{t.importFile}</button>
        </div>
        {importError && <p role="alert" data-status-message className="mb-3 rounded border border-err bg-err-subtle px-3 py-2 text-sm text-err">{importError}</p>}
        <label className="mb-3 flex flex-col gap-1.5">
          <span className={label}>{t.title}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t.scriptLabel}</span>
          <textarea
            id="prompter-script" value={text} onChange={(e) => typed(e.target.value)} rows={12} placeholder={t.placeholder}
            className="min-h-60 w-full resize-y rounded border border-border bg-bg p-3 text-base leading-relaxed" data-testid="script"
          />
        </label>
        <p data-numeric className="mt-2 text-xs text-muted" aria-live="polite" data-testid="stats">
          {t.stats(script.words.length, clock(readingSeconds(script.words.length, settings.wpm)), settings.wpm)}
          {script.sections.length > 0 && `, ${t.sectionsCount(script.sections.length)}`}
          {pauses > 0 && `, ${t.pausesCount(pauses)}`}
          {', '}{t.savedHere}
        </p>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted hover:text-text pointer-coarse:py-3.5">{t.formatHelp}</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {t.formatRows.map(([k, v]) => (<Fragment key={k}><dt className="font-mono">{k}</dt><dd className="text-muted">{v}</dd></Fragment>))}
          </dl>
        </details>
      </div>

      {/* Takes */}
      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold">{t.takes}</h2>
        {takes.length === 0 ? (
          <p className="text-sm text-muted">{t.noTakes}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="takes">
            {(allTakes ? takes : takes.slice(0, TAKES_SHOWN)).map((tk) => (
              <li key={tk.name} className="rounded border border-border px-3 py-2">
                {/* One line where it fits: the name, where it is kept, then the actions. */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-48 flex-1 text-xs">
                    <span className="font-mono">{tk.name}</span>
                    <span className={`block sm:inline ${tk.saved ? 'text-muted' : 'text-warn'}`}><span className="hidden sm:inline"> · </span>{tk.saved ? t.onDevice : t.inMemory}</span>
                  </span>
                  <span data-numeric className="text-xs text-muted">{bytes(tk.size)}</span>
                  {tk.url && <button type="button" onClick={() => setPlayingTake(playingTake === tk.name ? null : tk.name)} className={small}>{t.play}</button>}
                  {tk.url && <a href={tk.url} download={tk.name} className={small}>{t.download}</a>}
                  <button type="button" onClick={() => void removeTake(tk.name)} className={small}>{t.deleteTake}</button>
                </div>
                {playingTake === tk.name && tk.url && <video src={tk.url} controls playsInline className="mt-2 w-full rounded bg-black" />}
              </li>
            ))}
          </ul>
        )}
        {takes.length > TAKES_SHOWN && (
          <button type="button" onClick={() => setAllTakes((a) => !a)} aria-expanded={allTakes} className={`${small} mt-3`} data-testid="takes-all">
            {allTakes ? t.takesFewer : t.takesAll(takes.length)}
          </button>
        )}
      </div>

      {/* Start, under the takes and beside each other: the two ways into the stage. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => setStage({ record: false })} className="min-h-12 flex-1 rounded-lg bg-accent px-5 py-3 text-base font-semibold text-accent-on hover:bg-accent-hover" data-testid="start">
          {t.start}
        </button>
        <button type="button" onClick={() => setStage({ record: true })} className="min-h-12 flex-1 rounded-lg border border-border bg-surface px-5 py-3 text-base font-semibold hover:border-accent" data-testid="start-record">
          ● {t.startRecord}
        </button>
      </div>
      {!wakeOk && <p className="text-xs leading-snug text-warn" data-testid="screen-sleep">{t.screenSleep}</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted hover:text-text pointer-coarse:py-3.5">{t.keysTitle}</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {t.keys.map(([k, v]) => (<Fragment key={k}><dt className="font-mono">{k}</dt><dd className="text-muted">{v}</dd></Fragment>))}
        </dl>
        <p className="mt-2 text-xs text-muted">{t.keysNote}</p>
      </details>
      </div>

      {/* Settings */}
      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold">{t.settings}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {/* Speed, what it comes to in minutes, and a target length to work
              back from. Typing a target sets the speed; touching the slider
              gives control back to you and drops the target. */}
          <div className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className={label}>{t.speed}</span>
              <span data-numeric className="font-mono text-xs tabular-nums" data-testid="wpm-value">{settings.wpm} {t.wpmUnit}</span>
            </span>
            <input
              type="range" min={WPM.min} max={WPM.max} step={1} value={settings.wpm}
              onChange={(e) => { clearTarget(); set('wpm', Number(e.target.value)); }}
              className="accent-[var(--accent)]" data-setting="wpm" aria-label={t.speed}
            />
            <span data-numeric className="text-xs text-muted" data-testid="speed-time">
              {t.speedTime(clock(readingSeconds(words, settings.wpm)), words)}
            </span>

            <div className="mt-2 rounded border border-border p-2.5">
              <span className={`${label} block`}>{t.targetLength}</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  type="number" inputMode="numeric" min={0} max={180} value={targetM} placeholder="0"
                  onChange={(e) => setTargetM(e.target.value)} aria-label={t.targetMinutes}
                  className={`${field} w-14 text-center`} data-testid="target-min"
                />
                <span aria-hidden="true" className="font-mono text-sm text-muted">:</span>
                <input
                  type="number" inputMode="numeric" min={0} max={59} value={targetS} placeholder="00"
                  onChange={(e) => setTargetS(e.target.value)} aria-label={t.targetSeconds}
                  className={`${field} w-14 text-center`} data-testid="target-sec"
                />
                {targetSeconds > 0 && (
                  <button type="button" onClick={clearTarget} className={small} data-testid="target-clear">{t.targetClear}</button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TARGETS.map((secs) => (
                  <button
                    key={secs} type="button" aria-pressed={targetSeconds === secs}
                    onClick={() => { setTargetM(String(Math.floor(secs / 60))); setTargetS(String(secs % 60)); }}
                    className={`rounded border px-2 py-0.5 font-mono text-2xs tabular-nums transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:text-sm ${targetSeconds === secs ? 'border-accent text-accent' : 'border-border text-muted hover:border-accent hover:text-text'}`}
                  >{clock(secs)}</button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-snug text-muted" aria-live="polite" data-testid="target-note">{targetNote}</p>
            </div>
          </div>
          {range('fontSize', t.fontSize, 24, 140, 2, (v) => `${v}px`)}
          {range('lineHeight', t.lineHeight, 1.1, 2.2, 0.05, (v) => v.toFixed(2))}
          {range('margin', t.margin, 0, 30, 1, (v) => `${v}%`)}
          {range('guide', t.guide, 5, 60, 1, (v) => `${v}%`, t.guideHelp)}
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={label}>{t.theme}</span>
              <select value={settings.theme} onChange={(e) => set('theme', e.target.value as Settings['theme'])} className={field}>
                {(['dark', 'light', 'yellow'] as const).map((k) => <option key={k} value={k}>{t.themes[k]}</option>)}
              </select>
            </label>
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className={label}>{t.align}</span>
                <select value={settings.align} onChange={(e) => set('align', e.target.value as Settings['align'])} className={field}>
                  {(['left', 'center'] as const).map((k) => <option key={k} value={k}>{t.aligns[k]}</option>)}
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className={label}>{t.countdown}</span>
                <select value={settings.countdown} onChange={(e) => set('countdown', Number(e.target.value))} className={field}>
                  {[0, 3, 5, 10].map((n) => <option key={n} value={n}>{n ? t.seconds(n) : t.countdownOff}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
            <input type="checkbox" checked={settings.mirrorX} onChange={(e) => set('mirrorX', e.target.checked)} /> {t.mirrorX}
          </label>
          <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
            <input type="checkbox" checked={settings.mirrorY} onChange={(e) => set('mirrorY', e.target.checked)} /> {t.mirrorY}
          </label>
          <div className="mt-2 rounded border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium pointer-coarse:min-h-11">
              <input type="checkbox" checked={settings.voice} disabled={!speechOk} onChange={(e) => set('voice', e.target.checked)} data-testid="voice" /> {t.voice}
            </label>
            <p className="mt-1.5 text-xs leading-snug text-muted">{speechOk ? t.voiceHelp : t.voiceNone}</p>
            {settings.voice && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-muted">{t.voiceLang}</span>
                <select value={settings.voiceLang} onChange={(e) => set('voiceLang', e.target.value)} className={field}>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="ms-MY">Bahasa Melayu</option>
                </select>
              </label>
            )}
          </div>
        </div>
      </div>
      </div>

      {stage && (
        <TeleprompterStage
          script={script}
          settings={settings}
          onSettings={setSettings}
          t={t}
          record={stage.record}
          onClose={() => setStage(null)}
          onTake={() => void refreshTakes()}
          remote={{ code, status, phoneSeen, pair, send, handler }}
        />
      )}
    </section>
  );
}
