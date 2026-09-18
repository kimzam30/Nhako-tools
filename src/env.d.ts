/// <reference types="astro/client" />
declare module '*?url' {
  const src: string;
  export default src;
}

/** Versioned vendor paths injected at build time (scripts/versions.mjs). */
declare const __FFMPEG_BASE__: string;
declare const __ORT_BASE__: string;
