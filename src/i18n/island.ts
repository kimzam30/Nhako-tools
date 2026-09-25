import type { Locale } from './paths';

/**
 * The few strings the interactive islands need, kept apart from ./ui so a
 * tool page's JavaScript carries about thirty short strings rather than every
 * page's text in both languages. `ms` is typed as `typeof en`, so a missing
 * translation is a compile error.
 */
const en = {
  dropToStart: 'Drop to start',
  filesSelected: (n: number) => `${n} file${n === 1 ? '' : 's'} selected`,
  dropHere: (multiple: boolean) => `Drop ${multiple ? 'files' : 'a file'} here, or browse`,
  tapToChoose: (multiple: boolean): string => (multiple ? 'Choose files' : 'Choose a file'),
  runsOnLand: 'Runs the moment the file lands. There is no upload step',
  runsInBrowser: 'Runs entirely in your browser.',
  verifyNetwork: 'Verify it in your network tab',
  settingsChanged: 'Settings changed. This tool is slow, so it waits for you.',
  runAgain: 'Run again with these settings',
  working: 'Working',
  /* The result region is present and labelled before anything is dropped. Its
     fields read as a gauge at zero, not as a disabled form. The row labels are
     lower case on purpose: they are readout fields, not sentence text. */
  resultLabel: 'Result',
  resultOut: 'out',
  resultSize: 'size',
  resultTime: 'time',
  resultChars: 'chars',
  resultWaiting: 'waiting for a file',
  save: 'Save',
  clear: 'Clear',
  genericError: 'Something went wrong running this tool.',
  /* The outcome, said in words. The drawn mark beside it is decoration for
     anyone who can see it; this is what the live region actually announces. */
  doneLabel: 'Done',
  errorLabel: 'Could not finish',
  fileName: 'File name',
  fileNameHelp: 'Rename it before you save.',
  /* Said outright rather than implied by the plural in "Drop files here".
     Whether a tool takes a batch is the first thing someone with forty photos
     needs to know, and it was only ever inferable from an "s". */
  multiYes: 'Takes several files at once.',
  multiNo: 'One file at a time.',
  original: 'Original',
  input: 'Input',
  changed: 'Changed',
  output: 'Output',
  originalText: 'Original text',
  changedText: 'Changed text',
  comparePlaceholder: 'Paste the version to compare against…',
  outputHere: 'Output appears here as you type.',
  outputUpdated: 'Output updated.',
  errorPrefix: 'Error:',
  inputError: 'Could not process that input.',
  qrAlt: 'Generated QR code',
  savePng: 'Save PNG',
  copy: 'Copy',
  copied: 'Copied',
  copiedAnnounce: 'Copied to clipboard',
  placeholders: {
    'dev/json': '{ "paste": "your JSON here" }',
    'dev/jwt': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
    'dev/base64': 'Paste text to encode, or Base64 to decode…',
    'dev/word-count': 'Start typing. Counts update live.',
    'dev/hash': 'Text to hash…',
    'dev/qr': 'https://example.com',
    'dev/diff': 'Paste the original text…',
  } as Record<string, string>,
  placeholderDefault: 'Paste your input here…',
  numberRange: (min: number, max: number) => `${min} to ${max}`,
};

export type IslandStrings = typeof en;

const ms: IslandStrings = {
  dropToStart: 'Lepaskan untuk mula',
  filesSelected: (n) => `${n} fail dipilih`,
  dropHere: (multiple) => `Lepaskan ${multiple ? 'fail' : 'satu fail'} di sini, atau semak imbas`,
  tapToChoose: (multiple) => (multiple ? 'Pilih fail' : 'Pilih satu fail'),
  runsOnLand: 'Bermula sebaik sahaja fail dilepaskan. Tiada langkah muat naik',
  runsInBrowser: 'Berjalan sepenuhnya dalam pelayar anda.',
  verifyNetwork: 'Sahkan dalam tab rangkaian anda',
  settingsChanged: 'Tetapan berubah. Alat ini perlahan, jadi ia menunggu anda.',
  runAgain: 'Jalankan semula dengan tetapan ini',
  working: 'Sedang berjalan',
  resultLabel: 'Keputusan',
  resultOut: 'keluar',
  resultSize: 'saiz',
  resultTime: 'masa',
  resultChars: 'aksara',
  resultWaiting: 'menunggu fail',
  save: 'Simpan',
  clear: 'Kosongkan',
  genericError: 'Berlaku ralat semasa menjalankan alat ini.',
  doneLabel: 'Selesai',
  errorLabel: 'Tidak dapat diselesaikan',
  fileName: 'Nama fail',
  fileNameHelp: 'Namakan semula sebelum anda simpan.',
  multiYes: 'Menerima beberapa fail serentak.',
  multiNo: 'Satu fail pada satu masa.',
  original: 'Asal',
  input: 'Input',
  changed: 'Diubah',
  output: 'Output',
  originalText: 'Teks asal',
  changedText: 'Teks diubah',
  comparePlaceholder: 'Tampal versi untuk dibandingkan…',
  outputHere: 'Output muncul di sini semasa anda menaip.',
  outputUpdated: 'Output dikemas kini.',
  errorPrefix: 'Ralat:',
  inputError: 'Input itu tidak dapat diproses.',
  qrAlt: 'Kod QR yang dijana',
  savePng: 'Simpan PNG',
  copy: 'Salin',
  copied: 'Disalin',
  copiedAnnounce: 'Disalin ke papan keratan',
  placeholders: {
    'dev/json': '{ "tampal": "JSON anda di sini" }',
    'dev/jwt': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
    'dev/base64': 'Tampal teks untuk dikod, atau Base64 untuk dinyahkod…',
    'dev/word-count': 'Mula menaip. Kiraan dikemas kini serta-merta.',
    'dev/hash': 'Teks untuk dicincang…',
    'dev/qr': 'https://contoh.com',
    'dev/diff': 'Tampal teks asal…',
  },
  placeholderDefault: 'Tampal input anda di sini…',
  numberRange: (min, max) => `${min} hingga ${max}`,
};

export const islandText = (locale: Locale): IslandStrings => (locale === 'ms' ? ms : en);
