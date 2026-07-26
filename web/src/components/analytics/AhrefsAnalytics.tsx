import Script from "next/script";

// Ahrefs Web Analytics — lightweight, privacy-friendly traffic analytics that
// complements GA4 (and feeds Ahrefs' SEO tooling). The data-key is a public
// site key (it ships in the page source), so inlining it is safe; it stays
// overridable via env for future sites.
const AHREFS_KEY = process.env.NEXT_PUBLIC_AHREFS_KEY ?? "1maZDQEXz+BMR4o6rFsgfA";

export function AhrefsAnalytics() {
  if (!AHREFS_KEY) return null;
  return (
    <Script
      src="https://analytics.ahrefs.com/analytics.js"
      data-key={AHREFS_KEY}
      strategy="afterInteractive"
    />
  );
}
