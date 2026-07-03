"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

// GA4 (gtag.js). Loaded via next/script's `afterInteractive` strategy — the
// documented pattern for analytics tags (node_modules/next/dist/docs/.../
// scripts.md): fetched early but never blocks hydration, unlike pasting the
// raw <script> tag Google's setup wizard hands out.
//
// Two things the raw snippet doesn't handle, both needed for a Next.js App
// Router SPA: gtag's automatic pageview only fires once, on first load — client
// -side route changes need a manual `page_view` event — and admin traffic
// shouldn't pollute visitor analytics for a site that's noindex'd anyway.
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!MEASUREMENT_ID || pathname.startsWith("/admin")) return;
    // gtag's own `config` call (fired once below, on script load) already
    // sends the first pageview — only send explicit events for the SPA
    // navigations that happen after that.
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    gtag("event", "page_view", { page_path: pathname });
  }, [pathname]);

  if (!MEASUREMENT_ID || pathname.startsWith("/admin")) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
