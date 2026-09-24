import { useMemo } from 'preact/hooks';
import PixelSprite from './PixelSprite';

/**
 * The done / failed mark, in the NeraOS theme.
 *
 * Done: the butterfly pops in (NeraOS `pop`, the trash-file entrance) and
 * keeps flapping, and a short fall of square petals from the NeraOS finale
 * crosses the panel once. Failed: the butterfly shakes its head, which is
 * exactly what the NeraOS lock screen does on a wrong password.
 *
 * aria-hidden throughout. The live region in the runner already announces
 * the outcome in words, and a screen reader does not need it twice.
 */
export default function StatusMark({ kind }: { kind: 'done' | 'error' }) {
  if (kind === 'error') {
    return (
      <span className="nera-shake grid h-8 w-9 shrink-0 place-items-center" aria-hidden="true">
        <PixelSprite name="butterfly" scale={2} />
      </span>
    );
  }
  return (
    <span className="nera-pop flap grid h-8 w-9 shrink-0 place-items-center" aria-hidden="true">
      <PixelSprite name="butterfly" scale={2} />
    </span>
  );
}

/** The finale's petals, one pass across the finished panel. */
export function Petals({ count = 14 }: { count?: number }) {
  const petals = useMemo(
    () => Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      duration: 0.9 + Math.random() * 0.9,
      delay: Math.random() * 0.5,
      fall: 90 + Math.random() * 120,
    })),
    [count],
  );
  return (
    <span className="nera-petals" aria-hidden="true">
      {petals.map((p, i) => (
        <i
          key={i}
          className="nera-petal"
          style={{ left: `${p.left}%`, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`, ['--fall' as string]: `${p.fall}px` }}
        />
      ))}
    </span>
  );
}
