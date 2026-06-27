"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";

// Inline favorite toggle (M5 / §3). Login is required to save (no guest path).
//
// Signed-out path: we kick the user to Google sign-in and round-trip the intent
// through `callbackUrl` — `?save=<businessId>` on the page they came from. After
// login they land back here and the pending save is completed automatically
// (see the effect below), so the click is never lost.

type Size = "sm" | "lg";

export function SaveHeartButton({
  businessId,
  slug,
  initialSaved = false,
  size = "lg",
  withLabel = false,
  selfFetch = false,
}: {
  businessId: string;
  /** Used to build the post-login callback URL (return to this business page). */
  slug?: string;
  initialSaved?: boolean;
  size?: Size;
  withLabel?: boolean;
  /** When true (e.g. the standalone business-page heart), the button fetches
   *  its own saved-state via GET /api/saved-stables once authenticated. Cards in
   *  a grid pass `initialSaved` from a single shared fetch instead. */
  selfFetch?: boolean;
}) {
  const { status } = useSession();
  // `override` holds the user's own toggle / async-learned state; until they
  // interact we fall back to the `initialSaved` prop. This avoids a prop->state
  // sync effect (and its cascading-render lint warning).
  const [override, setOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const completedPending = useRef(false);
  const saved = override ?? initialSaved;

  async function persist(next: boolean) {
    setBusy(true);
    setOverride(next); // optimistic
    try {
      const res = next
        ? await fetch("/api/saved-stables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId }),
          })
        : await fetch(`/api/saved-stables/${businessId}`, { method: "DELETE" });
      if (!res.ok) setOverride(!next); // revert on failure
    } catch {
      setOverride(!next);
    } finally {
      setBusy(false);
    }
  }

  // Standalone hearts (business page) learn their saved-state directly.
  useEffect(() => {
    if (!selfFetch || status !== "authenticated") return;
    let alive = true;
    fetch("/api/saved-stables")
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d: { ids?: string[] }) => {
        if (alive && Array.isArray(d.ids)) setOverride(d.ids.includes(businessId));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [selfFetch, status, businessId]);

  // Complete a pending save after a sign-in round-trip: the callbackUrl carried
  // `?save=<businessId>`. Run once, then clean the param out of the URL.
  useEffect(() => {
    if (status !== "authenticated" || completedPending.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("save") !== businessId) return;
    completedPending.current = true;
    params.delete("save");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
    // Defer the save (and its setState) out of the effect body to avoid a
    // synchronous cascading render.
    queueMicrotask(() => void persist(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, businessId]);

  function onClick(e: React.MouseEvent) {
    // Cards wrap the heart over a <Link>; never navigate on a heart click.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    if (status !== "authenticated") {
      const base = slug ? `/business/${slug}` : window.location.pathname;
      const callbackUrl = `${base}?save=${businessId}`;
      void signIn("google", { callbackUrl });
      return;
    }
    void persist(!saved);
  }

  const dim = size === "lg" ? "h-6 w-6" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this stable"}
      title={saved ? "Saved" : "Save"}
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/90 p-1.5 text-ink shadow-sm ring-1 ring-leather/15 backdrop-blur transition hover:ring-brass/50 disabled:opacity-60 ${
        withLabel ? "px-3" : ""
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`${dim} transition ${saved ? "text-brass" : "text-ink/40"}`}
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21s-7.5-4.6-10-9.2C.5 8.4 2.1 4.5 5.7 4.5c2 0 3.4 1.2 4.3 2.6.9-1.4 2.3-2.6 4.3-2.6 3.6 0 5.2 3.9 3.7 7.3C19.5 16.4 12 21 12 21z"
        />
      </svg>
      {withLabel && (
        <span className="text-sm font-medium">{saved ? "Saved" : "Save"}</span>
      )}
    </button>
  );
}
