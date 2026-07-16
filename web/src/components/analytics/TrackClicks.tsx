"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/track";

// Delegated click tracking for server components. Any element carrying
// data-track="<event>" (plus optional data-track-label) fires a GA4 event on
// click — no need to convert server-rendered pages to client components just
// to measure a CTA. Mounted once in the root layout.
export function TrackClicks() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest?.("[data-track]");
      if (!el) return;
      const event = el.getAttribute("data-track");
      if (!event) return;
      const label = el.getAttribute("data-track-label");
      track(event, label ? { label } : undefined);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
