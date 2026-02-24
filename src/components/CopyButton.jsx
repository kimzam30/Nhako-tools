import { useState } from 'react';

export default function CopyButton({ textToCopy, className = '' }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!textToCopy) return;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      
    } catch (err) {
      console.error('Failed to copy text: ', err);
      
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={!textToCopy} 
      className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full transition-all duration-300 shadow-sm
        ${!textToCopy ? 'opacity-50 cursor-not-allowed bg-gray-50 text-gray-400 border-2 border-gray-100' : ''}
        ${isCopied && textToCopy
          ? 'bg-green-100 text-green-700 border-2 border-green-200 shadow-[0_4px_14px_rgba(34,197,94,0.2)] scale-105' 
          : textToCopy ? 'bg-white text-gray-500 border-2 border-gray-200 hover:border-nhakoPink hover:text-nhakoPink active:scale-95' : ''
        } ${className}`}
      title="Copy to clipboard"
    >
      {isCopied ? (
        <>
          {/* Checkmark Icon */}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          {/* Document Duplicate Icon */}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}