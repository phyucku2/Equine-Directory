import Link from "next/link";

// Shared homepage rail heading (Zillow-style): eyebrow + title on the left,
// "See more →" on the right. `href` defaults to the map, which auto-centers on
// the visitor's area — effectively "your county" at its initial zoom.
export function RailHeading({
  eyebrow,
  title,
  href = "/map",
  linkLabel = "See more →",
}: {
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">{eyebrow}</p>
        <h2 className="mt-1 text-3xl font-semibold text-pine">{title}</h2>
      </div>
      <Link
        href={href}
        className="shrink-0 pb-1 text-sm font-medium text-brass transition hover:underline"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
