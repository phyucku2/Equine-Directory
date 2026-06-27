import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { loadOwnedBusiness } from "../_shared";

export const dynamic = "force-dynamic";

// Team tab — OWNER-only (ADMIN bypasses). Lists the verified co-owners of this
// barn. Invite/relinquish (the transfer POST) is surfaced here; the mutating
// endpoint is owner-guarded server-side.
export default async function OwnerTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "OWNER" && role !== "ADMIN") notFound();

  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  return (
    <div className="max-w-xl">
      <h3 className="mb-1 text-sm font-semibold text-pine">Team</h3>
      <p className="mb-5 text-xs text-ink/50">
        People who can manage this listing. Ownership is granted through verified claims.
      </p>

      <ul className="space-y-2">
        {business.owners.map((o) => (
          <li
            key={o.id}
            className="flex items-center gap-3 rounded-xl border border-leather/15 bg-white p-3"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-pine/10 text-sm font-semibold text-pine">
              {o.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                (o.user.name ?? o.user.email ?? "?").charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {o.user.name ?? o.user.email ?? "Owner"}
                {o.user.id === session?.user?.id && (
                  <span className="ml-2 text-xs text-ink/45">(you)</span>
                )}
              </p>
              {o.user.email && <p className="truncate text-xs text-ink/50">{o.user.email}</p>}
            </div>
            {o.isPrimary && (
              <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px] font-semibold text-leather">
                Primary
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs text-ink/45">
        To add a co-owner, have them sign in and verify a claim on this barn from the public listing.
      </p>
    </div>
  );
}
