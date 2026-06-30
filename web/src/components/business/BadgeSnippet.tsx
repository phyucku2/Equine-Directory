"use client";

// "Get your badge" panel (specs/website-builder.md §"Backlinks & Certified
// badge"). Offered free to every claimed barn in the owner dashboard: it shows a
// live preview of the embeddable seal and the copy-paste <a><img></a> snippet the
// owner drops onto their own site. The <a> wrapper is the dofollow backlink to
// our domain; the ?utm=badge param lets us track referrals.
//
// URLs are built with absoluteUrl() so the snippet always points at the public
// origin (NEXT_PUBLIC_BASE_URL), not whatever host the dashboard is served from.

import { useState } from "react";
import { absoluteUrl, businessUrl } from "@/lib/urls";

export function BadgeSnippet({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  // Listing link (the backlink target) + the badge image, both absolute.
  const listingUrl = `${absoluteUrl(businessUrl(slug))}?utm=badge`;
  const badgeImgUrl = absoluteUrl(`/api/badge/${slug}.svg`);

  // Exactly the snippet from the spec — pretty-printed for legibility.
  const snippet = `<a href="${listingUrl}">
  <img src="${badgeImgUrl}" alt="Certified — The Stable Directory" width="300" height="120">
</a>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-xl border border-leather/20 bg-cream p-5">
      <h3 className="text-base font-semibold text-pine">Get your badge</h3>
      <p className="mt-1 text-sm text-ink/70">
        Add this certified seal to your own website. It links back to your listing
        and shows your real rating — auto-updating as reviews come in. Free for
        every claimed barn.
      </p>

      {/* Live preview of the embedded seal. */}
      <div className="mt-4 flex justify-center rounded-lg bg-white p-4 ring-1 ring-leather/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={badgeImgUrl}
          alt="Certified — The Stable Directory"
          width={300}
          height={120}
          className="h-auto max-w-full"
        />
      </div>

      {/* Copy-paste snippet. */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/60">
            Embed code
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-pine-light"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-ink/[0.04] p-3 text-xs leading-relaxed text-ink ring-1 ring-leather/15">
          <code>{snippet}</code>
        </pre>
      </div>
    </section>
  );
}
