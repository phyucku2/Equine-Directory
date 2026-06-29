"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Review = {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  content: string;
  ownerResponse: string | null;
  createdAt: string;
  isApproved: boolean;
};

type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  createdAt: string;
};

function Stars({ n }: { n: number }) {
  return (
    <span className="text-brass" aria-label={`${n} stars`}>
      {"★".repeat(n)}
      <span className="text-leather/25">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function ReviewsInbox({
  businessId,
  slug,
  canRespond,
  reviews,
  inquiries,
  initialTab,
}: {
  businessId: string;
  slug: string;
  canRespond: boolean;
  reviews: Review[];
  inquiries: Inquiry[];
  initialTab: "reviews" | "inbox";
}) {
  const [tab, setTab] = useState<"reviews" | "inbox">(initialTab);
  const pendingReviews = reviews.filter((r) => r.isApproved && !r.ownerResponse).length;
  const newInquiries = inquiries.filter((i) => i.status === "NEW").length;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <TabBtn active={tab === "reviews"} onClick={() => setTab("reviews")}>
          Reviews {pendingReviews > 0 && <Badge>{pendingReviews}</Badge>}
        </TabBtn>
        <TabBtn active={tab === "inbox"} onClick={() => setTab("inbox")}>
          Inquiries {newInquiries > 0 && <Badge>{newInquiries}</Badge>}
        </TabBtn>
      </div>

      {tab === "reviews" ? (
        <div className="space-y-4">
          {!canRespond && (
            <div className="rounded-xl border border-leather/15 bg-cream-dark/40 p-4 text-sm text-ink/60">
              Responding to reviews is part of the Verified plan. Reviews still show
              publicly.{" "}
              <a href={`/owner/${slug}/plan`} className="font-medium text-pine underline">
                Upgrade
              </a>{" "}
              to reply and collect new reviews.
            </div>
          )}
          {reviews.length === 0 && <p className="text-sm text-ink/50">No reviews yet.</p>}
          {reviews.map((r) => (
            <ReviewCard key={r.id} businessId={businessId} review={r} canRespond={canRespond} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.length === 0 && <p className="text-sm text-ink/50">No inquiries yet.</p>}
          {inquiries.map((i) => (
            <InquiryCard key={i.id} businessId={businessId} inquiry={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  businessId,
  review,
  canRespond,
}: {
  businessId: string;
  review: Review;
  canRespond: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(review.ownerResponse ?? "");
  const [editing, setEditing] = useState(!review.ownerResponse);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) {
      setError("Write a response first.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError(null);
    const res = await fetch(
      `/api/owner/businesses/${businessId}/reviews/${review.id}/respond`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: text }),
      },
    );
    if (res.ok) {
      setEditing(false);
      setStatus("idle");
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-xl border border-leather/15 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <Stars n={review.rating} />
          <span className="ml-2 text-sm font-semibold text-ink">{review.authorName}</span>
        </div>
        <span className="text-xs text-ink/40">
          {new Date(review.createdAt).toLocaleDateString()}
        </span>
      </div>
      {review.title && <p className="mt-1 text-sm font-medium text-pine">{review.title}</p>}
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink/75">{review.content}</p>

      {!canRespond && !review.ownerResponse ? null : (
      <div className="mt-3 rounded-lg bg-cream-dark/40 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/45">
          Owner response
        </p>
        {!editing ? (
          <div>
            <p className="whitespace-pre-wrap text-sm text-ink/75">{review.ownerResponse}</p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 text-xs font-medium text-brass hover:underline"
            >
              Edit response
            </button>
          </div>
        ) : (
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Thank the reviewer or address their feedback…"
              className="min-h-20 w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={status === "saving"}
                className="rounded-lg bg-pine px-4 py-1.5 text-sm font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
              >
                {status === "saving" ? "Posting…" : "Post response"}
              </button>
              {review.ownerResponse && (
                <button
                  type="button"
                  onClick={() => {
                    setText(review.ownerResponse ?? "");
                    setEditing(false);
                  }}
                  className="text-sm text-ink/55 hover:text-pine"
                >
                  Cancel
                </button>
              )}
              {status === "error" && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function InquiryCard({ businessId, inquiry }: { businessId: string; inquiry: Inquiry }) {
  const router = useRouter();
  const [status, setStatus] = useState(inquiry.status);

  async function setStatusTo(next: string) {
    setStatus(next);
    await fetch(`/api/owner/businesses/${businessId}/inquiries/${inquiry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
  }

  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        status === "NEW" ? "border-brass/40" : "border-leather/15"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-ink">{inquiry.name}</span>
          {status === "NEW" && (
            <span className="ml-2 rounded-full bg-brass/15 px-2 py-0.5 text-[10px] font-semibold text-leather">
              NEW
            </span>
          )}
        </div>
        <span className="text-xs text-ink/40">
          {new Date(inquiry.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink/55">
        <a href={`mailto:${inquiry.email}`} className="text-brass hover:underline">
          {inquiry.email}
        </a>
        {inquiry.phone ? ` · ${inquiry.phone}` : ""}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink/75">{inquiry.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {status !== "READ" && status !== "REPLIED" && (
          <StatusBtn onClick={() => setStatusTo("READ")}>Mark read</StatusBtn>
        )}
        {status !== "REPLIED" && (
          <StatusBtn onClick={() => setStatusTo("REPLIED")}>Mark replied</StatusBtn>
        )}
        {status !== "ARCHIVED" && (
          <StatusBtn onClick={() => setStatusTo("ARCHIVED")}>Archive</StatusBtn>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-pine text-cream" : "text-ink/55 hover:text-pine"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-leather/20 px-3 py-1 text-xs font-medium text-pine transition hover:border-brass/50"
    >
      {children}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded-full bg-brass px-1.5 text-[10px] font-bold text-white">
      {children}
    </span>
  );
}
