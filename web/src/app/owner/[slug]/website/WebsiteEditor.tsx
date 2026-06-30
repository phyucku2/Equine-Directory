"use client";

import { useState } from "react";
import type { SitePageSection } from "@/lib/db/sites";

// Client editor for a started build: template gallery (radio), brand copy
// (tagline / About), and the page-section selection. Posts the whole patch to the
// owner site API in one Save. Server re-validates everything (sections vocab,
// template id, copy length) — this is just the form. Styling mirrors DetailsForm.

const inputCls =
  "w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brass";

export interface TemplateChoice {
  id: string;
  name: string;
}

export interface WebsiteEditorProps {
  businessId: string;
  templates: TemplateChoice[];
  sectionLabels: { value: SitePageSection; label: string }[];
  initial: {
    templateId: string;
    tagline: string;
    about: string;
    sections: SitePageSection[];
  };
}

export function WebsiteEditor({
  businessId,
  templates,
  sectionLabels,
  initial,
}: WebsiteEditorProps) {
  const [templateId, setTemplateId] = useState(initial.templateId);
  const [tagline, setTagline] = useState(initial.tagline);
  const [about, setAbout] = useState(initial.about);
  const [sections, setSections] = useState<Set<SitePageSection>>(new Set(initial.sections));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function toggleSection(value: SitePageSection) {
    setStatus("idle");
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function save() {
    setStatus("saving");
    setError(null);
    // Preserve the canonical section order from the label list.
    const ordered = sectionLabels.map((s) => s.value).filter((v) => sections.has(v));
    const res = await fetch(`/api/owner/sites/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        pages: { sections: ordered, tagline: tagline.trim() || null, about: about.trim() || null },
      }),
    });
    if (res.ok) {
      setStatus("saved");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save.");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Template</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => {
            const active = t.id === templateId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTemplateId(t.id);
                  setStatus("idle");
                }}
                className={`rounded-xl border px-4 py-4 text-left transition ${
                  active
                    ? "border-brass bg-brass-light/10 ring-1 ring-brass"
                    : "border-leather/20 hover:border-brass/50"
                }`}
              >
                <span className="block text-sm font-semibold text-pine">{t.name}</span>
                <span className="mt-0.5 block text-xs text-ink/45">
                  {active ? "Selected" : "Tap to choose"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Brand</h4>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Tagline</span>
          <input
            className={inputCls}
            value={tagline}
            maxLength={160}
            placeholder="Where champions are made"
            onChange={(e) => {
              setTagline(e.target.value);
              setStatus("idle");
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">About</span>
          <textarea
            className={`${inputCls} min-h-32`}
            value={about}
            maxLength={4000}
            placeholder="Tell visitors your barn's story…"
            onChange={(e) => {
              setAbout(e.target.value);
              setStatus("idle");
            }}
          />
          <span className="mt-1 block text-xs text-ink/40">
            Leave blank to use your listing description.
          </span>
        </label>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Pages</h4>
        <p className="mb-3 text-xs text-ink/50">
          Choose which sections appear. Each one only renders when your listing has that data.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {sectionLabels.map((s) => (
            <label
              key={s.value}
              className="flex items-center gap-2 rounded-lg border border-leather/15 px-3 py-2 text-sm text-ink"
            >
              <input
                type="checkbox"
                checked={sections.has(s.value)}
                onChange={() => toggleSection(s.value)}
                className="h-4 w-4 accent-pine"
              />
              {s.label}
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save website"}
        </button>
        {status === "saved" && <span className="text-sm text-pine">Saved ✓</span>}
        {status === "error" && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
