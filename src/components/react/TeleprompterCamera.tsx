import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { CAM_CORNERS, type CamCorner } from './teleprompter-store';
import type { StageText } from './teleprompter-text';

/**
 * The camera preview's own lane beside the script. The script never runs
 * under the picture: on a wide stage the lane is a column at one side, on a
 * tall one (a phone, the Flip's cover screen) a band across the top or
 * bottom, and the text area shrinks to fit beside it. The picture docks in
 * one of four corners; drag it and it snaps to the nearest, or use Move.
 */

interface Props {
  corner: CamCorner;
  onCorner: (c: CamCorner) => void;
  onHide: () => void;
  /** The stage area the lane and the script share, for the drop target. */
  areaRef: RefObject<HTMLDivElement | null>;
  area: { w: number; h: number };
  aspect: number;
  onAspect: (a: number) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  meterRef: RefObject<HTMLDivElement | null>;
  needsTap: boolean;
  onTapPlay: () => void;
  /** "REC 0:12" while a take runs, else null. */
  rec: string | null;
  fg: string;
  t: StageText;
}

const GAP = 12;
const CTRL = 44;
/** Move and Hide side by side: the narrowest a side lane can be. */
const CTRLS_W = CTRL * 2 + 8;

/** Side lane on a wide stage, band on a tall one. */
export const laneIsSide = (area: { w: number; h: number }) => area.w >= area.h;

/** The picture's size in the lane: big enough to frame a shot, never the script's room. */
export function cameraSize(area: { w: number; h: number }, aspect: number): { w: number; h: number } {
  if (area.w <= 0 || area.h <= 0) return { w: 0, h: 0 };
  if (laneIsSide(area)) {
    // Leave room under the picture for its controls.
    const w = Math.min(area.w * 0.28, (area.h - CTRL - GAP * 3) * aspect, 320);
    return { w: Math.max(0, Math.round(w)), h: Math.max(0, Math.round(w / aspect)) };
  }
  const h = Math.min(area.h * 0.22, (area.w * 0.45) / aspect, 240);
  return { w: Math.max(0, Math.round(h * aspect)), h: Math.max(0, Math.round(h)) };
}

const nearest = (x: number, y: number, r: DOMRect): CamCorner =>
  `${y < r.top + r.height / 2 ? 't' : 'b'}${x < r.left + r.width / 2 ? 'l' : 'r'}` as CamCorner;

export default function TeleprompterCamera({
  corner, onCorner, onHide, areaRef, area, aspect, onAspect, videoRef, meterRef, needsTap, onTapPlay, rec, fg, t,
}: Props) {
  const side = laneIsSide(area);
  const size = cameraSize(area, aspect);
  const top = corner[0] === 't';
  const left = corner[1] === 'l';
  const next = CAM_CORNERS[(CAM_CORNERS.indexOf(corner) + 1) % CAM_CORNERS.length]!;

  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const [target, setTarget] = useState<CamCorner | null>(null);
  const [announce, setAnnounce] = useState('');
  // Where the picture was let go, so it can glide from there to its new slot.
  const from = useRef<DOMRect | null>(null);

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useLayoutEffect(() => {
    const el = boxRef.current;
    const f = from.current;
    from.current = null;
    if (!el || !f) return;
    const to = el.getBoundingClientRect();
    el.style.transition = 'none';
    el.style.transform = `translate(${f.left - to.left}px, ${f.top - to.top}px)`;
    if (reduced()) { el.style.transform = ''; return; }
    void el.offsetWidth;
    el.style.transition = 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = '';
  }, [corner]);

  const moveTo = (c: CamCorner) => {
    setAnnounce(t.cameraMovedTo(t.corners[c]));
    onCorner(c);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = boxRef.current;
    const areaEl = areaRef.current;
    if (!d || d.id !== e.pointerId || !el || !areaEl) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    setTarget(nearest(e.clientX, e.clientY, areaEl.getBoundingClientRect()));
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>, drop: boolean) => {
    const d = drag.current;
    drag.current = null;
    setTarget(null);
    const el = boxRef.current;
    const areaEl = areaRef.current;
    if (!d || !d.moved || !el) return;
    from.current = el.getBoundingClientRect();
    const c = drop && areaEl ? nearest(e.clientX, e.clientY, areaEl.getBoundingClientRect()) : corner;
    if (c !== corner) { moveTo(c); return; }
    // Dropped back on its own corner: glide home from where it was let go.
    el.style.transform = '';
    const f = from.current;
    from.current = null;
    const to = el.getBoundingClientRect();
    el.style.transform = `translate(${f.left - to.left}px, ${f.top - to.top}px)`;
    if (reduced()) { el.style.transform = ''; return; }
    void el.offsetWidth;
    el.style.transition = 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = '';
  };

  const ctrl = 'inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors';
  const ctrlStyle = { background: `${fg}14`, color: fg };

  // The drop hint: where the picture lands if let go now.
  const hint = target && (() => {
    const s = { width: size.w, height: size.h };
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-30 rounded-lg border-2 border-dashed"
        style={{
          ...s, borderColor: `${fg}80`,
          [target[0] === 't' ? 'top' : 'bottom']: GAP, [target[1] === 'l' ? 'left' : 'right']: GAP,
        }}
        data-testid="camera-drop-hint"
      />
    );
  })();

  return (
    <>
      <div
        className="relative flex shrink-0"
        style={{
          order: (side ? left : top) ? -1 : 1,
          flexDirection: side ? (top ? 'column' : 'column-reverse') : (left ? 'row' : 'row-reverse'),
          alignItems: side ? (left ? 'flex-start' : 'flex-end') : 'center',
          gap: GAP,
          padding: GAP,
          ...(side ? { width: Math.max(size.w, CTRLS_W) + GAP * 2 } : { height: size.h + GAP * 2 }),
        }}
        data-testid="camera-lane"
        data-corner={corner}
      >
        <div
          ref={boxRef}
          className="relative z-40 shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-lg border border-white/25 bg-black shadow-[0_6px_20px_rgb(0_0_0/0.35)] active:cursor-grabbing"
          style={{ width: size.w, height: size.h }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, true)}
          onPointerCancel={(e) => endDrag(e, false)}
          data-testid="camera-preview"
        >
          <video
            ref={videoRef} autoPlay muted playsInline disablePictureInPicture
            onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) onAspect(v.videoWidth / v.videoHeight); }}
            onResize={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) onAspect(v.videoWidth / v.videoHeight); }}
            className="pointer-events-none block size-full object-cover" style={{ transform: 'scaleX(-1)' }}
          />
          {needsTap && (
            <button
              type="button" onClick={onTapPlay}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 px-2 text-center text-xs font-medium text-white"
              data-testid="camera-tap"
            >
              {t.cameraTap}
            </button>
          )}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/15" />)}
          </div>
          {rec && (
            // On the picture, where the eye already is when checking the take.
            <span className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/75 px-2 py-0.5 text-xs text-white" data-testid="rec-badge">
              <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
              <span className="font-mono tabular-nums">{size.w < 120 ? rec.replace(/^\S+\s/, '') : rec}</span>
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40"><div ref={meterRef} className="h-full origin-left bg-emerald-400" style={{ transform: 'scaleX(0)' }} /></div>
        </div>

        <div
          className="flex shrink-0 items-center gap-2"
          style={{ flexDirection: left ? 'row' : 'row-reverse' }}
        >
          <button
            type="button" onClick={() => moveTo(next)} className={ctrl} style={ctrlStyle}
            aria-label={t.moveCamera(t.corners[next])} title={t.moveCamera(t.corners[next])} data-testid="camera-move"
          >
            <MoveMark />
          </button>
          <button
            type="button" onClick={onHide} className={ctrl} style={ctrlStyle}
            aria-label={t.hideCamera} title={t.hideCamera} data-testid="camera-hide"
          >
            <HideMark />
          </button>
        </div>
        <span className="sr-only" aria-live="polite">{announce}</span>
      </div>
      {hint}
    </>
  );
}

// Drawn, like the stage's other marks: four arrows out from the centre, and a slashed lens.
const MoveMark = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2.5v15M2.5 10h15M10 2.5 7.8 4.7M10 2.5l2.2 2.2M10 17.5l-2.2-2.2M10 17.5l2.2-2.2M2.5 10l2.2-2.2M2.5 10l2.2 2.2M17.5 10l-2.2-2.2M17.5 10l-2.2 2.2" />
  </svg>
);
const HideMark = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="5.5" width="10.5" height="9" rx="1.5" /><path d="m13 8.5 4.5-2.5v8L13 11.5M2.5 3l15 14" />
  </svg>
);
