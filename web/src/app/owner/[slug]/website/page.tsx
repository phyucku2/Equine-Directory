import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusinessOwner, AuthError } from "@/lib/auth/guards";
import { loadOwnedBusiness } from "../_shared";
import {
  getSiteForBusiness,
  createSiteFromListing,
  setSiteStatus,
  readPages,
  SITE_PAGE_SECTIONS,
  type SitePageSection,
} from "@/lib/db/sites";
import { TEMPLATES } from "@/components/sites/templates/registry";
import { getApexDomain } from "@/lib/sites/tenant";
import { isDnsEnabled, checkDomainStatus, VERCEL_NAMESERVERS } from "@/lib/sites/dns";
import { WebsiteEditor } from "./WebsiteEditor";
import { DomainPanel, type DomainStatusView } from "./DomainPanel";

export const dynamic = "force-dynamic";

// Owner "Website" tab (specs/website-builder.md §"Owner UI"). Start a managed
// build (pre-fills a Site from the listing), pick a template, edit brand + page
// selection, see the subdomain, and connect a custom domain (DNS delegated). The
// build is available to any claimed/owned business — ownership is already
// enforced by loadOwnedBusiness() (the slug must be owned or this 404s).

const SECTION_LABELS: { value: SitePageSection; label: string }[] = [
  { value: "boarding", label: "Boarding & pricing" },
  { value: "facets", label: "Disciplines & features" },
  { value: "programs", label: "Programs & camps" },
  { value: "trainers", label: "Trainers" },
  { value: "events", label: "Events" },
  { value: "gallery", label: "Photo gallery" },
  { value: "reviews", label: "Reviews" },
  { value: "contact", label: "Contact, map & hours" },
];

// Order the canonical sections by the label list so the editor shows them in a
// sensible order even though SITE_PAGE_SECTIONS is the storage vocab.
const ORDERED_SECTIONS: { value: SitePageSection; label: string }[] = SECTION_LABELS.filter((s) =>
  (SITE_PAGE_SECTIONS as readonly string[]).includes(s.value),
);

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-cream-dark text-ink/70" },
  LIVE: { label: "Live", cls: "bg-pine/10 text-pine" },
  SUSPENDED: { label: "Suspended", cls: "bg-red-100 text-red-700" },
};

// Re-resolve ownership inside every server action (businessId from the form, then
// guarded) so the action can't be replayed against a business the user doesn't own.
async function assertOwner(businessId: string) {
  try {
    await requireBusinessOwner(businessId);
  } catch (err) {
    if (err instanceof AuthError) redirect(`/owner`);
    throw err;
  }
}

async function startBuildAction(formData: FormData) {
  "use server";
  const businessId = String(formData.get("businessId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  await assertOwner(businessId);
  await createSiteFromListing(businessId);
  revalidatePath(`/owner/${slug}/website`);
}

async function publishAction(formData: FormData) {
  "use server";
  const businessId = String(formData.get("businessId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  await assertOwner(businessId);
  await setSiteStatus(businessId, "LIVE");
  revalidatePath(`/owner/${slug}/website`);
}

async function unpublishAction(formData: FormData) {
  "use server";
  const businessId = String(formData.get("businessId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  await assertOwner(businessId);
  await setSiteStatus(businessId, "DRAFT");
  revalidatePath(`/owner/${slug}/website`);
}

export default async function OwnerWebsitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  const site = await getSiteForBusiness(business.id);
  const apex = getApexDomain();
  const dnsEnabled = isDnsEnabled();

  // ── No build yet: intake CTA ──
  if (!site) {
    return (
      <div>
        <h3 className="mb-1 text-sm font-semibold text-pine">Your barn website</h3>
        <p className="mb-5 max-w-prose text-xs text-ink/50">
          Turn your listing into a fast, branded website — pre-filled from everything
          you&apos;ve already added (photos, boarding, trainers, events, reviews). Pick a
          template, brand it, and go live on your own subdomain.
        </p>
        <div className="rounded-xl border border-leather/15 bg-cream-dark/40 p-6">
          <p className="text-sm font-semibold text-pine">Start your build</p>
          <p className="mt-1.5 max-w-prose text-sm text-ink/60">
            We&apos;ll pre-fill a site from your listing and derive a color palette from
            your logo. You can edit everything before it goes live.
          </p>
          <form action={startBuildAction} className="mt-4">
            <input type="hidden" name="businessId" value={business.id} />
            <input type="hidden" name="slug" value={business.slug} />
            <button className="rounded-lg bg-pine px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-pine-light">
              Start build →
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Build exists: editor + status + domain ──
  const pages = readPages(site.pages);
  const badge = STATUS_BADGE[site.status] ?? STATUS_BADGE.DRAFT;
  const subdomainHost = `${site.subdomain}.${apex}`;
  const liveUrl = `https://${site.customDomain ?? subdomainHost}`;

  // Resolve live domain status when automation is on and a custom domain is set.
  let domainStatus: DomainStatusView | null = null;
  if (dnsEnabled && site.customDomain) {
    const res = await checkDomainStatus(site.customDomain);
    if (res.ok) {
      const d = res.data;
      domainStatus = {
        added: d.added,
        verified: d.verified,
        delegated: d.delegated,
        misconfigured: d.misconfigured,
        nameservers: d.nameservers,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-pine">Your barn website</h3>
          <p className="mt-1 text-xs text-ink/50">
            Live at{" "}
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-brass underline">
              {site.customDomain ?? subdomainHost}
            </a>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {site.status === "LIVE" ? (
          <form action={unpublishAction}>
            <input type="hidden" name="businessId" value={business.id} />
            <input type="hidden" name="slug" value={business.slug} />
            <button className="rounded-lg border border-leather/20 px-4 py-2 text-sm font-medium text-pine transition hover:border-brass/50">
              Take offline
            </button>
          </form>
        ) : site.status === "SUSPENDED" ? (
          <p className="text-sm text-red-700">
            This site has been suspended. Contact support to restore it.
          </p>
        ) : (
          <form action={publishAction}>
            <input type="hidden" name="businessId" value={business.id} />
            <input type="hidden" name="slug" value={business.slug} />
            <button className="rounded-lg bg-pine px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-pine-light">
              Publish site
            </button>
          </form>
        )}
      </div>

      <WebsiteEditor
        businessId={business.id}
        templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name }))}
        sectionLabels={ORDERED_SECTIONS}
        initial={{
          templateId: site.templateId,
          tagline: pages.tagline ?? "",
          about: pages.about ?? "",
          sections: pages.sections,
        }}
      />

      <DomainPanel
        businessId={business.id}
        dnsEnabled={dnsEnabled}
        nameservers={[...VERCEL_NAMESERVERS]}
        initialDomain={site.customDomain}
        initialStatus={domainStatus}
      />
    </div>
  );
}
