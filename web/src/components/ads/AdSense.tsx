"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

// AdSense loader, same next/script `afterInteractive` pattern as
// GoogleAnalytics.tsx. Renders nothing until NEXT_PUBLIC_ADSENSE_CLIENT
// (ca-pub-…) is set, so the site is ad-free until the AdSense account is
// approved and the env var lands. Never loads on admin/owner/account
// surfaces — those are private tools, not content.
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

const PRIVATE_PREFIXES = ["/admin", "/owner", "/account", "/claim"];

export function adsDisabledForPath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((p) => pathname.startsWith(p));
}

export function AdSense() {
  const pathname = usePathname();
  if (!CLIENT || adsDisabledForPath(pathname)) return null;

  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
