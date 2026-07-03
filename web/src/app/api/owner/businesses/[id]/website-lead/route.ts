import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withOwner } from "@/lib/auth/owner-route";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/db/notification";
import { PRICES } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

// Website-builder lead capture (Goal 7 / specs/website-builder.md). The build is
// a productized service ($99–299 one-time + $49.99/yr managed hosting), fulfilled
// manually for now — this route files the lead as an admin notification, exactly
// like the beta plan-request path. The multi-tenant site builder itself is a
// later phase; the funnel starts earning leads today.

const PACKAGES = {
  starter: { label: "Starter website build", amountCents: PRICES.websiteBuild.starter },
  premium: { label: "Premium website build", amountCents: PRICES.websiteBuild.premium },
} as const;

type PackageKey = keyof typeof PACKAGES;

export const POST = withOwner(async ({ id, request, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const pkg = typeof body.package === "string" ? (body.package as PackageKey) : null;
  if (!pkg || !(pkg in PACKAGES)) {
    return NextResponse.json({ error: "Choose a package." }, { status: 400 });
  }
  const desiredDomain =
    typeof body.desiredDomain === "string" ? body.desiredDomain.trim().slice(0, 253) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";

  const business = await prisma.business.findUnique({
    where: { id },
    select: { name: true, slug: true },
  });
  const { label, amountCents } = PACKAGES[pkg];

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(
    admins.map((a) =>
      createNotification({
        userId: a.id,
        type: "SYSTEM",
        title: `Website build lead: ${business?.name ?? id}`,
        body: `${user.name ?? user.email ?? "An owner"} requested "${label}" (+$${(PRICES.websiteBuild.maintenanceYearly / 100).toFixed(2)}/yr maintenance)${desiredDomain ? ` · domain: ${desiredDomain}` : ""}${notes ? ` · notes: ${notes}` : ""}`,
        url: "/admin",
        data: {
          businessId: id,
          lead: "website-build",
          package: pkg,
          amountCents,
          desiredDomain: desiredDomain || null,
          notes: notes || null,
          requestedBy: user.id,
        } as Prisma.InputJsonValue,
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    message: "Thanks! We'll reach out shortly to kick off your website.",
  });
});
