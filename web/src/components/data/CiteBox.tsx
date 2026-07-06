"use client";

import { useState } from "react";

// "Cite this data" box — the backlink mechanism. Anyone republishing a stat
// copies a snippet that links back to the study page (dofollow), which is how a
// data asset earns editorial links. Mirrors the badge snippet UX.
export function CiteBox({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* non-secure context — the textarea is selectable as a fallback */
    }
  }
  return (
    <div>
      <textarea
        readOnly
        value={snippet}
        rows={3}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-leather/20 bg-white px-3 py-2 font-mono text-[11px] text-ink/80 outline-none focus:border-brass"
      />
      <button
        type="button"
        onClick={copy}
        className="mt-2 rounded-lg border border-leather/20 px-4 py-2 text-sm font-medium text-pine transition hover:border-brass/50"
      >
        {copied ? "Copied ✓" : "Copy citation"}
      </button>
    </div>
  );
}
