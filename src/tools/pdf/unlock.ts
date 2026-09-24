import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { inspectPdf, passwordWorks, qpdf } from '../../lib/qpdf';
import { sayer } from '../say';
import { stem } from './load';

/**
 * Remove a PDF's password and restrictions with qpdf, given the password.
 * The password is checked by qpdf against the file itself; it never leaves
 * this page.
 */
export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const password = String(opts.password ?? '');
  const input = new Uint8Array(await file.arrayBuffer());

  const state = await inspectPdf(input);
  if (state === 'unreadable') {
    throw new ToolError(say(`Could not read "${file.name}" as a PDF.`, `"${file.name}" tidak dapat dibaca sebagai PDF.`));
  }
  if (state === 'plain') {
    throw new ToolError(say(
      `"${file.name}" has no password or restrictions. There is nothing to unlock.`,
      `"${file.name}" tiada kata laluan atau sekatan. Tiada apa-apa untuk dibuka.`,
    ));
  }

  ctx.onProgress(0.2, say('Loading the decryption engine', 'Memuatkan enjin penyahsulitan'));
  // A file that only restricts printing or copying opens with an empty
  // password, so a mistyped one still gets it unlocked.
  let usable = password;
  if (!(await passwordWorks(input, password))) {
    if (password && (await passwordWorks(input, ''))) usable = '';
    else {
      throw new ToolError(password
        ? say('That password is not correct for this file.', 'Kata laluan itu tidak betul untuk fail ini.')
        : say('This PDF needs a password to open. Type it above.', 'PDF ini memerlukan kata laluan untuk dibuka. Taip di atas.'));
    }
  }

  ctx.onProgress(0.6, say('Decrypting', 'Menyahsulit'));
  const result = await qpdf(input, [`--password=${usable}`, '--decrypt', '/in.pdf', '/out.pdf']);
  if (result.code === 2 || !result.bytes) {
    throw new ToolError(say(`Could not unlock "${file.name}".`, `"${file.name}" tidak dapat dibuka kuncinya.`));
  }
  ctx.onProgress(1);
  return {
    blob: bytesToBlob(result.bytes, 'application/pdf'),
    filename: `${stem(file)}-unlocked.pdf`,
    summary: say('Password and restrictions removed', 'Kata laluan dan sekatan dibuang'),
  };
};
