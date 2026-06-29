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
  slug,
  ownerPhotos,
  otherPhotos,
  maxPhotos,
  canLogo,
  logoUrl,
  canStallsBadge,
  stallsBadgeOn,
}: {
  businessId: string;
  slug: string;
  ownerPhotos: Img[];
  otherPhotos: Img[];
  maxPhotos: number;
  canLogo: boolean;
  logoUrl: string | null;
  canStallsBadge: boolean;
  stallsBadgeOn: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<Img[]>(ownerPhotos);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Logo + stalls-badge local state.
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [stalls, setStalls] = useState(stallsBadgeOn);
  const [stallsBusy, setStallsBusy] = useState(false);

  const canUpload = maxPhotos > 0;
  const atLimit = order.length >= maxPhotos;

  async function onLogoFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      setError(`Unsupported file type. Use JPEG, PNG, WebP or AVIF.`);
      return;
    }
    setLogoBusy(true);
    setError(null);
    try {
      const blob = await upload(`businesses/${businessId}/logo-${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: `/api/owner/businesses/${businessId}/logo`,
      });
      const res = await fetch(`/api/owner/businesses/${businessId}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not save the logo.");
      } else {
        setLogo(blob.url);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setLogoBusy(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  }

  async function removeLogo() {
    setLogo(null);
    await fetch(`/api/owner/businesses/${businessId}/logo`, { method: "DELETE" });
    router.refresh();
  }

  async function toggleStalls(on: boolean) {
    setStalls(on);
    setStallsBusy(true);
    const res = await fetch(`/api/owner/businesses/${businessId}/stalls-badge`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on }),
    });
    setStallsBusy(false);
    if (!res.ok) {
      setStalls(!on); // revert
      setError((await res.json().catch(() => ({}))).error ?? "Could not update the badge.");
    } else {
      router.refresh();
    }
  }

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
      {/* Logo */}
      <div className="rounded-xl border border-leather/15 p-4">
        <p className="text-sm font-semibold text-pine">Logo</p>
        {canLogo ? (
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-leather/15 bg-cream-dark">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] text-ink/35">No logo</span>
              )}
            </div>
            <div>
              <input
                ref={logoRef}
                type="file"
                accept={ALLOWED.join(",")}
                hidden
                onChange={(e) => onLogoFile(e.target.files)}
              />
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                disabled={logoBusy}
                className="rounded-lg border border-leather/20 px-3 py-1.5 text-xs font-medium text-pine transition hover:border-brass/50 disabled:opacity-50"
              >
                {logoBusy ? "Uploading…" : logo ? "Replace logo" : "Upload logo"}
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="ml-2 text-xs text-ink/45 underline"
                >
                  Remove
                </button>
              )}
              <p className="mt-1 text-[11px] text-ink/45">Shown on your listing header and card.</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink/55">
            A logo is part of the Verified plan.{" "}
            <a href={`/owner/${slug}/plan`} className="font-medium text-pine underline">
              Upgrade
            </a>
            .
          </p>
        )}
      </div>

      {/* Stalls Available badge */}
      {canStallsBadge && (
        <div className="rounded-xl border border-leather/15 p-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold text-pine">
                “Stalls Available” badge
              </span>
              <span className="block text-xs text-ink/55">
                Overlay a badge on your cover photo to signal open boarding spots.
              </span>
            </span>
            <input
              type="checkbox"
              checked={stalls}
              disabled={stallsBusy}
              onChange={(e) => toggleStalls(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
        </div>
      )}

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
            Photo uploads are part of the Verified plan.{" "}
            <a href={`/owner/${slug}/plan`} className="font-medium text-pine underline">
              Upgrade
            </a>{" "}
            to add up to 5 photos.
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
