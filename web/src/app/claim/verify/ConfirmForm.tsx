"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { businessUrl } from "@/lib/urls";

type Phase =
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "verified"; slug: string; name: string }
  | { kind: "already"; slug: string; name: string }
  | { kind: "disputed"; name: string }
  | { kind: "expired"; claimId: string | null }
  | { kind: "error"; message: string };

const CARD = "mx-auto max-w-xl px-4 py-16 text-center";
const BTN =
  "inline-flex items-center justify-center rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine/90 disabled:opacity-60";

function Badge({ tone, children }: { tone: "ok" | "bad"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-pine/10 text-pine"
      : "bg-leather/15 text-leather";
  return (
    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${cls}`}>
      {children}
    </div>
  );
}

export function ConfirmForm({ token }: { token: string | null }) {
  const { data: session, status, update } = useSession();
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [resending, setResending] = useState(false);

  if (!token) {
    return (
      <div className={CARD}>
        <Badge tone="bad">✕</Badge>
        <h1 className="mt-4 text-2xl font-bold text-ink">Invalid link</h1>
        <p className="mt-2 text-ink/70">This verification link is missing its token.</p>
        <Link href="/" className="mt-6 inline-block text-pine hover:underline">
          Back home →
        </Link>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className={CARD}>
        <div className="mx-auto h-14 w-14 animate-pulse rounded-full bg-cream-dark" />
      </div>
    );
  }

  // Session required — anonymous users sign in with Google, returning here.
  if (!session?.user) {
    const callbackUrl = `/claim/verify?token=${encodeURIComponent(token)}`;
    return (
      <div className={CARD}>
        <h1 className="text-2xl font-bold text-ink">Confirm your barn claim</h1>
        <p className="mt-2 text-ink/70">
          Sign in with the Google account for the email the verification link was sent to, then
          confirm ownership.
        </p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className={`mt-6 ${BTN}`}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  async function confirm() {
    setPhase({ kind: "submitting" });
    const res = await fetch("/api/claim/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.status === "verified") {
      // Refresh the JWT so role flips USER -> OWNER without a re-login.
      await update();
      setPhase({ kind: "verified", slug: data.business.slug, name: data.business.name });
    } else if (data.status === "already") {
      setPhase({ kind: "already", slug: data.business.slug, name: data.business.name });
    } else if (data.status === "disputed") {
      setPhase({ kind: "disputed", name: data.business.name });
    } else if (data.status === "expired") {
      setPhase({ kind: "expired", claimId: data.claimId ?? null });
    } else {
      setPhase({ kind: "error", message: data.error ?? "Verification failed." });
    }
  }

  async function resend(claimId: string) {
    setResending(true);
    const res = await fetch("/api/claim/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId }),
    });
    const data = await res.json().catch(() => ({}));
    setResending(false);
    setPhase({
      kind: "error",
      message: res.ok
        ? "A fresh verification link was sent to the listing's contact email. Check that inbox."
        : data.error ?? "Couldn't resend the link.",
    });
  }

  if (phase.kind === "verified" || phase.kind === "already") {
    return (
      <div className={CARD}>
        <Badge tone="ok">✓</Badge>
        <h1 className="mt-4 text-2xl font-bold text-ink">
          {phase.kind === "already" ? "Already verified" : "Listing verified!"}
        </h1>
        <p className="mt-2 text-ink/70">
          {phase.name} is now yours to manage. Head to your dashboard to edit the listing.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/owner" className={BTN}>
            Go to barn dashboard
          </Link>
          <Link href={businessUrl(phase.slug)} className="text-pine hover:underline">
            View listing →
          </Link>
        </div>
      </div>
    );
  }

  if (phase.kind === "disputed") {
    return (
      <div className={CARD}>
        <Badge tone="bad">!</Badge>
        <h1 className="mt-4 text-2xl font-bold text-ink">Claim under review</h1>
        <p className="mt-2 text-ink/70">
          {phase.name} already has a verified owner, so we&apos;ve sent your claim to our team to
          review. We&apos;ll be in touch if anything&apos;s needed.
        </p>
        <Link href="/" className="mt-6 inline-block text-pine hover:underline">
          Back home →
        </Link>
      </div>
    );
  }

  if (phase.kind === "expired") {
    return (
      <div className={CARD}>
        <Badge tone="bad">⌛</Badge>
        <h1 className="mt-4 text-2xl font-bold text-ink">Link expired</h1>
        <p className="mt-2 text-ink/70">
          Verification links are valid for 72 hours. Request a fresh one below.
        </p>
        {phase.claimId && (
          <button
            type="button"
            disabled={resending}
            onClick={() => resend(phase.claimId!)}
            className={`mt-6 ${BTN}`}
          >
            {resending ? "Sending…" : "Resend verification link"}
          </button>
        )}
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className={CARD}>
        <Badge tone="bad">✕</Badge>
        <h1 className="mt-4 text-2xl font-bold text-ink">We couldn&apos;t verify that</h1>
        <p className="mt-2 text-ink/70">{phase.message}</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "ready" })}
          className="mt-6 text-pine hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // ready / submitting — the explicit confirm step (GET must not mutate).
  return (
    <div className={CARD}>
      <h1 className="text-2xl font-bold text-ink">Confirm your barn claim</h1>
      <p className="mt-2 text-ink/70">
        Signed in as <span className="font-medium text-pine">{session.user.email}</span>. Confirm to
        verify ownership of this listing.
      </p>
      <button
        type="button"
        disabled={phase.kind === "submitting"}
        onClick={confirm}
        className={`mt-6 ${BTN}`}
      >
        {phase.kind === "submitting" ? "Verifying…" : "Confirm and verify"}
      </button>
    </div>
  );
}
