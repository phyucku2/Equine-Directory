import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { updateBusinessDetails, type DetailsInput } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.trim().slice(0, max);
}

// Nullable string field: "" / null -> null (clear), otherwise trimmed value.
function nullableStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// PATCH /api/owner/businesses/[id] — edit core listing details. businessId is
// the URL param (owner-guarded); only the whitelisted fields below are writable.
export const PATCH = withOwner(async ({ id, request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: DetailsInput = {};

  if (body.name !== undefined) {
    const name = str(body.name, 255);
    if (!name) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    data.name = name;
  }
  if (body.description !== undefined) data.description = nullableStr(body.description, 20000);
  if (body.phone !== undefined) data.phone = nullableStr(body.phone, 32);
  if (body.address !== undefined) {
    const address = str(body.address, 512);
    if (!address) return NextResponse.json({ error: "Address cannot be empty." }, { status: 400 });
    data.address = address;
  }

  if (body.email !== undefined) {
    const email = nullableStr(body.email, 255);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    data.email = email;
  }
  if (body.website !== undefined) {
    const website = nullableStr(body.website, 512);
    if (website && !/^https?:\/\//i.test(website)) {
      return NextResponse.json({ error: "Website must start with http:// or https://" }, { status: 400 });
    }
    data.website = website;
  }
  if (body.socialLinks !== undefined) {
    const sl = body.socialLinks;
    if (sl !== null && (typeof sl !== "object" || Array.isArray(sl))) {
      return NextResponse.json({ error: "socialLinks must be an object." }, { status: 400 });
    }
    data.socialLinks = sl as DetailsInput["socialLinks"];
  }

  const result = await updateBusinessDetails(id, data);
  return NextResponse.json({ ok: true, business: result });
});
