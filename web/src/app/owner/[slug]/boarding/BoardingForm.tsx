"use client";

import { useState } from "react";
import { facetLabel } from "@/lib/facets";
import type { PricingMap, PriceEntry } from "@/lib/db/owner";
import {
  ChipMultiSelect,
  FacetSection,
  SaveBar,
  numberInputCls,
  textInputCls,
} from "../_facets/ChipMultiSelect";

// Access-related policy slugs surfaced on this tab (the rest live on Facility).
const ACCESS_POLICY_SLUGS = ["24-7-access", "daylight-access-only"];

function emptyEntry(): PriceEntry {
  return { from: null, to: null, included: [] };
}

export function BoardingForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: {
    boardTypes: string[];
    policies: string[];
    spotsAvailable: number | null;
    stallCount: number | null;
    acreage: number | null;
    pricing: PricingMap;
  };
}) {
  const [boardTypes, setBoardTypes] = useState<string[]>(initial.boardTypes);
  // Access policies are a subset of the policies array; the rest pass through.
  const [access, setAccess] = useState<string[]>(
    initial.policies.filter((p) => ACCESS_POLICY_SLUGS.includes(p)),
  );
  const otherPolicies = initial.policies.filter((p) => !ACCESS_POLICY_SLUGS.includes(p));
  const [spots, setSpots] = useState(initial.spotsAvailable?.toString() ?? "");
  const [stalls, setStalls] = useState(initial.stallCount?.toString() ?? "");
  const [acreage, setAcreage] = useState(initial.acreage?.toString() ?? "");
  const [pricing, setPricing] = useState<PricingMap>(initial.pricing);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function dirty() {
    setStatus("idle");
  }

  function entryFor(slug: string): PriceEntry {
    return pricing[slug] ?? emptyEntry();
  }

  function setEntry(slug: string, patch: Partial<PriceEntry>) {
    setPricing((p) => ({ ...p, [slug]: { ...entryFor(slug), ...patch } }));
    dirty();
  }

  async function save() {
    setStatus("saving");
    setError(null);
    // Validate to >= from per filled row before sending.
    for (const slug of boardTypes) {
      const e = pricing[slug];
      if (e && e.from != null && e.to != null && e.to < e.from) {
        setError(`${facetLabel("boardTypes", slug)}: "to" must be ≥ "from".`);
        setStatus("error");
        return;
      }
    }
    // Only send pricing rows for selected board types.
    const trimmedPricing: PricingMap = {};
    for (const slug of boardTypes) if (pricing[slug]) trimmedPricing[slug] = pricing[slug];

    const res = await fetch(`/api/owner/businesses/${businessId}/boarding`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardTypes,
        // Merge the untouched non-access policy slugs back so we don't clobber them.
        policies: [...otherPolicies, ...access],
        spotsAvailable: spots,
        stallCount: stalls,
        acreage,
        pricing: trimmedPricing,
      }),
    });
    if (res.ok) {
      setStatus("saved");
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <FacetSection title="Board types offered">
        <ChipMultiSelect
          facet="boardTypes"
          value={boardTypes}
          onChange={(v) => {
            setBoardTypes(v);
            dirty();
          }}
        />
      </FacetSection>

      {boardTypes.length > 0 && (
        <FacetSection
          title="Pricing per board type"
          hint="Monthly price range and what's included. Leave blank to hide. Your lowest 'from' becomes the listing's starting price."
        >
          <div className="space-y-4">
            {boardTypes.map((slug) => {
              const e = entryFor(slug);
              return (
                <div key={slug} className="rounded-xl border border-leather/15 p-3">
                  <p className="mb-2 text-sm font-medium text-pine">
                    {facetLabel("boardTypes", slug)}
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-ink/50">
                        From ($/mo)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={e.from ?? ""}
                        onChange={(ev) =>
                          setEntry(slug, {
                            from: ev.target.value === "" ? null : Number(ev.target.value),
                          })
                        }
                        className="w-32 rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm outline-none focus:border-brass"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-ink/50">
                        To ($/mo)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={e.to ?? ""}
                        onChange={(ev) =>
                          setEntry(slug, {
                            to: ev.target.value === "" ? null : Number(ev.target.value),
                          })
                        }
                        className="w-32 rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm outline-none focus:border-brass"
                      />
                    </label>
                  </div>
                  <div className="mt-2">
                    <span className="mb-1 block text-[11px] font-semibold text-ink/50">
                      Included (comma-separated)
                    </span>
                    <input
                      value={e.included.join(", ")}
                      onChange={(ev) =>
                        setEntry(slug, {
                          included: ev.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Daily turnout, grain 2x, blanketing"
                      className={textInputCls}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </FacetSection>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Spots available</span>
          <input
            type="number"
            min={0}
            value={spots}
            onChange={(e) => {
              setSpots(e.target.value);
              dirty();
            }}
            placeholder="e.g. 3"
            className={numberInputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Total stalls</span>
          <input
            type="number"
            min={0}
            value={stalls}
            onChange={(e) => {
              setStalls(e.target.value);
              dirty();
            }}
            placeholder="e.g. 24"
            className={numberInputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Acreage</span>
          <input
            type="number"
            min={0}
            step="0.1"
            value={acreage}
            onChange={(e) => {
              setAcreage(e.target.value);
              dirty();
            }}
            placeholder="e.g. 40"
            className={numberInputCls}
          />
        </label>
      </div>

      <FacetSection title="Access policy">
        <ChipMultiSelect
          facet="policies"
          only={ACCESS_POLICY_SLUGS}
          value={access}
          onChange={(v) => {
            setAccess(v);
            dirty();
          }}
        />
      </FacetSection>

      <SaveBar status={status} error={error} label="Save boarding" onSave={save} />
    </div>
  );
}
