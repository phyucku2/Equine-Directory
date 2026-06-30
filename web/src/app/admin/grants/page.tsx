import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import type { Metadata } from "next";
import type { SubTier } from "@prisma/client";
import { isAdmin } from "@/lib/auth/admin";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { businessUrl } from "@/lib/urls";
import { grantTier, addTrainerSeats, createSpotlight, expireStaleSpotlights } from "@/lib/db/grants";
import { BILLING_ENABLED } from "@/lib/billing/beta";

export const metadata: Metadata = { title: "Manual grants", robots: "noindex,nofollow" };
export const dynamic = "force-dynamic";

// Admin manual-grant console (specs/monetization-tiers.md §"Billing + admin").
// During beta (billing off) this is how we operate: grant a barn a tier, trainer
// seats, or a city spotlight without payment. isAdmin-guarded, mirrors the
// moderation queue's server-action pattern. Every grant writes an AuditLog row.

const GRANT_TIERS: { value: SubTier; label: string }[] = [
  { value: "VERIFIED", label: "Verified" },
  { value: "TEAM", label: "Team" },
  { value: "EVENTS", label: "Events" },
  { value: "FREE", label: "Free (revoke)" },
];

async function performer(): Promise<string> {
  const session = await auth();
  return `admin:${session?.user?.email ?? session?.user?.id ?? "unknown"}`;
}

// Look up a business by slug or id (used by every action below).
async function findBusiness(key: string) {
  const k = key.trim();
  if (!k) return null;
  return prisma.business.findFirst({
    where: { OR: [{ slug: k }, { id: k }] },
    select: { id: true, name: true, slug: true, locationId: true },
  });
}

async function grantTierAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");
  const biz = await findBusiness(String(formData.get("business") ?? ""));
  if (!biz) redirect("/admin/grants?error=notfound");
  const tier = String(formData.get("tier")) as SubTier;
  const seatsRaw = String(formData.get("trainerSeats") ?? "").trim();
  const trainerSeats = seatsRaw === "" ? undefined : Math.max(0, Number(seatsRaw) || 0);
  await grantTier({ businessId: biz.id, tier, trainerSeats, performedBy: await performer() });
  revalidatePath(businessUrl(biz.slug));
  redirect(`/admin/grants?ok=tier&biz=${biz.slug}`);
}

async function addSeatsAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");
  const biz = await findBusiness(String(formData.get("business") ?? ""));
  if (!biz) redirect("/admin/grants?error=notfound");
  const quantity = Math.max(1, Number(formData.get("quantity")) || 1);
  await addTrainerSeats({ businessId: biz.id, quantity, performedBy: await performer() });
  revalidatePath(businessUrl(biz.slug));
  redirect(`/admin/grants?ok=seats&biz=${biz.slug}`);
}

async function grantSpotlightAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");
  const biz = await findBusiness(String(formData.get("business") ?? ""));
  if (!biz) redirect("/admin/grants?error=notfound");
  const weeks = Math.max(1, Math.min(52, Number(formData.get("weeks")) || 1));
  const locationOverride = String(formData.get("locationId") ?? "").trim();
  const locationId = locationOverride || biz.locationId;
  const result = await createSpotlight({
    businessId: biz.id,
    locationId,
    weeks,
    performedBy: await performer(),
  });
  revalidatePath(businessUrl(biz.slug));
  redirect(`/admin/grants?ok=spotlight&biz=${biz.slug}&active=${result.active ? "1" : "0"}`);
}

async function expireAction() {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");
  const r = await expireStaleSpotlights();
  redirect(`/admin/grants?ok=sweep&expired=${r.expired}&promoted=${r.promoted}`);
}

export default async function AdminGrantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const sp = await searchParams;

  // Recent grants from the audit log + current spotlight inventory for context.
  const recent = await prisma.auditLog.findMany({
    where: { action: { in: ["TIER_GRANTED", "SPOTLIGHT_GRANTED"] } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, action: true, entityId: true, performedBy: true, details: true, createdAt: true },
  });
  const now = new Date();
  const activeSpotlights = await prisma.spotlight.findMany({
    where: { status: "active", startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: [{ locationId: "asc" }, { startsAt: "asc" }],
    select: {
      id: true,
      endsAt: true,
      business: { select: { name: true, slug: true } },
      location: { select: { name: true } },
    },
  });

  const banner = (() => {
    if (sp.error === "notfound") return { cls: "bg-red-100 text-red-800", text: "Business not found (slug or id)." };
    if (sp.ok === "tier") return { cls: "bg-emerald-100 text-emerald-900", text: `Tier granted to ${sp.biz}.` };
    if (sp.ok === "seats") return { cls: "bg-emerald-100 text-emerald-900", text: `Trainer seats added to ${sp.biz}.` };
    if (sp.ok === "spotlight")
      return {
        cls: "bg-emerald-100 text-emerald-900",
        text:
          sp.active === "1"
            ? `Spotlight granted to ${sp.biz} (active now).`
            : `Spotlight granted to ${sp.biz} — queued (city is at the 3-active cap; it activates as a slot frees).`,
      };
    if (sp.ok === "sweep")
      return { cls: "bg-blue-100 text-blue-900", text: `Sweep done: ${sp.expired} expired, ${sp.promoted} promoted.` };
    return null;
  })();

  const field = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm";
  const primaryBtn = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700";
  const card = "rounded-xl border border-stone-200 bg-white p-5";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Manual grants</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/sites" className="text-sm text-blue-600 hover:underline">
            Sites →
          </Link>
          <Link href="/admin/review" className="text-sm text-blue-600 hover:underline">
            Moderation queue →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Grant a tier, trainer seats, or a city spotlight without payment.{" "}
        {BILLING_ENABLED
          ? "Billing is ON — these grants override/supplement Stripe state."
          : "Billing is OFF (beta) — this is how barns get upgraded."}
      </p>

      {banner && <div className={`mt-4 rounded-lg px-4 py-2 text-sm ${banner.cls}`}>{banner.text}</div>}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {/* Grant tier */}
        <form action={grantTierAction} className={card}>
          <h2 className="font-semibold text-stone-900">Grant tier</h2>
          <p className="mt-0.5 text-xs text-stone-500">Sets the subscription tier ACTIVE.</p>
          <label className="mt-3 block text-xs font-medium text-stone-600">Business (slug or id)</label>
          <input name="business" required placeholder="happy-trails-stables" className={`mt-1 ${field}`} />
          <label className="mt-3 block text-xs font-medium text-stone-600">Tier</label>
          <select name="tier" className={`mt-1 ${field}`} defaultValue="VERIFIED">
            {GRANT_TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="mt-3 block text-xs font-medium text-stone-600">
            Trainer seats (optional, absolute)
          </label>
          <input name="trainerSeats" type="number" min={0} placeholder="leave blank to keep" className={`mt-1 ${field}`} />
          <button className={`mt-4 ${primaryBtn}`}>Grant tier</button>
        </form>

        {/* Add trainer seats */}
        <form action={addSeatsAction} className={card}>
          <h2 className="font-semibold text-stone-900">Add trainer seats</h2>
          <p className="mt-0.5 text-xs text-stone-500">Adds seats on top of current (lifts to Team if needed).</p>
          <label className="mt-3 block text-xs font-medium text-stone-600">Business (slug or id)</label>
          <input name="business" required placeholder="happy-trails-stables" className={`mt-1 ${field}`} />
          <label className="mt-3 block text-xs font-medium text-stone-600">Seats to add</label>
          <input name="quantity" type="number" min={1} defaultValue={1} className={`mt-1 ${field}`} />
          <button className={`mt-4 ${primaryBtn}`}>Add seats</button>
        </form>

        {/* Grant spotlight */}
        <form action={grantSpotlightAction} className={card}>
          <h2 className="font-semibold text-stone-900">Grant spotlight</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Defaults to the barn&apos;s city. Max 3 active per city — beyond that it queues.
          </p>
          <label className="mt-3 block text-xs font-medium text-stone-600">Business (slug or id)</label>
          <input name="business" required placeholder="happy-trails-stables" className={`mt-1 ${field}`} />
          <label className="mt-3 block text-xs font-medium text-stone-600">Weeks</label>
          <input name="weeks" type="number" min={1} max={52} defaultValue={1} className={`mt-1 ${field}`} />
          <label className="mt-3 block text-xs font-medium text-stone-600">
            City location id (optional override)
          </label>
          <input name="locationId" placeholder="defaults to barn city" className={`mt-1 ${field}`} />
          <button className={`mt-4 ${primaryBtn}`}>Grant spotlight</button>
        </form>

        {/* Expiry sweep */}
        <form action={expireAction} className={card}>
          <h2 className="font-semibold text-stone-900">Spotlight sweep</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Expire ended windows and promote queued ones into freed slots. (Read paths already filter
            by now ∈ [startsAt, endsAt]; this keeps the table tidy.)
          </p>
          <button className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:border-blue-300 hover:text-blue-700">
            Run sweep
          </button>
        </form>
      </div>

      {/* Active spotlights */}
      <h2 className="mt-8 font-semibold text-stone-900">Active spotlights</h2>
      {activeSpotlights.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">None active right now.</p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {activeSpotlights.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                <Link href={businessUrl(s.business.slug)} className="font-medium text-stone-800 hover:text-blue-600" target="_blank">
                  {s.business.name}
                </Link>
                <span className="text-stone-400"> · {s.location.name}</span>
              </span>
              <span className="text-stone-400">ends {s.endsAt.toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Recent grants */}
      <h2 className="mt-8 font-semibold text-stone-900">Recent grants</h2>
      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">No grants yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {recent.map((r) => (
            <li key={r.id} className="px-4 py-2 text-sm">
              <span className="font-medium text-stone-800">
                {r.action === "TIER_GRANTED" ? "Tier" : "Spotlight"}
              </span>{" "}
              <span className="text-stone-500">
                {JSON.stringify(r.details)} · by {r.performedBy} · {r.createdAt.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
