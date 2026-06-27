"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

type Img = {
  id: string;
  url: string;
  source: string;
  rank: number;
};

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

export function PhotosManager({
  businessId,
  ownerPhotos,
  otherPhotos,
  canUpload,
  maxPhotos,
}: {
  businessId: string;
  ownerPhotos: Img[];
  otherPhotos: Img[];
  canUpload: boolean;
  maxPhotos: number;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<Img[]>(ownerPhotos);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const atLimit = order.length >= maxPhotos;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        setError(`Unsupported file type: ${file.type || "unknown"}. Use JPEG, PNG, WebP or AVIF.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 8 MB.`);
        continue;
      }
      if (order.length >= maxPhotos) {
        setError("Photo limit reached for your plan.");
        break;
      }
      setBusy(true);
      try {
        const blob = await upload(`businesses/${businessId}/${Date.now()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: `/api/owner/businesses/${businessId}/images`,
        });
        // Persist the DB row (localhost has no completion webhook).
        const res = await fetch(`/api/owner/businesses/${businessId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: blob.url }),
        });
        if (!res.ok) {
          setError((await res.json().catch(() => ({}))).error ?? "Could not save the photo.");
        } else {
          const { image } = await res.json();
          setOrder((cur) => [...cur, image]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setOrder((cur) => {
      const from = cur.findIndex((i) => i.id === dragId);
      const to = cur.findIndex((i) => i.id === targetId);
      if (from < 0 || to < 0) return cur;
      const next = [...cur];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      void persistOrder(next.map((i) => i.id));
      return next;
    });
    setDragId(null);
  }

  async function persistOrder(ids: string[]) {
    await fetch(`/api/owner/businesses/${businessId}/images`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: ids }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    setOrder((cur) => cur.filter((i) => i.id !== id));
    await fetch(`/api/owner/businesses/${businessId}/images?imageId=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-pine">Your photos</p>
          <p className="text-xs text-ink/45">
            {order.length} / {maxPhotos} · drag to reorder · first is the cover
          </p>
        </div>

        {order.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {order.map((img, i) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => setDragId(img.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(img.id)}
                className={`group relative aspect-[4/3] cursor-move overflow-hidden rounded-lg border bg-cream-dark ${
                  dragId === img.id ? "border-brass ring-2 ring-brass" : "border-leather/15"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-pine/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/50">No owner photos yet.</p>
        )}
      </div>

      <div>
        {canUpload ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED.join(",")}
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || atLimit}
              className="rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
            >
              {busy ? "Uploading…" : atLimit ? "Photo limit reached" : "Upload photos"}
            </button>
            <p className="mt-2 text-xs text-ink/45">JPEG, PNG, WebP or AVIF · up to 8 MB each.</p>
          </>
        ) : (
          <div className="rounded-xl border border-leather/15 bg-cream-dark/40 p-4 text-sm text-ink/60">
            Photo uploads aren&apos;t included in your current plan.
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {otherPhotos.length > 0 && (
        <div className="border-t border-leather/10 pt-5">
          <p className="text-sm font-semibold text-pine">Crawled / Google photos</p>
          <p className="text-xs text-ink/45">
            Your uploads appear ahead of these on the public page. They stay as a fallback.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {otherPhotos.map((img) => (
              <div
                key={img.id}
                className="aspect-[4/3] overflow-hidden rounded-lg border border-leather/10 bg-cream-dark opacity-70"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
