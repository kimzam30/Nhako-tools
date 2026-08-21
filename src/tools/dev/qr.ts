import { ToolError, type TextRun } from '../types';

export const run: TextRun = async (input, opts) => {
  if (!input.trim()) return { output: '', language: 'image' };
  const QRCode = await import('qrcode');
  const size = Number(opts.size) || 512;
  const ec = String(opts.ec ?? 'M') as 'L' | 'M' | 'Q' | 'H';
  try {
    const output = await QRCode.toDataURL(input, {
      width: size,
      margin: opts.margin === false ? 0 : 2,
      errorCorrectionLevel: ec,
      color: { dark: '#000000ff', light: '#ffffffff' },
    });
    return {
      output,
      language: 'image',
      stats: [
        { label: 'Size', value: `${size}×${size}` },
        { label: 'Correction', value: `${ec} — ${({ L: '7', M: '15', Q: '25', H: '30' })[ec]}%` },
        { label: 'Encoded', value: `${input.length} ch` },
      ],
    };
  } catch (err) {
    throw new ToolError(
      err instanceof Error && /too big|code length/i.test(err.message)
        ? `Too much data for a QR code at error correction ${ec}. Shorten the text or lower the correction level.`
        : 'Could not generate a QR code from that input.',
    );
  }
};
