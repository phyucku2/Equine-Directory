"use client";

import { groupedOptions, type FacetKey } from "@/lib/facets";

// Grouped chip multi-select driven by the controlled vocab in facets.ts. No
// freeform — filterable facets stay clean (see owner-profile-facets.md §4).
// `only` optionally restricts to a subset of slugs (e.g. the trainer-policy
// chips on the Disciplines tab).
export function ChipMultiSelect({
  facet,
  value,
  onChange,
  only,
}: {
  facet: FacetKey;
  value: string[];
  onChange: (next: string[]) => void;
  only?: string[];
}) {
  const groups = groupedOptions(facet);
  const allow = only ? new Set(only) : null;
  const selected = new Set(value);

  function toggle(slug: string) {
    onChange(selected.has(slug) ? value.filter((v) => v !== slug) : [...value, slug]);
  }

  const groupKeys = Object.keys(groups);
  const ungrouped = groupKeys.length === 1 && groupKeys[0] === "";

  return (
    <div className="space-y-3">
      {groupKeys.map((g) => {
        const opts = groups[g].filter((o) => !allow || allow.has(o.slug));
        if (opts.length === 0) return null;
        return (
          <div key={g || "_"}>
            {!ungrouped && g && (
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                {g}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {opts.map((o) => {
                const on = selected.has(o.slug);
                return (
                  <button
                    key={o.slug}
                    type="button"
                    onClick={() => toggle(o.slug)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      on
                        ? "border-pine bg-pine/10 text-pine"
                        : "border-leather/20 text-ink/55 hover:border-brass/50"
                    }`}
                  >
                    {on ? "✓ " : "+ "}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// A small labeled section wrapper used across the facet tabs.
export function FacetSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-ink/60">{title}</p>
      {hint && <p className="mb-2 text-xs text-ink/45">{hint}</p>}
      {children}
    </div>
  );
}

// Shared save button + status row, matching the listing/details tabs.
export function SaveBar({
  status,
  error,
  label,
  onSave,
}: {
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
  label: string;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-leather/10 pt-4">
      <button
        type="button"
        onClick={onSave}
        disabled={status === "saving"}
        className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
      >
        {status === "saving" ? "Saving…" : label}
      </button>
      {status === "saved" && <span className="text-sm text-pine">Saved ✓</span>}
      {status === "error" && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

export const numberInputCls =
  "w-40 rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brass";
export const textInputCls =
  "w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brass";
