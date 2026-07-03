import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Newsletter signup (growth-and-pipeline.md §4 — the consumer email asset).
// One-field capture; idempotent on email (re-subscribing clears unsubscribedAt).
// The `website` field is a honeypot: bots that fill it get a fake success.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SOURCES = new Set(["footer", "guide", "camp-guide"]);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Honeypot filled -> pretend success, store nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 255) : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const source =
    typeof body.source === "string" && SOURCES.has(body.source) ? body.source : "footer";

  await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: { email, source },
    update: { unsubscribedAt: null },
  });

  return NextResponse.json({ ok: true });
}
