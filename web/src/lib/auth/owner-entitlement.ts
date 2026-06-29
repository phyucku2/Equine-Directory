import { NextResponse } from "next/server";
import { getEntitlements, type Entitlements } from "@/lib/entitlements";
import { loadBusinessForEntitlements } from "@/lib/db/owner";

// Entitlement gate for owner API routes. Authorization (ownership) is already
// enforced by withOwner upstream; this resolves the business's entitlements via
// getEntitlements(business) — the single resolver in the spec — and returns a
// clear, machine-readable JSON error when the feature isn't unlocked.
//
// Usage inside a withOwner handler:
//   const gate = await requireEntitlement(id, (e) => e.canEditFacets, "Editing …");
//   if (gate.blocked) return gate.response;       // 403 { error, upgradeRequired }
//   // gate.entitlements is the resolved Entitlements here
export async function requireEntitlement(
  businessId: string,
  predicate: (e: Entitlements) => boolean,
  message: string,
): Promise<
  | { blocked: false; entitlements: Entitlements }
  | { blocked: true; response: Response }
> {
  const business = await loadBusinessForEntitlements(businessId);
  if (!business) {
    return {
      blocked: true,
      response: NextResponse.json({ error: "Business not found." }, { status: 404 }),
    };
  }
  const entitlements = getEntitlements(business);
  if (!predicate(entitlements)) {
    return {
      blocked: true,
      response: NextResponse.json(
        { error: message, upgradeRequired: true },
        { status: 403 },
      ),
    };
  }
  return { blocked: false, entitlements };
}
