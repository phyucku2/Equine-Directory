"use client";

import { useState } from "react";
import type { SubTier } from "@prisma/client";
import { PRICES } from "@/lib/entitlements";

// Cents → "$2.99" / "$25".
function money(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

type TierKey = "VERIFIED" | "TEAM" | "EVENTS";

const TIER_ORDER: Record<SubTier, number> = {
  FREE: 0,
  VERIFIED: 1,
  TEAM: 2,
  EVENTS: 3,
  // Legacy aliases (PRO→TEAM, PREMIUM→EVENTS).
  PRO: 2,
  PREMIUM: 3,
};

const TIERS: { key: TierKey; name: string; tagline: string; unlocks: string[] }[] = [
  {
    key: "VERIFIED",
    name: "Verified",
    tagline: `${money(PRICES.verified.monthly)}/mo or ${money(PRICES.verified.yearly)}/yr`,
    unlocks: [
      "Verified badge",
      "5 owner photos + 1 logo",
      "“Stalls Available” badge",
      "Collect & respond to reviews",
      "Edit rich facets (board, disciplines, programs, …)",
    ],
  },
  {
    key: "TEAM",
    name: "Team",
    tagline: `Verified + ${money(PRICES.trainerSeat.yearly)}/yr per trainer`,
    unlocks: ["Everything in Verified", "Trainer profiles — 2 seats included", "Public trainer pages"],
  },
  {
    key: "EVENTS",
    name: "Events",
    tagline: `Team + ${money(PRICES.events.yearly)}/yr`,
    unlocks: ["Everything in Team", "Publish events / shows / clinics / camps", "Public event pages + calendar"],
  },
];

type Status = { state: "idle" | "busy" | "done" | "error"; message: string };

export function PlanPanel({
  businessId,
  tier,
  maxTrainers,
  spotlightActive,
  city,
  billingEnabled,
}: {
  businessId: string;
  tier: SubTier;
  maxTrainers: number;
  spotlightActive: boolean;
  city: { id: string; name: string } | null;
  billingEnabled: boolean;
}) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");
  const [seats, setSeats] = useState(1);
  const [weeks, setWeeks] = useState(1);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });

  const current = TIER_ORDER[tier];
  const ctaLabel = billingEnabled ? "Upgrade" : "Request access";

  async function request(payload: Record<string, unknown>) {
    setStatus({ state: "busy", message: "" });
    try {
      const res = await fetch(`/api/owner/businesses/${businessId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ state: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      // Behind the billing flag the server tells us to open Stripe Checkout
      // (stage 4 maps each request to a price); in beta it files the request.
      if (data.checkout) {
        setStatus({
          state: "done",
          message: "Redirecting to checkout…",
        });
        // The checkout route maps the plan request to Stripe line items + price
        // ids (web/src/lib/billing/products.ts) and returns the Checkout URL.
        const co = await fetch(`/api/billing/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, request: payload }),
        });
        const coData = await co.json().catch(() => ({}));
        if (co.ok && coData.url) {
          window.location.assign(coData.url);
          return;
        }
        setStatus({ state: "error", message: coData.error ?? "Checkout is not available yet." });
        return;
      }
      setStatus({ state: "done", message: data.message ?? "Request received." });
    } catch {
      setStatus({ state: "error", message: "Network error." });
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Current plan + billing-cycle toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/60">
          Current plan: <span className="font-semibold text-pine">{tier}</span>
        </p>
        <div className="inline-flex rounded-lg border border-leather/20 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={`rounded-md px-3 py-1 font-medium transition ${
              cycle === "monthly" ? "bg-pine text-cream" : "text-ink/55 hover:text-pine"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle("yearly")}
            className={`rounded-md px-3 py-1 font-medium transition ${
              cycle === "yearly" ? "bg-pine text-cream" : "text-ink/55 hover:text-pine"
            }`}
          >
            Annual <span className="text-[11px] opacity-80">· best value</span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((t) => {
          const owned = current >= TIER_ORDER[t.key];
          return (
            <div
              key={t.key}
              className={`flex flex-col rounded-xl border p-4 ${
                owned ? "border-brass/60 bg-brass/5" : "border-leather/15"
              }`}
            >
              <p className="text-sm font-bold text-pine">{t.name}</p>
              <p className="mt-0.5 text-xs text-ink/55">{t.tagline}</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-ink/65">
                {t.unlocks.map((u) => (
                  <li key={u} className="flex gap-1.5">
                    <span className="text-brass">✓</span>
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={owned || status.state === "busy"}
                onClick={() => request({ kind: "verified", cycle })}
                className="mt-4 rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-cream transition hover:bg-pine-light disabled:opacity-50"
              >
                {owned ? "Active" : ctaLabel}
              </button>
            </div>
          );
        })}
      </div>

      {/* Trainer seats */}
      <div className="rounded-xl border border-leather/15 p-4">
        <p className="text-sm font-semibold text-pine">Trainer seats</p>
        <p className="mt-0.5 text-xs text-ink/55">
          Team includes 2 seats · {money(PRICES.trainerSeat.yearly)}/yr per extra seat.
          {maxTrainers > 0 && ` You currently have ${maxTrainers} seats.`}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="inline-flex items-center rounded-lg border border-leather/20">
            <button
              type="button"
              onClick={() => setSeats((s) => Math.max(1, s - 1))}
              className="px-3 py-1.5 text-pine hover:bg-cream-dark"
            >
              −
            </button>
            <span className="w-10 text-center text-sm font-medium text-ink">{seats}</span>
            <button
              type="button"
              onClick={() => setSeats((s) => Math.min(50, s + 1))}
              className="px-3 py-1.5 text-pine hover:bg-cream-dark"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={status.state === "busy"}
            onClick={() => request({ kind: "trainerSeat", quantity: seats })}
            className="rounded-lg border border-leather/20 px-4 py-2 text-sm font-medium text-pine transition hover:border-brass/50 disabled:opacity-50"
          >
            {ctaLabel} · {money(PRICES.trainerSeat.yearly * seats)}/yr
          </button>
        </div>
      </div>

      {/* Spotlight */}
      <div className="rounded-xl border border-leather/15 p-4">
        <p className="text-sm font-semibold text-pine">Spotlight placement</p>
        <p className="mt-0.5 text-xs text-ink/55">
          Featured at the top of {city ? <span className="font-medium">{city.name}</span> : "your city"}{" "}
          search · {money(PRICES.spotlight.weekly)}/week · max 3 per city.
          {spotlightActive && " A spotlight is currently active."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink/65">
            Weeks
            <input
              type="number"
              min={1}
              max={52}
              value={weeks}
              onChange={(e) => setWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brass"
            />
          </label>
          <button
            type="button"
            disabled={!city || status.state === "busy"}
            onClick={() => city && request({ kind: "spotlight", locationId: city.id, weeks })}
            className="rounded-lg border border-leather/20 px-4 py-2 text-sm font-medium text-pine transition hover:border-brass/50 disabled:opacity-50"
          >
            {ctaLabel} · {money(PRICES.spotlight.weekly * weeks)}
          </button>
        </div>
      </div>

      {status.state === "done" && <p className="text-sm text-pine">{status.message}</p>}
      {status.state === "error" && <p className="text-sm text-red-600">{status.message}</p>}
    </div>
  );
}
