"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

// ReviewForm (M7 / §3) — posts to /api/businesses/[id]/reviews. Login required:
// a signed-in user is a verified author, so the review auto-approves and is
// immediately visible (the API sets isVerifiedAuthor:true). Signed-out users see
// a sign-in prompt that preserves intent via callbackUrl back to the listing.
export function ReviewForm({
  businessId,
  businessSlug,
}: {
  businessId: string;
  businessSlug: string;
}) {
  const { status } = useSession();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const callbackUrl = `/business/${businessSlug}`;

  if (status === "loading") {
    return <div className="h-10 animate-pulse rounded-lg bg-leather/10" />;
  }

  if (status === "unauthenticated") {
    return (
      <div className="rounded-xl border border-dashed border-leather/25 bg-white p-5 text-sm text-ink/70">
        <p className="font-medium text-pine">Been here? Share your experience.</p>
        <p className="mt-1">Sign in to write a review for this stable.</p>
        <button
          type="button"
          onClick={() => void signIn("google", { callbackUrl })}
          className="mt-3 rounded-lg bg-pine px-4 py-2 font-medium text-cream transition hover:bg-pine-light"
        >
          Sign in to review
        </button>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-semibold">Thanks for your review ✓</p>
        <p className="mt-1">It&apos;s now live on this listing.</p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating < 1) {
      setError("Please pick a star rating.");
      return;
    }
    setState("submitting");
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/businesses/${businessId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating,
        title: form.get("title"),
        content: form.get("content"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("error");
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setState("done");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-leather/15 bg-white p-5 space-y-4">
      <p className="font-medium text-pine">Write a review</p>

      <div>
        <span className="block text-sm font-medium text-ink/70">Your rating</span>
        <div className="mt-1 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className={`text-2xl leading-none transition ${
                n <= (hover || rating) ? "text-brass" : "text-leather/25"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="review-title" className="block text-sm font-medium text-ink/70">
          Title (optional)
        </label>
        <input
          id="review-title"
          name="title"
          maxLength={255}
          className="mt-1 w-full rounded-lg border border-leather/25 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brass"
        />
      </div>

      <div>
        <label htmlFor="review-content" className="block text-sm font-medium text-ink/70">
          Your review
        </label>
        <textarea
          id="review-content"
          name="content"
          required
          rows={4}
          maxLength={5000}
          className="mt-1 w-full rounded-lg border border-leather/25 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brass"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
      >
        {state === "submitting" ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
