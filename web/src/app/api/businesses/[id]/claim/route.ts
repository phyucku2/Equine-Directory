import { NextResponse } from "next/server";
import { createClaim } from "@/lib/db/claim";
import { absoluteUrl } from "@/lib/urls";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { ownerName?: string; ownerEmail?: string; ownerPhone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ownerName = body.ownerName?.trim();
  const ownerEmail = body.ownerEmail?.trim();
  if (!ownerName || !ownerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
  }

  const result = await createClaim(id, { ownerName, ownerEmail, ownerPhone: body.ownerPhone });
  if (!result) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  const verifyUrl = absoluteUrl(`/claim/verify?token=${result.token}`);
  // Email delivery is a later task; until then we return the link so the flow
  // is testable end-to-end.
  return NextResponse.json({ ok: true, verifyUrl });
}
