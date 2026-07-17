import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/admin";
import { listModerationQueue, moderationQueueCount } from "@/lib/db/moderation";
import { ReviewList, type ReviewItem } from "./ReviewList";

export const metadata: Metadata = { title: "Moderation queue", robots: "noindex,nofollow" };
export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const [queue, total] = await Promise.all([listModerationQueue(), moderationQueueCount()]);

  const items: ReviewItem[] = queue.map((item) => ({
    businessId: item.businessId,
    categoryId: item.categoryId,
    grade: item.grade,
    confidence: item.confidence != null ? Number(item.confidence) : null,
    evidenceQuote: item.evidenceQuote ?? null,
    business: {
      name: item.business.name,
      slug: item.business.slug,
      website: item.business.website ?? null,
      address: item.business.address ?? null,
    },
    category: { name: item.category.name },
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Moderation queue</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/reports" className="text-sm text-blue-600 hover:underline">
            Reported listings →
          </Link>
          <Link href="/admin/grants" className="text-sm text-blue-600 hover:underline">
            Manual grants →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Grade 1 &amp; 2 category claims the extractor couldn&apos;t auto-confirm. Approve to publish
        (promotes to grade 3); reject to hide that category.
      </p>

      <ReviewList items={items} totalPending={total} loadedCount={items.length} />
    </div>
  );
}
