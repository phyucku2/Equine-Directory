import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listUserInquiries } from "@/lib/db/inquiry";
import { businessUrl } from "@/lib/urls";

// /account/inquiries — leads the signed-in user has sent to barns (M6 / §3).
// Guest inquiries have no account record (acceptable for beta); only signed-in
// inquiries appear here. The account layout already guards auth; requireUser()
// is a cheap second factor that also gives us the user id.
const STATUS_LABEL: Record<string, string> = {
  NEW: "Sent",
  READ: "Seen",
  REPLIED: "Replied",
  ARCHIVED: "Archived",
};

const STATUS_CLASS: Record<string, string> = {
  NEW: "bg-pine/10 text-pine",
  READ: "bg-brass/15 text-leather",
  REPLIED: "bg-emerald-100 text-emerald-800",
  ARCHIVED: "bg-leather/10 text-ink/55",
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function InquiriesPage() {
  const user = await requireUser();
  const inquiries = await listUserInquiries(user.id);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pine">Inquiries</h2>
          <p className="mt-0.5 text-sm text-ink/55">
            {inquiries.length} {inquiries.length === 1 ? "inquiry" : "inquiries"} sent to barns.
          </p>
        </div>
        <Link href="/account" className="text-sm text-brass hover:underline">
          ← Back to account
        </Link>
      </div>

      {inquiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-sm text-ink/60">
          <p>You haven&apos;t sent any inquiries yet.</p>
          <p className="mt-1">
            Find a stable and use the &ldquo;Contact this barn&rdquo; form to send a lead.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {inquiries.map((inq) => (
            <li key={inq.id} className="rounded-xl border border-leather/15 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={businessUrl(inq.business.slug)}
                  className="font-semibold text-pine hover:text-brass hover:underline"
                >
                  {inq.business.name}
                </Link>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_CLASS[inq.status] ?? "bg-leather/10 text-ink/55"
                    }`}
                  >
                    {STATUS_LABEL[inq.status] ?? inq.status}
                  </span>
                  <span className="text-xs text-ink/45">{dateFmt.format(inq.createdAt)}</span>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink/70">{inq.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
