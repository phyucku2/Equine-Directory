import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listSavedStables } from "@/lib/db/savedStable";
import { SavedStablesGrid } from "@/components/saved/SavedStablesGrid";

// /account/saved — the user's favorited stables, rendered through the shared
// StableCard. The account layout already guards auth; requireUser() is a cheap
// second factor that also gives us the user id.
export default async function SavedStablesPage() {
  const user = await requireUser();
  const stables = await listSavedStables(user.id);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pine">Saved stables</h2>
          <p className="mt-0.5 text-sm text-ink/55">
            {stables.length} {stables.length === 1 ? "stable" : "stables"} saved.
          </p>
        </div>
        <Link href="/account" className="text-sm text-brass hover:underline">
          ← Back to account
        </Link>
      </div>
      <SavedStablesGrid initial={stables} />
    </div>
  );
}
