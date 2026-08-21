import type { ToolMeta } from './types';

/**
 * THE SOURCE OF TRUTH.
 *
 * Routes, page metadata, the homepage grid, the command palette and the sitemap
 * are all derived from this array. A tool that is not here has no page, and a
 * duplicate id fails the build (see registry.test.ts) — which structurally
 * eliminates the four bugs the old build shipped: a dead `css-generator` slug
 * that rendered a working-looking page doing nothing, a dead `edit-pdf`,
 * `convert-pdf` listed twice, and `/tool/<anything>` returning a real page.
 */
export const TOOLS: readonly ToolMeta[] = [
  // ─── PDF ──────────────────────────────────────────────────────────────────
  {
    slug: 'merge', category: 'pdf', name: 'Merge PDF', kind: 'file',
    blurb: 'Combine several PDFs into one file.',
    description: 'Merge PDF files in your browser. No upload, no file size limit, no account. Drop the files and the merged PDF is ready instantly.',
    keywords: ['merge', 'combine', 'join', 'concatenate', 'append', 'pdf'],
    accept: 'application/pdf,.pdf', multiple: true,
    about: 'Files are merged in the order you drop them, keeping every page at its original size and quality. Nothing is re-encoded, so the output is lossless.',
    limits: ['Encrypted or password-protected PDFs must be unlocked first.', 'Very large merges are bounded by your device memory, not by an upload cap.'],
    related: ['pdf/split', 'pdf/compress', 'pdf/rotate'],
  },
  {
    slug: 'split', category: 'pdf', name: 'Split PDF', kind: 'file',
    blurb: 'Extract every page into a separate PDF.',
    description: 'Split a PDF into single pages in your browser. Returns a ZIP, with no upload and no page limit.',
    keywords: ['split', 'separate', 'extract pages', 'divide', 'burst', 'pdf'],
    accept: 'application/pdf,.pdf',
    options: [{ kind: 'text', key: 'range', label: 'Pages', default: '', placeholder: 'all, or 1-5, 8, 11-13', help: 'Leave empty to split every page.' }],
    about: 'Each selected page becomes its own PDF, bundled into a ZIP. Pages are copied, not re-rendered, so quality is untouched.',
    limits: ['Output arrives as a ZIP even for a single page.'],
    related: ['pdf/merge', 'pdf/rotate', 'pdf/to-image'],
  },
  {
    slug: 'compress', category: 'pdf', name: 'Compress PDF', kind: 'file',
    blurb: 'Shrink a PDF, losslessly or aggressively.',
    description: 'Compress PDF files in your browser. Choose lossless structural compression or aggressive image re-encoding.',
    keywords: ['compress', 'reduce', 'shrink', 'optimise', 'optimize', 'smaller', 'pdf'],
    accept: 'application/pdf,.pdf',
    options: [
      { kind: 'select', key: 'mode', label: 'Mode', default: 'lossless', choices: [
        { value: 'lossless', label: 'Lossless (keeps text selectable)' },
        { value: 'strong', label: 'Strong (rasterises pages)' },
      ], help: 'Strong re-encodes each page as an image. Much smaller, but text stops being selectable or searchable.' },
      { kind: 'range', key: 'quality', label: 'Image quality', min: 30, max: 95, step: 5, default: 70, suffix: '%', help: 'Strong mode only.' },
    ],
    about: 'Lossless mode repacks the file structure with object streams. That is safe, but the saving is usually small, and close to zero on image-heavy files. Strong mode renders each page and re-encodes it as a JPEG, which shrinks scanned documents dramatically at the cost of selectable text.',
    limits: ['Strong mode makes text non-selectable and non-searchable.', 'Lossless mode often saves only a few percent. That is the honest ceiling for structural compression.'],
    related: ['pdf/to-image', 'image/compress', 'pdf/merge'],
  },
  {
    slug: 'to-image', category: 'pdf', name: 'PDF to JPG', kind: 'file',
    blurb: 'Turn every page into a high-resolution image.',
    description: 'Convert PDF pages to JPG or PNG in your browser. High resolution, no upload, no watermark.',
    keywords: ['pdf to jpg', 'pdf to png', 'pdf to image', 'convert', 'render', 'export', 'screenshot'],
    accept: 'application/pdf,.pdf',
    options: [
      { kind: 'select', key: 'format', label: 'Format', default: 'jpg', choices: [{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }] },
      { kind: 'select', key: 'scale', label: 'Resolution', default: '2', choices: [
        { value: '1', label: '72 dpi, screen' }, { value: '2', label: '144 dpi, default' }, { value: '3', label: '216 dpi, print' },
      ] },
    ],
    about: 'Each page is rendered at the chosen resolution and exported as an image, bundled into a ZIP.',
    limits: ['High resolutions on long documents are memory-hungry.'],
    related: ['pdf/to-text', 'image/convert', 'pdf/compress'],
  },
  {
    slug: 'to-text', category: 'pdf', name: 'PDF to text', kind: 'file',
    blurb: 'Extract the raw text from a PDF.',
    description: 'Extract text from a PDF in your browser. No upload, no account, no character limit.',
    keywords: ['pdf to text', 'extract text', 'copy text', 'txt', 'scrape', 'read'],
    accept: 'application/pdf,.pdf',
    about: 'Pulls the embedded text layer out of the document, page by page.',
    limits: ['Scanned PDFs have no text layer, so this returns nothing for them. OCR is not included.', 'Complex multi-column layouts may extract out of reading order.'],
    related: ['pdf/to-image', 'media/transcribe', 'dev/word-count'],
  },
  {
    slug: 'rotate', category: 'pdf', name: 'Rotate PDF', kind: 'file',
    blurb: 'Rotate pages and fix orientation.',
    description: 'Rotate PDF pages in your browser. Fix sideways or upside-down scans without uploading the file.',
    keywords: ['rotate', 'turn', 'orientation', 'sideways', 'upside down', 'landscape', 'portrait', 'edit'],
    accept: 'application/pdf,.pdf',
    options: [
      { kind: 'select', key: 'angle', label: 'Rotate by', default: '90', choices: [
        { value: '90', label: '90° clockwise' }, { value: '180', label: '180°' }, { value: '270', label: '90° anticlockwise' },
      ] },
      { kind: 'text', key: 'range', label: 'Pages', default: '', placeholder: 'all, or 1-5, 8', help: 'Leave empty to rotate every page.' },
    ],
    about: 'Rotation is applied to the page metadata, so nothing is re-rendered and quality is untouched.',
    limits: ['Rotation is a multiple of 90°. Arbitrary angles would require rasterising the page.'],
    related: ['pdf/split', 'pdf/merge', 'pdf/watermark'],
  },
  {
    slug: 'watermark', category: 'pdf', name: 'Watermark PDF', kind: 'file',
    blurb: 'Stamp text across every page.',
    description: 'Add a text watermark to a PDF in your browser. Set the text, size, angle and opacity. Nothing is uploaded.',
    keywords: ['watermark', 'stamp', 'draft', 'confidential', 'overlay', 'brand'],
    accept: 'application/pdf,.pdf',
    options: [
      { kind: 'text', key: 'text', label: 'Text', default: 'DRAFT', placeholder: 'DRAFT' },
      { kind: 'range', key: 'size', label: 'Size', min: 10, max: 120, step: 2, default: 52, suffix: 'pt' },
      { kind: 'range', key: 'opacity', label: 'Opacity', min: 5, max: 100, step: 5, default: 20, suffix: '%' },
      { kind: 'range', key: 'angle', label: 'Angle', min: -90, max: 90, step: 15, default: 45, suffix: '°' },
    ],
    about: 'Draws the text once per page, centred. It sits on top of the existing content.',
    limits: ['Text watermarks only. Image watermarks are not supported.', 'A watermark is not security: it can be removed by anyone with the right tool.'],
    related: ['pdf/rotate', 'pdf/merge', 'pdf/compress'],
  },

  // ─── Media ────────────────────────────────────────────────────────────────
  {
    slug: 'compress-video', category: 'media', name: 'Compress video', kind: 'file', heavy: true,
    blurb: 'Hit a target file size, in your browser.',
    description: 'Compress video to a target size in your browser using ffmpeg.wasm. No upload, no size cap, no account.',
    keywords: ['compress video', 'shrink', 'reduce', 'mp4', 'target size', 'discord', 'smaller', 'bitrate'],
    accept: 'video/*',
    options: [
      { kind: 'number', key: 'targetMB', label: 'Target size', min: 1, max: 2000, step: 1, default: 15, suffix: 'MB', help: 'The encoder aims for this. Expect to land within a few percent.' },
      { kind: 'select', key: 'audio', label: 'Audio', default: '128', choices: [
        { value: '128', label: '128 kbps, the default' }, { value: '96', label: '96 kbps' }, { value: '64', label: '64 kbps, smaller file' }, { value: 'none', label: 'Remove audio' },
      ] },
    ],
    about: 'Computes the bitrate needed to land on your target size given the video length, then re-encodes at that bitrate. Audio is re-encoded to a known bitrate so the size arithmetic is actually correct.',
    limits: ['Runs at roughly real-time or slower. A 5 minute video takes minutes, not seconds.', 'Single-pass encoding, so the final size lands close to the target but rarely exactly on it.', 'Needs a desktop browser for anything large; mobile memory is the binding constraint.'],
    related: ['media/extract-audio', 'media/transcribe', 'image/compress'],
  },
  {
    slug: 'extract-audio', category: 'media', name: 'Extract audio', kind: 'file', heavy: true,
    blurb: 'Pull the audio track out of a video as MP3.',
    description: 'Extract audio from video to MP3 in your browser. No upload and no length limit.',
    keywords: ['extract audio', 'video to mp3', 'rip audio', 'soundtrack', 'strip', 'convert', 'mp3'],
    accept: 'video/*',
    options: [{ kind: 'select', key: 'bitrate', label: 'Quality', default: '192', choices: [
      { value: '320', label: '320 kbps' }, { value: '192', label: '192 kbps, the default' }, { value: '128', label: '128 kbps' },
    ] }],
    about: 'Discards the video stream and re-encodes the audio to MP3.',
    limits: ['Re-encoding to MP3 is lossy. The source audio is already compressed, so this is a second generation.'],
    related: ['media/transcribe', 'media/compress-video'],
  },
  {
    slug: 'transcribe', category: 'media', name: 'Audio to text', kind: 'file', heavy: true,
    blurb: 'Transcribe speech with Whisper, on your device.',
    description: 'Transcribe audio to text in your browser with Whisper. The model runs on your device, so the audio is never uploaded.',
    keywords: ['transcribe', 'transcription', 'speech to text', 'audio to text', 'whisper', 'subtitles', 'captions', 'dictation', 'stt'],
    accept: 'audio/*,video/*',
    about: 'Runs OpenAI Whisper (tiny.en) locally through WebAssembly. The model is downloaded once, around 39 MB, then cached by your browser for every later run.',
    limits: ['English only. This is the `tiny.en` model.', 'First run downloads roughly 39 MB of model weights. After that it is offline.', 'Accuracy is well below the full-size cloud models, especially with accents, crosstalk or background noise.', 'Long recordings are slow: expect a sizeable fraction of the audio duration.'],
    related: ['media/extract-audio', 'dev/word-count', 'pdf/to-text'],
  },

  // ─── Image ────────────────────────────────────────────────────────────────
  {
    slug: 'compress', category: 'image', name: 'Compress image', kind: 'file',
    blurb: 'Shrink JPG, PNG and WebP files.',
    description: 'Compress images in your browser. Adjust quality and watch the size change instantly. Nothing is uploaded.',
    keywords: ['compress image', 'shrink', 'reduce', 'optimise', 'optimize', 'jpg', 'png', 'webp', 'smaller', 'tinypng'],
    accept: 'image/*', multiple: true,
    options: [
      { kind: 'range', key: 'quality', label: 'Quality', min: 30, max: 95, step: 5, default: 75, suffix: '%' },
      { kind: 'select', key: 'format', label: 'Output', default: 'auto', choices: [
        { value: 'auto', label: 'Keep original format' }, { value: 'webp', label: 'WebP, usually the smallest' }, { value: 'jpeg', label: 'JPG' },
      ] },
    ],
    about: 'Decodes each image and re-encodes it at the chosen quality. WebP typically beats JPG by a wide margin at the same visual quality.',
    limits: ['Re-encoding is lossy. Compressing an already-compressed image degrades it further.', 'PNG transparency is preserved only when the output stays PNG or WebP.'],
    related: ['image/convert', 'image/resize', 'pdf/compress'],
  },
  {
    slug: 'convert', category: 'image', name: 'Convert image', kind: 'file',
    blurb: 'Move between JPG, PNG, WebP and AVIF.',
    description: 'Convert images between JPG, PNG, WebP and AVIF in your browser. Batch conversion with no upload.',
    keywords: ['convert image', 'jpg to png', 'png to jpg', 'webp', 'avif', 'heic', 'format', 'change'],
    accept: 'image/*', multiple: true,
    options: [
      { kind: 'select', key: 'format', label: 'Convert to', default: 'webp', choices: [
        { value: 'webp', label: 'WebP' }, { value: 'jpeg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'avif', label: 'AVIF' },
      ] },
      { kind: 'range', key: 'quality', label: 'Quality', min: 30, max: 100, step: 5, default: 85, suffix: '%', help: 'Ignored for PNG, which is lossless.' },
    ],
    about: 'Decodes with the browser image pipeline and re-encodes to the chosen format.',
    limits: ['AVIF encoding depends on browser support and is slower than the others.', 'Converting to PNG from a lossy source will usually make the file larger, not smaller.'],
    related: ['image/compress', 'image/resize', 'pdf/to-image'],
  },
  {
    slug: 'resize', category: 'image', name: 'Resize image', kind: 'file',
    blurb: 'Scale images to exact dimensions.',
    description: 'Resize images in your browser. Set a width or height, keep the aspect ratio, and batch process without uploading.',
    keywords: ['resize', 'scale', 'dimensions', 'width', 'height', 'thumbnail', 'crop', 'shrink', 'enlarge'],
    accept: 'image/*', multiple: true,
    options: [
      { kind: 'number', key: 'width', label: 'Width', min: 0, max: 20000, step: 1, default: 1280, suffix: 'px', help: '0 to derive from height.' },
      { kind: 'number', key: 'height', label: 'Height', min: 0, max: 20000, step: 1, default: 0, suffix: 'px', help: '0 to derive from width.' },
      { kind: 'toggle', key: 'noUpscale', label: 'Never enlarge', default: true, help: 'Leave images already smaller than the target untouched.' },
    ],
    about: 'Scales with the browser’s high-quality resampling. Setting only one dimension preserves the aspect ratio.',
    limits: ['Enlarging cannot invent detail. This is plain resampling, not AI upscaling.'],
    related: ['image/compress', 'image/convert'],
  },

  // ─── Developer ────────────────────────────────────────────────────────────
  {
    slug: 'json', category: 'dev', name: 'JSON formatter', kind: 'text',
    blurb: 'Format, validate and minify JSON.',
    description: 'Format and validate JSON in your browser with syntax highlighting. Pinpoints the exact line of a syntax error.',
    keywords: ['json', 'format', 'pretty print', 'beautify', 'validate', 'minify', 'lint', 'parse', 'prettify'],
    options: [
      { kind: 'select', key: 'indent', label: 'Indent', default: '2', choices: [
        { value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tabs' }, { value: '0', label: 'Minify' },
      ] },
      { kind: 'toggle', key: 'sortKeys', label: 'Sort keys', default: false },
    ],
    about: 'Parses with the browser’s own JSON parser, so what validates here is exactly what validates in your code. Errors report the line and column.',
    limits: ['Strict JSON only. No comments, no trailing commas, no single quotes.'],
    related: ['dev/jwt', 'dev/base64', 'dev/diff'],
  },
  {
    slug: 'jwt', category: 'dev', name: 'JWT decoder', kind: 'text',
    blurb: 'Decode a token’s header and payload.',
    description: 'Decode JSON Web Tokens in your browser. The token is never sent anywhere, which matters, because tokens are credentials.',
    keywords: ['jwt', 'json web token', 'decode', 'token', 'bearer', 'auth', 'claims', 'jwt.io'],
    about: 'Splits the token, base64url-decodes the header and payload, and renders the claims. Timestamp claims (`exp`, `iat`, `nbf`) are shown as readable dates alongside their raw values.',
    limits: ['Decoding only. The signature is not verified, and a decoded token is not a trusted token.', 'Never paste a production token into a tool that uploads it. This one does not, and you can confirm that in your network tab.'],
    related: ['dev/base64', 'dev/json', 'dev/hash'],
  },
  {
    slug: 'base64', category: 'dev', name: 'Base64 converter', kind: 'text',
    blurb: 'Encode and decode Base64.',
    description: 'Encode and decode Base64 in your browser, with full Unicode support and URL-safe output.',
    keywords: ['base64', 'encode', 'decode', 'btoa', 'atob', 'b64', 'data uri', 'url safe'],
    options: [
      { kind: 'select', key: 'mode', label: 'Mode', default: 'encode', choices: [{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }] },
      { kind: 'toggle', key: 'urlSafe', label: 'URL-safe alphabet', default: false, help: 'Uses - and _ instead of + and /, and drops padding.' },
    ],
    about: 'Handles multi-byte UTF-8 correctly in both directions, so emoji and non-Latin scripts round-trip exactly.',
    limits: ['Text only. For files, use the file tools.'],
    related: ['dev/jwt', 'dev/hash', 'dev/json'],
  },
  {
    slug: 'word-count', category: 'dev', name: 'Word counter', kind: 'text',
    blurb: 'Live word, character and reading-time counts.',
    description: 'Count words, characters, sentences and reading time as you type. Nothing is sent anywhere.',
    keywords: ['word count', 'character count', 'letter count', 'reading time', 'essay', 'twitter', 'limit', 'counter'],
    about: 'Counts update on every keystroke. Reading time assumes 200 words per minute, speaking time 130.',
    limits: ['Word counting splits on whitespace, which undercounts languages that do not use spaces between words.'],
    related: ['dev/diff', 'pdf/to-text', 'media/transcribe'],
  },
  {
    slug: 'hash', category: 'dev', name: 'Hash generator', kind: 'text',
    blurb: 'SHA-1, SHA-256, SHA-384 and SHA-512.',
    description: 'Generate SHA hashes in your browser using the native Web Crypto API. Nothing is uploaded.',
    keywords: ['hash', 'sha', 'sha256', 'sha1', 'sha512', 'checksum', 'digest', 'fingerprint', 'md5'],
    options: [{ kind: 'select', key: 'algo', label: 'Algorithm', default: 'SHA-256', choices: [
      { value: 'SHA-1', label: 'SHA-1' }, { value: 'SHA-256', label: 'SHA-256' }, { value: 'SHA-384', label: 'SHA-384' }, { value: 'SHA-512', label: 'SHA-512' },
    ] }],
    about: 'Uses the browser’s built-in Web Crypto implementation, the same primitive your runtime uses.',
    limits: ['MD5 is not offered. Web Crypto deliberately omits it because it is broken for anything security-related.', 'SHA-1 is included for checking legacy checksums only. Do not use it for security.'],
    related: ['dev/uuid', 'dev/base64', 'dev/jwt'],
  },
  {
    slug: 'uuid', category: 'dev', name: 'UUID generator', kind: 'text', generator: true,
    blurb: 'Cryptographically random UUIDs.',
    description: 'Generate v4 UUIDs in your browser using the native crypto API. Bulk generation, no upload.',
    keywords: ['uuid', 'guid', 'v4', 'random', 'identifier', 'id', 'generate', 'unique'],
    options: [
      { kind: 'number', key: 'count', label: 'How many', min: 1, max: 1000, step: 1, default: 10 },
      { kind: 'toggle', key: 'uppercase', label: 'Uppercase', default: false },
      { kind: 'toggle', key: 'braces', label: 'Wrap in braces', default: false },
    ],
    about: 'Uses `crypto.randomUUID()`, which draws from the platform CSPRNG. These are suitable for real identifiers, not just placeholders.',
    limits: ['Version 4 only, which is random rather than time-ordered. If you need sortable ids, you want UUIDv7 or ULID.'],
    related: ['dev/hash', 'dev/qr'],
  },
  {
    slug: 'qr', category: 'dev', name: 'QR code generator', kind: 'text',
    blurb: 'Turn text or a URL into a QR code.',
    description: 'Generate a QR code in your browser and download it as PNG. No upload, no tracking redirect, no expiry.',
    keywords: ['qr', 'qr code', 'barcode', 'url', 'link', 'generate', 'scan', 'wifi'],
    options: [
      { kind: 'range', key: 'size', label: 'Size', min: 128, max: 1024, step: 64, default: 512, suffix: 'px' },
      { kind: 'select', key: 'ec', label: 'Error correction', default: 'M', choices: [
        { value: 'L', label: 'L (7%)' }, { value: 'M', label: 'M (15%)' }, { value: 'Q', label: 'Q (25%)' }, { value: 'H', label: 'H (30%)' },
      ], help: 'Higher survives more damage, at the cost of a denser code.' },
      { kind: 'toggle', key: 'margin', label: 'Quiet zone border', default: true },
    ],
    about: 'The QR code encodes your text directly. Many online generators encode a redirect through their own domain, so the code stops working when they do. This one does not.',
    limits: ['Around 2,900 characters at the lowest error correction, far fewer at the highest.'],
    related: ['dev/uuid', 'image/convert'],
  },
  {
    slug: 'diff', category: 'dev', name: 'Text diff', kind: 'text2',
    blurb: 'Compare two blocks of text.',
    description: 'Compare two texts and see exactly what changed, line by line or word by word. Runs entirely in your browser.',
    keywords: ['diff', 'compare', 'difference', 'changes', 'merge', 'text', 'file compare', 'delta'],
    options: [
      { kind: 'select', key: 'granularity', label: 'Compare by', default: 'line', choices: [
        { value: 'line', label: 'Line' }, { value: 'word', label: 'Word' }, { value: 'char', label: 'Character' },
      ] },
      { kind: 'toggle', key: 'ignoreWhitespace', label: 'Ignore whitespace', default: false },
    ],
    about: 'A standard diff over the two inputs, with additions and removals marked inline.',
    limits: ['Plain text only. No syntax awareness and no three-way merge.'],
    related: ['dev/json', 'dev/word-count'],
  },
  {
    slug: 'css-shadow', category: 'dev', name: 'CSS shadow generator', kind: 'text', generator: true,
    blurb: 'Build box-shadows with a live preview.',
    description: 'Generate CSS box-shadow code with sliders and a live preview. Copy the result straight into your stylesheet.',
    keywords: ['css', 'box shadow', 'shadow', 'generator', 'drop shadow', 'elevation', 'design', 'style'],
    options: [
      { kind: 'range', key: 'x', label: 'Offset X', min: -50, max: 50, step: 1, default: 0, suffix: 'px' },
      { kind: 'range', key: 'y', label: 'Offset Y', min: -50, max: 50, step: 1, default: 8, suffix: 'px' },
      { kind: 'range', key: 'blur', label: 'Blur', min: 0, max: 100, step: 1, default: 24, suffix: 'px' },
      { kind: 'range', key: 'spread', label: 'Spread', min: -50, max: 50, step: 1, default: -6, suffix: 'px' },
      { kind: 'range', key: 'opacity', label: 'Opacity', min: 0, max: 100, step: 1, default: 18, suffix: '%' },
      { kind: 'text', key: 'color', label: 'Colour', default: '#131316', placeholder: '#131316' },
      { kind: 'toggle', key: 'inset', label: 'Inset', default: false },
    ],
    about: 'Emits a single `box-shadow` declaration. The preview swatch uses the exact value you would paste.',
    limits: ['One shadow layer. Stacked shadows are more convincing, but that is a different tool.'],
    related: ['dev/json', 'image/convert'],
  },
] as const;

export const TOOLS_BY_ID = new Map(TOOLS.map((t) => [`${t.category}/${t.slug}`, t]));

export const toolsIn = (category: string): ToolMeta[] => TOOLS.filter((t) => t.category === category);
