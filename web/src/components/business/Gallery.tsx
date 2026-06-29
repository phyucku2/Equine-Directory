"use client";

import Image from "next/image";
import { useState } from "react";

type GalleryImage = { url: string; altText: string | null; caption: string | null };

// Listing photo gallery: a main image with a clickable thumbnail strip.
// Google Places photos carry author attribution (required) — shown on the image.
// `stallsBadge` overlays a "Stalls Available" pill on the primary image when the
// barn is entitled (stallsBadge) and has open spots (monetization-tiers.md).
export function Gallery({
  images,
  name,
  stallsBadge = false,
}: {
  images: GalleryImage[];
  name: string;
  stallsBadge?: boolean;
}) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return null;
  const main = images[active] ?? images[0];

  return (
    <section className="overflow-hidden rounded-2xl border border-leather/15 bg-white">
      <div className="relative aspect-[16/9] w-full bg-cream-dark">
        <Image
          src={main.url}
          alt={main.altText ?? name}
          fill
          sizes="(max-width: 1024px) 100vw, 700px"
          className="object-cover"
          priority
        />
        {stallsBadge && active === 0 && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
            Stalls Available
          </span>
        )}
        {main.caption && (
          <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
            {main.caption}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-2">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View photo ${i + 1}`}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                i === active ? "ring-brass" : "ring-transparent hover:ring-leather/30"
              }`}
            >
              <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
