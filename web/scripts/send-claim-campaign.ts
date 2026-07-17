/**
 * Claim-your-listing outreach campaign.
 *
 * Sends ONE email to each published, UNCLAIMED barn we have an address for:
 * "you're listed — claim your free page now." Turns crawled barns into claimed
 * (and eventually paying) accounts while traffic is still ramping.
 *
 * This is cold-ish outreach, so it is built defensively:
 *   - DRY RUN by default. Nothing sends without --apply.
 *   - Suppression list (AuditLog EMAIL_UNSUBSCRIBED) checked before every send.
 *   - One email per business per cooldown window (AuditLog CLAIM_CAMPAIGN_SENT),
 *     and never the same address twice in one run.
 *   - Every message carries a visible unsubscribe link + List-Unsubscribe /
 *     List-Unsubscribe-Post headers (RFC 8058 one-click) + a physical postal
 *     address (CAN-SPAM). --apply refuses to run without CAMPAIGN_POSTAL_ADDRESS.
 *   - Throttled (per-send delay + per-run --limit) so sender reputation warms up
 *     instead of getting the domain blocklisted.
 *
 * Env: DATABASE_URL, UNSUBSCRIBE_SECRET (signs unsubscribe links; falls back to
 *   AUTH_SECRET). For --apply also: RESEND_API_KEY, EMAIL_FROM,
 *   NEXT_PUBLIC_BASE_URL, CAMPAIGN_POSTAL_ADDRESS.
 *
 * Usage (web/ folder):
 *   npx tsx scripts/send-claim-campaign.ts --limit 100            # preview
 *   npx tsx scripts/send-claim-campaign.ts --apply --limit 100    # send (warm-up)
 */

import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { unsubscribeUrl } from "../src/lib/email/unsubscribe";

const prisma = new PrismaClient();

const COOLDOWN_DAYS = 30;

type Args = { apply: boolean; limit: number; delayMs: number };

function parseArgs(argv: string[]): Args {
  const a: Args = { apply: false, limit: 200, delayMs: 500 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") a.apply = true;
    else if (arg === "--limit") a.limit = parseInt(argv[++i], 10) || a.limit;
    else if (arg === "--delay-ms") a.delayMs = parseInt(argv[++i], 10) || a.delayMs;
  }
  return a;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function campaignHtml(args: {
  businessName: string;
  claimUrl: string;
  unsub: string;
  postalAddress: string;
}): string {
  const name = escapeHtml(args.businessName);
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2b2b2b;max-width:520px">
      <p>Hi ${name},</p>
      <p><strong>${name}</strong> is listed on <a href="https://thestabledirectory.com">The Stable Directory</a>,
         a national directory for horse boarding, training, and equine services.</p>
      <p>Right now your page is unclaimed. <strong>Claiming it is free</strong> and lets you:</p>
      <ul>
        <li>Correct your details, hours, and photos</li>
        <li>Receive inquiries from horse owners by email</li>
        <li>Respond to reviews</li>
      </ul>
      <p>We're early and adding barns fast — claim yours now so it's ready as traffic grows:</p>
      <p><a href="${args.claimUrl}"
            style="display:inline-block;background:#2f5d3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
        Claim ${name}
      </a></p>
      <hr style="border:none;border-top:1px solid #e7e0d4;margin:24px 0" />
      <p style="font-size:12px;color:#8a8a8a">
        You're receiving this because ${name} is publicly listed on The Stable Directory.
        <a href="${args.unsub}">Unsubscribe</a> to stop these emails.<br />
        ${escapeHtml(args.postalAddress)}
      </p>
    </div>`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Signing secret is only needed to bake working unsubscribe links into real
  // sends — a dry run mails nothing, so it can run with no secrets at all (handy
  // for just counting recipients before any of the send config is in place).
  if (args.apply && !process.env.UNSUBSCRIBE_SECRET && !process.env.AUTH_SECRET) {
    console.error("--apply requires UNSUBSCRIBE_SECRET (or AUTH_SECRET) to sign unsubscribe links.");
    process.exit(1);
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://thestabledirectory.com";

  // Where owner replies land. We send from the branded domain but set Reply-To
  // to a real monitored inbox (e.g. a Gmail) so replies aren't lost — the send
  // domain has inbound receiving disabled, so a reply to the From address would
  // otherwise bounce. Optional: unset → no Reply-To header (replies bounce).
  const replyTo = process.env.CAMPAIGN_REPLY_TO?.trim() || undefined;

  let resend: Resend | null = null;
  let postalAddress = "";
  if (args.apply) {
    const missing = ["RESEND_API_KEY", "EMAIL_FROM", "CAMPAIGN_POSTAL_ADDRESS"].filter(
      (k) => !process.env[k],
    );
    if (missing.length) {
      console.error(`--apply requires: ${missing.join(", ")}. Refusing to send.`);
      process.exit(1);
    }
    resend = new Resend(process.env.RESEND_API_KEY!);
    postalAddress = process.env.CAMPAIGN_POSTAL_ADDRESS!;
  }

  // Suppression + recent-send sets (small relative to the barn table).
  const [suppressedRows, sentRows] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: "EMAIL_UNSUBSCRIBED" },
      select: { entityId: true },
    }),
    prisma.auditLog.findMany({
      where: {
        action: "CLAIM_CAMPAIGN_SENT",
        createdAt: { gte: new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000) },
      },
      select: { entityId: true },
    }),
  ]);
  const suppressed = new Set(suppressedRows.map((r) => r.entityId.toLowerCase()));
  const recentlySent = new Set(sentRows.map((r) => r.entityId));

  // Published, unclaimed barns with an email, best-known first. Over-fetch so
  // post-filtering (suppressed / recently-sent / dup address) still fills limit.
  const candidates = await prisma.business.findMany({
    where: {
      isPublished: true,
      email: { not: null },
      owners: { none: {} },
      // Belt-and-suspenders: never campaign the non-barn names we screen publicly.
      NOT: [
        { name: { contains: "church", mode: "insensitive" } },
        { name: { contains: "equipment", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true, email: true, reviewCount: true },
    orderBy: { reviewCount: "desc" },
    take: args.limit * 4,
  });

  const seenEmail = new Set<string>();
  const targets: typeof candidates = [];
  for (const b of candidates) {
    const email = (b.email ?? "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    if (suppressed.has(email) || seenEmail.has(email)) continue;
    if (recentlySent.has(b.id)) continue;
    seenEmail.add(email);
    targets.push(b);
    if (targets.length >= args.limit) break;
  }

  console.log(
    `${args.apply ? "APPLY" : "DRY RUN"} · ${targets.length} barns to email ` +
      `(limit ${args.limit}, cooldown ${COOLDOWN_DAYS}d, delay ${args.delayMs}ms)` +
      `\nReply-To: ${replyTo ?? "(none — replies will bounce; set CAMPAIGN_REPLY_TO)"}\n`,
  );

  let sent = 0;
  for (const b of targets) {
    const email = b.email!.trim();

    if (!args.apply) {
      console.log(`  would email ${email}  ←  ${b.name}`);
      continue;
    }

    const claimUrl = `${baseUrl.replace(/\/$/, "")}/business/${b.slug}/claim`;
    const unsub = unsubscribeUrl(baseUrl, email);
    try {
      await resend!.emails.send({
        from: process.env.EMAIL_FROM!,
        to: email,
        ...(replyTo ? { replyTo } : {}),
        subject: `Claim your free listing for ${b.name}`,
        html: campaignHtml({ businessName: b.name, claimUrl, unsub, postalAddress }),
        headers: {
          "List-Unsubscribe": `<${unsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      await prisma.auditLog.create({
        data: {
          action: "CLAIM_CAMPAIGN_SENT",
          entityType: "Business",
          entityId: b.id,
          performedBy: "system:claim-campaign",
          details: { email },
        },
      });
      sent += 1;
      if (sent % 25 === 0) console.log(`  … sent ${sent}/${targets.length}`);
      await sleep(args.delayMs);
    } catch (err) {
      console.error(`  ✗ failed ${email} (${b.name}):`, (err as Error).message);
    }
  }

  console.log(
    `\n${args.apply ? `APPLIED: sent ${sent}` : `DRY RUN: ${targets.length} would send`} ` +
      `· re-run with --apply to send.`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
