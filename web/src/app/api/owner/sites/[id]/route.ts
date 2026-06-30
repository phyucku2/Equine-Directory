import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import {
  getSiteForBusiness,
  updateSite,
  readPages,
  sanitizePages,
  type UpdateSiteInput,
} from "@/lib/db/sites";
import { getTemplate } from "@/components/sites/templates/registry";

export const dynamic = "force-dynamic";

// PATCH /api/owner/sites/[id] — update a started build's template + page
// selection + brand copy. businessId is the URL param (owner-guarded by
// withOwner). Everything is re-validated server-side: templateId is normalized
// through the registry, sections against the vocab, copy is length-capped.
export const PATCH = withOwner(async ({ id, request }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const site = await getSiteForBusiness(id);
  if (!site) {
    return NextResponse.json({ error: "No website build for this barn yet." }, { status: 404 });
  }

  const data: UpdateSiteInput = {};
  if (typeof body.templateId === "string") {
    // Normalize: an unknown id resolves to the default template's id.
    data.templateId = getTemplate(body.templateId).id;
  }
  if (body.pages !== undefined) {
    data.pages = sanitizePages(body.pages, readPages(site.pages));
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await updateSite(id, data);
  if (!updated) {
    return NextResponse.json({ error: "No website build for this barn yet." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, templateId: updated.templateId });
});
