import { useState, useRef, useEffect } from 'react';

export default function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
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
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}
