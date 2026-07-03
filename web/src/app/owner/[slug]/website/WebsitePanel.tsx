"use client";

import { useState } from "react";
import { PRICES } from "@/lib/entitlements";

function money(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

const PACKAGES = [
  {
    key: "starter",
    name: "Starter",
    price: PRICES.websiteBuild.starter,
    features: ["One-page site built from your listing", "Your logo, photos & colors", "Mobile-fast + SEO schema", "yourbarn.thestabledirectory.com"],
  },
  {
    key: "premium",
    name: "Premium",
    price: PRICES.websiteBuild.premium,
    features: [
      "Multi-page site (boarding, training, camps, gallery, reviews)",
      "Custom domain — we manage DNS & SSL",
      "Auto-updates from your listing",
      "Priority build",
    ],
  },
] as const;

type Status = { state: "idle" | "busy" | "done" | "error"; message: string };

export function WebsitePanel({
  businessId,
  businessName,
  listingUrl,
  badgeUrl,
}: {
  businessId: string;
  businessName: string;
  listingUrl: string;
  badgeUrl: string;
}) {
  const [pkg, setPkg] = useState<"starter" | "premium">("starter");
  const [desiredDomain, setDesiredDomain] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });
  const [copied, setCopied] = useState(false);

  const snippet = `<a href="${listingUrl}?utm_source=badge"><img src="${badgeUrl}" alt="${businessName} — The Stable Directory" width="240" /></a>`;

  async function submitLead() {
    setStatus({ state: "busy", message: "" });
    try {
      const res = await fetch(`/api/owner/businesses/${businessId}/website-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: pkg, desiredDomain, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ state: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      setStatus({ state: "done", message: data.message ?? "Request received." });
    } catch {
      setStatus({ state: "error", message: "Network error." });
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — the textarea below is
      // selectable, so manual copy still works.
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Website build lead form */}
      <div className="rounded-xl border border-leather/15 p-4">
        <p className="text-sm font-semibold text-pine">Get a barn website</p>
        <p className="mt-0.5 text-xs text-ink/55">
          We build it from your listing — photos, services, pricing, trainers, reviews — so it
          stays current automatically. Includes hosting &amp; upkeep at{" "}
          {money(PRICES.websiteBuild.maintenanceYearly)}/yr.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PACKAGES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPkg(p.key)}
              className={`rounded-xl border p-4 text-left transition ${
                pkg === p.key ? "border-brass bg-brass/5 ring-1 ring-brass/40" : "border-leather/15 hover:border-brass/40"
              }`}
            >
              <p className="text-sm font-bold text-pine">
                {p.name} · {money(p.price)}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-ink/65">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <span className="text-brass">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-medium text-ink/60">
          Desired domain (optional)
          <input
            value={desiredDomain}
            onChange={(e) => setDesiredDomain(e.target.value)}
            placeholder="yourbarn.com"
            className="mt-1 w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brass"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-ink/60">
          Anything we should know? (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Pages you want, an existing site to replace, timing…"
            className="mt-1 w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brass"
          />
        </label>

        <button
          type="button"
          disabled={status.state === "busy" || status.state === "done"}
          onClick={submitLead}
          className="mt-4 rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-cream transition hover:bg-pine-light disabled:opacity-50"
        >
          {status.state === "done" ? "Request sent" : `Request my website · ${money(PACKAGES.find((p) => p.key === pkg)!.price)}`}
        </button>
        {status.state === "done" && <p className="mt-2 text-sm text-pine">{status.message}</p>}
        {status.state === "error" && <p className="mt-2 text-sm text-red-600">{status.message}</p>}
      </div>

      {/* Free badge */}
      <div className="rounded-xl border border-leather/15 p-4">
        <p className="text-sm font-semibold text-pine">Your free directory badge</p>
        <p className="mt-0.5 text-xs text-ink/55">
          Paste this on your existing website — it shows your live rating and links visitors to
          your listing.
        </p>
        <div className="mt-3 rounded-lg bg-cream p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt={`${businessName} — The Stable Directory badge`} width={240} />
        </div>
        <textarea
          readOnly
          value={snippet}
          rows={3}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full rounded-lg border border-leather/20 bg-white px-3 py-2 font-mono text-[11px] text-ink/80 outline-none focus:border-brass"
        />
        <button
          type="button"
          onClick={copySnippet}
          className="mt-2 rounded-lg border border-leather/20 px-4 py-2 text-sm font-medium text-pine transition hover:border-brass/50"
        >
          {copied ? "Copied ✓" : "Copy snippet"}
        </button>
      </div>
    </div>
  );
}
