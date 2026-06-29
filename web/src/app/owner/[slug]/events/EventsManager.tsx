"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { PROGRAM_TYPES } from "@/lib/facets";
import { textInputCls } from "../_facets/ChipMultiSelect";

type EventRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  startDate: string; // ISO
  endDate: string | null; // ISO
  price: number | null; // cents
  registrationUrl: string | null;
  imageUrl: string | null;
  isPublished: boolean;
};

type Draft = {
  type: string;
  title: string;
  description: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  price: string; // dollars
  registrationUrl: string;
  imageUrl: string;
  isPublished: boolean;
};

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

// ISO → yyyy-mm-dd for <input type=date>.
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function toDraft(e?: EventRow): Draft {
  return {
    type: e?.type ?? PROGRAM_TYPES[0].slug,
    title: e?.title ?? "",
    description: e?.description ?? "",
    startDate: toDateInput(e?.startDate ?? null),
    endDate: toDateInput(e?.endDate ?? null),
    price: e?.price != null ? String(e.price / 100) : "",
    registrationUrl: e?.registrationUrl ?? "",
    imageUrl: e?.imageUrl ?? "",
    isPublished: e?.isPublished ?? true,
  };
}

function typeLabel(slug: string): string {
  return PROGRAM_TYPES.find((t) => t.slug === slug)?.label ?? slug;
}

export function EventsManager({
  businessId,
  initial,
}: {
  businessId: string;
  initial: EventRow[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function startNew() {
    setDraft(toDraft());
    setEditingId("new");
    setError(null);
  }
  function startEdit(e: EventRow) {
    setDraft(toDraft(e));
    setEditingId(e.id);
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
      const blob = await upload(`events/${businessId}/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: `/api/owner/businesses/${businessId}/events/upload`,
      });
      setDraft((d) => ({ ...d, imageUrl: blob.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!draft.title.trim()) {
      setError("An event title is required.");
      return;
    }
    if (!draft.startDate) {
      setError("A start date is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const isNew = editingId === "new";
    const url = isNew
      ? `/api/owner/businesses/${businessId}/events`
      : `/api/owner/businesses/${businessId}/events/${editingId}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: draft.type,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        startDate: draft.startDate,
        endDate: draft.endDate || null,
        // Dollars → cents; server re-validates.
        price: draft.price.trim() === "" ? null : Math.round(Number(draft.price) * 100),
        registrationUrl: draft.registrationUrl.trim() || null,
        imageUrl: draft.imageUrl || null,
        isPublished: draft.isPublished,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
      return;
    }
    const { event } = await res.json();
    const row: EventRow = {
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      price: event.price,
      registrationUrl: event.registrationUrl,
      imageUrl: event.imageUrl,
      isPublished: event.isPublished,
    };
    setEvents((cur) => (isNew ? [...cur, row] : cur.map((e) => (e.id === row.id ? row : e))));
    setEditingId(null);
    router.refresh();
  }

  async function remove(id: string) {
    setEvents((cur) => cur.filter((e) => e.id !== id));
    await fetch(`/api/owner/businesses/${businessId}/events/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-5">
      {editingId === null && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={startNew}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-cream transition hover:bg-pine-light"
          >
            + Add event
          </button>
        </div>
      )}

      {editingId === null &&
        events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-xl border border-leather/15 p-3">
            <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-leather/15 bg-cream-dark">
              {e.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.imageUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-pine">
                {e.title}
                {!e.isPublished && (
                  <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-medium text-ink/55">
                    Draft
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-ink/50">
                {typeLabel(e.type)} · {toDateInput(e.startDate)}
                {e.endDate ? ` – ${toDateInput(e.endDate)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => startEdit(e)}
              className="rounded-lg border border-leather/20 px-3 py-1.5 text-xs font-medium text-pine transition hover:border-brass/50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => remove(e.id)}
              className="rounded-lg border border-leather/20 px-3 py-1.5 text-xs font-medium text-ink/55 transition hover:border-red-300 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ))}

      {editingId === null && events.length === 0 && (
        <p className="rounded-xl border border-dashed border-leather/25 px-4 py-6 text-center text-sm text-ink/45">
          No events yet. Add a show, clinic, or camp.
        </p>
      )}

      {editingId !== null && (
        <div className="space-y-4 rounded-xl border border-leather/15 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">Type</span>
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                className="w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brass"
              >
                {PROGRAM_TYPES.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">Title</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className={textInputCls}
                placeholder="e.g. Spring Schooling Show"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink/50">Description</span>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={3}
              className={textInputCls}
              placeholder="What to expect, divisions, schedule…"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">Start date</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                className={textInputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">
                End date (optional)
              </span>
              <input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                className={textInputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">Price ($)</span>
              <input
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                className={textInputCls}
                placeholder="e.g. 45"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">
                Registration URL
              </span>
              <input
                value={draft.registrationUrl}
                onChange={(e) => setDraft((d) => ({ ...d, registrationUrl: e.target.value }))}
                className={textInputCls}
                placeholder="https://…"
              />
            </label>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-leather/15 bg-cream-dark">
              {draft.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.imageUrl} alt="" className="h-full w-full object-cover" />
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
                {uploading ? "Uploading…" : draft.imageUrl ? "Replace image" : "Upload image"}
              </button>
              {draft.imageUrl && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, imageUrl: "" }))}
                  className="ml-2 text-xs text-ink/45 underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink/65">
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(e) => setDraft((d) => ({ ...d, isPublished: e.target.checked }))}
            />
            Published (visible on your public page)
          </label>

          <div className="flex items-center gap-3 border-t border-leather/10 pt-4">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save event"}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
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
