"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { track } from "@/lib/analytics/track";

// Consumer inquiry / lead form (M6 / §3), modeled on ClaimForm. Posts to
// /api/businesses/[id]/inquiry. Guests submit name + email + message; signed-in
// users get name/email pre-filled (and the route stamps their userId so the lead
// appears in /account/inquiries). Brand tokens: brass / pine / ink / cream / leather.
export function InquiryForm({
  businessId,
  businessName,
  defaultName,
  defaultEmail,
  isSignedIn,
}: {
  businessId: string;
  businessName: string;
  defaultName?: string | null;
  defaultEmail?: string | null;
  isSignedIn?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [delivered, setDelivered] = useState(true);
  const [sentEmail, setSentEmail] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    const form = new FormData(e.currentTarget);
    const submittedEmail = String(form.get("email") ?? "").trim();
    setSentEmail(submittedEmail);
    const res = await fetch(`/api/businesses/${businessId}/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: submittedEmail,
        phone: form.get("phone"),
        message: form.get("message"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "Something went wrong. Please try again.");
      return;
    }
    setDelivered(data.delivered !== false);
    setStatus("done");
    // GA4 recommended event — the primary paid-traffic conversion (imported
    // into Google Ads as the campaign optimization target).
    track("generate_lead", { business_id: businessId });
  }

  if (status === "done") {
    // callbackUrl returns the visitor to this listing after Google sign-in.
    const callbackUrl = typeof window !== "undefined" ? window.location.href : "/account/inquiries";
    return (
      <div className="rounded-xl border border-pine/25 bg-pine/5 p-5 text-sm text-pine">
        <p className="font-semibold">Message sent ✓</p>
        <p className="mt-1 text-ink/70">
          {delivered
            ? `We've passed your message to ${businessName}. They'll reply to your email.`
            : `Your message is saved. ${businessName} hasn't claimed their page yet — we've invited them to join and reply, and we'll email you if they do.`}
        </p>
        {!isSignedIn && (
          <div className="mt-3 border-t border-pine/15 pt-3">
            <p className="text-ink/70">Create a free account to track this message and get notified of replies.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {/* We already have their email from the inquiry — a magic link
                  turns it into an account with no password and no Google. */}
              {sentEmail && (
                <button
                  type="button"
                  onClick={() => void signIn("resend", { email: sentEmail, callbackUrl })}
                  className="inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2 font-medium text-cream transition hover:bg-pine-light"
                >
                  Email me a sign-in link
                </button>
              )}
              <button
                type="button"
                onClick={() => void signIn("google", { callbackUrl })}
                className="inline-flex items-center gap-2 rounded-lg border border-pine/30 px-4 py-2 font-medium text-pine transition hover:border-brass hover:text-brass"
              >
                Continue with Google
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-leather/25 bg-cream/40 px-3 py-2 text-ink focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="inq-name" className="block text-sm font-medium text-pine">
          Your name
        </label>
        <input
          id="inq-name"
          name="name"
          required
          defaultValue={defaultName ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="inq-email" className="block text-sm font-medium text-pine">
          Email
        </label>
        <input
          id="inq-email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="inq-phone" className="block text-sm font-medium text-pine">
          Phone (optional)
        </label>
        <input id="inq-phone" name="phone" className={inputClass} />
      </div>
      <div>
        <label htmlFor="inq-message" className="block text-sm font-medium text-pine">
          Message
        </label>
        <textarea
          id="inq-message"
          name="message"
          required
          rows={4}
          placeholder={`Hi ${businessName}, I'm interested in…`}
          className={inputClass}
        />
      </div>
      {status === "error" && <p className="text-sm text-red-600">{message}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Send inquiry"}
      </button>
      {!isSignedIn && (
        <p className="text-xs text-ink/55">
          You can send this as a guest. Sign in to track your inquiries in your account.
        </p>
      )}
    </form>
  );
}
