/**
 * Curated cross-category pages.
 *
 * A collection is editorial, not derived: the order is chosen and every entry
 * carries the context that earns it a place. That is why this is a hand-written
 * list rather than a query over `alsoIn`, which exists for the mechanical case
 * of showing a tool in a second category.
 *
 * Every entry points at a page that already exists. collections.test.ts fails
 * on an id or variant that does not resolve, so a collection cannot drift into
 * linking at nothing.
 */

export interface CollectionEntry {
  /** Tool id, e.g. 'image/passport-photo'. */
  tool: string;
  /** Variant slug, when the entry is a preset rather than the tool itself. */
  variant?: string;
  /** Why this belongs here. Replaces the tool's own blurb on this page. */
  context: string;
  contextMs: string;
}

export const MALAYSIA: readonly CollectionEntry[] = [
  {
    tool: 'image/passport-photo',
    context: 'Passport, JPJ and SPM or UPU presets, white background, and a 4R print sheet.',
    contextMs: 'Praset pasport, JPJ dan SPM atau UPU, latar belakang putih, dan helaian cetakan 4R.',
  },
  {
    tool: 'calc/take-home-pay',
    context: 'Take-home pay after EPF, SOCSO, EIS and PCB, using this year’s official rates.',
    contextMs: 'Gaji bersih selepas KWSP, PERKESO, SIP dan PCB, menggunakan kadar rasmi tahun ini.',
  },
  {
    tool: 'pdf/compress', variant: '500kb',
    context: 'The 500 KB ceiling that SSM, LHDN, JPA and UPU portals impose on an upload.',
    contextMs: 'Had 500 KB yang dikenakan oleh portal SSM, LHDN, JPA dan UPU pada muat naik.',
  },
  {
    tool: 'image/compress', variant: '200kb',
    context: 'A common photo limit on government and university portals.',
    contextMs: 'Had foto yang biasa pada portal kerajaan dan universiti.',
  },
  {
    tool: 'image/compress', variant: 'spa-myresume',
    context: 'Sized for SPA MyResume, which rejects anything larger.',
    contextMs: 'Bersaiz untuk SPA MyResume, yang menolak apa-apa yang lebih besar.',
  },
  {
    tool: 'pdf/ocr',
    context: 'Makes a scanned document searchable, reading Malay as well as English.',
    contextMs: 'Menjadikan dokumen imbasan boleh dicari, membaca bahasa Melayu dan bahasa Inggeris.',
  },
  {
    tool: 'image/ocr',
    context: 'Pulls text out of a photographed form or screenshot, in Malay or English.',
    contextMs: 'Mengeluarkan teks daripada borang atau tangkapan skrin, dalam bahasa Melayu atau Inggeris.',
  },
  {
    tool: 'media/transcribe',
    context: 'Transcribes Malay speech on your device, with no recording leaving it.',
    contextMs: 'Mentranskripsi pertuturan bahasa Melayu pada peranti anda, tiada rakaman meninggalkannya.',
  },
];
