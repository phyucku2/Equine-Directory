"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { ChipMultiSelect, textInputCls } from "../_facets/ChipMultiSelect";

type Trainer = {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  disciplines: string[];
  certifications: string[];
  email: string | null;
  phone: string | null;
};

type Draft = {
  name: string;
  bio: string;
  photoUrl: string;
  disciplines: string[];
  certifications: string[];
  email: string;
  phone: string;
};

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function toDraft(t?: Trainer): Draft {
  return {
    name: t?.name ?? "",
    bio: t?.bio ?? "",
    photoUrl: t?.photoUrl ?? "",
    disciplines: t?.disciplines ?? [],
    certifications: t?.certifications ?? [],
    email: t?.email ?? "",
    phone: t?.phone ?? "",
  };
}

export function TrainersManager({
  businessId,
  slug,
  maxTrainers,
  initial,
}: {
  businessId: string;
  slug: string;
  maxTrainers: number;
  initial: Trainer[];
}) {
  const router = useRouter();
  const [trainers, setTrainers] = useState<Trainer[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const atCap = trainers.length >= maxTrainers;

  function startNew() {
    setDraft(toDraft());
    setEditingId("new");
    setError(null);
  }
  function startEdit(t: Trainer) {
    setDraft(toDraft(t));
    setEditingId(t.id);
    setError(null);
  }
  function cancel() {
    setEditingId(null);
    setError(null);
  }

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      setError("Use a JPEG, PNG, WebP or AVIF image.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const blob = await upload(`trainers/${businessId}/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: `/api/owner/businesses/${businessId}/trainers/upload`,
      });
      setDraft((d) => ({ ...d, photoUrl: blob.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!draft.name.trim()) {
      setError("A trainer name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const isNew = editingId === "new";
    const url = isNew
      ? `/api/owner/businesses/${businessId}/trainers`
      : `/api/owner/businesses/${businessId}/trainers/${editingId}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name.trim(),
        bio: draft.bio.trim() || null,
        photoUrl: draft.photoUrl || null,
        disciplines: draft.disciplines,
        certifications: draft.certifications,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
      return;
    }
    const { trainer } = await res.json();
    setTrainers((cur) =>
      isNew ? [...cur, trainer] : cur.map((t) => (t.id === trainer.id ? trainer : t)),
    );
    setEditingId(null);
    router.refresh();
  }

  async function remove(id: string) {
    setTrainers((cur) => cur.filter((t) => t.id !== id));
    await fetch(`/api/owner/businesses/${businessId}/trainers/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const certText = draft.certifications.join(", ");

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink/55">
          {trainers.length} / {maxTrainers} seats used
        </p>
        {editingId === null && (
          <button
            type="button"
            onClick={startNew}
            disabled={atCap}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-cream transition hover:bg-pine-light disabled:opacity-50"
          >
            + Add trainer
          </button>
        )}
      </div>

      {atCap && editingId === null && (
        <div className="rounded-xl border border-leather/15 bg-cream-dark/40 p-4 text-sm text-ink/60">
          You&apos;ve used all your trainer seats.{" "}
          <a href={`/owner/${slug}/plan`} className="font-medium text-pine underline">
            Add a seat
          </a>{" "}
          to invite more.
        </div>
      )}

      {/* List */}
      {editingId === null &&
        trainers.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-leather/15 p-3"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-leather/15 bg-cream-dark">
              {t.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.photoUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-pine">{t.name}</p>
              <p className="truncate text-xs text-ink/50">
                {t.disciplines.length ? t.disciplines.join(", ") : "No disciplines yet"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => startEdit(t)}
              className="rounded-lg border border-leather/20 px-3 py-1.5 text-xs font-medium text-pine transition hover:border-brass/50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="rounded-lg border border-leather/20 px-3 py-1.5 text-xs font-medium text-ink/55 transition hover:border-red-300 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ))}

      {editingId === null && trainers.length === 0 && (
        <p className="rounded-xl border border-dashed border-leather/25 px-4 py-6 text-center text-sm text-ink/45">
          No trainers yet. Add your first trainer profile.
        </p>
      )}

      {/* Editor */}
      {editingId !== null && (
        <div className="space-y-4 rounded-xl border border-leather/15 p-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-leather/15 bg-cream-dark">
              {draft.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.photoUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED.join(",")}
                hidden
                onChange={(e) => onFile(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-leather/20 px-3 py-1.5 text-xs font-medium text-pine transition hover:border-brass/50 disabled:opacity-50"
              >
                {uploading ? "Uploading…" : draft.photoUrl ? "Replace photo" : "Upload photo"}
              </button>
              {draft.photoUrl && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, photoUrl: "" }))}
                  className="ml-2 text-xs text-ink/45 underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink/50">Name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className={textInputCls}
              placeholder="e.g. Jane Rider"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink/50">Bio</span>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              rows={3}
              className={textInputCls}
              placeholder="Background, accomplishments, training philosophy…"
            />
          </label>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-ink/50">Disciplines</p>
            <ChipMultiSelect
              facet="disciplines"
              value={draft.disciplines}
              onChange={(v) => setDraft((d) => ({ ...d, disciplines: v }))}
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink/50">
              Certifications (comma-separated)
            </span>
            <input
              value={certText}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  certifications: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              className={textInputCls}
              placeholder="e.g. USDF Bronze, CHA Certified"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">Email</span>
              <input
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                className={textInputCls}
                placeholder="trainer@example.com"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">Phone</span>
              <input
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                className={textInputCls}
                placeholder="(555) 555-5555"
              />
            </label>
          </div>

          <div className="flex items-center gap-3 border-t border-leather/10 pt-4">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save trainer"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="text-sm text-ink/55 transition hover:text-pine"
            >
              Cancel
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}

      {error && editingId === null && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
