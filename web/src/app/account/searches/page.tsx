import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listSavedSearches } from "@/lib/db/savedSearch";
import { SearchList, type SavedSearchItem } from "./SearchList";

// /account/searches — saved searches with alert toggles + frequency (M8a / §3).
export default async function SearchesPage() {
  const user = await requireUser();
  const searches = await listSavedSearches(user.id);

  const initial: SavedSearchItem[] = searches.map((s) => ({
    id: s.id,
    name: s.name,
    filters: s.filters,
    frequency: s.frequency,
    emailEnabled: s.emailEnabled,
    lastCheckedAt: s.lastCheckedAt ? s.lastCheckedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pine">Saved searches</h2>
          <p className="mt-0.5 text-sm text-ink/55">
            Get alerted when new stables match your filters.
          </p>
        </div>
        <Link href="/account" className="text-sm text-brass hover:underline">
          ← Back to account
        </Link>
      </div>

      <SearchList initial={initial} />
    </div>
  );
}
