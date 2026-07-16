"use client";

import { useState } from "react";

import { track } from "@/lib/analytics/track";

// One-field newsletter capture (growth-and-pipeline.md §4). Rendered in the
// footer; posts to /api/newsletter with a honeypot field for bots.
export function NewsletterSignup({ source = "footer" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Something went wrong — try again.");
        return;
      }
      setState("done");
      setMessage("You're in! Watch for barn news and new-listing alerts.");
      track("newsletter_signup", { source });
    } catch {
      setState("error");
      setMessage("Network error — try again.");
    }
  }

  if (state === "done") {
    return <p className="mt-2 text-sm text-pine">{message}</p>;
  }

  return (
    <form onSubmit={submit} className="mt-2">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brass"
        />
        {/* Honeypot — hidden from humans, tempting to bots */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="shrink-0 rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-cream transition hover:bg-pine-light disabled:opacity-50"
        >
          Sign up
        </button>
      </div>
      {state === "error" && <p className="mt-1 text-xs text-red-600">{message}</p>}
    </form>
  );
}
