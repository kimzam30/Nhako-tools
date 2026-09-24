import { ToolError, type TextRun } from '../types';
import { sayer } from '../say';

export const run: TextRun = async (input, opts) => {
  const say = sayer(opts);
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
        { label: say('Size', 'Saiz'), value: `${size}×${size}` },
        { label: say('Correction', 'Pembetulan'), value: `${ec} (${({ L: '7', M: '15', Q: '25', H: '30' })[ec]}%)` },
        { label: say('Encoded', 'Dikodkan'), value: say(`${input.length} ch`, `${input.length} aks`) },
      ],
    };
  } catch (err) {
    throw new ToolError(
      err instanceof Error && /too big|code length/i.test(err.message)
        ? say(
          `Too much data for a QR code at error correction ${ec}. Shorten the text or lower the correction level.`,
          `Terlalu banyak data untuk kod QR pada pembetulan ralat ${ec}. Pendekkan teks atau turunkan tahap pembetulan.`,
        )
        : say('Could not generate a QR code from that input.', 'Tidak dapat menjana kod QR daripada input itu.'),
    );
  }
};
