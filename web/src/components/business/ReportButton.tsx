"use client";

import { useState } from "react";

const REASONS: { value: string; label: string }[] = [
  { value: "not_a_stable", label: "Not a stable or barn" },
  { value: "closed", label: "Permanently closed" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "other", label: "Something else" },
];

// Crowdsourced moderation flag (post-launch-fixes.md §4). Anonymous public
// visitors can report a listing that isn't a boarding facility; enough
// independent reports auto-hide it for admin triage.
export function ReportButton({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("not_a_stable");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  async function submit() {
    setState("sending");
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, reason, detail: detail.trim() || undefined }),
      });
    } catch {
      // Swallow — reporting is best-effort; we still thank the reporter.
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <p className="text-xs text-ink/50">Thanks — we&apos;ll review this listing.</p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink/45 underline-offset-2 transition hover:text-red-700 hover:underline"
      >
        ⚑ Report this listing
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-leather/20 bg-white p-3 text-sm">
      <p className="font-medium text-pine">Report this listing</p>
      <fieldset className="mt-2 space-y-1.5">
        {REASONS.map((r) => (
          <label key={r.value} className="flex items-center gap-2 text-ink/75">
            <input
              type="radio"
              name="report-reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="accent-pine"
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Add a detail (optional)"
        rows={2}
        maxLength={512}
        className="mt-2 w-full rounded-md border border-leather/20 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={state === "sending"}
          className="rounded-md bg-pine px-3 py-1.5 text-xs font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : "Submit report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink/50 hover:text-ink/80"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
