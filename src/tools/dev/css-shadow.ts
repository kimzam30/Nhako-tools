import type { TextRun } from '../types';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(0, 0, 0, ${alpha})`;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const run: TextRun = async (_input, opts) => {
  const { x = 0, y = 8, blur = 24, spread = -6, opacity = 18, color = '#131316', inset = false } = opts as Record<string, never> & {
    x?: number; y?: number; blur?: number; spread?: number; opacity?: number; color?: string; inset?: boolean;
  };
  const rgba = hexToRgba(String(color), Number((Number(opacity) / 100).toFixed(3)));
  const value = `${inset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px ${rgba}`;
  return {
    output: `box-shadow: ${value};`,
    language: 'css',
    preview: `box-shadow: ${value}`,
    stats: [
      { label: 'Offset', value: `${x}, ${y}` },
      { label: 'Blur', value: `${blur}px` },
      { label: 'Spread', value: `${spread}px` },
    ],
  };
};
