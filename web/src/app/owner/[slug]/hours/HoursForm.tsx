"use client";

import { useState } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Parse stored weekdayDescriptions ("Monday: 9 AM – 5 PM") back into per-day text.
function parseInitial(descriptions: string[]): string[] {
  const byDay = new Map<string, string>();
  for (const d of descriptions) {
    const idx = d.indexOf(":");
    if (idx > 0) byDay.set(d.slice(0, idx).trim().toLowerCase(), d.slice(idx + 1).trim());
  }
  return DAYS.map((day) => byDay.get(day.toLowerCase()) ?? "");
}

export function HoursForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: string[];
}) {
  const [hours, setHours] = useState<string[]>(parseInitial(initial));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function set(i: number, value: string) {
    setHours((cur) => cur.map((h, j) => (j === i ? value : h)));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError(null);
    const weekdayDescriptions = DAYS.map((day, i) => {
      const v = hours[i].trim();
      return v ? `${day}: ${v}` : `${day}: Closed`;
    });
    const res = await fetch(`/api/owner/businesses/${businessId}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekdayDescriptions }),
    });
    if (res.ok) setStatus("saved");
    else {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save hours.");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      {DAYS.map((day, i) => (
        <div key={day} className="grid grid-cols-[110px_1fr] items-center gap-3">
          <span className="text-sm font-medium text-ink/70">{day}</span>
          <input
            value={hours[i]}
            onChange={(e) => set(i, e.target.value)}
            placeholder="e.g. 9:00 AM – 5:00 PM (blank = Closed)"
            className="rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm outline-none focus:border-brass"
          />
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save hours"}
        </button>
        {status === "saved" && <span className="text-sm text-pine">Saved ✓</span>}
        {status === "error" && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
