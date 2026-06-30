// Vercel DNS / custom-domain wrapper for the Website Builder
// (specs/website-builder.md §"Domain/DNS integration"). We manage DNS: the owner
// delegates their registrar nameservers to us, and we add the domain + records +
// SSL through the Vercel API.
//
// EVERYTHING here is GATED behind the `SITES_DNS_ENABLED` env flag AND the
// presence of VERCEL_API_TOKEN + VERCEL_PROJECT_ID. When the flag is off or a
// secret is missing, every function returns a clear `{ ok: false, configured:
// false }` result so the UI falls back to the manual nameserver-delegation guide
// instead of erroring. Secrets are read from env only — never hardcoded.
//
// Node runtime only (uses fetch against the Vercel REST API).

const VERCEL_API = "https://api.vercel.com";

/** The two apex nameservers an owner points their registrar at to delegate DNS. */
export const VERCEL_NAMESERVERS = ["ns1.vercel-dns.com", "ns2.vercel-dns.com"] as const;

export interface DnsConfig {
  token: string;
  projectId: string;
  /** Optional Vercel team scope (?teamId=…). */
  teamId: string | null;
}

/** Discriminated result: every DNS call returns this shape. */
export type DnsResult<T = Record<string, unknown>> =
  | { ok: true; configured: true; data: T }
  | { ok: false; configured: false; reason: string }
  | { ok: false; configured: true; reason: string; status?: number };

/** A "not configured" result — the flag is off or a secret is missing. */
function notConfigured(reason: string): DnsResult<never> {
  return { ok: false, configured: false, reason };
}

/**
 * Resolve the DNS config from env, or null when DNS automation is not enabled.
 * Off unless `SITES_DNS_ENABLED === "true"` AND both secrets are present.
 */
export function getDnsConfig(): DnsConfig | null {
  if (process.env.SITES_DNS_ENABLED !== "true") return null;
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID ?? null };
}

/** True when custom-domain automation is wired up (flag on + secrets present). */
export function isDnsEnabled(): boolean {
  return getDnsConfig() !== null;
}

// Shared fetch against the Vercel API with the team scope + bearer token applied.
async function vercelFetch<T>(
  cfg: DnsConfig,
  path: string,
  init: RequestInit = {},
): Promise<DnsResult<T>> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${VERCEL_API}${path}${cfg.teamId ? `${sep}teamId=${cfg.teamId}` : ""}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        status: res.status,
        reason: body?.error?.message ?? `Vercel API error (${res.status}).`,
      };
    }
    return { ok: true, configured: true, data: body };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      reason: err instanceof Error ? err.message : "Network error calling Vercel.",
    };
  }
}

/**
 * Add a custom domain to the Vercel project. Vercel provisions SSL automatically
 * once the domain verifies. No-op "not configured" when DNS automation is off.
 */
export async function addDomain(domain: string): Promise<DnsResult<{ name: string; verified: boolean }>> {
  const cfg = getDnsConfig();
  if (!cfg) return notConfigured("Custom-domain automation is not configured.");
  return vercelFetch(cfg, `/v10/projects/${cfg.projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
}

/**
 * Add a DNS record under a domain we manage (e.g. an A/CNAME for the subdomain).
 * Used after nameserver delegation completes. Not configured → manual fallback.
 */
export async function addRecord(
  domain: string,
  record: { type: string; name: string; value: string; ttl?: number },
): Promise<DnsResult<{ uid: string }>> {
  const cfg = getDnsConfig();
  if (!cfg) return notConfigured("DNS record management is not configured.");
  return vercelFetch(cfg, `/v2/domains/${domain}/records`, {
    method: "POST",
    body: JSON.stringify(record),
  });
}

export interface DomainStatus {
  /** Vercel has the domain on the project. */
  added: boolean;
  /** SSL/ownership verified (records/nameservers correct). */
  verified: boolean;
  /** Nameservers Vercel currently sees for the domain, if any. */
  nameservers: string[];
  /** Whether the registrar's nameservers point at us yet. */
  delegated: boolean;
  /** Outstanding verification challenges Vercel reports, if any. */
  misconfigured: boolean;
}

/**
 * Check a custom domain's provisioning status on the project: added? verified?
 * nameservers delegated to us yet? Not configured → manual fallback.
 */
export async function checkDomainStatus(domain: string): Promise<DnsResult<DomainStatus>> {
  const cfg = getDnsConfig();
  if (!cfg) return notConfigured("Domain status checks are not configured.");

  const domainRes = await vercelFetch<{
    verified?: boolean;
    nameservers?: string[];
    intendedNameservers?: string[];
  }>(cfg, `/v9/projects/${cfg.projectId}/domains/${domain}`);
  if (!domainRes.ok) {
    // A 404 just means the domain isn't on the project yet — that's a valid,
    // non-error "not added" status, not a hard failure.
    if (domainRes.configured && domainRes.status === 404) {
      return {
        ok: true,
        configured: true,
        data: { added: false, verified: false, nameservers: [], delegated: false, misconfigured: false },
      };
    }
    return domainRes;
  }

  const nameservers = domainRes.data.nameservers ?? [];
  const delegated = nameservers.some((ns) => ns.toLowerCase().includes("vercel-dns.com"));

  // Config endpoint reports whether records/nameservers are still misconfigured.
  const configRes = await vercelFetch<{ misconfigured?: boolean }>(
    cfg,
    `/v6/domains/${domain}/config`,
  );
  const misconfigured = configRes.ok ? configRes.data.misconfigured === true : false;

  return {
    ok: true,
    configured: true,
    data: {
      added: true,
      verified: domainRes.data.verified === true,
      nameservers,
      delegated,
      misconfigured,
    },
  };
}
