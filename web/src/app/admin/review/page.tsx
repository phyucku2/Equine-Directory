import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/admin";
import { listModerationQueue, moderateAssignment } from "@/lib/db/moderation";
import { businessUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Moderation queue", robots: "noindex,nofollow" };
export const dynamic = "force-dynamic";

const GRADE_LABEL: Record<string, { label: string; cls: string }> = {
  GRADE_1_NOT: { label: "1 · No evidence", cls: "bg-red-100 text-red-800" },
  GRADE_2_UNSURE: { label: "2 · Unsure", cls: "bg-amber-100 text-amber-900" },
};

async function act(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");
  const businessId = String(formData.get("businessId"));
  const categoryId = String(formData.get("categoryId"));
  const action = String(formData.get("action")) as "approve" | "reject";
  const slug = String(formData.get("slug") ?? "");
  await moderateAssignment(businessId, categoryId, action, "admin");
  if (slug) revalidatePath(businessUrl(slug));
  revalidatePath("/admin/review");
}

export default async function AdminReviewPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const queue = await listModerationQueue();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Moderation queue</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/grants" className="text-sm text-blue-600 hover:underline">
            Manual grants →
          </Link>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
            {queue.length} pending
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Grade 1 &amp; 2 category claims the extractor couldn&apos;t auto-confirm. Approve to publish
        (promotes to grade 3); reject to hide that category.
      </p>

      {queue.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          Queue is empty — nothing to review. 🎉
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {queue.map((item) => {
            const g = GRADE_LABEL[item.grade] ?? { label: item.grade, cls: "bg-stone-100" };
            return (
              <li
                key={`${item.businessId}:${item.categoryId}`}
                className="rounded-xl border border-stone-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={businessUrl(item.business.slug)} className="font-semibold text-stone-900 hover:text-emerald-800" target="_blank">
                        {item.business.name}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${g.cls}`}>{g.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">{item.business.address}</p>
                    <p className="mt-2 text-sm">
                      Category claim: <span className="font-medium text-stone-800">{item.category.name}</span>
                      {item.confidence != null && (
                        <span className="text-stone-400"> · confidence {Number(item.confidence).toFixed(2)}</span>
                      )}
                    </p>
                    {item.evidenceQuote && (
                      <blockquote className="mt-2 border-l-2 border-stone-300 pl-3 text-sm italic text-stone-600">
                        “{item.evidenceQuote}”
                      </blockquote>
                    )}
                    {item.business.website && (
                      <a href={item.business.website} target="_blank" rel="noreferrer nofollow" className="mt-2 inline-block text-xs text-emerald-700 hover:underline">
                        Visit site to verify →
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <form action={act}>
                      <input type="hidden" name="businessId" value={item.businessId} />
                      <input type="hidden" name="categoryId" value={item.categoryId} />
                      <input type="hidden" name="slug" value={item.business.slug} />
                      <input type="hidden" name="action" value="approve" />
                      <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                        Approve
                      </button>
                    </form>
                    <form action={act}>
                      <input type="hidden" name="businessId" value={item.businessId} />
                      <input type="hidden" name="categoryId" value={item.categoryId} />
                      <input type="hidden" name="slug" value={item.business.slug} />
                      <input type="hidden" name="action" value="reject" />
                      <button className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:border-red-300 hover:text-red-700">
                        Reject
                      </button>
                    </form>
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
