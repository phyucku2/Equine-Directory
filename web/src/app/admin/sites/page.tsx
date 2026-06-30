import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import type { Metadata } from "next";
import type { SiteStatus } from "@prisma/client";
import { isAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { businessUrl } from "@/lib/urls";
import {
  listSites,
  createSiteFromListing,
  setSiteStatus,
  getSiteForBusiness,
} from "@/lib/db/sites";
import { getApexDomain } from "@/lib/sites/tenant";
import { isDnsEnabled } from "@/lib/sites/dns";
import { BILLING_ENABLED } from "@/lib/billing/beta";

export const metadata: Metadata = { title: "Sites", robots: "noindex,nofollow" };
export const dynamic = "force-dynamic";

// Admin site-provisioning console (specs/website-builder.md §"Admin"). List every
// generated Site, provision/suspend, and grant a build in beta. isAdmin-guarded,
// mirrors the moderation queue / manual-grants server-action pattern.

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-stone-100 text-stone-600" },
  LIVE: { label: "Live", cls: "bg-emerald-100 text-emerald-800" },
  SUSPENDED: { label: "Suspended", cls: "bg-red-100 text-red-800" },
};

// Look up a business by slug or id.
async function findBusiness(key: string) {
  const k = key.trim();
  if (!k) return null;
  return prisma.business.findFirst({
    where: { OR: [{ slug: k }, { id: k }] },
    select: { id: true, name: true, slug: true },
  });
}

// Provision a build for a business (admin grant in beta). Pre-fills a Site from
// the listing if none exists, then publishes it LIVE.
async function provisionAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");
  const biz = await findBusiness(String(formData.get("business") ?? ""));
  if (!biz) redirect("/admin/sites?error=notfound");
  await createSiteFromListing(biz.id);
  await setSiteStatus(biz.id, "LIVE");
  revalidatePath("/admin/sites");
  redirect(`/admin/sites?ok=provisioned&biz=${biz.slug}`);
}

async function setStatusAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");
  const businessId = String(formData.get("businessId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const status = String(formData.get("status") ?? "") as SiteStatus;
  if (!["DRAFT", "LIVE", "SUSPENDED"].includes(status)) redirect("/admin/sites?error=badstatus");
  const site = await getSiteForBusiness(businessId);
  if (!site) redirect("/admin/sites?error=nosite");
  await setSiteStatus(businessId, status);
  revalidatePath("/admin/sites");
  redirect(`/admin/sites?ok=${status.toLowerCase()}&biz=${slug}`);
}

export default async function AdminSitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const sp = await searchParams;

  const sites = await listSites();
  const apex = getApexDomain();
  const dnsEnabled = isDnsEnabled();

  const banner = (() => {
    if (sp.error === "notfound") return { cls: "bg-red-100 text-red-800", text: "Business not found (slug or id)." };
    if (sp.error === "nosite") return { cls: "bg-red-100 text-red-800", text: "That business has no site." };
    if (sp.error === "badstatus") return { cls: "bg-red-100 text-red-800", text: "Invalid status." };
    if (sp.ok === "provisioned") return { cls: "bg-emerald-100 text-emerald-900", text: `Site provisioned + published for ${sp.biz}.` };
    if (sp.ok === "live") return { cls: "bg-emerald-100 text-emerald-900", text: `${sp.biz} is now live.` };
    if (sp.ok === "suspended") return { cls: "bg-amber-100 text-amber-900", text: `${sp.biz} suspended.` };
    if (sp.ok === "draft") return { cls: "bg-blue-100 text-blue-900", text: `${sp.biz} taken offline (draft).` };
    return null;
  })();

  const field = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm";
  const primaryBtn = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700";
  const card = "rounded-xl border border-stone-200 bg-white p-5";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Sites</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/grants" className="text-sm text-blue-600 hover:underline">
            Manual grants →
          </Link>
          <Link href="/admin/review" className="text-sm text-blue-600 hover:underline">
            Moderation queue →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Provision, suspend, and grant barn website builds.{" "}
        {BILLING_ENABLED
          ? "Billing is ON — the build is normally a paid one-time purchase."
          : "Billing is OFF (beta) — provision builds here without payment."}{" "}
        DNS automation is {dnsEnabled ? "ON" : "OFF (manual nameserver delegation)"}.
      </p>

      {banner && <div className={`mt-4 rounded-lg px-4 py-2 text-sm ${banner.cls}`}>{banner.text}</div>}

      {/* Provision a build */}
      <form action={provisionAction} className={`mt-6 ${card}`}>
        <h2 className="font-semibold text-stone-900">Provision a build</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Pre-fills a site from the listing (subdomain, palette, default template) and
          publishes it live. Idempotent — re-running just re-publishes.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1 block text-xs font-medium text-stone-600">Business (slug or id)</span>
            <input name="business" required placeholder="happy-trails-stables" className={field} />
          </label>
          <button className={primaryBtn}>Provision + publish</button>
        </div>
      </form>

      {/* All sites */}
      <h2 className="mt-8 font-semibold text-stone-900">All sites ({sites.length})</h2>
      {sites.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">No sites yet.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {sites.map((s) => {
            const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.DRAFT;
            const host = s.customDomain ?? `${s.subdomain}.${apex}`;
            return (
              <li key={s.id} className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={businessUrl(s.business.slug)}
                        target="_blank"
                        className="font-semibold text-stone-900 hover:text-emerald-800"
                      >
                        {s.business.name}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">
                      <a href={`https://${host}`} target="_blank" rel="noreferrer" className="hover:underline">
                        {host}
                      </a>
                      {s.customDomain && (
                        <span className="text-stone-400"> · custom · DNS {s.dnsManaged ? "managed" : "manual"}</span>
                      )}
                      <span className="text-stone-400"> · template {s.templateId}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {s.status !== "LIVE" && (
                      <StatusButton businessId={s.businessId} slug={s.business.slug} status="LIVE" label="Publish" action={setStatusAction} />
                    )}
                    {s.status !== "SUSPENDED" && (
                      <StatusButton businessId={s.businessId} slug={s.business.slug} status="SUSPENDED" label="Suspend" action={setStatusAction} danger />
                    )}
                    {s.status !== "DRAFT" && (
                      <StatusButton businessId={s.businessId} slug={s.business.slug} status="DRAFT" label="Unpublish" action={setStatusAction} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusButton({
  businessId,
  slug,
  status,
  label,
  action,
  danger = false,
}: {
  businessId: string;
  slug: string;
  status: SiteStatus;
  label: string;
  action: (formData: FormData) => void;
  danger?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={status} />
      <button
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
          danger
            ? "border-stone-300 text-stone-600 hover:border-red-300 hover:text-red-700"
            : "border-stone-300 text-stone-700 hover:border-blue-300 hover:text-blue-700"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
