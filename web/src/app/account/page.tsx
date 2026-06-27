import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { countSavedStables } from "@/lib/db/savedStable";

// /account dashboard. The layout guards auth; requireUser() gives us the id for
// the saved-count summary. Section links match the account dropdown in AuthButton.
const SECTIONS = [
  { href: "/account/saved", label: "Saved stables", desc: "Stables you've favorited." },
  { href: "/account/searches", label: "Saved searches", desc: "Searches with email alerts." },
  { href: "/account/inquiries", label: "Inquiries", desc: "Leads you've sent to barns." },
  { href: "/account/reviews", label: "Reviews", desc: "Reviews you've written." },
  { href: "/account/notifications", label: "Notifications", desc: "Your activity feed." },
];

export default async function AccountHomePage() {
  const user = await requireUser();
  const savedCount = await countSavedStables(user.id);

  return (
    <div className="space-y-6">
      <Link
        href="/account/saved"
        className="block rounded-xl border border-leather/15 bg-pine/5 p-5 transition hover:border-brass/50"
      >
        <p className="text-sm font-semibold text-pine">Saved stables</p>
        <p className="mt-1 text-2xl font-bold text-brass">{savedCount}</p>
        <p className="mt-0.5 text-xs text-ink/55">
          {savedCount === 0 ? "Tap the heart on any listing to save it." : "View your favorites →"}
        </p>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-leather/15 bg-white p-5 transition hover:border-brass/50"
          >
            <p className="text-sm font-semibold text-pine">{s.label}</p>
            <p className="mt-1 text-xs text-ink/55">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
