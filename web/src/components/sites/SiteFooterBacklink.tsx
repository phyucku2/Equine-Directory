// Footer backlink for generated tenant sites (specs/website-builder.md
// §"Backlinks & Certified badge", mechanism 1). Every built client site renders
// this in its footer: dofollow links back to us with local-keyword anchors, which
// raise our domain authority → better directory rankings → more traffic. The
// directory ⇄ site cross-linking goes both ways.
//
// Two links, both dofollow (no rel="nofollow") and both tracked via ?utm=badge:
//   1. A plain "Find us on The Stable Directory" link to our domain.
//   2. The barn's own listing, anchored with a local keyword
//      ("<City> horse boarding") so the anchor text carries SEO weight.
//
// React server component, themed from the same `--site-*` CSS custom properties
// the templates set (no directory Tailwind tokens — this is the barn's brand).

import type { ReactElement } from "react";
import { absoluteUrl, businessUrl } from "@/lib/urls";

export interface SiteFooterBacklinkProps {
  /** The barn's directory slug — the backlink target. */
  slug: string;
  /** City, e.g. "Ocala" — used in the local-keyword anchor. */
  city: string | null;
  /** Region/state name, e.g. "Florida" — falls back to anchor when no city. */
  region: string | null;
}

export function SiteFooterBacklink({
  slug,
  city,
  region,
}: SiteFooterBacklinkProps): ReactElement {
  // Listing URL (the backlink) + our homepage, both absolute + utm-tracked.
  const listingUrl = `${absoluteUrl(businessUrl(slug))}?utm=badge`;
  const directoryUrl = `${absoluteUrl("/")}?utm=badge`;

  // Local-keyword anchor: "<City> horse boarding", or region, or a safe default.
  const place = city ?? region;
  const listingAnchor = place ? `${place} horse boarding` : "View our listing";

  return (
    <footer className="border-t border-[var(--site-primary)]/15 bg-[var(--site-bg)] text-[var(--site-text)]">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-8 text-center text-sm">
        <p className="opacity-80">
          {/* Dofollow on purpose — no rel="nofollow". */}
          <a
            href={directoryUrl}
            className="font-semibold text-[var(--site-primary)] underline-offset-2 hover:underline"
          >
            Find us on The Stable Directory
          </a>
        </p>
        <p className="opacity-70">
          <a
            href={listingUrl}
            className="text-[var(--site-primary)] underline-offset-2 hover:underline"
          >
            {listingAnchor}
          </a>
        </p>
      </div>
    </footer>
  );
}
