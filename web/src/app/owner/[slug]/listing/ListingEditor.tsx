"use client";

import { useMemo, useState } from "react";
import { StableCard, type StableMarker } from "@/components/stable/StableCard";
import { OFFERINGS } from "@/lib/db/owner";

// Suggested amenities (free-text additions still allowed). These match the chips
// the public card renders.
const SUGGESTED_AMENITIES = [
  "Indoor Arena",
  "Outdoor Arena",
  "Round Pen",
  "Trails",
  "Wash Stall",
  "Turnout",
  "Pasture Board",
  "Full Board",
  "Cross Ties",
  "Tack Room",
  "Heated Barn",
  "Hot Walker",
  "Grass Jumping Field",
  "Trailer Parking",
];

export function ListingEditor({
  businessId,
  baseMarker,
  initial,
}: {
  businessId: string;
  baseMarker: StableMarker;
  initial: { offering: string; priceFrom: number | null; amenities: string[] };
}) {
  const [offering, setOffering] = useState(initial.offering);
  const [price, setPrice] = useState(initial.priceFrom != null ? String(initial.priceFrom) : "");
  const [amenities, setAmenities] = useState<string[]>(initial.amenities);
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const priceNum = price.trim() === "" ? null : Number(price);

  const previewMarker: StableMarker = useMemo(
    () => ({
      ...baseMarker,
      offering,
      priceFrom: priceNum != null && Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null,
      amenities,
    }),
    [baseMarker, offering, priceNum, amenities],
  );

  function toggleAmenity(a: string) {
    setAmenities((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
    setStatus("idle");
  }

  function addCustom() {
    const a = custom.trim();
    if (a && !amenities.some((x) => x.toLowerCase() === a.toLowerCase())) {
      setAmenities((cur) => [...cur, a]);
    }
    setCustom("");
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError(null);
    if (priceNum != null && (!Number.isFinite(priceNum) || priceNum <= 0)) {
      setError("Price must be a positive number.");
      setStatus("error");
      return;
    }
    // Two writes: offering+price (attribute merge) then amenities (column replace).
    const offRes = await fetch(`/api/owner/businesses/${businessId}/offering`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offering, priceFrom: priceNum }),
    });
    if (!offRes.ok) {
      setError((await offRes.json().catch(() => ({}))).error ?? "Could not save offering.");
      setStatus("error");
      return;
    }
    const amRes = await fetch(`/api/owner/businesses/${businessId}/amenities`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amenities }),
    });
    if (!amRes.ok) {
      setError((await amRes.json().catch(() => ({}))).error ?? "Could not save amenities.");
      setStatus("error");
      return;
    }
    setStatus("saved");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-semibold text-ink/60">Offering</p>
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-leather/15 bg-cream-dark/40 p-1">
            {OFFERINGS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  setOffering(o);
                  setStatus("idle");
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  offering === o ? "bg-pine text-cream shadow-sm" : "text-ink/60 hover:text-pine"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-ink/60">Starting price (per month)</p>
          <div className="flex items-center gap-2">
            <span className="text-ink/50">$</span>
            <input
              type="number"
              min={1}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setStatus("idle");
              }}
              placeholder="e.g. 600"
              className="w-40 rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            />
            <span className="text-xs text-ink/45">Leave blank to hide the price.</span>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-ink/60">Amenities</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set([...SUGGESTED_AMENITIES, ...amenities])].map((a) => {
              const on = amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    on
                      ? "border-pine bg-pine/10 text-pine"
                      : "border-leather/20 text-ink/55 hover:border-brass/50"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  {a}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="Add a custom amenity"
              className="w-56 rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            />
            <button
              type="button"
              onClick={addCustom}
              className="rounded-lg border border-leather/20 px-3 py-2 text-sm font-medium text-pine transition hover:border-brass/50"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-leather/10 pt-4">
          <button
            type="button"
            onClick={save}
            disabled={status === "saving"}
            className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
          >
            {status === "saving" ? "Saving…" : "Save listing"}
          </button>
          {status === "saved" && <span className="text-sm text-pine">Saved ✓</span>}
          {status === "error" && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Live preview</p>
        <div className="sticky top-6">
          <StableCard s={previewMarker} />
        </div>
      </div>
    </div>
  );
}
