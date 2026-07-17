"use client";

import { useState } from "react";
import Link from "next/link";
import { businessUrl } from "@/lib/urls";

// Client-side moderation list. Talks to POST /api/admin/review (not a Server
// Action) so it can't go stale after a redeploy, and shows explicit feedback:
// the item slides to a resolved state and the pending counter updates, so an
// admin working an ~8k backlog can *see* each decision land instead of the list
// silently refilling. See the route handler for the why.
export type ReviewItem = {
  businessId: string;
  categoryId: string;
  grade: string;
  confidence: number | null;
  evidenceQuote: string | null;
  business: { name: string; slug: string; website: string | null; address: string | null };
  category: { name: string };
};

const GRADE_LABEL: Record<string, { label: string; cls: string }> = {
  GRADE_1_NOT: { label: "1 · No evidence", cls: "bg-red-100 text-red-800" },
  GRADE_2_UNSURE: { label: "2 · Unsure", cls: "bg-amber-100 text-amber-900" },
};

type ItemState = { status: "idle" | "working" | "approved" | "rejected" | "error"; error?: string };

export function ReviewList({
  items,
  totalPending,
  loadedCount,
}: {
  items: ReviewItem[];
  totalPending: number;
  loadedCount: number;
}) {
  const [rows, setRows] = useState(items);
  const [pending, setPending] = useState(totalPending);
  const [state, setState] = useState<Record<string, ItemState>>({});
  const [purging, setPurging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const keyOf = (i: ReviewItem) => `${i.businessId}:${i.categoryId}`;

  async function moderate(item: ReviewItem, decision: "approve" | "reject") {
    const key = keyOf(item);
    setState((s) => ({ ...s, [key]: { status: "working" } }));
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "moderate",
          businessId: item.businessId,
          categoryId: item.categoryId,
          decision,
          slug: item.business.slug,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState((s) => ({ ...s, [key]: { status: "error", error: data.error ?? "Failed" } }));
        return;
      }
      if (typeof data.pending === "number") setPending(data.pending);
      setState((s) => ({ ...s, [key]: { status: decision === "approve" ? "approved" : "rejected" } }));
      // Drop the resolved row after a beat so the confirmation is visible.
      setTimeout(() => setRows((r) => r.filter((x) => keyOf(x) !== key)), 900);
    } catch {
      setState((s) => ({ ...s, [key]: { status: "error", error: "Network error" } }));
    }
  }

  async function purge() {
    setPurging(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "purge" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "Purge failed.");
        return;
      }
      if (typeof data.pending === "number") setPending(data.pending);
      const kws: string[] = data.keywords ?? [];
      setRows((r) =>
        r.filter((x) => !kws.some((kw) => x.business.name.toLowerCase().includes(kw.toLowerCase()))),
      );
      setNotice(`Rejected ${data.rejected ?? 0} church/equipment listing(s) from the queue.`);
    } catch {
      setNotice("Network error while purging.");
    } finally {
      setPurging(false);
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
          {pending.toLocaleString()} pending in total
        </span>
        <span className="text-sm text-stone-500">
          Showing {rows.length} of {loadedCount} loaded (oldest grade-1 first)
        </span>
        <button
          onClick={purge}
          disabled={purging}
          className="ml-auto rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {purging ? "Removing…" : "Remove church / equipment"}
        </button>
      </div>
      {notice && <p className="mt-2 text-sm text-emerald-800">{notice}</p>}

      {rows.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          Nothing left in the loaded batch — reload to pull the next {loadedCount}. 🎉
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((item) => {
            const key = keyOf(item);
            const st = state[key] ?? { status: "idle" };
            const g = GRADE_LABEL[item.grade] ?? { label: item.grade, cls: "bg-stone-100" };
            const resolved = st.status === "approved" || st.status === "rejected";
            return (
              <li
                key={key}
                className={`rounded-xl border p-5 transition ${
                  resolved ? "border-stone-100 bg-stone-50 opacity-60" : "border-stone-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={businessUrl(item.business.slug)}
                        className="font-semibold text-stone-900 hover:text-emerald-800"
                        target="_blank"
                      >
                        {item.business.name}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${g.cls}`}>{g.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">{item.business.address}</p>
                    <p className="mt-2 text-sm">
                      Category claim: <span className="font-medium text-stone-800">{item.category.name}</span>
                      {item.confidence != null && (
                        <span className="text-stone-400"> · confidence {Number(item.confidence).toFixed(2)}</span>
                      )}
                    </p>
                    {item.evidenceQuote && (
                      <blockquote className="mt-2 border-l-2 border-stone-300 pl-3 text-sm italic text-stone-600">
                        “{item.evidenceQuote}”
                      </blockquote>
                    )}
                    {item.business.website && (
                      <a
                        href={item.business.website}
                        target="_blank"
                        rel="noreferrer nofollow"
                        className="mt-2 inline-block text-xs text-emerald-700 hover:underline"
                      >
                        Visit site to verify →
                      </a>
                    )}
                  </div>

                  <div className="flex min-w-[9rem] flex-col items-end gap-2">
                    {st.status === "approved" ? (
                      <span className="text-sm font-semibold text-emerald-700">✓ Approved</span>
                    ) : st.status === "rejected" ? (
                      <span className="text-sm font-semibold text-stone-500">✕ Rejected</span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => moderate(item, "approve")}
                          disabled={st.status === "working"}
                          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          {st.status === "working" ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => moderate(item, "reject")}
                          disabled={st.status === "working"}
                          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:border-red-300 hover:text-red-700 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {st.status === "error" && <span className="text-xs text-red-600">{st.error}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
