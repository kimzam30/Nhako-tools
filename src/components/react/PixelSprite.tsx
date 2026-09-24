import { spriteRuns, type Overrides, type SpriteName } from '../../lib/butterfly';

/**
 * A NeraOS sprite drawn as SVG runs, so it renders on the server, needs no
 * canvas, and stays pixel-sharp at any scale. Decorative everywhere it is
 * used: the words beside it always carry the meaning.
 */
export default function PixelSprite({ name, scale = 2, colors, className = '' }: {
  name: SpriteName;
  scale?: number;
  colors?: Overrides;
  className?: string;
}) {
  const { width, height, runs } = spriteRuns(name, colors);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      shapeRendering="crispEdges"
      className={`px shrink-0 ${className}`}
      aria-hidden="true"
    >
      {runs.map((r) => <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
    </svg>
  );
}
