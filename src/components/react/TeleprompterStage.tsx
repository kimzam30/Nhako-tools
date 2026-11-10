import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  clock, followMatch, normalizeWord, pixelsPerSecond, readingSeconds, snapWpm, WPM,
  type Action, type PrompterState, type RemoteMessage, type Script,
} from '../../tools/media/teleprompter';
import { prepareRecording, startRecording, type PreparedRecording, type Recording, type Take } from '../../lib/takes';
import type { Settings } from './teleprompter-store';
import { cameraProblemText, cameraRetryable, type StageText } from './teleprompter-text';
import { currentCameraBlocker, isLive, openCamera, type OpenedCamera } from '../../lib/camera';
import TeleprompterCamera, { laneIsSide } from './TeleprompterCamera';

interface Props {
  script: Script;
  settings: Settings;
  onSettings: (s: Settings) => void;
  t: StageText;
  /** Opened from "Start and record": bring the camera up, ready to record. */
  record: boolean;
  /** Opened by the setup page, inside the Start and record tap, so the
   *  permission prompt came up over the page rather than the full-screen stage. */
  camera?: OpenedCamera | null;
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
/** Where the stage's control bar folds: a phone, then a tablet. */
const COMPACT = '(max-width: 700px), (max-height: 520px)';
const MID = '(max-width: 1179.98px)';

const speechRecognition = (): (new () => SpeechRecognitionLike) | null => {
  const w = globalThis as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
};

export default function TeleprompterStage({ script, settings, onSettings, t, record, camera = null, onClose, onTake, remote }: Props) {
  const theme = THEMES[settings.theme];
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  // The text area and the camera lane share this.
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  // The text area's width, for fitting the longest word.
  const [viewW, setViewW] = useState(0);

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
  const [stream, setStream] = useState<MediaStream | null>(camera?.stream ?? null);
  // For the handlers: a stream opened moments ago is not in their closure yet.
  const streamRef = useRef(stream);
  streamRef.current = stream;
  const [recording, setRecording] = useState<{ rec: Recording; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessageText] = useState<string | null>(camera && !camera.audio ? t.cameraNoMic : null);
  // The message is a camera problem that one more tap may fix. Any other
  // message replaces it, Try again included.
  const [cameraRetry, setCameraRetry] = useState(false);
  const setMessage = (m: string | null) => { setMessageText(m); setCameraRetry(false); };
  // The preview's play() was refused (iOS Low Power Mode blocks even muted autoplay).
  const [needsTap, setNeedsTap] = useState(false);
  // The picture's real shape. A phone's front camera films portrait
  // (1080 x 1920 on the Android emulator), which a fixed 16:9 box cropped to a
  // strip across the presenter's eyes.
  const [aspect, setAspect] = useState(16 / 9);
  const [voiceState, setVoiceState] = useState<'off' | 'listening' | 'unsupported' | 'blocked' | 'offline'>('off');
  const [showRemote, setShowRemote] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  // Nothing scrolls or records until asked, so the first screen says what to do.
  const [started, setStarted] = useState(false);
  // A phone has room for a few big controls, not eleven. On a narrow or short
  // screen the secondary ones move behind More, so the script keeps the screen.
  // A tablet (an iPad in landscape is 1024 wide) fits one row of controls only
  // if the setup ones, Camera and Phone remote, wait behind More too.
  // Read on the first render: the stage only ever opens in the browser, and
  // waiting for an effect painted one frame of the full bar before it folded.
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT).matches);
  const [mid, setMid] = useState(() => window.matchMedia(MID).matches);
  const [showMore, setShowMore] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT);
    const mm = window.matchMedia(MID);
    const apply = () => { setCompact(mq.matches); setMid(mm.matches); };
    apply();
    mq.addEventListener('change', apply);
    mm.addEventListener('change', apply);
    return () => { mq.removeEventListener('change', apply); mm.removeEventListener('change', apply); };
  }, []);

  const normWords = useMemo(() => script.words.map(normalizeWord), [script]);

  // A word wider than the screen was cut off mid-word ("internati"), so the
  // text shrinks until the longest word fits. Breaking a word is worse read
  // aloud than a smaller font; it only happens past half the chosen size.
  const widestWord = useMemo(() => {
    const family = typeof window !== 'undefined' && rootRef.current ? getComputedStyle(rootRef.current).fontFamily : 'sans-serif';
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return 0;
    ctx.font = `700 100px ${family}`;
    let max = 0;
    for (const w of script.words) max = Math.max(max, ctx.measureText(w).width);
    return max / 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, viewW > 0]);
  const textRoom = viewW * (1 - (2 * settings.margin) / 100);
  const fontSize = widestWord > 0 && textRoom > 0
    ? Math.max(Math.min(settings.fontSize, 24), Math.min(settings.fontSize, Math.max(settings.fontSize * 0.5, Math.floor((textRoom * 0.97) / widestWord))))
    : settings.fontSize;
  const fontRef = useRef(fontSize);
  fontRef.current = fontSize;
  const canRecord = currentCameraBlocker() === null;

  // ─── Layout ──────────────────────────────────────────────────────────
  const measure = useCallback(() => {
    const c = contentRef.current;
    const v = viewRef.current;
    if (!c || !v) return;
    const tops = (sel: string) => [...c.querySelectorAll<HTMLElement>(sel)].map((el) => el.offsetTop);
    const old = layout.current;
    const next = {
      height: c.scrollHeight,
      view: v.clientHeight,
      sections: tops('[data-section]'),
      pauses: tops('[data-pause]'),
      words: tops('[data-w]'),
    };
    // A reflow (camera moved, font fitted, phone turned) moves every line.
    // Keep the word on the reading line where it was, not the pixel offset.
    if (old.words.length === next.words.length && old.words.length > 0 && y.current > 0) {
      const i = wordAt(y.current);
      const before = old.words[i];
      const after = next.words[i];
      if (before !== undefined && after !== undefined && before !== after) {
        y.current = Math.max(0, after + (y.current - before) * (next.height / Math.max(1, old.height)));
        target.current = null;
      } else if (before === undefined && old.height > 1) {
        y.current = (y.current / old.height) * next.height;
      }
    }
    layout.current = next;
    setViewW(v.clientWidth);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (contentRef.current) ro.observe(contentRef.current);
    if (viewRef.current) ro.observe(viewRef.current);
    return () => ro.disconnect();
  }, [measure, script, fontSize, settings.lineHeight, settings.margin, settings.align]);

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

  // A take opened for Play and record, waiting for the countdown to end.
  const pendingTake = useRef<PreparedRecording | null>(null);
  const [takeWaiting, setTakeWaiting] = useState(false);

  function stop(atCue: boolean) {
    clearInterval(countdownTimer.current);
    setCountdown(0);
    if (pendingTake.current) { void pendingTake.current.cancel(); pendingTake.current = null; }
    setTakeWaiting(false);
    playing.current = false;
    setIsPlaying(false);
    setPausedAtCue(atCue);
    stopVoice();
  }

  /** Scroll, after the countdown. With `take`, the recording starts on the same tick. */
  function play(take?: PreparedRecording) {
    if (playing.current || countdown) return;
    setStarted(true);
    setPausedAtCue(false);
    const L = layout.current;
    if (y.current >= L.height - 2) { y.current = 0; armed.current.clear(); }
    pendingTake.current = take ?? null;
    setTakeWaiting(Boolean(take));
    const go = () => {
      if (take) {
        pendingTake.current = null;
        setTakeWaiting(false);
        try {
          setRecording({ rec: take.start(), started: Date.now() });
        } catch {
          void take.cancel();
          setMessage(t.recordUnsupported);
          return;
        }
      }
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
  const lineStep = () => fontRef.current * settingsRef.current.lineHeight;
  const nudge = (lines: number) => jumpTo((target.current ?? y.current) + lines * lineStep());
  const section = (dir: 1 | -1) => {
    const s = layout.current.sections;
    const here = target.current ?? y.current;
    const next = dir > 0 ? s.find((top) => top > here + 4) : [...s].reverse().find((top) => top < here - 4);
    jumpTo(next ?? (dir > 0 ? layout.current.height - 1 : 0));
  };
  const restart = () => { stop(false); armed.current.clear(); jumpTo(0); };
  // Nudging from an exact speed set by a target length (143) lands back on the
  // step grid (150), rather than carrying the odd number along.
  const speed = (delta: number) => onSettings({ ...settingsRef.current, wpm: snapWpm(settingsRef.current.wpm + delta) });

  // ─── Camera, meter, recording ────────────────────────────────────────
  // One request at a time. Start and record opens the camera as the stage
  // mounts, and a Record pressed during the permission prompt used to ask a
  // second time; on iOS the second capture mutes the first, and the preview
  // stayed black.
  const opening = useRef<Promise<MediaStream | null> | null>(null);

  function cameraFailed(e: unknown) {
    setMessage(cameraProblemText(t, e));
    setCameraRetry(cameraRetryable(e));
  }

  function ensureCamera(): Promise<MediaStream | null> {
    if (isLive(streamRef.current)) return Promise.resolve(streamRef.current);
    if (opening.current) return opening.current;
    const blocker = currentCameraBlocker();
    if (blocker) { cameraFailed(blocker); return Promise.resolve(null); }
    opening.current = openCamera().then(
      (cam) => {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = cam.stream;
        setStream(cam.stream);
        setPreview(true);
        setMessage(cam.audio ? null : t.cameraNoMic);
        return cam.stream;
      },
      (e: unknown) => { cameraFailed(e); return null; },
    ).finally(() => { opening.current = null; });
    return opening.current;
  }

  // The picture. autoplay alone is not enough on a phone: iOS in Low Power
  // Mode refuses even a muted autoplay, and an element that mounted before
  // the stream arrived never starts. So: attach, play, and if play is
  // refused, show a button, because a tap is always allowed to start it.
  useEffect(() => {
    const v = videoRef.current;
    if (!stream || !preview || !v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play().then(() => setNeedsTap(false), () => setNeedsTap(true));
  }, [stream, preview]);

  // A camera can go away under the page: another app takes it, or the phone
  // stops it while the browser is in the background. An ended track is a
  // black box forever, so drop it and say so.
  useEffect(() => {
    if (!stream) return;
    const tracks = stream.getVideoTracks();
    const onEnded = () => {
      if (streamRef.current !== stream) return;
      streamRef.current = null;
      setStream(null);
      setMessage(t.cameraStopped);
      setCameraRetry(true);
    };
    tracks.forEach((tr) => tr.addEventListener('ended', onEnded));
    return () => tracks.forEach((tr) => tr.removeEventListener('ended', onEnded));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  // Back from the home screen or another app, a phone may hand back a track
  // that is still muted or already ended. Permission was given, so opening it
  // again is silent. Not while recording: the take is tied to the old stream.
  const recordingRef = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s = streamRef.current;
        if (!s || recordingRef.current) return;
        const video = s.getVideoTracks()[0];
        if (video && video.readyState === 'live' && !video.muted) return;
        s.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        void ensureCamera();
      }, 600);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stream) return;
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
  }, [stream]);

  // A second press while the camera or file is still opening would open two takes.
  const busy = useRef(false);

  /** Record, or stop recording. The scroll is left alone: that is Play's job. */
  async function toggleRecord() {
    if (recording) {
      const r = recording;
      setRecording(null);
      try {
        const take = await r.rec.stop();
        onTake(take);
        setMessage(take.saved ? t.takeSaved(take.name) : t.takeInMemory(take.name));
      } catch {
        setMessage(t.recordFailed);
      }
      return;
    }
    if (busy.current) return;
    if (!canRecord) { cameraFailed(currentCameraBlocker()); return; }
    busy.current = true;
    try {
      const s = await ensureCamera();
      if (!s) return;
      const rec = await startRecording(s, () => setMessage(t.recordFailed));
      setStarted(true);
      setRecording({ rec, started: Date.now() });
      setMessage(null);
    } catch {
      setMessage(t.recordUnsupported);
    } finally {
      busy.current = false;
    }
  }

  /**
   * Play and record: one countdown, then the recorder and the scroll start on
   * the same tick, so the take opens on the first line rather than on a few
   * seconds of countdown. Pressed again, it stops both and saves the take.
   */
  async function playRecord() {
    if (recording) { stop(false); await toggleRecord(); return; }
    if (countdown) { stop(false); return; }
    if (busy.current) return;
    if (!canRecord) { cameraFailed(currentCameraBlocker()); return; }
    busy.current = true;
    try {
      // The camera and the file first: a permission prompt must not eat the countdown.
      const s = await ensureCamera();
      if (!s) return;
      const take = await prepareRecording(s, () => setMessage(t.recordFailed));
      stop(false);
      setMessage(null);
      play(take);
    } catch {
      setMessage(t.recordUnsupported);
    } finally {
      busy.current = false;
    }
  }
  recordingRef.current = Boolean(recording);
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - recording.started) / 1000)), 500);
    return () => clearInterval(id);
  }, [recording]);

  // ─── Voice-follow ────────────────────────────────────────────────────
  const recognizer = useRef<SpeechRecognitionLike | null>(null);
  const wantVoice = useRef(false);
  const voiceRetry = useRef(250);

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
      voiceRetry.current = 250;
      setVoiceState('listening');
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
    let failed = false;
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { wantVoice.current = false; setVoiceState('blocked'); }
      // No speech service (offline, or it refused): restarting at once looped
      // four times a second forever while the screen still said Listening.
      else if (e.error === 'network' || e.error === 'audio-capture' || e.error === 'language-not-supported') { failed = true; setVoiceState('offline'); }
    };
    // Recognition ends itself after silence; keep it going while wanted. A
    // failure backs off, doubling up to 8 seconds, and a result resets it.
    r.onend = () => {
      recognizer.current = null;
      voiceRetry.current = failed ? Math.min(8000, Math.max(500, voiceRetry.current * 2)) : 250;
      if (wantVoice.current) setTimeout(() => { if (wantVoice.current) startVoice(); }, voiceRetry.current);
      else setVoiceState((v) => (v === 'listening' ? 'off' : v));
    };
    try {
      r.start();
      recognizer.current = r;
      setVoiceState((v) => (v === 'offline' ? v : 'listening'));
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
      // The phone-remote dialog is on top: Esc closes it, not the whole stage
      // (and with it a take that is recording), and nothing else reaches the stage.
      if (showRemote) {
        if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); setShowRemote(false); }
        // Tab goes round the dialog's own controls rather than out of the page.
        else if (k === 'Tab') {
          const box = remoteDone.current?.closest('[role=dialog]');
          const items = [...(box?.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])') ?? [])];
          if (items.length) {
            e.preventDefault();
            const i = items.indexOf(document.activeElement as HTMLElement);
            items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]!.focus();
          }
        }
        return;
      }
      retryFullscreen();
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
  const remoteDone = useRef<HTMLButtonElement>(null);
  const remoteOpener = useRef<Element | null>(null);
  useEffect(() => {
    if (!showRemote) return;
    remoteOpener.current = document.activeElement;
    remoteDone.current?.focus();
    // Everything behind the dialog leaves the Tab order while it is open.
    const behind = [...(rootRef.current?.children ?? [])].filter((el) => !el.contains(remoteDone.current));
    behind.forEach((el) => el.setAttribute('inert', ''));
    return () => {
      behind.forEach((el) => el.removeAttribute('inert'));
      (remoteOpener.current as HTMLElement | null)?.focus?.();
    };
  }, [showRemote]);
  useEffect(() => {
    if (!showRemote || !remote.code) return;
    let live = true;
    void import('qrcode').then((QR) => QR.toString(remoteUrl(remote.code!), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })).then((svg) => { if (live) setQr(svg); });
    return () => { live = false; };
  }, [showRemote, remote.code]);

  // ─── Screen: full screen, awake ──────────────────────────────────────
  // A browser goes full screen only inside a tap. Start and record opens the
  // stage after the camera prompt, and if that prompt waited a few seconds
  // for an answer, the tap had expired (the Flip 5 stayed in its browser
  // bars). So a refused request is asked again on the stage's next tap or key.
  const fsWanted = useRef(false);
  function goFullscreen() {
    const root = rootRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    if (!root || doc.fullscreenElement || doc.webkitFullscreenElement) { fsWanted.current = false; return; }
    try {
      const p = root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.();
      if (p instanceof Promise) {
        fsWanted.current = false;
        p.catch(() => { fsWanted.current = true; });
      }
    } catch { fsWanted.current = true; /* the overlay already covers the page */ }
  }
  function retryFullscreen() { if (fsWanted.current) goFullscreen(); }
  useEffect(() => {
    goFullscreen();

    // The page behind stays out of reach of Tab and of a screen reader.
    const inerted: Element[] = [];
    for (let n: Element | null = rootRef.current; n && n !== document.body; n = n.parentElement) {
      for (const sib of n.parentElement?.children ?? []) {
        if (sib !== n && !sib.hasAttribute('inert')) { sib.setAttribute('inert', ''); inerted.push(sib); }
      }
    }

    let lock: { release(): Promise<void> } | null = null;
    const wake = async () => {
      try { lock = await (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null; } catch { lock = null; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void wake(); };
    void wake();
    document.addEventListener('visibilitychange', onVisible);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    // The site keeps a scrollbar gutter, and a fixed element stops short of it:
    // a 15 px strip of the page showed down the stage's right edge.
    const prevGutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.scrollbarGutter = 'auto';
    rootRef.current?.focus();
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
      document.documentElement.style.overflow = prevOverflow;
      document.documentElement.style.scrollbarGutter = prevGutter;
      inerted.forEach((el) => el.removeAttribute('inert'));
      // Whichever API took us in has to take us out. A Safari old enough to
      // have only the prefixed one would otherwise stay full screen after
      // Close, with the page behind it and no way back but the Esc key.
      const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
      if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => undefined);
      else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
    };
  }, []);

  // Opened from "Start and record": bring the camera up so the shot can be
  // framed and the mic checked. Nothing scrolls and nothing records until the
  // presenter says so: they may still be setting up the phone remote.
  useEffect(() => {
    if (record) void ensureCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android's Back (and a browser's back gesture) landed on the page behind the
  // stage, so backing out of a take dropped you off the tool entirely. An extra
  // history entry turns that gesture into Close.
  const closeRef = useRef<() => void>(() => undefined);
  closeRef.current = () => void close();
  // A layout effect, so the entry exists before the stage is on screen: a Back
  // pressed in its first frame otherwise skipped it and left the tool.
  useLayoutEffect(() => {
    history.pushState({ nhakoStage: true }, '');
    const onPop = () => closeRef.current();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed some other way: take our entry back out, so one Back press does
      // not land the presenter on the page they were on before opening it.
      if ((history.state as { nhakoStage?: boolean } | null)?.nhakoStage) history.back();
    };
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

  // ─── Camera lane ─────────────────────────────────────────────────────
  const laneShown = Boolean(stream && preview);
  const laneSide = laneIsSide(area);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const read = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────
  const mirror = `scale(${settings.mirrorX ? -1 : 1}, ${settings.mirrorY ? -1 : 1})`;
  const btn = 'inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40';
  const quiet = `${btn} bg-white/10 text-white hover:bg-white/20`;
  // Each lives on the bar or behind More, depending on the screen.
  const sectionButtons = script.sections.length > 0 && (
    <>
      <button type="button" onClick={() => section(-1)} className={quiet} aria-label={t.prevSection}>⇤</button>
      <button type="button" onClick={() => section(1)} className={quiet} aria-label={t.nextSection}>⇥</button>
    </>
  );
  const restartButton = <button type="button" onClick={restart} className={quiet}>{t.restart}</button>;
  // With no camera yet (opened with plain Start, or after a refusal) this is
  // the way to ask for it, from a tap, which is where every browser prompts.
  const cameraButton = canRecord && (
    <button
      type="button"
      onClick={() => (isLive(stream) ? setPreview((p) => !p) : void ensureCamera())}
      className={quiet} aria-pressed={isLive(stream) && preview} data-testid="camera"
    >
      {t.preview}
    </button>
  );
  const remoteButton = (
    <button type="button" onClick={() => void openRemote()} className={quiet} data-testid="remote">
      {t.remote}{remote.phoneSeen ? ' ●' : ''}
    </button>
  );

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.stageLabel}
      tabIndex={-1}
      onPointerDownCapture={retryFullscreen}
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col outline-none"
      style={{ background: theme.bg, color: theme.fg }}
    >
      {/* The text area and, when the camera is up, its lane: side by side on a
          wide stage, stacked on a tall one, never on top of each other. */}
      <div ref={areaRef} className="relative flex min-h-0 flex-1 overflow-hidden" style={{ flexDirection: laneSide ? 'row' : 'column' }}>
      {/* Text area. Mirroring flips this and the reading line together. */}
      <div
        ref={viewRef}
        className="relative min-h-0 min-w-0 flex-1 cursor-pointer touch-none select-none overflow-hidden"
        style={{ transform: mirror }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; }}
        onWheel={onWheel}
        data-testid="prompter-view"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{ top: `${settings.guide}%`, height: `${fontSize * settings.lineHeight}px`, background: `${theme.em}1f`, borderTop: `2px solid ${theme.em}66` }}
        />
        <div
          ref={contentRef}
          data-testid="prompter-text"
          className="absolute inset-x-0 top-0 will-change-transform"
          style={{
            fontSize: `${fontSize}px`, lineHeight: settings.lineHeight, padding: `0 ${settings.margin}%`,
            textAlign: settings.align, fontWeight: 500, overflowWrap: 'anywhere',
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
        {/* Before the first Play, in the empty space above the reading line,
            where the script has not arrived yet: over the bottom lines it hid
            the very text the presenter was about to read. Not in the bar: a
            line that comes and goes there would resize the text area and move
            the reading line just as the script starts. Mirrored back so it
            reads the right way round on a beam-splitter rig. */}
        {!started && (
          <p className="pointer-events-none absolute inset-x-0 top-3 z-10 px-3 text-center" style={{ transform: mirror }} data-testid="ready-hint">
            <span className="inline-block max-w-xl rounded-2xl bg-black/75 px-4 py-2 text-sm leading-snug text-white">
              {record && stream ? t.readyRecord : t.readyPlay}
            </span>
          </p>
        )}
        {countdown > 0 && (
          <div aria-live="assertive" className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: `${theme.bg}cc` }}>
            <span data-testid="countdown" className="font-mono text-[20vmin] font-bold tabular-nums">{countdown}</span>
          </div>
        )}
      </div>

      {laneShown && (
        <TeleprompterCamera
          corner={settings.camCorner}
          onCorner={(c) => onSettings({ ...settingsRef.current, camCorner: c })}
          onHide={() => setPreview(false)}
          areaRef={areaRef} area={area} aspect={aspect} onAspect={setAspect}
          videoRef={videoRef} meterRef={meterRef}
          needsTap={needsTap}
          onTapPlay={() => { void videoRef.current?.play().then(() => setNeedsTap(false), () => undefined); }}
          rec={recording ? `${t.rec} ${clock(elapsed)}` : null}
          fg={theme.fg} t={t}
        />
      )}
      </div>

      {/* Controls: never mirrored, big enough for a thumb on a tablet, and
          clear of the home indicator and a landscape notch (the page is
          viewport-fit=cover, so the system no longer keeps them clear). */}
      <div className={`relative z-40 border-t border-white/10 bg-black/85 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-2 text-white transition-opacity duration-300 ${isPlaying ? 'opacity-70 hover:opacity-100 focus-within:opacity-100' : 'opacity-100'}`}>
        <div className="mb-1.5 h-1 overflow-hidden rounded bg-white/10" aria-hidden="true">
          <div className="h-full bg-white/60" style={{ width: `${progress.fraction * 100}%` }} />
        </div>
        {/* One line of its own, always. Sharing the button row meant it took a
            whole row anyway below lg, and a line that comes and goes resizes
            the text area under it. */}
        {/* Not a live region: the time left changes every second, and a screen
            reader read it out over the script. The changes worth hearing are below. */}
        <span className="sr-only" aria-live="polite" data-testid="status-live">
          {pausedAtCue ? t.pausedAtCue : ''}
          {voiceState === 'unsupported' ? t.voiceUnsupported : voiceState === 'blocked' ? t.voiceBlocked : voiceState === 'offline' ? t.voiceOffline : ''}
        </span>
        <span className="mb-1.5 block truncate px-1 text-xs text-white/80" data-testid="status">
          {recording && !laneShown && (
            <span className="mr-2 inline-flex items-center gap-1.5 text-white" data-testid="rec-badge">
              <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
              <span className="font-mono tabular-nums">{t.rec} {clock(elapsed)}</span>
            </span>
          )}
          {pausedAtCue ? t.pausedAtCue : progress.section >= 0 ? script.sections[progress.section] : ''}
          {' '}<span className="font-mono tabular-nums">{t.left(clock(remainingSeconds))}</span>
          {voiceState === 'listening' && <span className="ml-2 text-emerald-300">{t.listening}</span>}
          {voiceState === 'unsupported' && <span className="ml-2 text-amber-300">{t.voiceUnsupported}</span>}
          {voiceState === 'blocked' && <span className="ml-2 text-amber-300">{t.voiceBlocked}</span>}
          {voiceState === 'offline' && <span className="ml-2 text-amber-300" data-testid="voice-offline">{t.voiceOffline}</span>}
        </span>
        {(compact || mid) && showMore && (
          <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-white/10 pb-2" data-testid="more-tray">
            {compact && sectionButtons}
            {compact && restartButton}
            {cameraButton}
            {remoteButton}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* The three ways to go, together: scroll, record, or both at once. */}
          <button type="button" onClick={toggle} className={`${btn} ${compact ? '' : 'min-w-24'} bg-white text-black hover:bg-white/90`} data-testid="play">
            {isPlaying || countdown ? t.pause : t.play}
          </button>
          {canRecord && (
            // On a phone this one is just the red dot (or the stop square): it
            // is the mark every camera uses, and the row then fits in two lines.
            <button
              type="button" onClick={() => void toggleRecord()} aria-pressed={Boolean(recording)}
              aria-label={compact ? (recording ? t.stopRecording : t.record) : undefined}
              title={compact ? (recording ? t.stopRecording : t.record) : undefined}
              className={`${btn} gap-2 text-white ${recording ? 'bg-red-600 hover:bg-red-500' : 'border border-red-500 bg-white/10 hover:bg-white/20'}`}
              data-testid="record"
            >
              {recording ? <StopMark /> : <RecMark className="text-red-500" />}
              {!compact && (recording ? t.stopRecording : t.record)}
            </button>
          )}
          {canRecord && (
            <button
              type="button" onClick={() => void playRecord()}
              className={`${btn} gap-2 text-white ${recording || takeWaiting ? 'border border-red-500 bg-white/10 hover:bg-white/20' : 'bg-red-600 hover:bg-red-500'}`}
              data-testid="play-record"
            >
              {recording || takeWaiting ? <StopMark /> : <><PlayMark /><RecMark /></>}
              {recording || takeWaiting ? t.stopBoth : t.playRecord}
            </button>
          )}
          {/* Slower, the speed, faster: wraps as one, never split across rows. */}
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => speed(-WPM.step)} className={quiet} aria-label={t.slower}>−</button>
            <span data-testid="wpm" className={`${compact ? 'min-w-16 text-xs' : 'min-w-20 text-sm'} text-center font-mono tabular-nums`} aria-live="polite">{settings.wpm} {t.wpmUnit}</span>
            <button type="button" onClick={() => speed(WPM.step)} className={quiet} aria-label={t.faster}>+</button>
          </span>
          {!compact && sectionButtons}
          {!compact && restartButton}
          {!compact && !mid && cameraButton}
          {!compact && !mid && remoteButton}
          {(compact || mid) && (
            <button type="button" onClick={() => setShowMore((m) => !m)} className={quiet} aria-expanded={showMore} data-testid="more">
              {t.more}
            </button>
          )}
          <button type="button" onClick={() => void close()} className={quiet} data-testid="close">{t.close}</button>
        </div>
        {message && (
          <p role="status" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-white/10 px-3 py-2 text-sm" data-testid="stage-message">
            <span className="min-w-0 flex-1 basis-60">{message}</span>
            <span className="flex items-center gap-2">
              {cameraRetry && (
                <button type="button" onClick={() => void ensureCamera()} className={`${btn} min-h-11 bg-white text-black hover:bg-white/90`} data-testid="camera-retry">
                  {t.tryAgain}
                </button>
              )}
              <button type="button" onClick={() => setMessage(null)} className="min-h-11 px-2 text-xs underline">{t.dismiss}</button>
            </span>
          </p>
        )}
      </div>

      {showRemote && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowRemote(false)}>
          <div role="dialog" aria-modal="true" aria-label={t.remoteTitle} className="w-full max-w-sm rounded-xl bg-white p-5 text-black" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t.remoteTitle}</h2>
            <p className="mt-1 text-sm text-stone-600">{t.remoteHelp}</p>
            <div className="mx-auto my-4 aspect-square w-56" data-testid="remote-qr" dangerouslySetInnerHTML={qr ? { __html: qr } : undefined} />
            <p className="text-center text-sm">{t.orOpen} <span className="font-mono">{remoteHost()}</span></p>
            <p data-testid="room-code" className="mt-1 text-center font-mono text-2xl font-bold tracking-[0.2em]">{remote.code ?? '…'}</p>
            <p className="mt-3 text-center text-sm" aria-live="polite">
              {remote.phoneSeen ? t.phoneConnected : remote.status === 'open' ? t.waitingPhone : remote.status === 'offline' ? t.relayOffline : t.connecting}
            </p>
            <p className="mt-3 text-xs text-stone-500">{t.remotePrivacy}</p>
            <button ref={remoteDone} type="button" onClick={() => setShowRemote(false)} className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white">{t.done}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Marks for the record controls. Drawn, not typed: a ● or ▶ character takes
// its size and weight from whatever font the device falls back to.
const PlayMark = () => (
  <svg aria-hidden="true" viewBox="0 0 10 10" className="size-3 shrink-0"><path d="M1.5 0.8v8.4L9 5z" fill="currentColor" /></svg>
);
const RecMark = ({ className = '' }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 10 10" className={`size-3 shrink-0 ${className}`}><circle cx="5" cy="5" r="4.5" fill="currentColor" /></svg>
);
const StopMark = () => (
  <svg aria-hidden="true" viewBox="0 0 10 10" className="size-3 shrink-0"><rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor" /></svg>
);

/** The phone opens this; the room code rides in the fragment, which never reaches a server. */
export function remoteUrl(code: string): string {
  const ms = location.pathname.startsWith('/ms/');
  return `${location.origin}${ms ? '/ms' : ''}/media/teleprompter/remote#${code}`;
}
const remoteHost = () => `${location.host}${location.pathname.startsWith('/ms/') ? '/ms' : ''}/media/teleprompter/remote`;
