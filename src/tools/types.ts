/**
 * The tool contract.
 *
 * Metadata (`ToolMeta`) is deliberately separated from implementation. The
 * registry imports only metadata, so `getStaticPaths()` can enumerate all 22
 * tools at build time without pulling pdf-lib, ffmpeg and transformers.js into
 * the graph. Implementations are reached through `src/tools/loaders.ts`, which
 * dynamic-imports one module per tool on demand.
 */

export type Category = 'pdf' | 'image' | 'calc' | 'media' | 'dev';

export const CATEGORIES: readonly Category[] = ['pdf', 'image', 'calc', 'media', 'dev'] as const;

export const CATEGORY_LABEL: Record<Category, string> = {
  pdf: 'PDF',
  media: 'Media',
  image: 'Image',
  calc: 'Calculators',
  dev: 'Developer',
};

/** Show an option only while another option has a given value. */
export interface OptionCondition { key: string; equals: string | number | boolean }

/** Declarative option spec that lets one generic renderer serve every tool. */
export type OptionSpec = (
  | { kind: 'select'; key: string; label: string; choices: { value: string; label: string }[]; default: string; help?: string }
  | { kind: 'number'; key: string; label: string; min: number; max: number; step?: number; default: number; suffix?: string; help?: string }
  | { kind: 'range'; key: string; label: string; min: number; max: number; step?: number; default: number; suffix?: string; help?: string }
  | { kind: 'toggle'; key: string; label: string; default: boolean; help?: string }
  | { kind: 'text'; key: string; label: string; default: string; placeholder?: string; help?: string; secret?: boolean }
) & { when?: OptionCondition | OptionCondition[] };

/** Every condition in `when` must hold. */
export const isVisible = (spec: OptionSpec, values: OptionValues): boolean =>
  [spec.when ?? []].flat().every((c) => values[c.key] === c.equals);

export type OptionValues = Record<string, string | number | boolean>;

export interface ToolMeta {
  /** Path segment within the category, e.g. 'merge' -> /pdf/merge */
  slug: string;
  category: Category;
  /** Display name and <h1>. Never derived from the slug: the old build did
   *  `toolId.replace('-', ' ')`, which only replaces the first hyphen. */
  name: string;
  /** Full <title>, when the default "<name> online, free, no upload" reads wrong. */
  seoTitle?: string;
  /** One line. Card subtitle and page subtitle. */
  blurb: string;
  /** <meta name="description">. Written for a search result, not for the page. */
  description: string;
  /** Search synonyms. Drives the command palette and on-page search, so
   *  "transcribe" finds Audio to Text, which the old search could not do. */
  keywords: string[];
  /**
   * 'text2' renders two input panes (diff). 'file' renders a drop zone.
   * 'app' has its own island (see src/views/ToolView.astro) because its UI
   * is not a drop zone or a text box: calculators, the photo maker.
   */
  kind: 'file' | 'text' | 'text2' | 'app';
  /** `accept` attribute for file tools. */
  accept?: string;
  multiple?: boolean;
  options?: OptionSpec[];
  /** Honest limits, rendered on the page. Saying what a tool cannot do is both
   *  more useful and better content than keyword filler. */
  limits?: string[];
  /** Longer prose for the "What this does" block. */
  about?: string;
  /** Fully-qualified ids, e.g. 'pdf/split'. */
  related?: string[];
  /** Produces output from options alone; the input pane is hidden (uuid). */
  generator?: boolean;
  /** Needs a large runtime (ffmpeg / Whisper). Only heavy tools get a real
   *  progress bar: a bar on a 400ms task makes it feel slower. */
  heavy?: boolean;
  /**
   * Preset landing pages at /<category>/<slug>/<variant>: the same tool with
   * different starting options and its own title, for searches like
   * "compress pdf to 500kb". Each must be genuinely useful on its own.
   */
  variants?: ToolVariant[];
}

export interface ToolVariant {
  slug: string;
  name: string;
  blurb: string;
  description: string;
  /** Option values this page starts with. */
  defaults: OptionValues;
  /** Extra prose for this preset, e.g. which portal the limit comes from. */
  about?: string;
}

export interface DiffSegment { text: string; kind: 'add' | 'del' | 'same' }

export interface TextToolResult {
  output: string;
  /**
   * Hint for the output pane renderer. 'image' means `output` is a data URL.
   * 'diff' is line-marked output; 'diff-inline' is rendered from `segments`.
   * Declared explicitly so ordinary text that happens to start a line with
   * "- " is never coloured as a diff.
   */
  language?: 'json' | 'text' | 'css' | 'image' | 'diff' | 'diff-inline';
  /** Inline change runs for 'diff-inline'. `output` holds a copyable form. */
  segments?: DiffSegment[];
  /** Inline CSS applied to a live preview swatch (css-shadow). */
  preview?: string;
  /** Key/value readout shown above the output, rendered in mono. */
  stats?: { label: string; value: string }[];
}

export interface FileToolResult {
  blob: Blob;
  filename: string;
  /** Short factual summary, e.g. "3 files -> 12 pages". */
  summary?: string;
  /** Readable text to show under the result with a Copy button (OCR). */
  text?: string;
}

export interface RunContext {
  onProgress(fraction: number, label?: string): void;
  signal?: AbortSignal;
}

/** Always async, even for instant tools: one uniform contract for callers.
 *  The microtask cost is imperceptible next to a keystroke. */
export type TextRun = (input: string, opts: OptionValues, inputB?: string) => Promise<TextToolResult>;

/** File tools are async and may be slow. */
export type FileRun = (files: File[], opts: OptionValues, ctx: RunContext) => Promise<FileToolResult>;

export interface TextToolModule { run: TextRun }
export interface FileToolModule { run: FileRun }
export type ToolModule = TextToolModule | FileToolModule;

/** Thrown for problems the user can act on. Message is shown verbatim. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

export const toolId = (t: Pick<ToolMeta, 'category' | 'slug'>): string => `${t.category}/${t.slug}`;
export const toolHref = (t: Pick<ToolMeta, 'category' | 'slug'>): string => `/${t.category}/${t.slug}`;

/** Default option values, derived from the spec so tools never restate them. */
export function defaultOptions(specs: OptionSpec[] | undefined): OptionValues {
  const out: OptionValues = {};
  for (const s of specs ?? []) out[s.key] = s.default;
  return out;
}
