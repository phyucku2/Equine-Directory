import { badgeLabel } from "@/lib/format";

const STYLES: Record<string, string> = {
  VERIFIED: "bg-sky-100 text-sky-800 ring-sky-200",
  TRUSTED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  PREMIUM: "bg-amber-100 text-amber-900 ring-amber-200",
};

export function VerificationBadge({ badge }: { badge: string }) {
  if (!badge || badge === "UNVERIFIED") return null;
  const cls = STYLES[badge] ?? STYLES.VERIFIED;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
      title={`${badgeLabel(badge)} listing`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.42.006l-3.5-3.5a1 1 0 1 1 1.414-1.415l2.79 2.79 6.794-6.886a1 1 0 0 1 1.416-.006Z"
          clipRule="evenodd"
        />
      </svg>
      {badgeLabel(badge)}
    </span>
  );
}
