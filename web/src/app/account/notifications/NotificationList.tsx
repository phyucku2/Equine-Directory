"use client";

import { useState } from "react";
import Link from "next/link";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const TYPE_LABEL: Record<string, string> = {
  SAVED_SEARCH: "Saved search",
  INQUIRY: "Inquiry",
  REVIEW_RESPONSE: "Review",
  CLAIM: "Claim",
  SYSTEM: "System",
};

export function NotificationList({ initial }: { initial: NotificationItem[] }) {
  const [items, setItems] = useState(initial);
  const hasUnread = items.some((n) => !n.readAt);

  async function markAllRead() {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
  }

  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={markAllRead}
          disabled={!hasUnread}
          className="text-sm font-medium text-brass transition hover:underline disabled:cursor-default disabled:text-ink/35 disabled:no-underline"
        >
          Mark all read
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-sm text-ink/60">
          You have no notifications yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const unread = !n.readAt;
            const inner = (
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-brass" : "bg-transparent"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                    <span className="text-xs text-ink/45">{dateFmt.format(new Date(n.createdAt))}</span>
                  </div>
                  <p className={`mt-0.5 text-sm ${unread ? "font-semibold text-pine" : "text-ink"}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 truncate text-sm text-ink/60">{n.body}</p>}
                </div>
              </div>
            );
            const cls = `block rounded-xl border bg-white p-4 transition ${
              unread ? "border-brass/30" : "border-leather/15"
            } hover:border-brass/40`;
            return (
              <li key={n.id}>
                {n.url ? (
                  <Link href={n.url} onClick={() => markRead(n.id)} className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" onClick={() => markRead(n.id)} className={`w-full text-left ${cls}`}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
