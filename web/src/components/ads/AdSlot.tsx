"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { adsDisabledForPath } from "./AdSense";

// One responsive AdSense display unit. Placement policy (owner decision
// 2026-07-16: "tastefully, not all over the place"): at most ONE unit per
// page, below the primary content — never in the header, hero, map, or
// between the first results a visitor sees. Renders nothing until
// NEXT_PUBLIC_ADSENSE_CLIENT is set.
//
// The wrapper reserves height up front (minHeight) so a late-filling ad
// doesn't shove content down (CLS); "Advertisement" labelling keeps the
// unit clearly distinguished from listings.
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
// The numeric ad-unit ID from the AdSense dashboard (one responsive
// "Display ad" unit reused across all placements). Ads render only when
// both env vars are present.
const SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_CONTENT;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ className }: { className?: string }) {
  const pathname = usePathname();
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT || !SLOT || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Blocked or double-initialised — either way, nothing to do.
    }
  }, []);

  if (!CLIENT || !SLOT || adsDisabledForPath(pathname)) return null;

  return (
    <div className={className ?? "mt-12"}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-ink/35">
        Advertisement
      </p>
      <ins
        className="adsbygoogle block"
        style={{ display: "block", minHeight: 120 }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
