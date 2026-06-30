import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { getSiteForBusiness, setCustomDomain } from "@/lib/db/sites";
import { addDomain, checkDomainStatus, isDnsEnabled } from "@/lib/sites/dns";

export const dynamic = "force-dynamic";

// Custom-domain endpoints for a started build (owner-guarded via withOwner; the
// businessId is the URL param). We manage DNS: connecting a domain stores it on
// the Site and, when DNS automation is enabled (SITES_DNS_ENABLED + Vercel
// secrets), registers it on the Vercel project. When automation is off, the
// domain is saved and the UI shows the manual nameserver-delegation guide.

interface StatusView {
  added: boolean;
  verified: boolean;
  delegated: boolean;
  misconfigured: boolean;
  nameservers: string[];
}

async function resolveStatus(domain: string): Promise<StatusView | null> {
  if (!isDnsEnabled()) return null;
  const res = await checkDomainStatus(domain);
  if (!res.ok) return null;
  const d = res.data;
  return {
    added: d.added,
    verified: d.verified,
    delegated: d.delegated,
    misconfigured: d.misconfigured,
    nameservers: d.nameservers,
  };
}

// GET — current provisioning status for the connected domain (live Vercel check
// when automation is on; null otherwise).
export const GET = withOwner(async ({ id }) => {
  const site = await getSiteForBusiness(id);
  if (!site) return NextResponse.json({ error: "No website build yet." }, { status: 404 });
  if (!site.customDomain) return NextResponse.json({ status: null, customDomain: null });
  return NextResponse.json({
    customDomain: site.customDomain,
    status: await resolveStatus(site.customDomain),
  });
});

// POST { domain: string | null } — connect (or clear) the custom domain.
export const POST = withOwner(async ({ id, request }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const site = await getSiteForBusiness(id);
  if (!site) return NextResponse.json({ error: "No website build yet." }, { status: 404 });

  const raw = body.domain;
  const domain = raw === null ? null : typeof raw === "string" ? raw : undefined;
  if (domain === undefined) {
    return NextResponse.json({ error: "Domain is required." }, { status: 400 });
  }

  const updated = await setCustomDomain(id, domain);
  if (!updated) {
    return NextResponse.json(
      { error: "That domain is invalid or already in use." },
      { status: 409 },
    );
  }

  // Best-effort: register the domain on Vercel when automation is on. A failure
  // here doesn't roll back the save — the owner still gets the delegation guide.
  if (updated.customDomain && isDnsEnabled()) {
    await addDomain(updated.customDomain);
  }

  return NextResponse.json({
    ok: true,
    customDomain: updated.customDomain,
    status: updated.customDomain ? await resolveStatus(updated.customDomain) : null,
  });
});
