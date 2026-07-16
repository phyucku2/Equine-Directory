// Client-side GA4 event helper. Safe to call anywhere: no-ops when GA isn't
// configured or during SSR. Event names follow GA4's recommended-event
// vocabulary where one exists (generate_lead, sign_up) so they can be
// imported into Google Ads as conversions without remapping.
//
// gtag.js quirk: commands must be pushed as an `arguments` object — a plain
// array is silently ignored. The GA init snippet (GoogleAnalytics.tsx)
// defines a global `gtag` that does this; prefer it, with an arguments-push
// fallback for the window between dataLayer creation and script eval.
export function track(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  if (w.gtag) {
    w.gtag("event", event, params ?? {});
    return;
  }
  if (!w.dataLayer) return; // GA not configured — nothing listening.
  const pushArgs = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  } as (...args: unknown[]) => void;
  pushArgs("event", event, params ?? {});
}
