import { prisma } from "@/lib/prisma";
import { verifyUnsubscribe } from "@/lib/email/unsubscribe";

// Unsubscribe endpoint for outbound campaign email (claim-your-listing drive).
// The suppression list lives in AuditLog (action EMAIL_UNSUBSCRIBED, entityId =
// lowercased email) so no schema migration is needed; the batch sender checks it
// before every send. Supports both the visible link (GET → confirmation page)
// and RFC 8058 one-click (POST → 204), advertised via the List-Unsubscribe and
// List-Unsubscribe-Post headers on each campaign message.

export const dynamic = "force-dynamic";

async function suppress(email: string): Promise<void> {
  const already = await prisma.auditLog.findFirst({
    where: { action: "EMAIL_UNSUBSCRIBED", entityId: email },
    select: { id: true },
  });
  if (already) return;
  await prisma.auditLog.create({
    data: {
      action: "EMAIL_UNSUBSCRIBED",
      entityType: "Email",
      entityId: email,
      performedBy: `unsubscribe:${email}`,
    },
  });
}

function emailFromRequest(url: URL): string | null {
  const e = url.searchParams.get("e");
  const s = url.searchParams.get("s");
  if (!e || !s) return null;
  return verifyUnsubscribe(e, s);
}

// One-click (RFC 8058): mail clients POST here directly from the header.
export async function POST(request: Request) {
  const email = emailFromRequest(new URL(request.url));
  if (!email) return new Response("Invalid link", { status: 400 });
  await suppress(email);
  return new Response(null, { status: 204 });
}

export async function GET(request: Request) {
  const email = emailFromRequest(new URL(request.url));
  const ok = email !== null;
  if (ok) await suppress(email!);
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${ok ? "Unsubscribed" : "Invalid link"} · The Stable Directory</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#faf7f2;color:#2b2b2b;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{max-width:460px;background:#fff;border:1px solid #e7e0d4;border-radius:16px;padding:32px;text-align:center}
  h1{font-size:1.25rem;margin:0 0 8px}
  p{color:#5b5b5b;line-height:1.5;margin:8px 0}
  a{color:#2f5d3a;font-weight:600;text-decoration:none}
</style></head>
<body><div class="card">
${
  ok
    ? `<h1>You're unsubscribed</h1>
       <p>We won't email <strong>${email}</strong> about claiming your listing again.</p>
       <p>You'll still receive replies to any inquiries you send, and messages from barns you contact directly.</p>
       <p><a href="https://thestabledirectory.com">Back to The Stable Directory</a></p>`
    : `<h1>This link isn't valid</h1>
       <p>The unsubscribe link may be incomplete. If you keep getting email you don't want, reply to any message and we'll remove you.</p>`
}
</div></body></html>`;
  return new Response(body, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
