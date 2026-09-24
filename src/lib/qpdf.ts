/**
 * qpdf 12 (Apache-2.0) compiled to WebAssembly, for PDF encryption and
 * decryption: the one PDF job pdf-lib cannot do. The 1.3 MB binary is
 * self-hosted under /vendor (scripts/vendor.mjs) and only fetched when
 * Protect or Unlock actually runs.
 */

interface Qpdf {
  callMain(args: string[]): number;
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
}

let instance: Promise<Qpdf> | null = null;

function load(): Promise<Qpdf> {
  instance ??= (async () => {
    const { default: create } = await import('@neslinesli93/qpdf-wasm');
    const factory = create as unknown as (opts: Record<string, unknown>) => Promise<Qpdf>;
    return factory({
      locateFile: () => `${__QPDF_BASE__}qpdf.wasm`,
      noInitialRun: true,
      // This build writes messages straight to the console, ignoring any
      // print hooks, so results are read from exit codes, never from text.
      print: () => {},
      printErr: () => {},
    });
  })();
  instance.catch(() => { instance = null; });
  return instance;
}

export interface QpdfResult {
  /** 0 success, 3 success with warnings (or "yes" for query flags), 2 failure. */
  code: number;
  bytes?: Uint8Array;
}

/**
 * Run qpdf with `input` at /in.pdf. Arguments may use "/in.pdf" and
 * "/out.pdf"; the output file is returned when qpdf writes one.
 */
export async function qpdf(input: Uint8Array, args: string[]): Promise<QpdfResult> {
  const q = await load();
  q.FS.writeFile('/in.pdf', input);
  let code: number;
  try {
    code = q.callMain(args);
  } catch (err) {
    // Emscripten reports a non-zero exit by throwing an ExitStatus.
    code = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 2;
  }
  let bytes: Uint8Array | undefined;
  try {
    bytes = q.FS.readFile('/out.pdf').slice();
    q.FS.unlink('/out.pdf');
  } catch { /* no output written */ }
  q.FS.unlink('/in.pdf');
  return { code, bytes };
}

/**
 * Whether qpdf accepts `password` for an encrypted file. --requires-password
 * exits 3 when the password given is right (or none is needed) and 2 when it
 * is wrong, verified against qpdf 12.2.
 */
export async function passwordWorks(input: Uint8Array, password: string): Promise<boolean> {
  return (await qpdf(input, ['--requires-password', `--password=${password}`, '/in.pdf'])).code === 3;
}

/** pdf-lib refuses encrypted files outright, which makes it a reliable test. */
export async function inspectPdf(input: Uint8Array): Promise<'encrypted' | 'plain' | 'unreadable'> {
  const { PDFDocument } = await import('pdf-lib');
  try {
    const doc = await PDFDocument.load(input, { updateMetadata: false });
    // Touch the catalog: load() accepts anything starting with "%PDF", so a
    // truncated file looked simply "not encrypted" and Unlock told the user
    // there was nothing to unlock, about a file it could not read at all.
    doc.getPageCount();
    return 'plain';
  } catch (err) {
    return /encrypt/i.test(String(err)) ? 'encrypted' : 'unreadable';
  }
}

/** A random owner password: nobody needs to know it, it only fixes permissions. */
export function randomPassword(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
