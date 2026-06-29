"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";

export interface SaveSearchFilters {
  category?: string;
  q?: string;
  amenities?: string[];
  bbox?: [number, number, number, number];
  priceFrom?: number;
  rating?: number;
  verified?: boolean;
  // Zillow-style facet filters (owner-profile-facets.md §6).
  disciplines?: string[];
  boardTypes?: string[];
  trainingTypes?: string[];
  securityFeatures?: string[];
  policies?: string[];
  programTypes?: string[];
  priceMax?: number;
  available?: boolean;
}

type Status = "idle" | "saving" | "saved" | "error" | "limit";

// "Save this search" entry point for the map toolbar (M8a / §3). Signed-out
// users are routed to Google sign-in, preserving intent via callbackUrl back to
// the map. Signed-in users get a small modal to name the search + pick the
// alert frequency, then POST /api/saved-searches.
export function SaveSearchButton({ filters }: { filters: () => SaveSearchFilters }) {
  const { status: authStatus } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"INSTANT" | "DAILY" | "WEEKLY">("DAILY");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (authStatus !== "authenticated") {
      signIn("google", { callbackUrl: typeof window !== "undefined" ? window.location.href : "/map" });
      return;
    }
    setStatus("idle");
    setError(null);
    setName("");
    setOpen(true);
  }

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, filters: filters(), frequency, emailEnabled }),
      });
      if (res.status === 409) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "You have too many saved searches.");
        setStatus("limit");
        return;
      }
      if (!res.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setOpen(false), 1200);
    } catch {
      setError("Couldn’t save. Please try again.");
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Save this search"
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-leather/15 bg-white px-3 py-2 text-sm font-medium text-pine shadow-sm transition hover:border-brass"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-brass" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 3h14a1 1 0 0 1 1 1v17l-8-5-8 5V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">Save search</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-cream p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-pine">Save this search</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink/50 hover:text-ink"
              >
                ✕
              </button>
            </div>

            {status === "saved" ? (
              <p className="rounded-lg bg-pine/10 px-3 py-4 text-center text-sm font-medium text-pine">
                Saved — we’ll alert you when new stables match.
              </p>
            ) : (
              <>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink/55">
                  Name (optional)
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ocala barns under $600"
                  maxLength={255}
                  className="mt-1 w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                />

                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/55">Alert me</p>
                <div className="mt-2 flex overflow-hidden rounded-full ring-1 ring-leather/15">
                  {(["INSTANT", "DAILY", "WEEKLY"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={`flex-1 px-3 py-1.5 text-sm font-medium transition ${
                        frequency === f ? "bg-pine text-cream" : "bg-white text-ink hover:bg-cream-dark"
                      }`}
                    >
                      {f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-leather/30 text-pine focus:ring-brass"
                  />
                  Email me new matches
                </label>

                {error && <p className="mt-3 text-sm text-leather">{error}</p>}

                <button
                  type="button"
                  onClick={save}
                  disabled={status === "saving"}
                  className="mt-5 w-full rounded-lg bg-pine py-3 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
                >
                  {status === "saving" ? "Saving…" : "Save search"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
