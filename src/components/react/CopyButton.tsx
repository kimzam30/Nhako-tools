import { useState, useRef, useEffect } from 'react';

export default function CopyButton({ text, label = 'Copy', copiedLabel = 'Copied', announce = 'Copied to clipboard' }: {
  text: string; label?: string; copiedLabel?: string; announce?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!text}
      className="rounded border border-border px-2 py-1 text-2xs font-medium text-muted transition-colors duration-[120ms] hover:border-border-strong hover:text-text disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted"
    >
      {copied ? copiedLabel : label}
      {/* Announce the outcome only. A live region around the label itself
          announced "Copy" every time the button appeared. */}
      <span className="sr-only" role="status">{copied ? announce : ''}</span>
    </button>
  );
}
