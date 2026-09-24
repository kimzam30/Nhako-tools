import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { inspectPdf, qpdf, randomPassword } from '../../lib/qpdf';
import { sayer } from '../say';
import { stem } from './load';

/**
 * AES-256 encryption with qpdf.
 *
 * The password the person types opens the file. A separate random owner
 * password locks the permissions (printing, copying, editing), so opening the
 * file does not also grant the right to change those restrictions.
 */
export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const password = String(opts.password ?? '');
  if (password.length < 4) {
    throw new ToolError(say('Type a password of at least 4 characters.', 'Taip kata laluan sekurang-kurangnya 4 aksara.'));
  }

  ctx.onProgress(0.2, say('Loading the encryption engine', 'Memuatkan enjin penyulitan'));
  const input = new Uint8Array(await file.arrayBuffer());

  const state = await inspectPdf(input);
  if (state === 'unreadable') {
    throw new ToolError(say(`Could not read "${file.name}" as a PDF.`, `"${file.name}" tidak dapat dibaca sebagai PDF.`));
  }
  if (state === 'encrypted') {
    throw new ToolError(say(
      'This PDF is already encrypted. Unlock it first, then protect it with a new password.',
      'PDF ini sudah disulitkan. Buka kuncinya dahulu, kemudian lindungi dengan kata laluan baharu.',
    ));
  }

  const restrictions = [
    `--print=${opts.allowPrint === false ? 'none' : 'full'}`,
    `--extract=${opts.allowCopy === false ? 'n' : 'y'}`,
    `--modify=${opts.allowEdit ? 'all' : 'none'}`,
  ];
  ctx.onProgress(0.6, say('Encrypting', 'Menyulitkan'));
  const result = await qpdf(input, ['--encrypt', password, randomPassword(), '256', ...restrictions, '--', '/in.pdf', '/out.pdf']);
  if (result.code === 2 || !result.bytes) {
    throw new ToolError(say(`Could not encrypt "${file.name}".`, `"${file.name}" tidak dapat disulitkan.`));
  }
  ctx.onProgress(1);

  const denied = [
    opts.allowPrint === false && say('printing', 'mencetak'),
    opts.allowCopy === false && say('copying text', 'menyalin teks'),
    !opts.allowEdit && say('editing', 'menyunting'),
  ].filter(Boolean);
  return {
    blob: bytesToBlob(result.bytes, 'application/pdf'),
    filename: `${stem(file)}-protected.pdf`,
    summary: say('AES-256, password required to open', 'AES-256, kata laluan diperlukan untuk membuka')
      + (denied.length ? say(`, blocks ${denied.join(', ')}`, `, menyekat ${denied.join(', ')}`) : ''),
  };
};
