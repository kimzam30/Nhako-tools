import { bytes } from '../../lib/format';

/**
 * Turning a File into something showable: a thumbnail and a line of facts.
 *
 * One module, because three surfaces need it and they must agree. FilePreview
 * shows what was handed to a tool; FileStage shows what is queued in Merge PDF
 * and JPG to PDF, where the thumbnail is the only way to tell two scans apart.
 * A second implementation would mean a PDF thumbnailed one way on one page and
 * another way on the next.
 *
 * Thumbnails come from native elements wherever possible (an <img>, a <video>
 * seeked to its first frame), so they cost nothing. PDFs are the exception and
 * pull pdf.js in on demand.
 *
 * Every `thumb` that starts with "blob:" is an object URL the CALLER owns and
 * must revoke. Leaking them keeps whole files alive in memory.
 */

export interface Meta {
  thumb?: string;
  kind: 'image' | 'video' | 'audio' | 'pdf' | 'file';
  facts: string[];
}

export const KIND_LABEL: Record<Meta['kind'], string> = {
  image: 'Image', video: 'Video', audio: 'Audio', pdf: 'PDF', file: 'File',
};

function kindOf(file: File): Meta['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  return 'file';
}

/**
 * The only wording this needs, passed in rather than imported, so the module
 * stays free of the caller's string table. Each surface has its own.
 */
export interface ThumbText { pages(n: number): string }

export async function describeFile(file: File, t: ThumbText): Promise<Meta> {
  const kind = kindOf(file);

  if (kind === 'image') {
    const url = URL.createObjectURL(file);
    try {
      const bmp = await createImageBitmap(file);
      const facts = [`${bmp.width} × ${bmp.height}`, bytes(file.size)];
      bmp.close();
      return { thumb: url, kind, facts };
    } catch {
      return { thumb: url, kind, facts: [bytes(file.size)] };
    }
  }

  if (kind === 'video') {
    const url = URL.createObjectURL(file);
    const facts = await new Promise<string[]>((resolve) => {
      const el = document.createElement('video');
      const done = (f: string[]) => { el.remove(); resolve(f); };
      const timer = setTimeout(() => done([bytes(file.size)]), 4000);
      el.preload = 'metadata';
      el.muted = true;
      el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px';
      el.onloadedmetadata = () => {
        clearTimeout(timer);
        const secs = Number.isFinite(el.duration) && el.duration > 0
          ? `${Math.floor(el.duration / 60)}:${String(Math.round(el.duration % 60)).padStart(2, '0')}`
          : null;
        done([`${el.videoWidth} × ${el.videoHeight}`, ...(secs ? [secs] : []), bytes(file.size)]);
      };
      el.onerror = () => { clearTimeout(timer); done([bytes(file.size)]); };
      document.body.appendChild(el);
      el.src = url;
      el.load();
    });
    return { thumb: url, kind, facts };
  }

  if (kind === 'audio') {
    return { thumb: URL.createObjectURL(file), kind, facts: [bytes(file.size)] };
  }

  if (kind === 'pdf') {
    try {
      const { loadDocument } = await import('../../lib/pdfjs');
      const doc = await loadDocument(file);
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scale = 160 / viewport.height;
      const scaled = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(scaled.width);
      canvas.height = Math.ceil(scaled.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise;
      }
      return {
        thumb: canvas.toDataURL('image/png'),
        kind,
        facts: [t.pages(doc.numPages), bytes(file.size)],
      };
    } catch {
      return { kind, facts: [bytes(file.size)] };
    }
  }

  return { kind, facts: [bytes(file.size)] };
}

