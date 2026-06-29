"use client";

import { useState } from "react";
import { POLICIES } from "@/lib/facets";
import { ChipMultiSelect, FacetSection, SaveBar } from "../_facets/ChipMultiSelect";

// Policy slugs surfaced on other tabs: trainer policy (Disciplines) and access
// policy (Boarding). Excluded here so each slug has one home; the server
// preserves the excluded slugs on save.
const ELSEWHERE_POLICY_SLUGS = ["open-barn", "closed-barn", "24-7-access", "daylight-access-only"];
const FACILITY_POLICY_SLUGS = POLICIES.map((p) => p.slug).filter(
  (s) => !ELSEWHERE_POLICY_SLUGS.includes(s),
);

export function FacilityForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: { amenities: string[]; securityFeatures: string[]; policies: string[] };
}) {
  const [amenities, setAmenities] = useState<string[]>(initial.amenities);
  const [securityFeatures, setSecurityFeatures] = useState<string[]>(initial.securityFeatures);
  // Only the facility-owned policy slugs are editable here; the rest pass through
  // untouched (the server preserves trainer/access policies).
  const [policies, setPolicies] = useState<string[]>(
    initial.policies.filter((p) => FACILITY_POLICY_SLUGS.includes(p)),
  );
  const passthroughPolicies = initial.policies.filter((p) => !FACILITY_POLICY_SLUGS.includes(p));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty = () => setStatus("idle");

  async function save() {
    setStatus("saving");
    setError(null);
    const res = await fetch(`/api/owner/businesses/${businessId}/facility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amenities,
        securityFeatures,
        // Merge facility-owned slugs with the trainer/access slugs we passed
        // through; the server re-splits and preserves the others anyway.
        policies: [...passthroughPolicies, ...policies],
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
      <FacetSection title="Amenities">
        <ChipMultiSelect
          facet="amenities"
          value={amenities}
          onChange={(v) => {
            setAmenities(v);
            dirty();
          }}
        />
      </FacetSection>

      <FacetSection title="Security & safety">
        <ChipMultiSelect
          facet="securityFeatures"
          value={securityFeatures}
          onChange={(v) => {
            setSecurityFeatures(v);
            dirty();
          }}
        />
      </FacetSection>

      <FacetSection title="Barn policies">
        <ChipMultiSelect
          facet="policies"
          only={FACILITY_POLICY_SLUGS}
          value={policies}
          onChange={(v) => {
            setPolicies(v);
            dirty();
          }}
        />
      </FacetSection>

      <SaveBar status={status} error={error} label="Save facility" onSave={save} />
    </div>
  );
}
