"use client";

import { useState } from "react";

type SocialLinks = Record<string, string>;

const SOCIAL_KEYS = ["facebook", "instagram", "youtube", "tiktok"] as const;

export function DetailsForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: {
    name: string;
    description: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    socialLinks: SocialLinks;
  };
}) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  }

  function setSocial(key: string, value: string) {
    setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [key]: value } }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError(null);
    const socialLinks: SocialLinks = {};
    for (const [k, v] of Object.entries(form.socialLinks)) {
      if (v.trim()) socialLinks[k] = v.trim();
    }
    const res = await fetch(`/api/owner/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        phone: form.phone,
        email: form.email,
        website: form.website,
        address: form.address,
        socialLinks: Object.keys(socialLinks).length ? socialLinks : null,
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
    <div className="max-w-2xl space-y-4">
      <Field label="Barn name">
        <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea
          className={`${inputCls} min-h-28`}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <input
            className={inputCls}
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Website">
        <input
          className={inputCls}
          placeholder="https://"
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </Field>
      <Field label="Address">
        <input
          className={inputCls}
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </Field>

      <fieldset className="rounded-xl border border-leather/15 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink/45">
          Social links
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIAL_KEYS.map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
              <input
                className={inputCls}
                placeholder="https://"
                value={form.socialLinks[k] ?? ""}
                onChange={(e) => setSocial(k, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save details"}
        </button>
        {status === "saved" && <span className="text-sm text-pine">Saved ✓</span>}
        {status === "error" && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brass";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">{label}</span>
      {children}
    </label>
  );
}
