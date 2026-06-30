"use client";

import { useState } from "react";

// Custom-domain panel. Two modes, driven by `dnsEnabled` (the SITES_DNS_ENABLED
// flag + Vercel secrets, resolved server-side):
//   - enabled  → owner enters their domain; we add it to the project via the
//                Vercel API and show the nameserver-delegation guide + a live
//                status check.
//   - disabled → the SAME guided nameserver instructions, but the actual API
//                wiring is a stub, so we just save the domain and tell the owner
//                we'll finish provisioning once DNS automation is on.

const inputCls =
  "w-full rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brass";

export interface DomainStatusView {
  added: boolean;
  verified: boolean;
  delegated: boolean;
  misconfigured: boolean;
  nameservers: string[];
}

export function DomainPanel({
  businessId,
  dnsEnabled,
  nameservers,
  initialDomain,
  initialStatus,
}: {
  businessId: string;
  dnsEnabled: boolean;
  nameservers: string[];
  initialDomain: string | null;
  initialStatus: DomainStatusView | null;
}) {
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [saved, setSaved] = useState(initialDomain);
  const [statusView, setStatusView] = useState<DomainStatusView | null>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/owner/sites/${businessId}/domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domain.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setSaved(body.customDomain ?? domain.trim());
      setStatusView(body.status ?? null);
    } else {
      setError(body.error ?? "Could not connect domain.");
    }
    setBusy(false);
  }

  async function refresh() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/owner/sites/${businessId}/domain`, { method: "GET" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setStatusView(body.status ?? null);
    else setError(body.error ?? "Could not check status.");
    setBusy(false);
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/owner/sites/${businessId}/domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: null }),
    });
    if (res.ok) {
      setSaved(null);
      setDomain("");
      setStatusView(null);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not disconnect.");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-leather/15 bg-cream-dark/30 p-5">
      <h4 className="text-sm font-semibold text-pine">Connect a custom domain</h4>
      <p className="mt-1 max-w-prose text-xs text-ink/55">
        We manage DNS for you. Point your registrar&apos;s nameservers at us once, and
        we handle records + SSL automatically.
        {!dnsEnabled && " Automatic provisioning is coming soon — we'll finish setup for you."}
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Your domain</span>
          <input
            className={inputCls}
            value={domain}
            placeholder="oakridgestables.com"
            onChange={(e) => setDomain(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={connect}
          disabled={busy || !domain.trim()}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-cream transition hover:bg-pine-light disabled:opacity-60"
        >
          {busy ? "Working…" : saved ? "Update" : "Connect"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {saved && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink">
            Domain on file: <span className="font-semibold text-pine">{saved}</span>
          </p>

          <div className="rounded-lg border border-leather/15 bg-white p-4">
            <p className="text-xs font-semibold text-ink/70">
              Step 1 — Delegate your nameservers
            </p>
            <p className="mt-1 text-xs text-ink/55">
              At your domain registrar (GoDaddy, Namecheap, …), replace the existing
              nameservers with ours:
            </p>
            <ul className="mt-2 space-y-1">
              {nameservers.map((ns) => (
                <li
                  key={ns}
                  className="rounded bg-cream-dark/50 px-2 py-1 font-mono text-xs text-ink"
                >
                  {ns}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink/45">
              DNS changes can take up to 48 hours to propagate. SSL is issued
              automatically once delegation is detected.
            </p>
          </div>

          {dnsEnabled && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={refresh}
                disabled={busy}
                className="rounded-lg border border-leather/20 px-3 py-1.5 text-sm font-medium text-pine transition hover:border-brass/50 disabled:opacity-60"
              >
                Check status
              </button>
              {statusView && (
                <span className="text-sm">
                  {statusView.verified ? (
                    <span className="text-pine">Verified ✓ — your site is live on this domain.</span>
                  ) : statusView.delegated ? (
                    <span className="text-brass">
                      Nameservers delegated — finishing verification…
                    </span>
                  ) : (
                    <span className="text-ink/55">Waiting for nameserver delegation…</span>
                  )}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="text-xs text-ink/45 underline transition hover:text-red-600 disabled:opacity-60"
          >
            Disconnect domain
          </button>
        </div>
      )}
    </div>
  );
}
