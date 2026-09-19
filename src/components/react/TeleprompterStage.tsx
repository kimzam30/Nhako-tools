import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clampWpm, clock, followMatch, normalizeWord, pixelsPerSecond, readingSeconds, WPM,
  type Action, type PrompterState, type RemoteMessage, type Script,
} from '../../tools/media/teleprompter';
import { startRecording, type Recording, type Take } from '../../lib/takes';
import type { Settings } from './teleprompter-store';
import type { StageText } from './teleprompter-text';

interface Props {
  script: Script;
  settings: Settings;
  onSettings: (s: Settings) => void;
  t: StageText;
  /** Record from the start, rather than only scroll. */
  record: boolean;
  onClose: () => void;
  onTake: (take: Take) => void;
  /** Remote wiring, owned by the parent so a pairing outlives the stage. */
  remote: {
    code: string | null;
    status: 'connecting' | 'open' | 'offline' | null;
    phoneSeen: boolean;
    pair: () => void;
    send: (s: PrompterState) => void;
    handler: { current: ((m: RemoteMessage) => void) | null };
  };
}

const THEMES = {
  dark: { bg: '#000000', fg: '#f5f5f4', em: '#fde047', cue: '#38bdf8', muted: '#a8a29e' },
  light: { bg: '#ffffff', fg: '#0c0a09', em: '#b45309', cue: '#0369a1', muted: '#57534e' },
  yellow: { bg: '#000000', fg: '#fde047', em: '#ffffff', cue: '#38bdf8', muted: '#a8a29e' },
} as const;

type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void;
};
const speechRecognition = (): (new () => SpeechRecognitionLike) | null => {
  const w = globalThis as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
};

export default function TeleprompterStage({ script, settings, onSettings, t, record, onClose, onTake, remote }: Props) {
  const theme = THEMES[settings.theme];
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);

  // The scroll runs every frame, so it lives in refs, not state.
  const y = useRef(0);
  const target = useRef<number | null>(null);
  const playing = useRef(false);
  const layout = useRef({ height: 1, view: 1, sections: [] as number[], pauses: [] as number[], words: [] as number[] });
  const armed = useRef(new Set<number>());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [progress, setProgress] = useState({ fraction: 0, section: -1 });
  const [pausedAtCue, setPausedAtCue] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState<{ rec: Recording; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<'off' | 'listening' | 'unsupported' | 'blocked'>('off');
  const [showRemote, setShowRemote] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);

  const normWords = useMemo(() => script.words.map(normalizeWord), [script]);
  const canRecord = typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  // ─── Layout ──────────────────────────────────────────────────────────
  const measure = useCallback(() => {
    const c = contentRef.current;
    const v = viewRef.current;
    if (!c || !v) return;
    const tops = (sel: string) => [...c.querySelectorAll<HTMLElement>(sel)].map((el) => el.offsetTop);
    layout.current = {
      height: c.scrollHeight,
      view: v.clientHeight,
      sections: tops('[data-section]'),
      pauses: tops('[data-pause]'),
      words: tops('[data-w]'),
    };
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (contentRef.current) ro.observe(contentRef.current);
    if (viewRef.current) ro.observe(viewRef.current);
    return () => ro.disconnect();
  }, [measure, script, settings.fontSize, settings.lineHeight, settings.margin, settings.align]);

  const wordAt = (pos: number) => {
    const w = layout.current.words;
    let lo = 0;
    let hi = w.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (w[mid]! < pos - 2) lo = mid + 1; else hi = mid; }
    return lo;
  };
  const sectionAt = (pos: number) => {
    let s = -1;
    layout.current.sections.forEach((top, i) => { if (top <= pos + 4) s = i; });
    return s;
  };

  // ─── The frame loop ──────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const frame = (now: number) => {
      // A stalled frame on a slow tablet still counts, so the pace holds; the
      // cap only stops a leap after the tab was hidden.
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      const L = layout.current;
      const end = Math.max(0, L.height - 1);
      // With voice-follow on, the voice moves the text and the clock does not.
      const following = playing.current && settingsRef.current.voice;
      if (target.current !== null) {
        // Voice-follow and jumps glide rather than snap.
        const d = target.current - y.current;
        y.current += Math.abs(d) < 1 ? d : d * Math.min(1, dt * 10);
        if (Math.abs(d) < 1 && !following) target.current = null;
      } else if (playing.current && !following) {
        const next = y.current + pixelsPerSecond(settingsRef.current.wpm, L.height, script.words.length) * dt;
        const cue = L.pauses.find((top) => top > y.current && top <= next && armed.current.has(top));
        if (cue !== undefined) {
          y.current = cue;
          armed.current.delete(cue);
          stop(true);
        } else if (next >= end) {
          y.current = end;
          stop(false);
        } else {
          y.current = next;
        }
      }
      // Cues behind the reading line re-arm when you scroll back above them.
      for (const top of L.pauses) if (top > y.current + 1) armed.current.add(top);
      const c = contentRef.current;
      if (c) c.style.transform = `translate3d(0, ${Math.round((L.view * settingsRef.current.guide) / 100 - y.current)}px, 0)`;
      if (now - lastUi > 200) {
        lastUi = now;
        setProgress({ fraction: L.height > 1 ? Math.min(1, y.current / (L.height - 1)) : 0, section: sectionAt(y.current) });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  // ─── Play, pause, move ───────────────────────────────────────────────
  const countdownTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  function stop(atCue: boolean) {
    clearInterval(countdownTimer.current);
    setCountdown(0);
    playing.current = false;
    setIsPlaying(false);
    setPausedAtCue(atCue);
    stopVoice();
  }

  function play() {
    if (playing.current || countdown) return;
    setPausedAtCue(false);
    const L = layout.current;
    if (y.current >= L.height - 2) { y.current = 0; armed.current.clear(); }
    const go = () => {
      playing.current = true;
      setIsPlaying(true);
      if (settingsRef.current.voice) startVoice();
    };
    const n = settingsRef.current.countdown;
    if (!n) { go(); return; }
    setCountdown(n);
    let left = n;
    countdownTimer.current = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(countdownTimer.current); setCountdown(0); go(); } else setCountdown(left);
    }, 1000);
  }

  const toggle = () => (playing.current || countdown ? stop(false) : play());

  const jumpTo = (pos: number) => {
    const L = layout.current;
    target.current = Math.max(0, Math.min(L.height - 1, pos));
  };
  const lineStep = () => settingsRef.current.fontSize * settingsRef.current.lineHeight;
  const nudge = (lines: number) => jumpTo((target.current ?? y.current) + lines * lineStep());
  const section = (dir: 1 | -1) => {
    const s = layout.current.sections;
    const here = target.current ?? y.current;
    const next = dir > 0 ? s.find((top) => top > here + 4) : [...s].reverse().find((top) => top < here - 4);
    jumpTo(next ?? (dir > 0 ? layout.current.height - 1 : 0));
  };
  const restart = () => { stop(false); armed.current.clear(); jumpTo(0); };
  const speed = (delta: number) => onSettings({ ...settingsRef.current, wpm: clampWpm(settingsRef.current.wpm + delta) });

  // ─── Camera, meter, recording ────────────────────────────────────────
  async function ensureCamera(): Promise<MediaStream | null> {
    if (stream) return stream;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setStream(s);
      return s;
    } catch (e) {
      setMessage(e instanceof DOMException && e.name === 'NotAllowedError' ? t.cameraBlocked : t.cameraMissing);
      return null;
    }
  }

  useEffect(() => {
    if (!stream) return;
    if (videoRef.current) videoRef.current.srcObject = stream;
    if (!stream.getAudioTracks().length) return;
    let ctx: AudioContext | null = null;
    let raf = 0;
    try {
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) ** 2;
        const level = Math.min(1, Math.sqrt(sum / data.length) / 40);
        if (meterRef.current) meterRef.current.style.transform = `scaleX(${level})`;
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* no meter, recording still works */ }
    return () => { cancelAnimationFrame(raf); void ctx?.close(); };
  }, [stream, preview]);

  async function toggleRecord() {
    if (recording) {
      const r = recording;
      setRecording(null);
      stop(false);
      try {
        const take = await r.rec.stop();
        onTake(take);
        setMessage(take.saved ? t.takeSaved(take.name) : t.takeInMemory(take.name));
      } catch {
        setMessage(t.recordFailed);
      }
      return;
    }
    if (!canRecord) { setMessage(t.recordUnsupported); return; }
    const s = await ensureCamera();
    if (!s) return;
    try {
      const rec = await startRecording(s, () => setMessage(t.recordFailed));
      setRecording({ rec, started: Date.now() });
      setMessage(null);
      stop(false);
      play();
    } catch {
      setMessage(t.recordUnsupported);
    }
  }

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - recording.started) / 1000)), 500);
    return () => clearInterval(id);
  }, [recording]);

  // ─── Voice-follow ────────────────────────────────────────────────────
  const recognizer = useRef<SpeechRecognitionLike | null>(null);
  const wantVoice = useRef(false);

  function startVoice() {
    const SR = speechRecognition();
    if (!SR) { setVoiceState('unsupported'); return; }
    wantVoice.current = true;
    if (recognizer.current) return;
    const r = new SR();
    r.lang = settingsRef.current.voiceLang;
    r.continuous = true;
    r.interimResults = true;
    let heard: string[] = [];
    r.onresult = (e) => {
      const latest: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) latest.push(e.results[i]?.[0]?.transcript ?? '');
      const words = latest.join(' ').split(/\s+/).filter(Boolean);
      if (e.results[e.results.length - 1]?.isFinal) heard = [...heard, ...words].slice(-8);
      const from = wordAt(target.current ?? y.current);
      const idx = followMatch(normWords, [...heard, ...words].slice(-6), from);
      if (idx === null) return;
      const tops = layout.current.words;
      // Keep the word being said on the reading line.
      if (idx < tops.length) target.current = Math.max(target.current ?? 0, tops[idx]!);
      else target.current = layout.current.height - 1;
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { wantVoice.current = false; setVoiceState('blocked'); }
    };
    // Recognition ends itself after silence; keep it going while wanted.
    r.onend = () => {
      recognizer.current = null;
      if (wantVoice.current) setTimeout(() => { if (wantVoice.current) startVoice(); }, 250);
      else setVoiceState((v) => (v === 'listening' ? 'off' : v));
    };
    try {
      r.start();
      recognizer.current = r;
      setVoiceState('listening');
    } catch {
      setVoiceState('unsupported');
    }
  }
  function stopVoice() {
    wantVoice.current = false;
    target.current = null;
    recognizer.current?.stop();
  }

  // ─── Keyboard, pedals, page turners ──────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key;
      // Space and Enter on a focused button press that button.
      if ((k === ' ' || k === 'Enter') && e.target instanceof HTMLButtonElement) return;
      const handled = () => { e.preventDefault(); e.stopPropagation(); };
      if (k === ' ' || k === 'Enter' || k === 'k' || k === 'K' || k === 'b' || k === 'B' || k === 'MediaPlayPause') { handled(); toggle(); }
      else if (k === 'ArrowDown') { handled(); nudge(1); }
      else if (k === 'ArrowUp') { handled(); nudge(-1); }
      else if (k === 'PageDown') { handled(); section(1); }
      else if (k === 'PageUp') { handled(); section(-1); }
      else if (k === 'ArrowRight' || k === '=' || k === '+') { handled(); speed(WPM.step); }
      else if (k === 'ArrowLeft' || k === '-' || k === '_') { handled(); speed(-WPM.step); }
      else if (k === 'Home') { handled(); restart(); }
      else if (k === 'r' || k === 'R') { handled(); void toggleRecord(); }
      else if (k === 'Escape') { handled(); void close(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // ─── The phone remote ────────────────────────────────────────────────
  useEffect(() => {
    remote.handler.current = (m) => {
      if (m.t === 'hello') { sendState(); return; }
      if (m.t === 'wpm') { onSettings({ ...settingsRef.current, wpm: m.v }); return; }
      const run: Record<Action, () => void> = {
        toggle, faster: () => speed(WPM.step), slower: () => speed(-WPM.step),
        back: () => nudge(-3), forward: () => nudge(3), prev: () => section(-1), next: () => section(1),
        restart, record: () => void toggleRecord(),
      };
      run[m.a]();
    };
  });
  useEffect(() => () => { remote.handler.current = null; }, [remote.handler]);

  const remainingSeconds = readingSeconds(script.words.length * (1 - progress.fraction), settings.wpm);
  function sendState() {
    remote.send({
      t: 'state', playing: playing.current || countdown > 0, wpm: settingsRef.current.wpm,
      progress: progress.fraction, remaining: remainingSeconds, section: progress.section,
      sections: script.sections, recording: Boolean(recording), canRecord,
    });
  }
  useEffect(() => {
    if (!remote.code) return;
    sendState();
    const id = setInterval(sendState, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote.code, isPlaying, countdown, settings.wpm, Math.round(progress.fraction * 100), progress.section, Boolean(recording)]);

  async function openRemote() {
    setShowRemote(true);
    remote.pair();
  }
  useEffect(() => {
    if (!showRemote || !remote.code) return;
    let live = true;
    void import('qrcode').then((QR) => QR.toString(remoteUrl(remote.code!), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })).then((svg) => { if (live) setQr(svg); });
    return () => { live = false; };
  }, [showRemote, remote.code]);

  // ─── Screen: full screen, awake ──────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    try {
      const p = root?.requestFullscreen?.({ navigationUI: 'hide' }) ?? root?.webkitRequestFullscreen?.();
      if (p instanceof Promise) p.catch(() => undefined);
    } catch { /* the overlay already covers the page */ }

    let lock: { release(): Promise<void> } | null = null;
    const wake = async () => {
      try { lock = await (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null; } catch { lock = null; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void wake(); };
    void wake();
    document.addEventListener('visibilitychange', onVisible);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    rootRef.current?.focus();
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
      document.documentElement.style.overflow = prevOverflow;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // Start button pressed: count down and go, recording first if asked.
  useEffect(() => {
    // Wait a frame so the text has been measured.
    const id = requestAnimationFrame(() => { if (record) void toggleRecord(); else play(); });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function close() {
    stop(false);
    if (recording) await toggleRecord();
    stream?.getTracks().forEach((tr) => tr.stop());
    onClose();
  }

  // ─── Touch and mouse on the text ─────────────────────────────────────
  const drag = useRef<{ x: number; y: number; start: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, start: target.current ?? y.current, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = (e.clientY - d.y) * (settings.mirrorY ? -1 : 1);
    if (!d.moved && Math.abs(dy) < 8) return;
    d.moved = true;
    target.current = null;
    y.current = Math.max(0, Math.min(layout.current.height - 1, d.start - dy));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) toggle();
  };
  const onWheel = (e: React.WheelEvent) => {
    target.current = null;
    y.current = Math.max(0, Math.min(layout.current.height - 1, y.current + e.deltaY * (settings.mirrorY ? -1 : 1)));
  };

  // ─── Render ──────────────────────────────────────────────────────────
  const mirror = `scale(${settings.mirrorX ? -1 : 1}, ${settings.mirrorY ? -1 : 1})`;
  const btn = 'inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40';
  const quiet = `${btn} bg-white/10 text-white hover:bg-white/20`;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.stageLabel}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex flex-col outline-none"
      style={{ background: theme.bg, color: theme.fg }}
    >
      {/* Text area. Mirroring flips this and the reading line together. */}
      <div
        ref={viewRef}
        className="relative flex-1 cursor-pointer touch-none select-none overflow-hidden"
        style={{ transform: mirror }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; }}
        onWheel={onWheel}
        data-testid="prompter-view"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{ top: `${settings.guide}%`, height: `${settings.fontSize * settings.lineHeight}px`, background: `${theme.em}1f`, borderTop: `2px solid ${theme.em}66` }}
        />
        <div
          ref={contentRef}
          data-testid="prompter-text"
          className="absolute inset-x-0 top-0 will-change-transform"
          style={{
            fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight, padding: `0 ${settings.margin}%`,
            textAlign: settings.align, fontWeight: 500,
          }}
        >
          {script.blocks.map((b, i) => b.kind === 'heading' ? (
            <div key={i} data-section={b.section} style={{ color: theme.muted, fontSize: '0.5em', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '1.2em 0 0.4em' }}>{b.text}</div>
          ) : (
            <p key={i} style={{ margin: '0 0 0.8em' }}>
              {b.items.map((it, j) => it.kind === 'word' ? (
                <span key={j}>{it.glue || j === 0 ? '' : ' '}<span data-w={it.glue ? undefined : it.index} style={it.em ? { color: theme.em, fontWeight: 700 } : undefined}>{it.text}</span></span>
              ) : (
                <span key={j} data-pause={it.pause ? '' : undefined} style={{ marginLeft: j === 0 ? 0 : '0.4em', color: it.pause ? '#f87171' : theme.cue, fontSize: '0.55em', verticalAlign: 'middle', border: '1px solid currentColor', borderRadius: '0.3em', padding: '0.05em 0.4em', marginRight: '0.4em' }}>{it.text}</span>
              ))}
            </p>
          ))}
          {script.words.length === 0 && <p style={{ color: theme.muted }}>{t.empty}</p>}
        </div>
        {countdown > 0 && (
          <div aria-live="assertive" className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: `${theme.bg}cc` }}>
            <span data-testid="countdown" className="font-mono text-[20vmin] font-bold tabular-nums">{countdown}</span>
          </div>
        )}
      </div>

      {/* Camera preview with a framing grid and a mic level. */}
      {stream && preview && (
        <div className="pointer-events-none absolute right-3 top-3 z-30 w-40 overflow-hidden rounded-lg border border-white/30 bg-black shadow-lg sm:w-52">
          <video ref={videoRef} autoPlay muted playsInline className="block aspect-video w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          <div aria-hidden="true" className="absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/15" />)}
          </div>
          <div className="h-1.5 bg-white/10"><div ref={meterRef} className="h-full origin-left bg-emerald-400" style={{ transform: 'scaleX(0)' }} /></div>
        </div>
      )}

      {recording && (
        <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm text-white" data-testid="rec-badge">
          <span className="size-2.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
          <span className="font-mono tabular-nums">{t.rec} {clock(elapsed)}</span>
        </div>
      )}

      {/* Controls: never mirrored, big enough for a thumb on a tablet. */}
      <div className={`z-40 border-t border-white/10 bg-black/85 px-3 py-2 text-white transition-opacity duration-300 ${isPlaying ? 'opacity-40 hover:opacity-100 focus-within:opacity-100' : 'opacity-100'}`}>
        <div className="mb-2 h-1 overflow-hidden rounded bg-white/10" aria-hidden="true">
          <div className="h-full bg-white/60" style={{ width: `${progress.fraction * 100}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggle} className={`${btn} min-w-24 bg-white text-black hover:bg-white/90`} data-testid="play">
            {isPlaying || countdown ? t.pause : t.play}
          </button>
          <button type="button" onClick={() => speed(-WPM.step)} className={quiet} aria-label={t.slower}>−</button>
          <span data-testid="wpm" className="min-w-20 text-center font-mono text-sm tabular-nums" aria-live="polite">{settings.wpm} {t.wpmUnit}</span>
          <button type="button" onClick={() => speed(WPM.step)} className={quiet} aria-label={t.faster}>+</button>
          {script.sections.length > 0 && (
            <>
              <button type="button" onClick={() => section(-1)} className={quiet} aria-label={t.prevSection}>⇤</button>
              <button type="button" onClick={() => section(1)} className={quiet} aria-label={t.nextSection}>⇥</button>
            </>
          )}
          <button type="button" onClick={restart} className={quiet}>{t.restart}</button>
          <span className="order-last basis-full truncate px-1 text-xs text-white/70 lg:order-none lg:basis-auto lg:flex-1" aria-live="polite">
            {pausedAtCue ? t.pausedAtCue : progress.section >= 0 ? script.sections[progress.section] : ''}
            {' '}<span className="font-mono tabular-nums">{t.left(clock(remainingSeconds))}</span>
            {voiceState === 'listening' && <span className="ml-2 text-emerald-300">{t.listening}</span>}
            {voiceState === 'unsupported' && <span className="ml-2 text-amber-300">{t.voiceUnsupported}</span>}
            {voiceState === 'blocked' && <span className="ml-2 text-amber-300">{t.voiceBlocked}</span>}
          </span>
          {canRecord && (
            <button type="button" onClick={() => void toggleRecord()} className={`${btn} ${recording ? 'bg-red-600 hover:bg-red-500' : 'bg-white/10 hover:bg-white/20'} text-white`} data-testid="record">
              {recording ? t.stopRecording : t.record}
            </button>
          )}
          {stream && (
            <button type="button" onClick={() => setPreview((p) => !p)} className={quiet} aria-pressed={preview}>{t.preview}</button>
          )}
          <button type="button" onClick={() => void openRemote()} className={quiet} data-testid="remote">
            {t.remote}{remote.phoneSeen ? ' ●' : ''}
          </button>
          <button type="button" onClick={() => void close()} className={quiet} data-testid="close">{t.close}</button>
        </div>
        {message && (
          <p role="status" className="mt-2 flex items-center gap-3 rounded bg-white/10 px-3 py-2 text-sm">
            <span className="flex-1">{message}</span>
            <button type="button" onClick={() => setMessage(null)} className="text-xs underline">{t.dismiss}</button>
          </p>
        )}
      </div>

      {showRemote && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowRemote(false)}>
          <div role="dialog" aria-label={t.remoteTitle} className="w-full max-w-sm rounded-xl bg-white p-5 text-black" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t.remoteTitle}</h2>
            <p className="mt-1 text-sm text-stone-600">{t.remoteHelp}</p>
            <div className="mx-auto my-4 aspect-square w-56" data-testid="remote-qr" dangerouslySetInnerHTML={qr ? { __html: qr } : undefined} />
            <p className="text-center text-sm">{t.orOpen} <span className="font-mono">{remoteHost()}</span></p>
            <p data-testid="room-code" className="mt-1 text-center font-mono text-2xl font-bold tracking-[0.2em]">{remote.code ?? '…'}</p>
            <p className="mt-3 text-center text-sm" aria-live="polite">
              {remote.phoneSeen ? t.phoneConnected : remote.status === 'open' ? t.waitingPhone : remote.status === 'offline' ? t.relayOffline : t.connecting}
            </p>
            <p className="mt-3 text-xs text-stone-500">{t.remotePrivacy}</p>
            <button type="button" onClick={() => setShowRemote(false)} className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white">{t.done}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The phone opens this; the room code rides in the fragment, which never reaches a server. */
export function remoteUrl(code: string): string {
  const ms = location.pathname.startsWith('/ms/');
  return `${location.origin}${ms ? '/ms' : ''}/media/teleprompter/remote#${code}`;
}
const remoteHost = () => `${location.host}${location.pathname.startsWith('/ms/') ? '/ms' : ''}/media/teleprompter/remote`;
