import Link from "next/link";

// Shown in place of a tab's editor when the business lacks the entitlement. Links
// to the Plan tab where the owner can request access / upgrade. Matches the clean
// card styling used across the owner dashboard.
export function UpgradePrompt({
  slug,
  title,
  body,
  cta = "View plans",
}: {
  slug: string;
  title: string;
  body: string;
  cta?: string;
}) {
  return (
    <div className="rounded-xl border border-leather/15 bg-cream-dark/40 p-6">
      <p className="text-sm font-semibold text-pine">{title}</p>
      <p className="mt-1.5 max-w-prose text-sm text-ink/60">{body}</p>
      <Link
        href={`/owner/${slug}/plan`}
        className="mt-4 inline-block rounded-lg bg-pine px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-pine-light"
      >
        {cta} →
      </Link>
    </div>
  );
}
