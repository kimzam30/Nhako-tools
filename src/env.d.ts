/// <reference types="astro/client" />
declare module '*?url' {
  const src: string;
  export default src;
}

/** Versioned vendor paths injected at build time (scripts/versions.mjs). */
declare const __FFMPEG_BASE__: string;
declare const __ORT_BASE__: string;
declare const __QPDF_BASE__: string;
declare const __LIBHEIF_BASE__: string;
declare const __TESSERACT_BASE__: string;
declare const __TESSDATA_BASE__: string;
declare const __LIBREOFFICE_BASE__: string;
