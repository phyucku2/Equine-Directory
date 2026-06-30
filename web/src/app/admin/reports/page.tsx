import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/admin";
import { listReportedBusinesses, resolveReports, REPORT_THRESHOLD } from "@/lib/db/reports";
import { businessUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Reported listings", robots: "noindex,nofollow" };
export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  not_a_stable: "Not a stable",
  closed: "Closed",
  duplicate: "Duplicate",
  other: "Other",
};

async function act(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");
  const businessId = String(formData.get("businessId"));
  const action = String(formData.get("action")) as "dismiss" | "reject";
  const slug = String(formData.get("slug") ?? "");
  await resolveReports(businessId, action, "admin");
  if (slug) revalidatePath(businessUrl(slug));
  revalidatePath("/admin/reports");
}

export default async function AdminReportsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const reported = await listReportedBusinesses();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Reported listings</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/review" className="text-sm text-blue-600 hover:underline">
            Moderation queue →
          </Link>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
            {reported.length} flagged
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Crowdsourced flags from visitors. A listing is auto-hidden once it reaches{" "}
        {REPORT_THRESHOLD} independent reports. <strong>Dismiss</strong> if the report is
        unfounded (re-publishes a genuine barn); <strong>Reject</strong> if it really isn&apos;t a
        stable (rejects its boarding category and unpublishes it).
      </p>

      {reported.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          No open reports. 🎉
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reported.map((r) => (
            <li key={r.businessId} className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={businessUrl(r.slug)}
                      target="_blank"
                      className="font-semibold text-stone-900 hover:text-emerald-800"
                    >
                      {r.name}
                    </Link>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      {r.openCount} report{r.openCount === 1 ? "" : "s"}
                    </span>
                    {!r.isPublished && (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
                        hidden
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-stone-500">{r.address}</p>
                  <p className="mt-2 text-sm text-stone-700">
                    {r.reasons
                      .map((x) => `${REASON_LABEL[x.reason] ?? x.reason} ×${x.count}`)
                      .join(" · ")}
                  </p>
                </div>

                <div className="flex gap-2">
                  <form action={act}>
                    <input type="hidden" name="businessId" value={r.businessId} />
                    <input type="hidden" name="slug" value={r.slug} />
                    <input type="hidden" name="action" value="dismiss" />
                    <button className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:border-emerald-300 hover:text-emerald-700">
                      Dismiss
                    </button>
                  </form>
                  <form action={act}>
                    <input type="hidden" name="businessId" value={r.businessId} />
                    <input type="hidden" name="slug" value={r.slug} />
                    <input type="hidden" name="action" value="reject" />
                    <button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
                      Reject &amp; unpublish
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
