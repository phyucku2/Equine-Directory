"use client";

import { useState } from "react";
import Link from "next/link";
import { businessUrl } from "@/lib/urls";

// Client list for /account/reviews (M7 / §3): inline edit (PATCH) + delete
// (DELETE) of the user's own reviews. Editing a review resets moderation
// server-side (isApproved -> false) and recomputes the business rating.

export interface MyReview {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  isApproved: boolean;
  ownerResponse: string | null;
  createdAt: string;
  business: { slug: string; name: string };
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  if (!onChange) {
    return <span className="text-brass">{"★".repeat(value)}</span>;
  }
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className={`text-xl leading-none ${n <= value ? "text-brass" : "text-leather/25"}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

function ReviewRow({
  review,
  onChanged,
  onRemoved,
}: {
  review: MyReview;
  onChanged: (r: MyReview) => void;
  onRemoved: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [title, setTitle] = useState(review.title ?? "");
  const [content, setContent] = useState(review.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, title, content }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }
    onChanged({
      ...review,
      rating,
      title: title.trim() || null,
      content: content.trim(),
      isApproved: false, // edits go back to pending
    });
    setEditing(false);
  }

  async function remove() {
    if (!confirm("Delete this review?")) return;
    setBusy(true);
    const res = await fetch(`/api/reviews/${review.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onRemoved(review.id);
  }

  return (
    <li className="rounded-xl border border-leather/15 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={businessUrl(review.business.slug)} className="font-medium text-pine hover:text-brass">
          {review.business.name}
        </Link>
        {!review.isApproved && (
          <span className="rounded-full bg-brass/15 px-2 py-0.5 text-xs font-medium text-leather">
            Pending review
          </span>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <Stars value={rating} onChange={setRating} />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            placeholder="Title (optional)"
            className="w-full rounded-lg border border-leather/25 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            maxLength={5000}
            className="w-full rounded-lg border border-leather/25 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="rounded-lg border border-leather/25 px-4 py-2 text-sm font-medium text-pine transition hover:border-brass hover:text-brass"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2">
            <Stars value={review.rating} />
          </div>
          {review.title && <p className="mt-1 font-medium text-ink/80">{review.title}</p>}
          <p className="mt-1 text-sm text-ink/70">{review.content}</p>
          {review.ownerResponse && (
            <div className="mt-3 rounded-lg bg-pine/5 p-3 text-sm text-ink/70">
              <span className="font-medium text-pine">Owner response: </span>
              {review.ownerResponse}
            </div>
          )}
          <div className="mt-3 flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-brass hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-red-600 hover:underline disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}

export function MyReviewsList({ initial }: { initial: MyReview[] }) {
  const [reviews, setReviews] = useState(initial);

  if (reviews.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-leather/25 bg-white p-6 text-sm text-ink/55">
        You haven&apos;t written any reviews yet. Find a stable and share your experience.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {reviews.map((r) => (
        <ReviewRow
          key={r.id}
          review={r}
          onChanged={(updated) =>
            setReviews((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
          }
          onRemoved={(id) => setReviews((prev) => prev.filter((x) => x.id !== id))}
        />
      ))}
    </ul>
  );
}
