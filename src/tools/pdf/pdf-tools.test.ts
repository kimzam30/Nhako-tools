import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { ToolError } from '../types';
import { run as watermark } from './watermark';

const onePage = async () => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  return new File([await doc.save() as Uint8Array<ArrayBuffer>], 'a.pdf', { type: 'application/pdf' });
};
const ctx = { onProgress() {} };
const opts = { size: 52, opacity: 20, angle: 45 };

describe('PDF watermark', () => {
  it('stamps Latin text, accents included', async () => {
    const r = await watermark([await onePage()], { ...opts, text: 'BROUILLON é €' }, ctx);
    expect(r.summary).toContain('1 page');
  });

  it('names the characters it cannot draw instead of a raw encoder error', async () => {
    const run = watermark([await onePage()], { ...opts, text: 'ЧЕРНОВИК ✓' }, ctx);
    await expect(run).rejects.toBeInstanceOf(ToolError);
    await expect(watermark([await onePage()], { ...opts, text: 'ЧЕРНОВИК ✓' }, ctx)).rejects.toThrow(/Latin characters only.*Ч/);
  });
});
